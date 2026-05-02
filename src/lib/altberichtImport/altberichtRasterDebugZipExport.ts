/**
 * Debug-Export: Raster-Block-Fotos als ZIP (nur Browser, nur auf Nutzeraktion).
 */
import { zipSync } from 'fflate'
import type { SupabaseClient } from '@supabase/supabase-js'

import { ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP } from './altberichtRasterGrid'
import { renderAltberichtPdfCropViewportToFullJpegBlob } from './altberichtPdfPageThumb'
import type { AltberichtRasterPhotoCropViewportPx } from './altberichtRasterBlockPhotoScan'
import type { AltberichtImportEmbeddedImageRow, AltberichtImportFileRow } from './altberichtImportTypes'
import type { AltberichtImportStagingObjectRow } from './altberichtImportQueryService'
import { getAltberichtImportPdfBufferCached } from './altberichtImportPdfDownloadCache'

/** Vor jedem neuen Export alte Blob-URLs freigeben (mehrfacher Download ohne hängenden Zustand). */
let lastRasterZipObjectUrl: string | null = null

/** Standard: volle Raster-Auflösung darf bei Extremfall länger dauern, darf aber nicht indefinit blockieren */
export const ALTBERICHT_RASTER_ZIP_ENTRY_TIMEOUT_MS_DEFAULT = 75_000

const revokeRasterZipObjectUrlSafe = (url: string): void => {
  if (typeof URL === 'undefined') return
  try {
    URL.revokeObjectURL(url)
  } catch {
    /* ignore */
  }
}

export type RasterZipEligibleFilterOpts = {
  /** Wenn false (Default): keine `block_raw_crop` / `block_raw_safety`-Debug-Zeilen. */
  includeRawDebugCrops?: boolean
}

export type AltberichtRasterZipManifestEntry = {
  jobId: string
  embeddedImageId: string
  fileId: string
  /** Original-PDF-Dateiname aus dem Auftrag */
  pdfFilename: string | null
  /** Dateiname innerhalb der ZIP (JPEG) — nur wenn exportStatus exported */
  zipEntryFilename: string
  pageNumber: number
  blockIndexOnPage: number | null
  globalRowIndex: number | null
  sequence: number | null
  logicalPhotoKey: string | null
  cropBox: AltberichtRasterPhotoCropViewportPx | null
  subtype: string | null
  suggested_staging_object_id: string | null
  linked_staging_object_id: string | null
  confidence: number | null
  qualityStatus: string | null
  attemptCount: number | null
  rasterSource: string | null
  blockAnalysisFinalStatus: string | null
  /** ok = JPEG liegt in ZIP; failed/timeout = übersprungen, siehe failureDetail */
  exportStatus?: 'exported' | 'failed' | 'timeout'
  failureDetail?: string | null
}

export type AltberichtRasterZipManifest = {
  jobId: string
  generatedAt: string
  /** Optionen dieses Laufs */
  includeRawDebugCrops: boolean
  entryTimeoutMs: number
  entries: AltberichtRasterZipManifestEntry[]
}

export const isAltberichtRasterZipExportRow = (im: AltberichtImportEmbeddedImageRow): boolean => {
  if (im.op_kind === ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP) return true
  const raw = im.scan_meta_json
  if (raw && typeof raw === 'object' && (raw as { source?: unknown }).source === 'block_crop') return true
  return false
}

/** Roh-/Safety-Streifen: nur bei expliziter Checkbox ins ZIP aufnehmen. */
export const isAltberichtRasterRawDebugZipRow = (im: AltberichtImportEmbeddedImageRow): boolean => {
  const raw = im.scan_meta_json
  if (!raw || typeof raw !== 'object') return false
  const m = raw as { rasterSource?: unknown; subtype?: unknown }
  if (m.rasterSource === 'block_raw_crop' || m.rasterSource === 'block_raw_safety') return true
  if (m.subtype === 'block_raw_safety') return true
  return false
}

export const filterAltberichtRasterPhotosZipEligibleRows = (
  images: readonly AltberichtImportEmbeddedImageRow[],
  opts?: RasterZipEligibleFilterOpts
): AltberichtImportEmbeddedImageRow[] => {
  const includeRawDebug = Boolean(opts?.includeRawDebugCrops)
  return images.filter((im) => {
    if (!isAltberichtRasterZipExportRow(im)) return false
    const raw = im.scan_meta_json
    if (!raw || typeof raw !== 'object') return false
    const m = raw as {
      photoAnalysis?: unknown
      viewportScaleUsed?: unknown
      cropViewportPx?: unknown
    }
    const viewportOk =
      m.photoAnalysis === 'viewport_crop_v2' &&
      typeof m.viewportScaleUsed === 'number' &&
      m.cropViewportPx &&
      typeof m.cropViewportPx === 'object'
    if (!viewportOk) return false
    if (!includeRawDebug && isAltberichtRasterRawDebugZipRow(im)) return false
    return true
  })
}

