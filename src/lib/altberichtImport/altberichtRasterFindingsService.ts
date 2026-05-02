/**
 * Raster-Persistenz: schreibt block-genaue Mängel in `findings_json` der passenden
 * Staging-Zeile und legt einen leichten Block-Foto-Stub in
 * `altbericht_import_embedded_image` ab.
 *
 * Wichtig:
 * - **C1-Parser bleibt unangetastet.** Diese Datei ergänzt nur additiv.
 * - **C2-Service bleibt unangetastet.** Wir schreiben nur in `findings_json`,
 *   die bestehende C2-Liste/UI greift sie automatisch über
 *   `listAltberichtC2FindingRows` ab.
 * - **Idempotent:** beim erneuten Lauf werden nur Findings mit Source
 *   `block_status*` ersetzt, alle anderen Parser-Sources bleiben stabil.
 *   Block-Foto-Stubs werden per Upsert auf (file_id, page_number, image_index)
 *   gemerged — manuelle Zuordnungen bleiben erhalten.
 * - **Keine Migration nötig:** Die DB-Spalte `op_kind` ist `text` ohne CHECK,
 *   `image_index` ist Bestandteil eines Unique-Keys (file_id, page_number,
 *   image_index). Wir nutzen einen reservierten image_index-Bereich
 *   (≥ 1100, siehe `computeAltberichtRasterImageIndex`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { ALTBERICHT_IMPORT_EVENT } from './altberichtImportConstants'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import {
  filterAltberichtRasterBlockStatusText,
  isAltberichtRasterFindingSource,
  ALTBERICHT_RASTER_FINDING_SOURCE_ACCEPT,
  ALTBERICHT_RASTER_FINDING_SOURCE_SUSPECT,
} from './altberichtRasterStatusFilter'

import { ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP } from './altberichtRasterGrid'

import {
  flattenAltberichtRasterBlocks,
  matchAltberichtRasterBlocksToStagingRows,
  runAltberichtRasterScanForPdf,
  type AltberichtRasterScanOptions,
  type AltberichtRasterPageData,
  type AltberichtRasterBlockData,
} from './altberichtRasterScan'
import {
  runAltberichtRasterBlockPhotoAnalysis,
  type RasterBlockPhotoProgressEvent,
} from './altberichtRasterBlockPhotoScan'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'

const isMissingTableError = (message: string): boolean =>
  /relation|does not exist|schema cache/i.test(message)

/**
 * Mergeresultat-Objekt für `findings_json` einer Staging-Zeile.
 *
 * Strategie:
 * - Alle vorhandenen Items mit `source` ∈ Raster-Quellen werden entfernt
 *   (Re-Run-sicher).
 * - Alle anderen Items (Parser-Findings) bleiben bestehen.
 * - Neue Block-Status-Findings werden hinten angehängt.
 */
export const mergeAltberichtBlockStatusFindings = (
  existing: unknown,
  newBlockStatusFindings: ReadonlyArray<{
    text: string
    source:
      | typeof ALTBERICHT_RASTER_FINDING_SOURCE_ACCEPT
      | typeof ALTBERICHT_RASTER_FINDING_SOURCE_SUSPECT
    sequence?: number
    confidence?: number
    sourceRefs?: Array<{ page?: number; snippet?: string }>
  }>
): unknown[] => {
  const baseArr: unknown[] = Array.isArray(existing) ? (existing as unknown[]) : []
  const kept = baseArr.filter((item) => {
    if (!item || typeof item !== 'object') return true
    const src = (item as { source?: unknown }).source
    return !isAltberichtRasterFindingSource(src)
  })
  return [...kept, ...newBlockStatusFindings]
}

export type AltberichtRasterAnalysisResult = {
  /** Gemergte Block-Status-Mängel-Items über alle Staging-Zeilen dieser Datei. */
  blockStatusFindingsAdded: number
  /** Davon vom Filter als „prüfpflichtig" eingestuft (suspect). */
  blockStatusSuspectCount: number
  /** Block-Foto-Stubs (op_kind = block_crop), die der Datei zugeordnet wurden. */
  blockCropsRegistered: number
  /** Seiten, deren pdf.js-TextContent fehlerhaft war und übersprungen wurden. */
  failedPages: number[]
  /** Anzahl Blöcke, die keiner Staging-Zeile zugeordnet werden konnten (typ. trailing-empty). */
  unmatchedBlocks: number
}

