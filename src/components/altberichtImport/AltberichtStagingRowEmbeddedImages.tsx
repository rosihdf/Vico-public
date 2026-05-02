import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../../supabase'
import { useToast } from '../../ToastContext'
import type { Object as Obj } from '../../types/object'
import { patchAltberichtEmbeddedImage } from '../../lib/altberichtImport/altberichtImportEmbeddedImageService'
import { importEmbeddedImageProductive } from '../../lib/altberichtImport/altberichtImportEmbeddedImageProductiveService'
import { importAltberichtPageAsObjectPhoto } from '../../lib/altberichtImport/altberichtImportPageAsPhotoService'
import {
  altberichtToastTypeForCode,
  formatAltberichtLogicalPhotoKey,
  getStagingRowSkippedPages,
  listAltberichtC2FindingRows,
  resolveStagingRowPageHints,
} from '../../lib/altberichtImport'
import type {
  AltberichtImportEmbeddedImageRow,
  AltberichtImportEmbeddedImageUserIntent,
  AltberichtImportFileRow,
} from '../../lib/altberichtImport'
import type { AltberichtImportStagingObjectRow } from '../../lib/altberichtImport/altberichtImportQueryService'
import {
  assignmentConfidenceLabelDe,
  describeEmbeddedImageAssignmentReason,
  findDuplicateEmbeddedImportForTarget,
  getAltberichtEmbeddedImageAssignmentConfidence,
  getAltberichtEmbeddedImagePrimaryKind,
  getEmbeddedImageLogicalPhotoKey,
  getEmbeddedImageRasterCropSubtypeLabelDe,
  isAltberichtBlockCropRow,
  isAltberichtRasterRawCropSafetyRow,
  isEmbeddedImageSuspectLogo,
  primaryKindLabelDe,
  type AltberichtEmbeddedImageAssignmentConfidence,
} from '../../lib/altberichtImport/altberichtImportEmbeddedImageRowUi'
import { AltberichtEmbeddedImagePreviewThumb } from './AltberichtEmbeddedImagePreviewThumb'
import { AltberichtPositionBlockThumb } from './AltberichtPositionBlockThumb'
import ConfirmDialog from '../ConfirmDialog'

const intentLabels: { value: AltberichtImportEmbeddedImageUserIntent; label: string }[] = [
  { value: 'unreviewed', label: 'Ungeprüft' },
  { value: 'ignore', label: 'Ignorieren' },
  { value: 'object_photo', label: 'Objektfoto (Galerie)' },
  { value: 'defect_photo', label: 'Mängelfoto (C2)' },
]

const formatTargetObjectLabel = (o: Obj | undefined): string => {
  if (!o) return ''
  const name = o.name?.trim() || o.internal_id?.trim() || 'Ohne Namen'
  const loc = [o.floor?.trim(), o.room?.trim()].filter(Boolean).join(' · ') || '—'
  return `${name} (${loc})`
}

const confidencePillClass = (k: AltberichtEmbeddedImageAssignmentConfidence): string => {
  switch (k) {
    case 'manual':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700'
    case 'suggested':
      return 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-700'
    case 'page-fallback':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700'
    case 'logo-hidden':
      return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-600'
  }
}

export type AltberichtStagingRowEmbeddedImagesProps = {
  row: AltberichtImportStagingObjectRow
  fileRow: AltberichtImportFileRow
  images: AltberichtImportEmbeddedImageRow[]
  allJobEmbeddedImages: AltberichtImportEmbeddedImageRow[]
  fileEmbeddedImageTotal: number
  fileLikelyLogoCount: number
  /** Übersprungene PDF-Seiten dieser Datei (Bildscan-Timeout). */
  fileSkippedPages?: number[]
  /** Scroll-Root für Lazy-Thumbnails innerhalb overflow-Stagingliste. */
  stagingScrollIntersectionRoot?: HTMLElement | null
  /** Öffnet die PDF-Vollvorschau auf einer bestimmten Seite. */
  onOpenPagePreview?: (fileRow: AltberichtImportFileRow, pageNumber: number) => void
  allObjects: Obj[]
  busy: boolean
  onReload: () => void
}