const safeSegment = (s: string): string =>
  String(s ?? '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^[_]+|[_]+$/g, '') || 'x'

const rasterZipRejectAfterMs = (
  ms: number
): Promise<{ kind: 'timeout' }> =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve({ kind: 'timeout' as const }), ms)
  })

export const downloadAltberichtRasterPhotosZipArchive = async (opts: {
  supabase: SupabaseClient
  jobId: string
  files: AltberichtImportFileRow[]
  staging: AltberichtImportStagingObjectRow[]
  images: AltberichtImportEmbeddedImageRow[]
  /** Default false — Roh-Streifen optional */
  includeRawDebugCrops?: boolean
  entryTimeoutMs?: number
  onProgress?: (message: string) => void
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  if (typeof document === 'undefined') return { ok: false, message: 'Nur im Browser verfügbar.' }

  if (lastRasterZipObjectUrl) {
    revokeRasterZipObjectUrlSafe(lastRasterZipObjectUrl)
    lastRasterZipObjectUrl = null
  }

  const includeRawDebugCrops = Boolean(opts.includeRawDebugCrops)
  const entryTimeoutMs = opts.entryTimeoutMs ?? ALTBERICHT_RASTER_ZIP_ENTRY_TIMEOUT_MS_DEFAULT

  const fileById = new Map(opts.files.map((f) => [f.id, f]))
  const stagingById = new Map(opts.staging.map((s) => [s.id, s]))
  const stagingSequenceOrNull = (
    stagingRow?: AltberichtImportStagingObjectRow | undefined
  ): number | null => stagingRow?.sequence ?? null

  const withCrop = filterAltberichtRasterPhotosZipEligibleRows(opts.images, { includeRawDebugCrops })

  if (withCrop.length === 0) {
    return {
      ok: false,
      message: includeRawDebugCrops
        ? 'Keine Raster-Zeilen mit viewport_crop_v2 gefunden.'
        : 'Keine Raster-Fotos ohne Roh-/Debug-Streifen (viewport_crop_v2). Optional „Roh-Crops einbeziehen“ aktivieren.',
    }
  }

  const manifest: AltberichtRasterZipManifest = {
    jobId: opts.jobId,
    generatedAt: new Date().toISOString(),
    includeRawDebugCrops,
    entryTimeoutMs,
    entries: [],
  }

  const zipFiles: Record<string, Uint8Array> = {}

  /** Pro Datei: PDF laden (Cache), dann Raster-Zeilen nacheinander verarbeiten. */
  const byFile = new Map<string, AltberichtImportEmbeddedImageRow[]>()
  for (const im of withCrop) {
    if (!byFile.has(im.file_id)) byFile.set(im.file_id, [])
    byFile.get(im.file_id)!.push(im)
  }

  let done = 0

  const usedZipNames = new Set<string>()
  const makeUniqueZipName = (want: string): string => {
    if (!usedZipNames.has(want)) {
      usedZipNames.add(want)
      return want
    }
    const dot = want.lastIndexOf('.')
    const stem = dot >= 0 ? want.slice(0, dot) : want
    const ext = dot >= 0 ? want.slice(dot) : '.jpg'
    let n = 2
    let candidate = `${stem}__${n}${ext}`
    while (usedZipNames.has(candidate)) {
      n += 1
      candidate = `${stem}__${n}${ext}`
    }
    usedZipNames.add(candidate)
    return candidate
  }

  try {
    for (const [, list] of byFile) {
      const first = list[0]
      if (!first) continue
      const fileRow = fileById.get(first.file_id)
      if (!fileRow) continue

      const pdfKey = `${fileRow.storage_bucket}:${fileRow.storage_path}`
      opts.onProgress?.(`PDF laden: ${fileRow.original_filename}`)
      const buf = await getAltberichtImportPdfBufferCached(
        opts.supabase,
        fileRow.storage_bucket,
        fileRow.storage_path
      )
      if (!buf) {
        return { ok: false, message: `PDF konnte nicht geladen werden (${fileRow.original_filename}).` }
      }

      for (const im of list.sort((a, b) =>
        a.page_number !== b.page_number
          ? a.page_number - b.page_number
          : (a.image_index ?? 0) - (b.image_index ?? 0)
      )) {
        done += 1
        opts.onProgress?.(`Raster ${done}/${withCrop.length} · ${fileRow.original_filename} · S.${im.page_number}`)

        const rawMeta = im.scan_meta_json && typeof im.scan_meta_json === 'object' ? im.scan_meta_json : {}
        const m = rawMeta as {
          viewportScaleUsed?: unknown
          cropViewportPx?: unknown
          blockIndexOnPage?: unknown
          globalRowIndex?: unknown
          photoIndexInBlock?: unknown
          logicalPhotoKey?: unknown
          confidence?: unknown
          subtype?: unknown
          qualityStatus?: unknown
          attemptCount?: unknown
          rasterSource?: unknown
          blockAnalysisFinalStatus?: unknown
        }

        const viewportScaleUsed = typeof m.viewportScaleUsed === 'number' ? m.viewportScaleUsed : 1.35
        const crop = (m.cropViewportPx ?? {}) as AltberichtRasterPhotoCropViewportPx
        const blockIx = typeof m.blockIndexOnPage === 'number' ? m.blockIndexOnPage : null
        const gri = typeof m.globalRowIndex === 'number' ? m.globalRowIndex : null

        let stagingRow =
          im.linked_staging_object_id != null ? stagingById.get(im.linked_staging_object_id) : undefined
        if (!stagingRow && im.suggested_staging_object_id) {
          stagingRow = stagingById.get(im.suggested_staging_object_id)
        }
        const seq = stagingSequenceOrNull(stagingRow) ?? gri ?? null

        const lk =
          typeof m.logicalPhotoKey === 'string' && m.logicalPhotoKey.trim()
            ? m.logicalPhotoKey.trim()
            : gri != null
              ? `${gri}.${typeof m.photoIndexInBlock === 'number' ? m.photoIndexInBlock : 1}`
              : `${im.page_number}.${im.image_index}`

        const subtypeRaw = typeof m.subtype === 'string' ? m.subtype : 'unknown'
        const blockPart = blockIx != null ? String(blockIx) : 'x'

        const base =
          safeSegment(`zeile-${seq ?? 'x'}__foto-${lk.replace(/[/\\]/g, '_')}__seite-${im.page_number}__block-${blockPart}__typ-${subtypeRaw}`)
        const filename = makeUniqueZipName(`${base}.jpg`)

        const commonFields = {
          jobId: opts.jobId,
          embeddedImageId: im.id,
          fileId: im.file_id,
          pdfFilename: fileRow.original_filename ?? null,
          zipEntryFilename: filename,
          pageNumber: im.page_number,
          blockIndexOnPage: blockIx,
          globalRowIndex: gri,
          sequence: seq,
          logicalPhotoKey: lk || null,
          cropBox:
            crop && typeof crop.sx === 'number' ? (crop as AltberichtRasterPhotoCropViewportPx) : null,
          subtype: subtypeRaw,
          suggested_staging_object_id: im.suggested_staging_object_id,
          linked_staging_object_id: im.linked_staging_object_id,
          confidence: typeof m.confidence === 'number' ? m.confidence : null,
          qualityStatus: typeof m.qualityStatus === 'string' ? m.qualityStatus : null,
          attemptCount: typeof m.attemptCount === 'number' ? m.attemptCount : null,
          rasterSource: typeof m.rasterSource === 'string' ? m.rasterSource : null,
          blockAnalysisFinalStatus:
            typeof m.blockAnalysisFinalStatus === 'string' ? m.blockAnalysisFinalStatus : null,
        }

        let exportStatus: AltberichtRasterZipManifestEntry['exportStatus'] = 'exported'
        let failureDetail: string | null = null

        try {
          /** Ohne UI-Preview-Warteschlange: sonst blockiert ein ZIP-Eintrag alle Raster-Thumbnails und kann „bei 1/N“ hängen bleiben. */
          const renderP = renderAltberichtPdfCropViewportToFullJpegBlob(
            buf,
            im.page_number,
            viewportScaleUsed,
            crop as AltberichtRasterPhotoCropViewportPx,
            { pdfCacheKey: pdfKey, jpegQuality: 0.92 }
          )
          const raced = await Promise.race([
            renderP.then((blob) => ({ kind: 'rendered' as const, blob })),
            rasterZipRejectAfterMs(entryTimeoutMs),
          ])

          if (raced.kind === 'timeout') {
            exportStatus = 'timeout'
            failureDetail = `timeout_after_${entryTimeoutMs}_ms`
          } else if (raced.blob) {
            const ab = await raced.blob.arrayBuffer()
            zipFiles[filename] = new Uint8Array(ab)
          } else {
            exportStatus = 'failed'
            failureDetail = 'render_returned_null'
          }
        } catch (e) {
          exportStatus = 'failed'
          failureDetail = e instanceof Error ? e.message : String(e)
        }

        manifest.entries.push({
          ...commonFields,
          exportStatus,
          ...(failureDetail != null ? { failureDetail } : {}),
        })
      }
    }

    manifest.entries.sort((a, b) =>
      a.pageNumber !== b.pageNumber
        ? a.pageNumber - b.pageNumber
        : a.embeddedImageId.localeCompare(b.embeddedImageId)
    )

    zipFiles['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2))

    const zipped = zipSync(zipFiles, { level: 6 })
    const outBlob = new Blob([new Uint8Array(zipped)], { type: 'application/zip' })
    const url = URL.createObjectURL(outBlob)
    lastRasterZipObjectUrl = url
    const a = document.createElement('a')
    const safeJob = safeSegment(opts.jobId).slice(0, 48)
    a.href = url
    a.download = `raster-fotos-${safeJob}.zip`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()

    /** Länger als die Default-Dauer: zweiter Export startet ohne dass der erste Download revoke trifft. */
    window.setTimeout(() => {
      revokeRasterZipObjectUrlSafe(url)
      if (lastRasterZipObjectUrl === url) lastRasterZipObjectUrl = null
    }, Math.max(entryTimeoutMs * 4, 45_000))

    opts.onProgress?.('ZIP fertig')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}
