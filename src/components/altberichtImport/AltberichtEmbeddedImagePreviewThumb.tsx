import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../supabase'
import {
  ALTBERICHT_RASTER_PREVIEW_MAX_EDGE_PX,
  renderAltberichtPdfCropViewportToPreviewJpegBlob,
  renderAltberichtPdfImageOrPageToPngDataUrl,
} from '../../lib/altberichtImport/altberichtPdfPageThumb'
import { getAltberichtImportPdfBufferCached } from '../../lib/altberichtImport/altberichtImportPdfDownloadCache'
import { withAltberichtImportPreviewConcurrency } from '../../lib/altberichtImport/altberichtImportPreviewConcurrency'
import { ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP } from '../../lib/altberichtImport/altberichtRasterGrid'
import type { AltberichtRasterPhotoCropViewportPx } from '../../lib/altberichtImport/altberichtRasterBlockPhotoScan'
import type { AltberichtImportEmbeddedImageRow, AltberichtImportFileRow } from '../../lib/altberichtImport'

/** Parallele Vorschau-Requests pro identischem Thumb (Race nach Reload bleiben unkritisch). */
const inflight = new Map<string, Promise<{ blob: Blob; source: 'embedded_image' | 'page' } | null>>()

/** Beim Job-Wechsel leeren — laufende Promises können noch auflösen, Komponenten brechen per cancel ab. */
export const clearAltberichtEmbeddedImagePreviewInflight = (): void => {
  inflight.clear()
}

/** Konservierte Operator-PDF-Fallback-Skalierung nur für Liste/Vorschau. */
const OPERATOR_LIST_PAGE_FALLBACK_SCALE = 0.26

const buildInflightKey = (
  pdfCacheKey: string,
  page: number,
  imageIndex: number,
  embedded: AltberichtImportEmbeddedImageRow | undefined | null,
  cacheBust: string | undefined
): string =>
  `${pdfCacheKey}:${page}:${imageIndex}:${embedded?.id ?? 'x'}:${cacheBust ?? ''}:${embedded?.op_kind ?? ''}`

const loadPreviewBlobPackage = async (
  fileRow: AltberichtImportFileRow,
  pageNumber: number,
  imageIndex: number,
  embedded?: AltberichtImportEmbeddedImageRow | null
): Promise<{ blob: Blob; source: 'embedded_image' | 'page' } | null> => {
  const pdfCacheKey = `${fileRow.storage_bucket}:${fileRow.storage_path}`
  const buf = await getAltberichtImportPdfBufferCached(supabase, fileRow.storage_bucket, fileRow.storage_path)
  if (!buf) return null

  if (embedded?.op_kind === ALTBERICHT_RASTER_OP_KIND_BLOCK_CROP) {
    const raw = embedded.scan_meta_json
    if (raw && typeof raw === 'object') {
      const m = raw as {
        photoAnalysis?: unknown
        viewportScaleUsed?: unknown
        cropViewportPx?: unknown
      }
      if (
        m.photoAnalysis === 'viewport_crop_v2' &&
        typeof m.viewportScaleUsed === 'number' &&
        m.cropViewportPx &&
        typeof m.cropViewportPx === 'object'
      ) {
        const cr = m.cropViewportPx as AltberichtRasterPhotoCropViewportPx
        const jpeg = await renderAltberichtPdfCropViewportToPreviewJpegBlob(
          buf,
          pageNumber,
          m.viewportScaleUsed,
          cr,
          {
            pdfCacheKey,
            maxOutputEdgePx: ALTBERICHT_RASTER_PREVIEW_MAX_EDGE_PX,
            jpegQuality: 0.82,
          }
        )
        if (jpeg) return { blob: jpeg, source: 'embedded_image' }
      }
    }
  }

  const r = await renderAltberichtPdfImageOrPageToPngDataUrl(
    buf,
    pageNumber,
    imageIndex,
    OPERATOR_LIST_PAGE_FALLBACK_SCALE,
    { pdfCacheKey }
  )
  if (!r) return null
  const pngBlob = await (await fetch(r.dataUrl)).blob()
  return { blob: pngBlob, source: r.source }
}

