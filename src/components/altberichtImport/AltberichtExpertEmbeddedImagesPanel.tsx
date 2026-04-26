import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { useToast } from '../../ToastContext'
import { renderAltberichtPdfPageToPngDataUrl } from '../../lib/altberichtImport/altberichtPdfPageThumb'
import { patchAltberichtEmbeddedImage } from '../../lib/altberichtImport/altberichtImportEmbeddedImageService'
import {
  importAllEmbeddedImagesPendingForJob,
  importEmbeddedImageProductive,
} from '../../lib/altberichtImport/altberichtImportEmbeddedImageProductiveService'
import { listAltberichtC2FindingRows } from '../../lib/altberichtImport/altberichtImportC2DefectService'
import type {
  AltberichtImportEmbeddedImageRow,
  AltberichtImportEmbeddedImageUserIntent,
  AltberichtImportFileRow,
} from '../../lib/altberichtImport'
import type { AltberichtImportStagingObjectRow } from '../../lib/altberichtImport/altberichtImportQueryService'

const thumbInFlight = new Map<string, Promise<string | null>>()

const getThumbDataUrl = (bucket: string, path: string, page: number) => {
  const key = `${bucket}:${path}:${page}`
  const existing = thumbInFlight.get(key)
  if (existing) return existing
  const p = (async () => {
    const { data: blob, error: dl } = await supabase.storage.from(bucket).download(path)
    if (dl || !blob) return null
    const buf = await blob.arrayBuffer()
    return renderAltberichtPdfPageToPngDataUrl(buf, page)
  })()
  thumbInFlight.set(key, p)
  return p
}

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

const importStatusLabel = (im: AltberichtImportEmbeddedImageRow): string => {
  const s = im.import_status ?? 'not_imported'
  if (s === 'imported') return 'Übernommen'
  if (s === 'failed') return 'Übernahme fehlgeschlagen'
  return 'Noch nicht produktiv übernommen'
}