export type RunAltberichtRasterAnalysisOptions = AltberichtRasterScanOptions & {
  /**
   * Wenn `false`, werden Block-Foto-Stubs **nicht** angelegt (nur Status-Findings).
   * Default: `true` — die Stubs sind die Quelle des Standardmodus-Ausschnitts mit
   * logischem Foto-Key.
   */
  registerBlockCrops?: boolean
  /** Fortschritt während Raster-Foto-Analyse (rechter Streifen, Segmente je Block). */
  onBlockPhotoProgress?: (e: RasterBlockPhotoProgressEvent) => void
  /**
   * Wenn nicht `false` (Default): Raster-Fotozeilen werden **nach jedem Positionsblock** per Upsert geschrieben
   * und zwischen Blöcken an den Event Loop abgegeben (stabiler bei großen PDFs).
   */
  incrementalRasterPhotoPersist?: boolean
  /** Optional: eigenes Yield (Offline/Tests); sonst requestAnimationFrame + 0ms Timeout. */
  rasterYieldToMain?: () => void | Promise<void>
}

/**
 * Hauptfunktion: führt den Raster-Scan für eine PDF-Datei aus, schreibt
 * Block-Status in `findings_json` der jeweils passenden Staging-Zeile und legt
 * Block-Crop-Stubs in `altbericht_import_embedded_image` an.
 */
