/**
 * Thumb für „Positionsausschnitt": rendert die PDF-Seite und zeigt ausschließlich
 * den vertikalen Block-Bereich der erkannten Position.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { supabase } from '../../supabase'
import {
  buildAltberichtPositionBlockBoxLookup,
  computeAltberichtPositionBlockBoxesFromPdfBytes,
  getCachedAltberichtPositionBlockLookup,
  renderAltberichtPositionBlockToBlob,
  setCachedAltberichtPositionBlockLookup,
} from '../../lib/altberichtImport'
import { getAltberichtImportPdfBufferCached } from '../../lib/altberichtImport/altberichtImportPdfDownloadCache'
import { withAltberichtImportPreviewConcurrency } from '../../lib/altberichtImport/altberichtImportPreviewConcurrency'
import type { AltberichtImportFileRow } from '../../lib/altberichtImport'

/** Render-/Geometrie-Dedup pro Datei/Ansicht — liefert Blob; jeder Thumb erzeugt eigene object URL (kein geteiltes revoke). */
const renderInflight = new Map<string, Promise<Blob | null>>()

export const clearAltberichtPositionBlockThumbInflightCaches = (): void => {
  renderInflight.clear()
}

const buildCacheKey = (fileRow: AltberichtImportFileRow): string =>
  `${fileRow.id}:${fileRow.parsed_at ?? ''}`

const renderBlockThumbBlob = (
  fileRow: AltberichtImportFileRow,
  sequence: number
): Promise<Blob | null> => {
  const cacheKey = buildCacheKey(fileRow)
  const renderKey = `${cacheKey}:${sequence}`
  const ex = renderInflight.get(renderKey)
  if (ex) return ex
  const p = withAltberichtImportPreviewConcurrency(async () => {
    const buf = await getAltberichtImportPdfBufferCached(
      supabase,
      fileRow.storage_bucket,
      fileRow.storage_path
    )
    if (!buf) return null
    let lookup = getCachedAltberichtPositionBlockLookup(cacheKey)
    if (!lookup) {
      const boxes = await computeAltberichtPositionBlockBoxesFromPdfBytes(buf)
      lookup = buildAltberichtPositionBlockBoxLookup(boxes)
      setCachedAltberichtPositionBlockLookup(cacheKey, lookup)
    }
    /** Niedrigere Skalierung: weniger Rasterarbeit in der Liste. */
    const r = await renderAltberichtPositionBlockToBlob(buf, sequence, lookup, { scale: 0.9 })
    if ('blob' in r) {
      return r.blob
    }
    return null
  }).finally(() => renderInflight.delete(renderKey))
  renderInflight.set(renderKey, p)
  return p
}

export type AltberichtPositionBlockThumbProps = {
  fileRow: AltberichtImportFileRow
  sequence: number
  /** Optional: zeigt einen Hinweis-Overlay beim Hover. */
  ariaLabel?: string
  deferUntilVisible?: boolean
  intersectRootMargin?: string
  /** Scroll-Container für IO (`overflow-auto` in Elternliste). */
  intersectionRoot?: Element | null
}

export const AltberichtPositionBlockThumb = ({
  fileRow,
  sequence,
  ariaLabel,
  deferUntilVisible = true,
  intersectRootMargin = '260px 0px 280px 0px',
  intersectionRoot = null,
}: AltberichtPositionBlockThumbProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const [isVisible, setIsVisible] = useState<boolean>(() => deferUntilVisible !== true)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle')

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
        const slack = 260
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

  useEffect(() => {
    let alive = true
    if (!isVisible) {
      setState('idle')
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setObjectUrl(null)
      return undefined
    }

    setState('loading')
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setObjectUrl(null)

    void (async () => {
      try {
        const blob = await renderBlockThumbBlob(fileRow, sequence)
        if (!alive) {
          return
        }
        if (!blob) {
          setState('unavailable')
          return
        }
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setObjectUrl(url)
        setState('ready')
      } catch {
        if (alive) setState('error')
      }
    })()

    return () => {
      alive = false
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [
    fileRow.id,
    fileRow.parsed_at,
    fileRow.storage_bucket,
    fileRow.storage_path,
    isVisible,
    sequence,
  ])

  return (
    <div ref={rootRef}>
      {deferUntilVisible && !isVisible ? (
        <div
          className="h-24 w-32 shrink-0 rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 animate-pulse"
          aria-label={ariaLabel ?? `Positionsausschnitt #${sequence} (noch nicht sichtbar)`}
        />
      ) : state === 'loading' || (state === 'idle' && isVisible) ? (
        <div
          className="h-24 w-32 shrink-0 rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 animate-pulse"
          aria-label={ariaLabel ?? `Positionsausschnitt #${sequence} wird geladen`}
        />
      ) : state === 'unavailable' ? (
        <div className="rounded border border-dashed border-slate-300 dark:border-slate-600 px-2 py-1.5 text-[10px] text-slate-600 dark:text-slate-400 leading-tight max-w-[14rem]">
          Positionsausschnitt nicht ableitbar – Seitenfoto-Fallback unten.
        </div>
      ) : state === 'error' ? (
        <div className="rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-[10px] text-red-700 dark:text-red-300 max-w-[14rem]">
          Renderfehler Ausschnitt
        </div>
      ) : objectUrl ? (
        <div className="flex flex-wrap items-start gap-1">
          <img
            src={objectUrl}
            decoding="async"
            loading="lazy"
            alt=""
            className="h-auto max-h-60 w-auto max-w-[14rem] rounded border border-slate-300 dark:border-slate-700 object-contain shadow-sm bg-white dark:bg-black/20"
            aria-label={ariaLabel ?? `Positionsausschnitt #${sequence}`}
          />
        </div>
      ) : deferUntilVisible ? (
        <div
          className="h-24 w-32 shrink-0 rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 animate-pulse"
          aria-label={ariaLabel ?? `Positionsausschnitt #${sequence} (noch nicht sichtbar)`}
        />
      ) : null}
    </div>
  )
}