const PageThumb = ({
  fileRow,
  pageNumber,
  cacheKey,
}: {
  fileRow: AltberichtImportFileRow
  pageNumber: number
  cacheKey: string
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setErr(null)
    setDataUrl(null)
    void (async () => {
      const url = await getThumbDataUrl(fileRow.storage_bucket, fileRow.storage_path, pageNumber)
      if (cancel) return
      if (!url) {
        setErr('Vorschau fehlgeschlagen')
        setLoading(false)
        return
      }
      setDataUrl(url)
      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [fileRow.storage_bucket, fileRow.storage_path, pageNumber, cacheKey])

  if (loading) {
    return <div className="h-20 w-28 shrink-0 rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 animate-pulse" />
  }
  if (err || !dataUrl) {
    return (
      <div className="h-20 w-28 shrink-0 rounded border border-slate-200 dark:border-slate-600 text-[10px] p-1 text-slate-500">
        {err ?? '—'}
      </div>
    )
  }
  return <img src={dataUrl} alt="" className="h-20 w-auto max-w-[7rem] object-contain rounded border border-slate-200 dark:border-slate-600" />
}

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
  const stagingById = new Map(staging.map((s) => [s.id, s]))
  const stagingForFile = (fileId: string) => staging.filter((s) => s.file_id === fileId).sort((a, b) => a.sequence - b.sequence)

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
        if (r.ok && r.code === 'imported') showToast('Übernommen.')
        else if (r.ok && r.code === 'already_imported') showToast('Bereits übernommen.')
        else showError(r.message ?? 'Übernahme nicht möglich.')
      } finally {
        setImportBusy(false)
        onPatched()
      }
    },
    [onPatched, showToast]
  )

  const runAll = useCallback(async () => {
    setImportBusy(true)
    try {
      const { ok, failed, skipped, results } = await importAllEmbeddedImagesPendingForJob(jobId)
      const firstErr = results.find(
        (x) => !x.result.ok && x.result.code !== 'already_imported' && x.result.code !== 'missing_intent'
      )?.result.message
      const lines = [`Neu übernommen: ${ok}`, `Übersprungen: ${skipped}`, `Fehler: ${failed}`]
      showToast(
        firstErr && failed > 0 ? `${lines.join(' · ')} — z. B.: ${firstErr}` : lines.join(' · ')
      )
    } finally {
      setImportBusy(false)
      onPatched()
    }
  }, [jobId, onPatched, showToast])

  if (images.length === 0) {
    return (
      <section className="mt-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/30 p-4">
        <h3 className="font-semibold text-sm">Eingebettete PDF-Bilder (Experte)</h3>
        {imageLoadError ? (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">Metadaten: {imageLoadError}</p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Keine Bildeinbettung per Operatorliste erkannt (Datei erneut parsen nach Paket E).
          </p>
        )}
      </section>
    )
  }

  const byFile = new Map<string, AltberichtImportEmbeddedImageRow[]>()
  for (const im of images) {
    if (!byFile.has(im.file_id)) byFile.set(im.file_id, [])
    byFile.get(im.file_id)!.push(im)
  }

  const locked = busy || importBusy

  return (
    <section className="mt-6 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
        <div>
          <h3 className="font-semibold text-amber-950 dark:text-amber-100">Eingebettete PDF-Bilder — Übernahme (Experte)</h3>
          <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-1">
            Erkennung per PDF-Operator; <strong>Übernahme</strong> speichert die gerenderte PDF-Seite als PNG (kein
            Einzel-Crop). Objektfoto = Galerie (<span className="font-mono">object_photos</span>), nicht Profilbild.
            Mängelfoto = Stammdaten-Mangel (<span className="font-mono">object_defect_photos</span>) nur mit C2-importiertem
            Schlüssel <span className="font-mono">f:Index</span>.
          </p>
        </div>
        <button
          type="button"
          disabled={locked}
          className="shrink-0 rounded bg-amber-800 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          onClick={() => void runAll()}
        >
          Markierte Bilder übernehmen
        </button>
      </div>
      {imageLoadError ? (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2">Metadaten: {imageLoadError} (Migration E/F?)</p>
      ) : null}

      <div className="space-y-4">
        {Array.from(byFile.entries()).map(([fileId, list]) => {
          const f = files.find((x) => x.id === fileId)
          const rows = stagingForFile(fileId)
          if (!f) return null
          return (
            <div key={fileId} className="rounded border border-amber-200/80 dark:border-amber-900/50 bg-white/80 dark:bg-slate-900/50 p-3">
              <div className="text-sm font-medium break-all mb-2">{f.original_filename}</div>
              <ul className="space-y-3">
                {list.map((im) => {
                  const sugg = im.suggested_staging_object_id ? stagingById.get(im.suggested_staging_object_id) : null
                  const linked = im.linked_staging_object_id ? stagingById.get(im.linked_staging_object_id) : null
                  const resolved = linked ?? sugg
                  const committed = resolved?.committed_object_id?.trim() ?? null
                  const c2Staging = linked ?? resolved
                  const c2Rows = c2Staging ? listAltberichtC2FindingRows(c2Staging).filter((x) => x.alreadyImported) : []
                  const imported = (im.import_status ?? 'not_imported') === 'imported'

                  return (
                    <li
                      key={im.id}
                      className="flex flex-col sm:flex-row gap-3 p-2 rounded border border-slate-200 dark:border-slate-600"
                    >
                      <div className="shrink-0">
                        <PageThumb fileRow={f} pageNumber={im.page_number} cacheKey={im.id} />
                      </div>
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
                          <span className="text-slate-500">Übernahmestatus:</span>{' '}
                          <span className="font-medium">{importStatusLabel(im)}</span>
                          {im.imported_at ? (
                            <span className="text-slate-500"> · {new Date(im.imported_at).toLocaleString('de-DE')}</span>
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
                                  {c.key}: {c.originalText.slice(0, 60)}
                                  {c.originalText.length > 60 ? '…' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <div>
                          <button
                            type="button"
                            disabled={
                              locked ||
                              imported ||
                              im.user_intent === 'unreviewed' ||
                              im.user_intent === 'ignore' ||
                              (im.user_intent === 'defect_photo' && !im.c2_finding_key?.trim()) ||
                              (im.user_intent === 'object_photo' && !committed)
                            }
                            className="rounded bg-slate-800 text-white px-2 py-1 text-xs disabled:opacity-50"
                            onClick={() => void runOne(im)}
                            title={
                              !committed && im.user_intent === 'object_photo'
                                ? 'Zuerst C1-Commit (committed_object_id)'
                                : im.user_intent === 'defect_photo' && !im.c2_finding_key
                                  ? 'C2-Schlüssel wählen'
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