export const runAltberichtRasterAnalysisForFile = async (
  client: SupabaseClient,
  jobId: string,
  fileId: string,
  pdfBytes: ArrayBuffer,
  staging: ReadonlyArray<AltberichtImportStagingObjectRow>,
  options: RunAltberichtRasterAnalysisOptions = {}
): Promise<{ result: AltberichtRasterAnalysisResult; error: Error | null }> => {
  if (typeof window === 'undefined') {
    return {
      result: {
        blockStatusFindingsAdded: 0,
        blockStatusSuspectCount: 0,
        blockCropsRegistered: 0,
        failedPages: [],
        unmatchedBlocks: 0,
      },
      error: null,
    }
  }

  const stagingForFile = staging.filter((s) => s.file_id === fileId)
  const stagingRowIdsBySequence = new Map<number, string>()
  for (const row of stagingForFile) {
    if (typeof row.sequence === 'number' && row.sequence >= 1) {
      stagingRowIdsBySequence.set(row.sequence, row.id)
    }
  }

  let pages: AltberichtRasterPageData[] = []
  let failedPages: number[] = []
  try {
    const r = await runAltberichtRasterScanForPdf(pdfBytes, {
      onProgress: options.onProgress,
      onPageDone: options.onPageDone,
      perPageTimeoutMs: options.perPageTimeoutMs,
      signal: options.signal,
    })
    pages = r.pages
    failedPages = r.failedPages
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: ALTBERICHT_IMPORT_EVENT.RASTER_ANALYSIS_FAILED,
      message: `Rasteranalyse fehlgeschlagen: ${message}`,
      payloadJson: { message },
    })
    return {
      result: {
        blockStatusFindingsAdded: 0,
        blockStatusSuspectCount: 0,
        blockCropsRegistered: 0,
        failedPages: [],
        unmatchedBlocks: 0,
      },
      error: e instanceof Error ? e : new Error(message),
    }
  }

  const flat: AltberichtRasterBlockData[] = flattenAltberichtRasterBlocks(pages)
  const matched = matchAltberichtRasterBlocksToStagingRows(flat, stagingRowIdsBySequence)
  const unmatchedBlocks = flat.length - matched.length

  const findingsByRowId = new Map<string, Array<{
    text: string
    source:
      | typeof ALTBERICHT_RASTER_FINDING_SOURCE_ACCEPT
      | typeof ALTBERICHT_RASTER_FINDING_SOURCE_SUSPECT
    sequence: number
    confidence: number
    sourceRefs: Array<{ page: number; snippet: string }>
  }>>()
  let blockStatusSuspectCount = 0

  for (const block of matched) {
    if (block.isEmpty) continue
    const filter = filterAltberichtRasterBlockStatusText(block.rawText)
    if (filter.kind === 'reject') continue
    if (!findingsByRowId.has(block.stagingRowId)) findingsByRowId.set(block.stagingRowId, [])
    findingsByRowId.get(block.stagingRowId)!.push({
      text: filter.text,
      source:
        filter.kind === 'accept'
          ? ALTBERICHT_RASTER_FINDING_SOURCE_ACCEPT
          : ALTBERICHT_RASTER_FINDING_SOURCE_SUSPECT,
      sequence: block.globalRowIndex,
      confidence: filter.kind === 'accept' ? 0.85 : 0.45,
      sourceRefs: [
        {
          page: block.pageNumber,
          snippet: block.rawText.slice(0, 220),
        },
      ],
    })
    if (filter.kind === 'suspect') blockStatusSuspectCount += 1
  }

  let blockStatusFindingsAdded = 0

  /**
   * Findings-Updates pro Zeile schreiben. Bewusst sequenziell (kleine Mengen) und
   * mit lokalem Merge — so bleiben Parser-Findings (`status`, `document_defect_list`)
   * stabil und nur block_status-Items werden ersetzt.
   */
  for (const row of stagingForFile) {
    const newFindings = findingsByRowId.get(row.id) ?? []
    const existing = row.findings_json
    const existingHasRaster =
      Array.isArray(existing) &&
      (existing as unknown[]).some(
        (it) =>
          it && typeof it === 'object' && isAltberichtRasterFindingSource((it as { source?: unknown }).source)
      )
    if (newFindings.length === 0 && !existingHasRaster) continue
    const merged = mergeAltberichtBlockStatusFindings(existing, newFindings)
    const { error: updErr } = await client
      .from('altbericht_import_staging_object')
      .update({ findings_json: merged })
      .eq('id', row.id)
    if (updErr) {
      if (isMissingTableError(updErr.message)) {
        await insertAltberichtImportEvent(client, {
          jobId,
          fileId,
          stagingObjectId: row.id,
          level: 'warn',
          code: ALTBERICHT_IMPORT_EVENT.RASTER_FINDINGS_UPDATE_FAILED,
          message: `findings_json-Update fehlgeschlagen (Tabelle/Spalte fehlt): ${updErr.message}`,
        })
        break
      }
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        stagingObjectId: row.id,
        level: 'warn',
        code: ALTBERICHT_IMPORT_EVENT.RASTER_FINDINGS_UPDATE_FAILED,
        message: updErr.message,
      })
      continue
    }
    blockStatusFindingsAdded += newFindings.length
  }

  let blockCropsRegistered = 0
  if (options.registerBlockCrops !== false) {
    /** Alte Raster-Block-Stubs ohne gemischten Operator-Zugriff löschen → Re-Scan frisch gemäß scan_version */
    const { error: delBlockCropErr } = await client
      .from('altbericht_import_embedded_image')
      .delete()
      .eq('file_id', fileId)
      .eq('op_kind', ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP)
    if (delBlockCropErr && !isMissingTableError(delBlockCropErr.message)) {
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: ALTBERICHT_IMPORT_EVENT.RASTER_BLOCK_CROP_PERSIST_FAILED,
        message: `Raster: alte block_crop-Einträge konnten nicht gelöscht werden: ${delBlockCropErr.message}`,
      })
    }

    const photoBlocks = matched.filter((b) => !b.isEmpty)
    try {
      const incremental = options.incrementalRasterPhotoPersist !== false
      const defaultRasterYield = async (): Promise<void> => {
        await new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => resolve())
          } else {
            setTimeout(resolve, 0)
          }
        })
      }
      const { inserts } = await runAltberichtRasterBlockPhotoAnalysis(pdfBytes, fileId, jobId, photoBlocks, {
        pageTotal: Math.max(1, pages.length),
        onBlockPhotoProgress: options.onBlockPhotoProgress,
        yieldToMain: async () => {
          if (options.rasterYieldToMain) {
            await options.rasterYieldToMain()
          } else {
            await defaultRasterYield()
          }
        },
        onPersistBlock: incremental
          ? async (rows) => {
              if (rows.length === 0) return
              const { error: blockUpErr } = await client
                .from('altbericht_import_embedded_image')
                .upsert(rows, { onConflict: 'file_id,page_number,image_index', ignoreDuplicates: false })
              if (!blockUpErr) return
              if (isMissingTableError(blockUpErr.message)) {
                await insertAltberichtImportEvent(client, {
                  jobId,
                  fileId,
                  level: 'warn',
                  code: ALTBERICHT_IMPORT_EVENT.RASTER_BLOCK_CROP_PERSIST_FAILED,
                  message:
                    'Tabelle altbericht_import_embedded_image fehlt; Migration Paket E ausführen. Block-Crops übersprungen.',
                })
              } else {
                await insertAltberichtImportEvent(client, {
                  jobId,
                  fileId,
                  level: 'warn',
                  code: ALTBERICHT_IMPORT_EVENT.RASTER_BLOCK_CROP_PERSIST_FAILED,
                  message: blockUpErr.message,
                })
              }
            }
          : undefined,
      })
      if (inserts.length > 0) {
        if (!incremental) {
          const { error: upErr } = await client
            .from('altbericht_import_embedded_image')
            .upsert(inserts, { onConflict: 'file_id,page_number,image_index', ignoreDuplicates: false })
          if (upErr) {
            if (isMissingTableError(upErr.message)) {
              await insertAltberichtImportEvent(client, {
                jobId,
                fileId,
                level: 'warn',
                code: ALTBERICHT_IMPORT_EVENT.RASTER_BLOCK_CROP_PERSIST_FAILED,
                message:
                  'Tabelle altbericht_import_embedded_image fehlt; Migration Paket E ausführen. Block-Crops übersprungen.',
              })
            } else {
              await insertAltberichtImportEvent(client, {
                jobId,
                fileId,
                level: 'warn',
                code: ALTBERICHT_IMPORT_EVENT.RASTER_BLOCK_CROP_PERSIST_FAILED,
                message: upErr.message,
              })
            }
          } else {
            blockCropsRegistered = inserts.length
          }
        } else {
          blockCropsRegistered = inserts.length
        }
      }
    } catch (cropErr) {
      const cm = cropErr instanceof Error ? cropErr.message : String(cropErr)
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: ALTBERICHT_IMPORT_EVENT.RASTER_BLOCK_CROP_PERSIST_FAILED,
        message: `Raster-Fotoanalyse konnte nicht geschrieben werden: ${cm}`,
      })
    }
  }

  await insertAltberichtImportEvent(client, {
    jobId,
    fileId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.RASTER_ANALYSIS_DONE,
    message: 'Rasteranalyse abgeschlossen',
    payloadJson: {
      blockStatusFindingsAdded,
      blockStatusSuspectCount,
      blockCropsRegistered,
      failedPages,
      unmatchedBlocks,
      pageCount: pages.length,
      blocksMatched: matched.length,
      blocksTotal: flat.length,
    },
  })

  return {
    result: {
      blockStatusFindingsAdded,
      blockStatusSuspectCount,
      blockCropsRegistered,
      failedPages,
      unmatchedBlocks,
    },
    error: null,
  }
}

