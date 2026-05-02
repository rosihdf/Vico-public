import type { SupabaseClient } from '@supabase/supabase-js'
import { insertAltberichtImportEvent } from './altberichtImportEvents'
import {
  ALTBERICHT_EMBEDDED_IMAGE_PAGE_SCAN_TIMEOUT_MS,
  ALTBERICHT_EMBEDDED_IMAGE_SCAN_TIMEOUT_MS,
  ALTBERICHT_IMPORT_EVENT,
} from './altberichtImportConstants'
import {
  ALTBERICHT_PDF_IMAGE_SCAN_VERSION,
  type AltberichtEmbeddedImageDraftEnriched,
  scanAltberichtPdfForEmbeddedImagesEnriched,
} from './altberichtPdfImageScan'
import { suggestStagingObjectIdForPage, type StagingRowForImageSuggest } from './altberichtEmbeddedImageSuggest'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import type { AltberichtImportEmbeddedImageUserIntent } from './altberichtImportTypes'
import { runAltberichtRasterAnalysisForFile } from './altberichtRasterFindingsService'

const isMissingTableError = (message: string): boolean =>
  /relation|does not exist|schema cache/i.test(message)

const raceWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T> => {
  if (timeoutMs <= 0) return promise
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${timeoutLabel} (${timeoutMs} ms)`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

export const fetchStagingRowsForEmbeddedImageSuggest = async (
  client: SupabaseClient,
  fileId: string
): Promise<{ rows: StagingRowForImageSuggest[]; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_staging_object')
    .select('id, file_id, sequence, source_refs_json, media_hints_json, findings_json')
    .eq('file_id', fileId)

  if (error) return { rows: [], error: new Error(error.message) }
  return { rows: (data ?? []) as StagingRowForImageSuggest[], error: null }
}

const buildScanMetaJson = (d: AltberichtEmbeddedImageDraftEnriched) => {
  const pageArea = d.pageWidth * d.pageHeight
  const imgArea = d.width * d.height
  const pageAreaRatio = pageArea > 0 ? imgArea / pageArea : 0
  return {
    v: 1 as const,
    logoLikelihood: d.logoLikelihood,
    logoReasons: d.logoReasons,
    width: d.width,
    height: d.height,
    pageAreaRatio,
    fingerprint: d.fingerprint,
  }
}

const draftsToInserts = (
  jobId: string,
  fileId: string,
  drafts: AltberichtEmbeddedImageDraftEnriched[],
  staging: StagingRowForImageSuggest[]
) =>
  drafts.map((d) => {
    const likelyLogo = d.logoLikelihood === 'likely'
    return {
      job_id: jobId,
      file_id: fileId,
      page_number: d.pageNumber,
      image_index: d.imageIndex,
      scan_version: ALTBERICHT_PDF_IMAGE_SCAN_VERSION,
      op_kind: d.opKind,
      suggested_staging_object_id: likelyLogo
        ? null
        : suggestStagingObjectIdForPage(fileId, d.pageNumber, staging),
      user_intent: likelyLogo ? ('ignore' as const) : ('unreviewed' as const),
      linked_staging_object_id: null as string | null,
      preview_storage_path: null as string | null,
      scan_meta_json: buildScanMetaJson(d),
    }
  })

export type RunAltberichtEmbeddedImageScanOptions = {
  /** True: Bestand mit aktueller scan_version wird ignoriert; bewusst kompletter Re-Scan inkl. DELETE/INSERT. */
  force?: boolean
  /**
   * Pro fertig analysierter Seite gefeuert (auch wenn übersprungen). Der Bildscan wird damit
   * im Fortschritts-Panel nicht mehr als 75%-Block sichtbar, sondern als Seitenzähler.
   */
  onPageProgress?: (pageDone: number, pageTotal: number) => void
  /**
   * Optionaler Live-Diagnose-Hook: meldet pro erkanntem Bild auf der aktuellen Seite
   * (Seite + laufende Bildzahl). Hilft im Expertenmodus zu sehen, ob der Scan aktiv ist
   * — auch bei langsamen Seiten — statt scheinbarer Stille.
   */
  onImageProgress?: (pageNumber: number, imagesOnPage: number) => void
  /** Erlaubt dem Aufrufer, den Scan kooperativ abzubrechen (z. B. UI-Stop-Button). */
  signal?: AbortSignal
}

export type RunAltberichtEmbeddedImageScanResult = {
  count: number
  error: Error | null
  reused: boolean
  /**
   * Raster-Nachlauf nach DELETE+INSERT der Operator-Bilder ist fehlgeschlagen
   * (Block-Fotos/ZIP ggf. unvollständig trotz erfolgreichem PDF-Bildscan).
   */
  rasterRedoErrorMessage?: string | null
}

/**
 * Findet schnell heraus, ob bereits Bild-Records für die Datei vorliegen (Skip-Check).
 * Ohne `scan_version`-Filter, damit der Reparse **nichts** anrührt – manuelle Zuordnungen bleiben erhalten.
 * Veraltete `scan_version` ⇒ bewusster Re-Scan via `options.force = true`.
 */
const countExistingEmbeddedImagesForFile = async (
  client: SupabaseClient,
  fileId: string
): Promise<{ count: number; hasCurrentVersion: boolean; error: Error | null }> => {
  const { data, error } = await client
    .from('altbericht_import_embedded_image')
    .select('scan_version')
    .eq('file_id', fileId)
    .limit(1)
  if (error) return { count: 0, hasCurrentVersion: false, error: new Error(error.message) }
  const rows = data ?? []
  if (rows.length === 0) return { count: 0, hasCurrentVersion: false, error: null }

  const probe = await client
    .from('altbericht_import_embedded_image')
    .select('id', { count: 'exact', head: true })
    .eq('file_id', fileId)
    .eq('scan_version', ALTBERICHT_PDF_IMAGE_SCAN_VERSION)
  const hasCurrent = !probe.error && (probe.count ?? 0) > 0

  const total = await client
    .from('altbericht_import_embedded_image')
    .select('id', { count: 'exact', head: true })
    .eq('file_id', fileId)
  if (total.error) return { count: 0, hasCurrentVersion: hasCurrent, error: new Error(total.error.message) }
  return { count: total.count ?? 0, hasCurrentVersion: hasCurrent, error: null }
}

/**
 * Nach Text-/Staging-Parser: eingebettete Bilder zählen und Metadaten ersetzen.
 * Fehler brechen den Import nicht ab; nur Event `warn` / still bei fehlender Migration.
 *
 * Reuse-Verhalten (Reparse-sicher): Liegen bereits Records mit aktueller `scan_version` für die Datei vor,
 * wird der pdf.js-Scan **nicht** erneut ausgeführt und es werden **keine** DELETE/INSERT durchgeführt.
 * Damit bleiben manuelle Zuordnungen (`linked_staging_object_id`, `user_intent`, …) erhalten.
 * Bewusster Neuscan: `options.force = true`.
 */
export const runAltberichtEmbeddedImageScanForFile = async (
  client: SupabaseClient,
  jobId: string,
  fileId: string,
  pdfBytes: ArrayBuffer,
  options: RunAltberichtEmbeddedImageScanOptions = {}
): Promise<RunAltberichtEmbeddedImageScanResult> => {
  if (typeof window === 'undefined') {
    return { count: 0, error: null, reused: false }
  }

  if (!options.force) {
    const existing = await countExistingEmbeddedImagesForFile(client, fileId)
    if (existing.error) {
      if (!isMissingTableError(existing.error.message)) {
        await insertAltberichtImportEvent(client, {
          jobId,
          fileId,
          level: 'warn',
          code: 'import.parser.embedded_image_reuse_check_failed',
          message: existing.error.message,
        })
      }
    } else if (existing.count > 0) {
      const reuseMessage = existing.hasCurrentVersion
        ? 'PDF-Bildscan: Bestand wiederverwendet (aktuelle Scan-Version, Zuordnungen erhalten).'
        : 'PDF-Bildscan: Bestand wiederverwendet (ältere Scan-Version, Zuordnungen erhalten – manueller Neu-Scan möglich).'
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'info',
        code: ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_SCAN_REUSED,
        message: reuseMessage,
        payloadJson: {
          count: existing.count,
          hasCurrentVersion: existing.hasCurrentVersion,
          scanVersion: ALTBERICHT_PDF_IMAGE_SCAN_VERSION,
        },
      })
      return { count: existing.count, error: null, reused: true }
    }
  }

  let drafts: AltberichtEmbeddedImageDraftEnriched[] = []
  const skippedPages: { page: number; reason: string }[] = []
  try {
    drafts = await raceWithTimeout(
      scanAltberichtPdfForEmbeddedImagesEnriched(pdfBytes, {
        perPageTimeoutMs: ALTBERICHT_EMBEDDED_IMAGE_PAGE_SCAN_TIMEOUT_MS,
        onPageWarning: (pageNumber, message) => {
          skippedPages.push({ page: pageNumber, reason: message })
        },
        onPageProgress: options.onPageProgress,
        onImageProgress: options.onImageProgress,
        signal: options.signal,
      }),
      ALTBERICHT_EMBEDDED_IMAGE_SCAN_TIMEOUT_MS,
      'PDF-Bildscan-Timeout'
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const isTimeout = /PDF-Bildscan-Timeout/i.test(message)
    const isAbort = /AbortError|operation was aborted/i.test(message)
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: isTimeout
        ? 'import.parser.embedded_image_scan_timeout'
        : 'import.parser.embedded_image_scan_failed',
      message: isTimeout
        ? 'Bilder konnten nicht analysiert werden (Zeitüberschreitung). Text und Staging bleiben nutzbar.'
        : isAbort
          ? 'Bildanalyse abgebrochen (AbortError). Text und Staging bleiben nutzbar; ggf. erneut starten.'
          : 'Bilder konnten nicht analysiert werden. Text und Staging bleiben nutzbar.',
      payloadJson: {
        message,
        timeoutMs: isTimeout ? ALTBERICHT_EMBEDDED_IMAGE_SCAN_TIMEOUT_MS : undefined,
        skippedPages: skippedPages.length > 0 ? skippedPages : undefined,
      },
    })
    return { count: 0, error: new Error(message), reused: false }
  }
  if (skippedPages.length > 0) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_PAGE_SKIPPED,
      message: `Bildscan: ${skippedPages.length} Seite(n) wegen Hänger/Fehler übersprungen. Über „Seitenvorschau“ in der Position prüfbar.`,
      payloadJson: {
        skippedPages: skippedPages.map((s) => s.page),
        skippedDetails: skippedPages,
        perPageTimeoutMs: ALTBERICHT_EMBEDDED_IMAGE_PAGE_SCAN_TIMEOUT_MS,
      },
    })
  }

  const { rows: staging, error: stErr } = await fetchStagingRowsForEmbeddedImageSuggest(client, fileId)
  if (stErr) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: 'import.parser.embedded_image_staging_load_failed',
      message: stErr.message,
    })
  }

  const { error: delErr } = await client.from('altbericht_import_embedded_image').delete().eq('file_id', fileId)
  if (delErr) {
    if (isMissingTableError(delErr.message)) {
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: 'import.parser.embedded_image_table_missing',
        message:
          'Tabelle altbericht_import_embedded_image fehlt; Migration Paket E ausführen. Bildscan übersprungen.',
      })
      return { count: 0, error: null, reused: false }
    }
    return { count: 0, error: new Error(delErr.message), reused: false }
  }

  if (drafts.length === 0) {
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'info',
      code: ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_SCAN_DONE,
      message: 'PDF-Bildscan: keine eingebetteten Zeichenoperationen',
      payloadJson: { count: 0 },
    })
    return { count: 0, error: null, reused: false }
  }

  const inserts = draftsToInserts(jobId, fileId, drafts, staging)
  let { error: insErr } = await client.from('altbericht_import_embedded_image').insert(inserts)
  if (insErr && /scan_meta_json|column/i.test(insErr.message) && inserts.length > 0) {
    const bare = inserts.map(({ scan_meta_json: _m, ...rest }) => rest)
    const retry = await client.from('altbericht_import_embedded_image').insert(bare)
    insErr = retry.error
  }
  if (insErr) {
    if (isMissingTableError(insErr.message)) {
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: 'import.parser.embedded_image_table_missing',
        message:
          'Tabelle altbericht_import_embedded_image fehlt; Migration Paket E ausführen. Bildscan übersprungen.',
      })
      return { count: 0, error: null, reused: false }
    }
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: 'import.parser.embedded_image_persist_failed',
      message: insErr.message,
    })
    return { count: 0, error: new Error(insErr.message), reused: false }
  }

  await insertAltberichtImportEvent(client, {
    jobId,
    fileId,
    level: 'info',
    code: ALTBERICHT_IMPORT_EVENT.EMBEDDED_IMAGE_SCAN_DONE,
    message: 'PDF-Bildscan abgeschlossen',
    payloadJson: { count: inserts.length, scanVersion: ALTBERICHT_PDF_IMAGE_SCAN_VERSION },
  })

  /**
   * Vollständiges Replace löschte auch `block_crop` / Rohstreifen aus der Raster-Analyse.
   * Parse-Pipeline läuft Raster vor dem Operator-Bildscan; hier muss Raster nachziehen — sonst
   * Experten-Re-Scan + ZIP ohne Block-Fotos.
   */
  let rasterRedoErrorMessage: string | null = null
  try {
    const stRes = await client
      .from('altbericht_import_staging_object')
      .select('*')
      .eq('file_id', fileId)
    if (stRes.error) {
      rasterRedoErrorMessage = `Staging: ${stRes.error.message}`
      await insertAltberichtImportEvent(client, {
        jobId,
        fileId,
        level: 'warn',
        code: ALTBERICHT_IMPORT_EVENT.RASTER_ANALYSIS_FAILED,
        message: `Raster nach Bildscan: Staging konnte nicht geladen werden: ${stRes.error.message}`,
        payloadJson: { phase: 'after_embedded_scan' },
      })
    } else {
      const stagingFull = (stRes.data ?? []) as unknown as AltberichtImportStagingObjectRow[]
      const rasterBuffer = pdfBytes.slice(0)
      const rRaster = await runAltberichtRasterAnalysisForFile(
        client,
        jobId,
        fileId,
        rasterBuffer,
        stagingFull,
        {
          incrementalRasterPhotoPersist: true,
        }
      )
      if (rRaster.error) {
        rasterRedoErrorMessage = rRaster.error.message
        await insertAltberichtImportEvent(client, {
          jobId,
          fileId,
          level: 'warn',
          code: ALTBERICHT_IMPORT_EVENT.RASTER_ANALYSIS_FAILED,
          message: `Raster nach Bildscan: ${rRaster.error.message}`,
          payloadJson: { phase: 'after_embedded_scan' },
        })
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    rasterRedoErrorMessage = msg
    await insertAltberichtImportEvent(client, {
      jobId,
      fileId,
      level: 'warn',
      code: ALTBERICHT_IMPORT_EVENT.RASTER_ANALYSIS_FAILED,
      message: `Raster nach Bildscan (Ausnahme): ${msg}`,
      payloadJson: { phase: 'after_embedded_scan' },
    })
  }

  return { count: inserts.length, error: null, reused: false, rasterRedoErrorMessage }
}

export type PatchAltberichtEmbeddedImageInput = {
  userIntent: AltberichtImportEmbeddedImageUserIntent
  linkedStagingObjectId: string | null
  c2FindingKey?: string | null
}

export const patchAltberichtEmbeddedImage = async (
  id: string,
  patch: PatchAltberichtEmbeddedImageInput,
  client: SupabaseClient
): Promise<{ error: Error | null }> => {
  const up: Record<string, unknown> = {
    user_intent: patch.userIntent,
    linked_staging_object_id: patch.linkedStagingObjectId,
  }
  if (patch.c2FindingKey !== undefined) {
    up.c2_finding_key = patch.c2FindingKey
  }
  const { error } = await client.from('altbericht_import_embedded_image').update(up).eq('id', id)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

/**
 * Manueller Trigger im Expertenmodus: lädt die PDF aus Storage und startet den
 * Operator-Bildscan inkl. force-Replace. Damit kann der teure Scan ausserhalb
 * des Parse-Flows on-demand ausgeführt werden, ohne den Standard-Import zu blockieren.
 */
export const runAltberichtEmbeddedImageScanForFileById = async (
  client: SupabaseClient,
  fileId: string,
  options: RunAltberichtEmbeddedImageScanOptions = {}
): Promise<RunAltberichtEmbeddedImageScanResult> => {
  if (typeof window === 'undefined') {
    return { count: 0, error: new Error('Bildanalyse nur im Browser möglich'), reused: false }
  }
  const { data, error: loadErr } = await client
    .from('altbericht_import_file')
    .select('id, job_id, storage_bucket, storage_path')
    .eq('id', fileId)
    .single()
  if (loadErr || !data) {
    return {
      count: 0,
      error: new Error(loadErr?.message ?? 'Datei nicht gefunden'),
      reused: false,
    }
  }
  const fileRow = data as { id: string; job_id: string; storage_bucket: string; storage_path: string }
  const dl = await client.storage.from(fileRow.storage_bucket).download(fileRow.storage_path)
  if (dl.error || !dl.data) {
    return {
      count: 0,
      error: new Error(dl.error?.message ?? 'Storage-Download fehlgeschlagen'),
      reused: false,
    }
  }
  const buf = await dl.data.arrayBuffer()
  return runAltberichtEmbeddedImageScanForFile(client, fileRow.job_id, fileRow.id, buf, {
    force: true,
    ...options,
  })
}
