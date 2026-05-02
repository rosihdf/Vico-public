import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../../supabase'
import { useToast } from '../../ToastContext'
import {
  patchAltberichtEmbeddedImage,
  runAltberichtEmbeddedImageScanForFileById,
} from '../../lib/altberichtImport/altberichtImportEmbeddedImageService'
import { importEmbeddedImageProductive } from '../../lib/altberichtImport/altberichtImportEmbeddedImageProductiveService'
import { listAltberichtC2FindingRows } from '../../lib/altberichtImport/altberichtImportC2DefectService'
import { altberichtToastTypeForCode } from '../../lib/altberichtImport/altberichtImportToastMap'
import type {
  AltberichtImportEmbeddedImageRow,
  AltberichtImportEmbeddedImageUserIntent,
  AltberichtImportFileRow,
} from '../../lib/altberichtImport'
import type { AltberichtImportStagingObjectRow } from '../../lib/altberichtImport/altberichtImportQueryService'
import {
  findDuplicateEmbeddedImportForTarget,
  getAltberichtEmbeddedImagePrimaryKind,
  getEmbeddedImageLogoLikelihood,
  isAltberichtRasterRawCropSafetyRow,
  primaryKindLabelDe,
} from '../../lib/altberichtImport/altberichtImportEmbeddedImageRowUi'
import {
  downloadAltberichtRasterPhotosZipArchive,
  filterAltberichtRasterPhotosZipEligibleRows,
  isAltberichtRasterRawDebugZipRow,
  isAltberichtRasterZipExportRow,
} from '../../lib/altberichtImport/altberichtRasterDebugZipExport'
import { AltberichtEmbeddedImagePreviewThumb } from './AltberichtEmbeddedImagePreviewThumb'

type AltberichtExpertEmbeddedImagesPanelProps = {
  jobId: string
  files: AltberichtImportFileRow[]
  images: AltberichtImportEmbeddedImageRow[]
  staging: AltberichtImportStagingObjectRow[]
  imageLoadError: string | null
  busy: boolean
  onPatched: () => void
}

const intentLabels: { value: AltberichtImportEmbeddedImageUserIntent; label: string }[] = [
  { value: 'unreviewed', label: 'Ungeprüft' },
  { value: 'ignore', label: 'Ignorieren' },
  { value: 'object_photo', label: 'Mögliches Objektfoto' },
  { value: 'defect_photo', label: 'Mögliches Mängelfoto' },
]