const loadPreviewBlob = (
  fileRow: AltberichtImportFileRow,
  pageNumber: number,
  imageIndex: number,
  embedded: AltberichtImportEmbeddedImageRow | undefined | null,
  cacheBust?: string | undefined
) => {
  const pdfCacheKey = `${fileRow.storage_bucket}:${fileRow.storage_path}`
  const key = buildInflightKey(pdfCacheKey, pageNumber, imageIndex, embedded, cacheBust)
  const existing = inflight.get(key)
  if (existing) return existing
  const p = withAltberichtImportPreviewConcurrency(() =>
    loadPreviewBlobPackage(fileRow, pageNumber, imageIndex, embedded)
  ).finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export type AltberichtEmbeddedImagePreviewThumbProps = {
  fileRow: AltberichtImportFileRow
  pageNumber: number
  imageIndex: number
  /** Optional: Zeile mit scan_meta für Raster-/Block-Crops. */
  embeddedRow?: AltberichtImportEmbeddedImageRow | null
  /** z. B. Bild-ID, damit nach Reload neu geladen wird */
  cacheBust?: string
  onPreviewMeta?: (meta: { source: 'embedded_image' | 'page' } | null) => void
  /** Wenn true: Rendern erst bei Sichtbarkeit (Import-Liste). */
  deferUntilVisible?: boolean
  /** Für IntersectionObserver (z. B. früheres Nachladen). */
  intersectRootMargin?: string
  /** Scroll-Container für IO (Listen mit `overflow-auto`; sonst Viewport). */
  intersectionRoot?: Element | null
}

export const AltberichtEmbeddedImagePreviewThumb = ({
  fileRow,
  pageNumber,
  imageIndex,
  embeddedRow,
  cacheBust,
  onPreviewMeta,
  deferUntilVisible = true,
  intersectRootMargin = '280px 0px 340px 0px',
  intersectionRoot = null,
}: AltberichtEmbeddedImagePreviewThumbProps) => {
  const metaCbRef = useRef(onPreviewMeta)
  metaCbRef.current = onPreviewMeta

  /** Verhindert unnötige Preview-Abbrüche, wenn das Parent nur neue Objekt-Referenzen übergibt. */
  const embeddedIdentityKey = useMemo(() => {
    const e = embeddedRow
    if (!e) return ''
    return [
      e.id,
      e.updated_at ?? '',
      e.op_kind ?? '',
      e.page_number,
      e.image_index,
      e.scan_version ?? '',
    ].join('|')
  }, [
    embeddedRow?.id,
    embeddedRow?.updated_at,
    embeddedRow?.op_kind,
    embeddedRow?.page_number,
    embeddedRow?.image_index,
    embeddedRow?.scan_version,
  ])

  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState<boolean>(() => deferUntilVisible !== true)

  useLayoutEffect(() => {
    if (!deferUntilVisible) {
      setIsVisible(true)
      return
    }
    const el = rootRef.current
    if (!el) return

    const rootEl = intersectionRoot ?? undefined

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        setIsVisible(hit)
      },
      {
        root: rootEl,
        threshold: 0.02,
        rootMargin: intersectRootMargin,
      }
    )
    io.observe(el)
    queueMicrotask(() => {
      try {
        if (typeof window === 'undefined') return
        const rect = el.getBoundingClientRect()
        const slack = 340
        let provisionalHit = rect.bottom > 0 && rect.top < window.innerHeight + slack
        if (rootEl instanceof HTMLElement) {
          const rr = rootEl.getBoundingClientRect()
          provisionalHit = rect.bottom > rr.top - slack && rect.top < rr.bottom + slack
        }
        if (provisionalHit) setIsVisible(true)
      } catch {
        /* ignore */
      }
    })

    return () => io.disconnect()
  }, [deferUntilVisible, intersectRootMargin, intersectionRoot])

  const blobUrlRef = useRef<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [source, setSource] = useState<'embedded_image' | 'page' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isVisible) {
      setLoading(false)
      setErr(null)
      setSource(null)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setObjectUrl(null)
      /** Kein metaCb(null): Parent-State (previewSourceById) soll beim Scrollen stabil bleiben; neu laden bei erneuter Sichtbarkeit. */
      return undefined
    }

    let cancel = false

    const run = (): void => {
      setLoading(true)
      setErr(null)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setObjectUrl(null)
      setSource(null)
      void (async () => {
        const res = await loadPreviewBlob(fileRow, pageNumber, imageIndex, embeddedRow, cacheBust)
        if (cancel) return
        if (!res) {
          setErr('Vorschau fehlgeschlagen')
          setLoading(false)
          metaCbRef.current?.(null)
          return
        }
        const url = URL.createObjectURL(res.blob)
        blobUrlRef.current = url
        setObjectUrl(url)
        setSource(res.source)
        setLoading(false)
        metaCbRef.current?.({ source: res.source })
      })()
    }
    run()

    return () => {
      cancel = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [
    isVisible,
    fileRow.storage_bucket,
    fileRow.storage_path,
    pageNumber,
    imageIndex,
    embeddedIdentityKey,
    cacheBust,
  ])

  const placeholder = (
    <div className="h-20 w-28 shrink-0 rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 animate-pulse" />
  )

  return (
    <div ref={rootRef} className="shrink-0">
      {!isVisible ? (
        placeholder
      ) : loading ? (
        placeholder
      ) : err || !objectUrl ? (
        <div className="h-20 w-28 shrink-0 rounded border border-slate-200 dark:border-slate-600 text-[10px] p-1 text-slate-500 flex items-center">
          {err ?? '—'}
        </div>
      ) : (
        <div className="shrink-0 space-y-0.5">
          <img
            src={objectUrl}
            alt=""
            decoding="async"
            loading="lazy"
            className="h-20 w-auto max-w-[7rem] object-contain rounded border border-slate-200 dark:border-slate-600"
          />
          {source === 'page' ? (
            <p className="text-[9px] text-amber-800 dark:text-amber-200 max-w-[7rem] leading-tight m-0">
              Seitenbild, kein Einzelbild
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