/**
 * On-Demand-Variante: lädt PDF aus Storage + Staging selbst und triggert die Analyse.
 * Wird vom Expertenmodus genutzt, falls der Standard-Parse-Lauf den Raster-Schritt
 * noch nicht hatte (z. B. ältere Importe).
 */
export const runAltberichtRasterAnalysisForFileById = async (
  client: SupabaseClient,
  fileId: string,
  options: RunAltberichtRasterAnalysisOptions = {}
): Promise<{ result: AltberichtRasterAnalysisResult; error: Error | null }> => {
  if (typeof window === 'undefined') {
    return {
      result: {
        blockStatusFindingsAdded: 0,
        blockStatusSuspectCount: 0,
        blockCropsRegistered: 0,
        failedPages: [],
        unmatchedBlocks: 0,
      },
      error: new Error('Rasteranalyse nur im Browser möglich'),
    }
  }

  const { data: file, error: fileErr } = await client
    .from('altbericht_import_file')
    .select('id, job_id, storage_bucket, storage_path')
    .eq('id', fileId)
    .single()
  if (fileErr || !file) {
    return {
      result: {
        blockStatusFindingsAdded: 0,
        blockStatusSuspectCount: 0,
        blockCropsRegistered: 0,
        failedPages: [],
        unmatchedBlocks: 0,
      },
      error: new Error(fileErr?.message ?? 'Datei nicht gefunden'),
    }
  }
  const fileRow = file as { id: string; job_id: string; storage_bucket: string; storage_path: string }

  const dl = await client.storage.from(fileRow.storage_bucket).download(fileRow.storage_path)
  if (dl.error || !dl.data) {
    return {
      result: {
        blockStatusFindingsAdded: 0,
        blockStatusSuspectCount: 0,
        blockCropsRegistered: 0,
        failedPages: [],
        unmatchedBlocks: 0,
      },
      error: new Error(dl.error?.message ?? 'Storage-Download fehlgeschlagen'),
    }
  }
  const pdfBytes = await dl.data.arrayBuffer()

  const { data: stagingData, error: stErr } = await client
    .from('altbericht_import_staging_object')
    .select('*')
    .eq('file_id', fileRow.id)
  if (stErr) {
    return {
      result: {
        blockStatusFindingsAdded: 0,
        blockStatusSuspectCount: 0,
        blockCropsRegistered: 0,
        failedPages: [],
        unmatchedBlocks: 0,
      },
      error: new Error(stErr.message),
    }
  }
  const staging = (stagingData ?? []) as unknown as AltberichtImportStagingObjectRow[]

  return runAltberichtRasterAnalysisForFile(
    client,
    fileRow.job_id,
    fileRow.id,
    pdfBytes,
    staging,
    options
  )
}