export const AltberichtExpertEmbeddedImagesPanel = ({
  jobId,
  files,
  images,
  staging,
  imageLoadError,
  busy,
  onPatched,
}: AltberichtExpertEmbeddedImagesPanelProps) => {
  const { showToast, showError } = useToast()
  const [importBusy, setImportBusy] = useState(false)
  const [previewSourceById, setPreviewSourceById] = useState<
    Record<string, 'embedded_image' | 'page' | undefined>
  >({})
  const [pageFallbackOk, setPageFallbackOk] = useState<Record<string, boolean>>({})
  const [scanBusyFileId, setScanBusyFileId] = useState<string | null>(null)
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null)
  const [scanCurrentImage, setScanCurrentImage] = useState<{ page: number; image: number } | null>(
    null
  )
  const [rasterZipBusy, setRasterZipBusy] = useState(false)
  const [rasterZipHint, setRasterZipHint] = useState<string | null>(null)
  const [zipIncludeRawRaster, setZipIncludeRawRaster] = useState(false)

  const runScanForFile = useCallback(
    async (fileId: string) => {
      setScanBusyFileId(fileId)
      setScanProgress(null)
      setScanCurrentImage(null)
      try {
        const r = await runAltberichtEmbeddedImageScanForFileById(supabase, fileId, {
          force: true,
          onPageProgress: (done, total) => setScanProgress({ done, total }),
          onImageProgress: (page, imagesOnPage) =>
            setScanCurrentImage({ page, image: imagesOnPage }),
        })
        if (r.error) {
          showError(`Bildanalyse fehlgeschlagen: ${r.error.message}`)
        } else {
          showToast(
            `Bildanalyse abgeschlossen (${r.count} Bild(er) erfasst).`,
            altberichtToastTypeForCode('imported')
          )
          if (r.rasterRedoErrorMessage) {
            showToast(
              `Raster-Nachlauf: ${r.rasterRedoErrorMessage}`,
              'warning'
            )
          }
          onPatched()
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        showError(`Bildanalyse abgebrochen: ${msg}`)
      } finally {
        setScanBusyFileId(null)
        setScanProgress(null)
        setScanCurrentImage(null)
      }
    },
    [onPatched, showError, showToast]
  )

  const stagingById = new Map(staging.map((s) => [s.id, s]))
  const stagingForFile = (fileId: string) =>
    staging.filter((s) => s.file_id === fileId).sort((a, b) => a.sequence - b.sequence)

  const handlePreviewMeta = useCallback((imageId: string) => {
    return (meta: { source: 'embedded_image' | 'page' } | null) => {
      setPreviewSourceById((prev) => {
        const next = { ...prev }
        if (meta?.source) next[imageId] = meta.source
        else delete next[imageId]
        return next
      })
    }
  }, [])

  const patchRow = useCallback(
    async (
      row: AltberichtImportEmbeddedImageRow,
      partial: { userIntent?: AltberichtImportEmbeddedImageUserIntent; linkedId?: string | null; c2?: string | null }
    ) => {
      const userIntent = partial.userIntent ?? row.user_intent
      const linked =
        partial.linkedId !== undefined ? partial.linkedId : row.linked_staging_object_id
      const c2Raw =
        partial.c2 !== undefined ? partial.c2 : row.c2_finding_key
      const c2FindingKey = userIntent === 'defect_photo' ? c2Raw : null
      const { error } = await patchAltberichtEmbeddedImage(
        row.id,
        {
          userIntent,
          linkedStagingObjectId: linked ?? null,
          c2FindingKey,
        },
        supabase
      )
      if (!error) onPatched()
    },
    [onPatched]
  )

  const onIntentChange = useCallback(
    async (row: AltberichtImportEmbeddedImageRow, userIntent: AltberichtImportEmbeddedImageUserIntent) => {
      await patchRow(row, { userIntent })
    },
    [patchRow]
  )

  const onLinkChange = useCallback(
    async (row: AltberichtImportEmbeddedImageRow, linkedId: string) => {
      const v = linkedId === '' ? null : linkedId
      await patchRow(row, { linkedId: v })
    },
    [patchRow]
  )

  const onC2Change = useCallback(
    async (row: AltberichtImportEmbeddedImageRow, key: string) => {
      const v = key === '' ? null : key
      await patchRow(row, { c2: v })
    },
    [patchRow]
  )

  const runOne = useCallback(
    async (row: AltberichtImportEmbeddedImageRow) => {
      setImportBusy(true)
      try {
        const r = await importEmbeddedImageProductive(row.id)
        if (r.ok && r.code === 'imported') {
          showToast('Übernommen.', altberichtToastTypeForCode('imported'))
        } else if (r.ok && r.code === 'already_imported') {
          showToast('Bereits übernommen.', altberichtToastTypeForCode('already_imported'))
        } else {
          showError(r.message ?? 'Übernahme nicht möglich.')
        }
      } finally {
        setImportBusy(false)
        onPatched()
      }
    },
    [onPatched, showToast, showError]
  )

  const locked = busy || importBusy

  const zipEligibleStandardRows = useMemo(
    () => filterAltberichtRasterPhotosZipEligibleRows(images, { includeRawDebugCrops: false }),
    [images]
  )
  const zipEligibleWithRawRows = useMemo(
    () => filterAltberichtRasterPhotosZipEligibleRows(images, { includeRawDebugCrops: true }),
    [images]
  )
  const zipRawDebugExtraCount = Math.max(
    0,
    zipEligibleWithRawRows.length - zipEligibleStandardRows.length
  )
  const rasterDebugRowsInDb = useMemo(
    () =>
      images.filter((im) => isAltberichtRasterZipExportRow(im) && isAltberichtRasterRawDebugZipRow(im)).length,
    [images]
  )
  const rasterBlockRowsTotal = useMemo(() => images.filter((im) => isAltberichtRasterZipExportRow(im)).length, [
    images,
  ])
  const rasterZipExportRows = zipIncludeRawRaster ? zipEligibleWithRawRows : zipEligibleStandardRows
  const rasterZipExportCount = rasterZipExportRows.length

  const zipStdNeedsReviewCount = useMemo(
    () =>
      zipEligibleStandardRows.filter((im) => {
        const raw = im.scan_meta_json
        if (!raw || typeof raw !== 'object') return false
        return (raw as { qualityStatus?: unknown }).qualityStatus === 'needs_review'
      }).length,
    [zipEligibleStandardRows]
  )

  const zipStdFallbackRasterCount = useMemo(
    () =>
      zipEligibleStandardRows.filter((im) => {
        const raw = im.scan_meta_json
        if (!raw || typeof raw !== 'object') return false
        const m = raw as { blockAnalysisFinalStatus?: unknown; rasterPositionsFallback?: unknown }
        return m.blockAnalysisFinalStatus === 'fallback_used' || m.rasterPositionsFallback === true
      }).length,
    [zipEligibleStandardRows]
  )

  const handleRasterZipExport = async () => {
    if (typeof window === 'undefined') return
    setRasterZipBusy(true)
    setRasterZipHint(null)
    try {
      const r = await downloadAltberichtRasterPhotosZipArchive({
        supabase,
        jobId,
        files,
        staging,
        images,
        includeRawDebugCrops: zipIncludeRawRaster,
        onProgress: (m) => setRasterZipHint(m),
      })
      if (!r.ok) {
        showError(r.message)
      } else {
        showToast(
          'ZIP mit Raster-Fotos erzeugt — Download sollte starten.',
          altberichtToastTypeForCode('imported')
        )
        setRasterZipHint(null)
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e))
    } finally {
      setRasterZipBusy(false)
    }
  }

  if (images.length === 0) {
    return (
      <section className="mt-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/30 p-4">
        <h3 className="font-semibold text-sm">Eingebettete PDF-Bilder (Experte)</h3>
        {imageLoadError ? (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">Metadaten: {imageLoadError}</p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Bildanalyse ist im Standardimport übersprungen worden. Pro Datei kann die Analyse
            optional gestartet werden – Text/Staging bleiben nutzbar, auch wenn der Scan abbricht.
          </p>
        )}
        {files.length > 0 ? (
          <div className="mt-3 space-y-2">
            {files.map((f) => {
              const running = scanBusyFileId === f.id
              return (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center gap-2 rounded border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 px-2 py-1.5 text-xs"
                >
                  <span className="font-mono break-all flex-1 min-w-0">{f.original_filename}</span>
                  {running && scanProgress ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      Seite {scanProgress.done}/{scanProgress.total}
                      {scanCurrentImage && scanCurrentImage.page === scanProgress.done
                        ? ` · Bild ${scanCurrentImage.image}`
                        : ''}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || scanBusyFileId != null}
                    className="rounded bg-slate-700 text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
                    onClick={() => void runScanForFile(f.id)}
                  >
                    {running ? 'Analyse läuft …' : 'Bildanalyse starten'}
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}
      </section>
    )
  }

  const byFile = new Map<string, AltberichtImportEmbeddedImageRow[]>()
  for (const im of images) {
    if (!byFile.has(im.file_id)) byFile.set(im.file_id, [])
    byFile.get(im.file_id)!.push(im)
  }

  return (
    <section className="mt-6 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900/40 p-4">
      <div className="mb-2">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Eingebettete PDF-Bilder — Korrektur (Experte)</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          Normalerweise reicht der Block <strong>Fotos</strong> in jeder Staging-Zeile. Hier alle Bildeinträge
          inkl. ausgeblendeter Logos/Kopfgrafiken; nur bei manueller Nachjustierung nötig. Übernahme weiterhin
          nur einzeln per Klick.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={
              locked || rasterZipBusy || rasterZipExportCount === 0 || scanBusyFileId != null
            }
            className="rounded bg-slate-800 text-white px-2.5 py-1 text-xs font-medium hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
            onClick={() => void handleRasterZipExport()}
          >
            {rasterZipBusy ? 'ZIP wird erzeugt …' : 'Raster-Fotos als ZIP herunterladen'}
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400 select-none">
            <input
              type="checkbox"
              className="rounded border border-slate-400 dark:border-slate-600"
              checked={zipIncludeRawRaster}
              disabled={
                rasterZipBusy || locked || zipRawDebugExtraCount === 0 || scanBusyFileId != null
              }
              onChange={(e) => setZipIncludeRawRaster(e.target.checked)}
            />
            Roh-Crops / Debug-Streifen einschließen
          </label>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xl leading-snug space-y-0.5 inline-block align-middle">
            <span className="block">
              <strong>{zipEligibleStandardRows.length}</strong> nutzbare Positionsfotos (Standard-ZIP, manifest.json)
              {' · '}
              <strong>{rasterDebugRowsInDb}</strong> Roh-/Debug-Zeilen gesamt
              {zipRawDebugExtraCount > 0 ? (
                <span>
                  {' '}
                  (davon <strong>{zipRawDebugExtraCount}</strong> ZIP-fähig mit Checkbox „Roh-Crops …“)
                </span>
              ) : null}
              {' · '}
              <span className="text-slate-400 dark:text-slate-500">
                Raster-/Block-Zeilen gesamt (Metadaten): <strong>{rasterBlockRowsTotal}</strong>
              </span>
              {zipStdNeedsReviewCount > 0 ? (
                <span>
                  · <strong>{zipStdNeedsReviewCount}</strong> mit Prüfhinweis (needs_review)
                </span>
              ) : null}
              {zipStdFallbackRasterCount > 0 ? (
                <span>
                  · <strong>{zipStdFallbackRasterCount}</strong> mit Raster-/Positions-Fallback
                </span>
              ) : null}
            </span>
            {rasterZipHint ? <span className="block text-slate-600 dark:text-slate-300">· {rasterZipHint}</span> : null}
          </span>
        </div>
      </div>
      {imageLoadError ? (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2">Metadaten: {imageLoadError} (Migration E/F?)</p>
      ) : null}

      <div className="space-y-4">
        {Array.from(byFile.entries()).map(([fileId, list]) => {
          const f = files.find((x) => x.id === fileId)
          const rows = stagingForFile(fileId)
          if (!f) return null
          const running = scanBusyFileId === f.id
          return (
            <div key={fileId} className="rounded border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-900/50 p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="text-sm font-medium break-all flex-1 min-w-0">{f.original_filename}</div>
                {running && scanProgress ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Seite {scanProgress.done}/{scanProgress.total}
                    {scanCurrentImage && scanCurrentImage.page === scanProgress.done
                      ? ` · Bild ${scanCurrentImage.image}`
                      : ''}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={busy || scanBusyFileId != null}
                  className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                  onClick={() => void runScanForFile(fileId)}
                  title="Vollständigen Operator-Bildscan für diese Datei erneut starten"
                >
                  {running ? 'Analyse läuft …' : 'Bildanalyse erneut starten'}
                </button>
              </div>
              <ul className="space-y-3">
                {list.map((im) => {
                  const sugg = im.suggested_staging_object_id ? stagingById.get(im.suggested_staging_object_id) : null
                  const linked = im.linked_staging_object_id ? stagingById.get(im.linked_staging_object_id) : null
                  const resolved = linked ?? sugg
                  const committed = resolved?.committed_object_id?.trim() ?? null
                  const c2Staging = linked ?? resolved
                  const c2Rows = c2Staging ? listAltberichtC2FindingRows(c2Staging).filter((x) => x.alreadyImported) : []
                  const imported = (im.import_status ?? 'not_imported') === 'imported'
                  const failed = (im.import_status ?? 'not_imported') === 'failed'
                  const primary = getAltberichtEmbeddedImagePrimaryKind(im)
                  const previewSource = previewSourceById[im.id]
                  const dup = findDuplicateEmbeddedImportForTarget(im, images, committed)
                  const logoLv = getEmbeddedImageLogoLikelihood(im)
                  const needsPageConfirm = previewSource === 'page' && !imported && !failed
                  const pageOk = Boolean(pageFallbackOk[im.id])
                  const rasterDebugRaw = isAltberichtRasterRawCropSafetyRow(im)

                  const canObject =
                    im.user_intent === 'object_photo' &&
                    Boolean(committed) &&
                    !imported &&
                    !failed &&
                    !dup &&
                    previewSource != null &&
                    !rasterDebugRaw &&
                    (!needsPageConfirm || pageOk)

                  const canDefect =
                    im.user_intent === 'defect_photo' &&
                    Boolean(committed) &&
                    Boolean(im.c2_finding_key?.trim()) &&
                    !imported &&
                    !failed &&
                    !dup &&
                    previewSource != null &&
                    !rasterDebugRaw &&
                    (!needsPageConfirm || pageOk)

                  return (
                    <li
                      key={im.id}
                      className="flex flex-col sm:flex-row gap-3 p-2 rounded border border-slate-200 dark:border-slate-600"
                    >
                      <AltberichtEmbeddedImagePreviewThumb
                        fileRow={f}
                        embeddedRow={im}
                        pageNumber={im.page_number}
                        imageIndex={im.image_index}
                        cacheBust={im.updated_at}
                        onPreviewMeta={handlePreviewMeta(im.id)}
                      />
                      <div className="flex-1 min-w-0 text-xs space-y-1">
                        <div>
                          <span className="text-slate-500">Seite / Index:</span>{' '}
                          <span className="font-mono">
                            {im.page_number} / {im.image_index}
                          </span>
                          {im.op_kind ? (
                            <span className="text-slate-500">
                              {' '}
                              · <span className="font-mono">{im.op_kind}</span>
                            </span>
                          ) : null}
                        </div>
                        <div>
                          <span className="text-slate-500">Status:</span>{' '}
                          <span className="font-medium">{primaryKindLabelDe(primary)}</span>
                          {logoLv === 'likely' ? (
                            <span className="text-slate-600 dark:text-slate-400"> · vermutlich Logo/Kopf (ausgeblendet)</span>
                          ) : null}
                          {logoLv === 'suspect' ? (
                            <span className="text-amber-800 dark:text-amber-200"> · vermutlich Logo/Kopf (prüfen)</span>
                          ) : null}
                          {rasterDebugRaw ? (
                            <span className="text-slate-500 dark:text-slate-400">
                              {' '}
                              · nur Debug/ZIP (keine Übernahme)
                            </span>
                          ) : null}
                          {previewSource === 'page' && !failed ? (
                            <span className="text-amber-800 dark:text-amber-200"> · Seitenbild-Fallback</span>
                          ) : null}
                          {dup ? (
                            <span className="text-slate-600 dark:text-slate-400"> · Bereits übernommen (Duplikat)</span>
                          ) : null}
                        </div>
                        {im.import_error ? (
                          <div className="text-red-600 dark:text-red-400 text-[11px]">{im.import_error}</div>
                        ) : null}
                        {(im.import_object_photo_id || im.import_defect_photo_id) && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                            {im.import_object_photo_id ? `object_photos: ${im.import_object_photo_id.slice(0, 8)}…` : null}
                            {im.import_defect_photo_id
                              ? `object_defect_photos: ${im.import_defect_photo_id.slice(0, 8)}…`
                              : null}
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Vorschlag Staging:</span>{' '}
                          {sugg ? (
                            <span>
                              #{sugg.sequence} · {sugg.object_name}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500">Zielobjekt (C1):</span>{' '}
                          {committed ? (
                            <span className="font-mono">{committed.slice(0, 8)}…</span>
                          ) : (
                            <span className="text-amber-800 dark:text-amber-200">— (noch kein commit)</span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                          <label className="flex flex-col text-[11px]">
                            <span className="text-slate-500">Manuelle Aktion</span>
                            <select
                              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-xs min-w-[12rem]"
                              value={im.user_intent}
                              disabled={locked || imported}
                              onChange={(e) =>
                                void onIntentChange(im, e.target.value as AltberichtImportEmbeddedImageUserIntent)
                              }
                            >
                              {intentLabels.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col text-[11px] flex-1 min-w-0">
                            <span className="text-slate-500">Verknüpfung Staging</span>
                            <select
                              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-xs w-full"
                              value={im.linked_staging_object_id ?? ''}
                              disabled={locked || imported}
                              onChange={(e) => void onLinkChange(im, e.target.value)}
                            >
                              <option value="">(Vorschlag / keine)</option>
                              {rows.map((r) => (
                                <option key={r.id} value={r.id}>
                                  #{r.sequence} {r.object_name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        {im.user_intent === 'defect_photo' ? (
                          <label className="flex flex-col text-[11px] max-w-md">
                            <span className="text-slate-500">C2-Mangel (nur importierte)</span>
                            <select
                              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-xs"
                              value={im.c2_finding_key ?? ''}
                              disabled={locked || imported || c2Rows.length === 0}
                              onChange={(e) => void onC2Change(im, e.target.value)}
                            >
                              <option value="">{c2Rows.length === 0 ? '— (erst C2-Textimport)' : '— wählen'}</option>
                              {c2Rows.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.key}: {c.commitText.slice(0, 60)}
                                  {c.commitText.length > 60 ? '…' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {needsPageConfirm ? (
                          <label className="flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-100 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={pageOk}
                              disabled={locked || imported}
                              onChange={(e) =>
                                setPageFallbackOk((s) => ({ ...s, [im.id]: e.target.checked }))
                              }
                            />
                            <span>
                              Seitenbild-Übernahme bestätigen (gesamte Seite, kein Einzelbild-Ausschnitt).
                            </span>
                          </label>
                        ) : null}
                        {!committed && (im.user_intent === 'object_photo' || im.user_intent === 'defect_photo') ? (
                          <p className="text-[11px] text-amber-800 dark:text-amber-200 m-0">
                            Fotoübernahme erst nach C1 (committed_object_id) möglich.
                          </p>
                        ) : null}
                        <div>
                          <button
                            type="button"
                            disabled={
                              locked ||
                              imported ||
                              im.user_intent === 'unreviewed' ||
                              im.user_intent === 'ignore' ||
                              (!canObject && !canDefect)
                            }
                            className="rounded bg-slate-800 text-white px-2 py-1 text-xs disabled:opacity-50"
                            onClick={() => void runOne(im)}
                            title={
                              !committed && (im.user_intent === 'object_photo' || im.user_intent === 'defect_photo')
                                ? 'Zuerst C1-Commit (committed_object_id)'
                                : im.user_intent === 'defect_photo' && !im.c2_finding_key
                                  ? 'C2-Schlüssel wählen'
                                  : dup
                                    ? 'Duplikat'
                                    : undefined
                            }
                          >
                            Jetzt übernehmen
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