export const AltberichtStagingRowEmbeddedImages = ({
  row,
  fileRow,
  images,
  allJobEmbeddedImages,
  fileEmbeddedImageTotal,
  fileLikelyLogoCount,
  fileSkippedPages = [],
  stagingScrollIntersectionRoot = null,
  onOpenPagePreview,
  allObjects,
  busy,
  onReload,
}: AltberichtStagingRowEmbeddedImagesProps) => {
  const { showToast, showError } = useToast()
  const [importBusy, setImportBusy] = useState(false)
  const [pagePhotoBusyByPage, setPagePhotoBusyByPage] = useState<Record<number, boolean>>({})
  const [pagePhotoConfirmPage, setPagePhotoConfirmPage] = useState<number | null>(null)
  const [previewSourceById, setPreviewSourceById] = useState<
    Record<string, 'embedded_image' | 'page' | undefined>
  >({})
  const [pageFallbackOk, setPageFallbackOk] = useState<Record<string, boolean>>({})
  const [pageFallbackOpen, setPageFallbackOpen] = useState(false)

  const committedId = row.committed_object_id?.trim() ?? null
  const targetObject = committedId ? allObjects.find((o) => o.id === committedId) : undefined

  /**
   * Quelle für Seitenfoto-Buttons mit Priorität: Parser-Anker → embedded_image → row.sequence (Heuristik).
   * Der Sequenz-Fallback ist wichtig im Standardmodus, in dem `embeddedImages` bewusst nicht geladen werden
   * und der Parser heute keine Page-Anker schreibt – sonst gäbe es gar keinen „PDF-Seite öffnen / Seitenfoto
   * übernehmen"-Block. Heuristische Quelle wird in der UI klar als „Position #N" markiert.
   */
  const pageHints = useMemo(
    () => resolveStagingRowPageHints(row, allJobEmbeddedImages),
    [row, allJobEmbeddedImages]
  )
  const rowMentionedPageList = pageHints.pages
  const rowSkippedPages = useMemo(
    () => getStagingRowSkippedPages(new Set(rowMentionedPageList), fileSkippedPages),
    [rowMentionedPageList, fileSkippedPages]
  )

  const summaryLine = useMemo(() => {
    /**
     * Klare Priorisierung in der Zusammenfassung:
     *  - echte Einzelbilder dieser Position → primärer Hinweis
     *  - keine Einzelbilder, aber Datei hat erkannte Bilder → „Kein Einzelbild sicher zugeordnet"
     *  - Datei hat gar keine erkannten Bilder → Seitenfoto-Fallback hervorheben
     */
    const anyRasterFallbackUsed = images.some((im) => {
      const m = im.scan_meta_json
      if (!m || typeof m !== 'object') return false
      return (m as { blockAnalysisFinalStatus?: unknown }).blockAnalysisFinalStatus === 'fallback_used'
    })
    const anyRasterPositionsFallback = images.some((im) => {
      const m = im.scan_meta_json
      if (!m || typeof m !== 'object') return false
      return (m as { rasterPositionsFallback?: unknown }).rasterPositionsFallback === true
    })
    const anyRasterNeedsReview = images.some((im) => {
      const m = im.scan_meta_json
      if (!m || typeof m !== 'object') return false
      return (m as { qualityStatus?: unknown }).qualityStatus === 'needs_review'
    })
    const n = images.length
    if (n > 0) {
      const allImported = images.every((im) => (im.import_status ?? 'not_imported') === 'imported')
      const anyFallback = images.some((im) => previewSourceById[im.id] === 'page')
      const parts: string[] = []
      parts.push(n === 1 ? '1 Einzelbild dieser Position' : `${n} Einzelbilder dieser Position`)
      if (allImported) parts.push('alle übernommen')
      else if (images.some((im) => (im.import_status ?? 'not_imported') === 'imported')) {
        parts.push('teilweise übernommen')
      }
      if (anyFallback) parts.push('mind. ein Seitenbild-Fallback')
      if (anyRasterFallbackUsed) parts.push('Raster: Positionsausschnitt-Fallback')
      if (anyRasterPositionsFallback) parts.push('Raster: Positionsausschnitt-Fallback (bitte prüfen)')
      if (anyRasterNeedsReview) parts.push('Raster: bitte Einzelbilder prüfen (Experte)')
      return parts.join(' · ')
    }
    if (fileEmbeddedImageTotal > 0) {
      return 'Kein Einzelbild sicher zugeordnet. Positionsausschnitt unten oder Seitenfoto-Fallback nutzen.'
    }
    if (rowMentionedPageList.length > 0) {
      return 'Fotoanalyse kann im Hintergrund laufen oder war übersprungen. Positionsausschnitt unten oder Seitenfoto-Fallback nutzen; Raster-Status im Expertenmodus.'
    }
    return 'Bildanalyse übersprungen. Im Expertenmodus kann die Operator-Bildanalyse gestartet werden.'
  }, [fileEmbeddedImageTotal, images, previewSourceById, rowMentionedPageList])

  const hasEmbeddedAssignments = images.length > 0
  const showPageFallbackBlock = rowMentionedPageList.length > 0

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

  const patchEmbedded = useCallback(
    async (
      im: AltberichtImportEmbeddedImageRow,
      partial: Partial<{
        userIntent: AltberichtImportEmbeddedImageUserIntent
        c2Key: string | null
      }>
    ) => {
      const userIntent = partial.userIntent ?? im.user_intent
      const c2Raw = partial.c2Key !== undefined ? partial.c2Key : im.c2_finding_key
      const c2FindingKey = userIntent === 'defect_photo' ? c2Raw : null
      const { error } = await patchAltberichtEmbeddedImage(
        im.id,
        {
          userIntent,
          linkedStagingObjectId: row.id,
          c2FindingKey: userIntent === 'defect_photo' ? c2FindingKey : null,
        },
        supabase
      )
      if (error) {
        showError(error.message)
        return
      }
      onReload()
    },
    [onReload, row.id, showError]
  )

  const handleImportOne = useCallback(
    async (im: AltberichtImportEmbeddedImageRow) => {
      setImportBusy(true)
      try {
        const r = await importEmbeddedImageProductive(im.id)
        if (r.ok && r.code === 'imported') {
          showToast('Foto übernommen.', altberichtToastTypeForCode('imported'))
        } else if (r.ok && r.code === 'already_imported') {
          showToast('Bereits übernommen.', altberichtToastTypeForCode('already_imported'))
        } else {
          showError(r.message ?? 'Übernahme nicht möglich.')
        }
      } finally {
        setImportBusy(false)
        onReload()
      }
    },
    [onReload, showError, showToast]
  )

  const handleRequestPagePhoto = useCallback(
    (pageNumber: number) => {
      if (!committedId) {
        showError('Bitte zuerst Objekt in die Stammdaten übernehmen (C1).')
        return
      }
      setPagePhotoConfirmPage(pageNumber)
    },
    [committedId, showError]
  )

  const runPagePhotoImport = useCallback(
    async (pageNumber: number) => {
      setPagePhotoBusyByPage((s) => ({ ...s, [pageNumber]: true }))
      try {
        const r = await importAltberichtPageAsObjectPhoto({
          stagingObjectId: row.id,
          pageNumber,
        })
        if (r.ok && r.code === 'imported') {
          showToast(
            `Seitenfoto S. ${pageNumber} übernommen.`,
            altberichtToastTypeForCode('imported')
          )
        } else if (r.ok && r.code === 'already_imported') {
          showToast(
            `Seitenfoto S. ${pageNumber} bereits in der Galerie.`,
            altberichtToastTypeForCode('already_imported')
          )
        } else {
          showError(r.message ?? `Übernahme S. ${pageNumber} nicht möglich.`)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        showError(`Fehler bei Seitenfoto S. ${pageNumber}: ${msg}`)
      } finally {
        setPagePhotoBusyByPage((s) => {
          const next = { ...s }
          delete next[pageNumber]
          return next
        })
        onReload()
      }
    },
    [onReload, row.id, showError, showToast]
  )

  const handleConfirmPagePhoto = useCallback(() => {
    const page = pagePhotoConfirmPage
    if (page == null) return
    setPagePhotoConfirmPage(null)
    void runPagePhotoImport(page)
  }, [pagePhotoConfirmPage, runPagePhotoImport])

  const handleCancelPagePhoto = useCallback(() => {
    setPagePhotoConfirmPage(null)
  }, [])

  const anyPagePhotoBusy = useMemo(
    () => Object.values(pagePhotoBusyByPage).some(Boolean),
    [pagePhotoBusyByPage]
  )
  const locked = busy || importBusy || anyPagePhotoBusy

  return (
    <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 px-2 py-2 space-y-2 text-xs">
      <div className="font-medium text-slate-800 dark:text-slate-100">Fotos</div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 m-0 leading-snug">{summaryLine}</p>
      {rowSkippedPages.length > 0 ? (
        <div className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100 leading-snug space-y-1">
          <div>
            Auf{' '}
            {rowSkippedPages.length === 1
              ? `Seite ${rowSkippedPages[0]}`
              : `den Seiten ${rowSkippedPages.join(', ')}`}{' '}
            konnten Bilder nicht vollständig analysiert werden. Die Position bleibt nutzbar; Foto bei Bedarf
            in der PDF-Seitenvorschau prüfen und manuell zuordnen.
          </div>
          {onOpenPagePreview ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {rowSkippedPages.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded bg-amber-700 text-white px-2 py-0.5 text-[10px] font-medium hover:bg-amber-800"
                  onClick={() => onOpenPagePreview(fileRow, p)}
                  aria-label={`Seitenvorschau für Seite ${p} öffnen`}
                >
                  Seitenvorschau · S. {p}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {fileLikelyLogoCount > 0 ? (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0">
          {fileLikelyLogoCount} vermutlich Logo/Kopf im Dokument ausgeblendet — keine Zuordnung zu Positionen.
          Bei Bedarf unten unter „Eingebettete PDF-Bilder (Korrektur)“ prüfen.
        </p>
      ) : null}
      <p className="text-[11px] text-slate-600 dark:text-slate-400 m-0 leading-snug">
        Ziel nach C1:{' '}
        {committedId ? (
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {formatTargetObjectLabel(targetObject) || committedId}
          </span>
        ) : (
          <span className="text-amber-800 dark:text-amber-200">
            Objekt zuerst in Stammdaten übernehmen (C1), dann Fotos übernehmen
          </span>
        )}
        .
      </p>

      {images.length > 0 ? (
        <ul className="space-y-2 list-none p-0 m-0">
          {images.map((im) => {
            const primary = getAltberichtEmbeddedImagePrimaryKind(im)
            const imported = (im.import_status ?? 'not_imported') === 'imported'
            const failed = (im.import_status ?? 'not_imported') === 'failed'
            const previewSource = previewSourceById[im.id]
            const dup = findDuplicateEmbeddedImportForTarget(im, allJobEmbeddedImages, committedId)
            const c2Rows = listAltberichtC2FindingRows(row).filter((x) => x.alreadyImported)
            const suspectLogo = isEmbeddedImageSuspectLogo(im)
            const confidence = getAltberichtEmbeddedImageAssignmentConfidence(im, row.id, row.sequence)

            const needsPageConfirm = previewSource === 'page' && !imported && !failed
            const pageOk = Boolean(pageFallbackOk[im.id])

            const canObjectImport =
              im.user_intent === 'object_photo' &&
              Boolean(committedId) &&
              !imported &&
              !failed &&
              !dup &&
              previewSource != null &&
              !isAltberichtRasterRawCropSafetyRow(im) &&
              (!needsPageConfirm || pageOk)

            const canDefectImport =
              im.user_intent === 'defect_photo' &&
              Boolean(committedId) &&
              Boolean(im.c2_finding_key?.trim()) &&
              !imported &&
              !failed &&
              !dup &&
              previewSource != null &&
              !isAltberichtRasterRawCropSafetyRow(im) &&
              (!needsPageConfirm || pageOk)

            return (
              <li
                key={im.id}
                className="flex flex-col sm:flex-row gap-2 p-2 rounded border border-slate-200/90 dark:border-slate-600/90 bg-white/80 dark:bg-slate-900/40"
              >
                <AltberichtEmbeddedImagePreviewThumb
                  fileRow={fileRow}
                  embeddedRow={im}
                  pageNumber={im.page_number}
                  imageIndex={im.image_index}
                  cacheBust={im.updated_at}
                  onPreviewMeta={handlePreviewMeta(im.id)}
                  intersectionRoot={stagingScrollIntersectionRoot}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                    <span className="text-slate-500">Seite / Bild:</span>
                    <span className="font-mono">
                      {im.page_number} / {im.image_index}
                    </span>
                  </div>
                  {getEmbeddedImageLogicalPhotoKey(im) ? (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-1 gap-y-0">
                      <span>Foto-ID:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        {getEmbeddedImageLogicalPhotoKey(im)}
                      </span>
                      {isAltberichtBlockCropRow(im) && getEmbeddedImageRasterCropSubtypeLabelDe(im) ? (
                        <span className="text-slate-500">· {getEmbeddedImageRasterCropSubtypeLabelDe(im)}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                    <span
                      className={`inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${confidencePillClass(confidence)}`}
                      aria-label={`Zuordnungsstatus: ${assignmentConfidenceLabelDe(confidence)}`}
                    >
                      {assignmentConfidenceLabelDe(confidence)}
                    </span>
                    <span className="text-slate-500">Status:</span>
                    <span className="font-medium">{primaryKindLabelDe(primary)}</span>
                    {suspectLogo ? (
                      <span className="text-amber-800 dark:text-amber-200">
                        · vermutlich Logo/Kopf — bitte prüfen
                      </span>
                    ) : null}
                    {previewSource === 'page' && !failed ? (
                      <span className="text-amber-800 dark:text-amber-200">· Seitenbild-Fallback</span>
                    ) : null}
                    {imported ? <span className="text-emerald-700 dark:text-emerald-300">· Übernommen</span> : null}
                    {dup ? (
                      <span className="text-slate-600 dark:text-slate-400">· Bereits übernommen (Duplikat)</span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0">
                    Zuordnung: {describeEmbeddedImageAssignmentReason(im, row.id)}
                  </p>
                  {im.import_error ? (
                    <p className="text-[11px] text-red-600 dark:text-red-400 m-0">{im.import_error}</p>
                  ) : null}

                  <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-1">
                    <label className="flex flex-col text-[11px] min-w-[10rem]">
                      <span className="text-slate-500">Nutzen als</span>
                      <select
                        className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-xs"
                        value={im.user_intent}
                        disabled={locked || imported}
                        onChange={(e) =>
                          void patchEmbedded(im, {
                            userIntent: e.target.value as AltberichtImportEmbeddedImageUserIntent,
                          })
                        }
                      >
                        {intentLabels.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {im.user_intent === 'defect_photo' ? (
                      <label className="flex flex-col text-[11px] flex-1 min-w-0">
                        <span className="text-slate-500">C2-Mangel (importiert)</span>
                        <select
                          className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-xs w-full"
                          value={im.c2_finding_key ?? ''}
                          disabled={locked || imported || c2Rows.length === 0}
                          onChange={(e) =>
                            void patchEmbedded(im, { c2Key: e.target.value === '' ? null : e.target.value })
                          }
                        >
                          <option value="">{c2Rows.length === 0 ? '— (erst C2)' : '— wählen'}</option>
                          {c2Rows.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.key}: {c.commitText.slice(0, 48)}
                              {c.commitText.length > 48 ? '…' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>

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
                        Ich bestätige die Übernahme als <strong>gesamte PDF-Seite</strong> (kein sicheres
                        Einzelbild).
                      </span>
                    </label>
                  ) : null}

                  {!committedId && (im.user_intent === 'object_photo' || im.user_intent === 'defect_photo') ? (
                    <p className="text-[11px] text-amber-800 dark:text-amber-200 m-0">
                      Übernahme ausgeblendet, bis das Objekt per C1 in den Stammdaten angelegt ist.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {im.user_intent === 'object_photo' ? (
                      <button
                        type="button"
                        disabled={locked || !canObjectImport}
                        className="rounded bg-slate-700 text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
                        onClick={() => void handleImportOne(im)}
                      >
                        Foto übernehmen
                      </button>
                    ) : null}
                    {im.user_intent === 'defect_photo' ? (
                      <button
                        type="button"
                        disabled={locked || !canDefectImport}
                        className="rounded bg-slate-700 text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
                        onClick={() => void handleImportOne(im)}
                      >
                        Mängelfoto übernehmen
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {/**
       * Positionsausschnitt: zeigt einen aus dem PDF gerenderten vertikalen Block-Bereich der
       * Position. Nur sichtbar, wenn keine echten Einzelbilder zugeordnet sind. Wenn die
       * Block-Geometrie nicht ableitbar ist, rendert die Komponente still einen Hinweis-Streifen
       * und der Seitenfoto-Fallback unten bleibt erreichbar.
       */}
      {!hasEmbeddedAssignments && row.sequence > 0 ? (
        <div className="rounded border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/30 px-2 py-1.5 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-medium text-slate-800 dark:text-slate-100">
              Positionsausschnitt
            </span>
            <span
              className="font-mono text-[10px] text-slate-500 dark:text-slate-400"
              aria-label={`Foto-Schlüssel ${formatAltberichtLogicalPhotoKey(row.sequence, 1)}`}
              title="Logischer Foto-Schlüssel: Position.Foto"
            >
              {formatAltberichtLogicalPhotoKey(row.sequence, 1)}
            </span>
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-400 m-0 leading-snug">
            Direkt aus dem PDF-Block dieser Position gerendert. Wenn der Block nicht sicher
            ableitbar ist, kann unten der Seitenfoto-Fallback genutzt werden.
          </p>
          <AltberichtPositionBlockThumb
            fileRow={fileRow}
            sequence={row.sequence}
            ariaLabel={`Positionsausschnitt #${row.sequence} (${formatAltberichtLogicalPhotoKey(row.sequence, 1)})`}
            intersectionRoot={stagingScrollIntersectionRoot}
          />
        </div>
      ) : null}

      {showPageFallbackBlock ? (
        <div
          className={`rounded border ${hasEmbeddedAssignments ? 'border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-900/20' : 'border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/30'} px-2 py-1.5 space-y-1`}
        >
          {hasEmbeddedAssignments ? (
            <button
              type="button"
              className="w-full flex items-center justify-between text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-50"
              aria-expanded={pageFallbackOpen}
              onClick={() => setPageFallbackOpen((v) => !v)}
            >
              <span>
                Seitenfoto-Fallback {pageFallbackOpen ? 'einklappen' : 'anzeigen'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {pageFallbackOpen ? '▾' : '▸'}
              </span>
            </button>
          ) : (
            <div className="text-[11px] font-medium text-slate-800 dark:text-slate-100">
              {fileEmbeddedImageTotal > 0
                ? 'Kein Einzelbild sicher zugeordnet — Seitenfoto-Fallback'
                : 'Seitenfoto, kein Einzelbild'}
            </div>
          )}

          {(!hasEmbeddedAssignments || pageFallbackOpen) ? (
            <div className="space-y-1.5 pt-0.5">
              {onOpenPagePreview ? (
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400">
                  <span>PDF-Seite öffnen:</span>
                  {rowMentionedPageList.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => onOpenPagePreview(fileRow, p)}
                      aria-label={`PDF-Seite ${p} öffnen`}
                    >
                      S. {p}
                    </button>
                  ))}
                  {pageHints.source === 'sequence' ? (
                    <span className="ml-1 italic text-slate-500 dark:text-slate-400">
                      (vermutet · Position #{row.sequence})
                    </span>
                  ) : null}
                </div>
              ) : null}

              {!committedId ? (
                <p className="text-[10px] text-amber-800 dark:text-amber-200 m-0 leading-snug">
                  Erst Objekt übernehmen (C1), dann Seitenfoto übernehmen.
                </p>
              ) : (
                <p className="text-[10px] text-slate-600 dark:text-slate-400 m-0 leading-snug">
                  Übernimmt die ganze PDF-Seite als Foto in die Objekt-Galerie. Bestätigung erforderlich.
                </p>
              )}
              {pageHints.source === 'sequence' ? (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 leading-snug italic">
                  Vermutete Seite (Position #{row.sequence}). Bitte mit „PDF-Seite öffnen" prüfen,
                  bevor Sie übernehmen.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1 pt-0.5">
                {rowMentionedPageList.map((p) => {
                  const pageBusy = Boolean(pagePhotoBusyByPage[p])
                  const disabled = !committedId || locked || pageBusy
                  const title = !committedId
                    ? 'Erst Objekt übernehmen (C1), dann Seitenfoto übernehmen'
                    : pageBusy
                      ? `Seitenfoto S. ${p} wird übernommen…`
                      : `PDF-Seite ${p} als Objektfoto in die Galerie übernehmen`
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={disabled}
                      className={`rounded ${hasEmbeddedAssignments ? 'bg-slate-500' : 'bg-slate-700'} text-white px-2 py-1 text-[11px] font-medium disabled:opacity-50`}
                      onClick={() => handleRequestPagePhoto(p)}
                      aria-label={title}
                      title={title}
                    >
                      {pageBusy ? `Übernehme S. ${p}…` : `Seitenfoto übernehmen · S. ${p}`}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={pagePhotoConfirmPage != null}
        title="Seitenfoto übernehmen?"
        message={
          pagePhotoConfirmPage != null
            ? `Diese PDF-Seite (S. ${pagePhotoConfirmPage}) wird als Foto in die Objekt-Galerie übernommen.`
            : 'Diese PDF-Seite wird als Foto in die Objekt-Galerie übernommen.'
        }
        confirmLabel="Seitenfoto übernehmen"
        cancelLabel="Abbrechen"
        variant="default"
        onConfirm={handleConfirmPagePhoto}
        onCancel={handleCancelPagePhoto}
      />
    </div>
  )
}
