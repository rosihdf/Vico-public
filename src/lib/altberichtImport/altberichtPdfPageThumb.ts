/**
 * Kleine Vorschau einer einzelnen PDF-Seite (nur Browser, pdf.js) — Altbericht-Import Experte.
 *
 * PDF-Dokumente können optional per `pdfCacheKey` zwischen Aufrufen gehalten werden,
 * damit viele Thumbnails pro Datei nicht jedes Mal `getDocument` ausführen.
 * `clearAltberichtPdfJsDocumentCache()` beim Job-Wechsel aufrufen.
 */
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { AltberichtRasterPhotoCropViewportPx } from './altberichtRasterBlockPhotoScan'

/** Skalierung für kleine UI-Vorschauen (Import-Review, Experte). */
export const THUMB_SCALE = 0.4
/** Skalierung für produktive Seitenbild-Übernahme (Galerie). Liefert ~1700px Breite bei A4. */
export const ALTBERICHT_PRODUCTIVE_PAGE_SCALE = 1.5

/** Max. Kantenlänge (px) für UI-Raster-Crop-Vorschauen — geringer Arbeitsspeicher/Main-Thread. */
export const ALTBERICHT_RASTER_PREVIEW_MAX_EDGE_PX = 400

let workerConfigured = false

const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

/** Offscreen-Canvas nach Nutzung leeren — reduziert GPU/RAM ohne DOM-Zombie. */
export const releaseTransientCanvas = (canvas: HTMLCanvasElement | null | undefined): void => {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

/** --- pdf.js Document LRU (pro Import-Datei): älteste Einträge verdrängen, destroy() garantiert --- */
const PDF_DOC_CACHE_MAX = 3
const pdfDocCacheEntries: {
  key: string
  doc: import('pdfjs-dist').PDFDocumentProxy
}[] = []

export const clearAltberichtPdfJsDocumentCache = (): void => {
  for (const e of pdfDocCacheEntries) {
    try {
      void e.doc.destroy()
    } catch {
      /* ignore */
    }
  }
  pdfDocCacheEntries.length = 0
}

const touchDocEntry = (key: string): void => {
  const ix = pdfDocCacheEntries.findIndex((e) => e.key === key)
  if (ix >= 0) {
    const [entry] = pdfDocCacheEntries.splice(ix, 1)
    pdfDocCacheEntries.push(entry!)
  }
}

const getAltberichtPdfJsDocCached = async (
  cacheKey: string,
  pdfBytes: ArrayBuffer
): Promise<import('pdfjs-dist').PDFDocumentProxy> => {
  ensurePdfWorker()
  const found = pdfDocCacheEntries.find((e) => e.key === cacheKey)
  if (found) {
    touchDocEntry(cacheKey)
    return found.doc
  }
  const data = new Uint8Array(pdfBytes.slice(0))
  const task = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  const doc = await task.promise
  pdfDocCacheEntries.push({ key: cacheKey, doc })
  while (pdfDocCacheEntries.length > PDF_DOC_CACHE_MAX) {
    const ev = pdfDocCacheEntries.shift()!
    try {
      void ev.doc.destroy()
    } catch {
      /* ignore */
    }
  }
  return doc
}

const openPdfDocumentForRender = async (
  pdfBytes: ArrayBuffer,
  pdfCacheKey: string | null | undefined
): Promise<{
  doc: import('pdfjs-dist').PDFDocumentProxy
  owned: boolean
}> => {
  const key = pdfCacheKey?.trim() ?? ''
  if (key) {
    const doc = await getAltberichtPdfJsDocCached(key, pdfBytes)
    return { doc, owned: false }
  }
  ensurePdfWorker()
  const data = new Uint8Array(pdfBytes.slice(0))
  const task = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  const doc = await task.promise
  return { doc, owned: true }
}

export type AltberichtPdfJsCacheOptions = {
  /** z. B. `${bucket}:${storagePath}` */
  pdfCacheKey?: string | null
}

const renderPageToPng = async (page: import('pdfjs-dist').PDFPageProxy, scale: number): Promise<string | null> => {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const task = page.render({ canvasContext: ctx, viewport })
    await task.promise
    return canvas.toDataURL('image/png')
  } finally {
    releaseTransientCanvas(canvas)
  }
}

type PdfJsImageLike = {
  width?: number
  height?: number
  data?: Uint8ClampedArray | Uint8Array
  kind?: number
  bitmap?: ImageBitmap
}

type PdfJsPageWithObjects = import('pdfjs-dist').PDFPageProxy & {
  objs?: {
    get?: (objId: string, callback?: (data: unknown) => void) => unknown
  }
}

const isCanvasImageSource = (value: unknown): value is CanvasImageSource => {
  if (typeof window === 'undefined') return false
  return (
    value instanceof HTMLCanvasElement ||
    value instanceof HTMLImageElement ||
    (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap)
  )
}

const objectStoreGet = (page: import('pdfjs-dist').PDFPageProxy, objId: string): Promise<unknown> => {
  const getter = (page as PdfJsPageWithObjects).objs?.get
  if (!getter) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const immediate = getter.call((page as PdfJsPageWithObjects).objs, objId, (data: unknown) => resolve(data))
      if (immediate != null) resolve(immediate)
    } catch {
      resolve(null)
    }
  })
}

const rgbaFromPdfJsImage = (image: PdfJsImageLike): Uint8ClampedArray | null => {
  const width = image.width ?? 0
  const height = image.height ?? 0
  const data = image.data
  if (!width || !height || !data) return null
  const pixelCount = width * height
  if (data.length === pixelCount * 4) return new Uint8ClampedArray(data)
  if (data.length === pixelCount * 3) {
    const rgba = new Uint8ClampedArray(pixelCount * 4)
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      rgba[j] = data[i] ?? 0
      rgba[j + 1] = data[i + 1] ?? 0
      rgba[j + 2] = data[i + 2] ?? 0
      rgba[j + 3] = 255
    }
    return rgba
  }
  if (data.length === pixelCount) {
    const rgba = new Uint8ClampedArray(pixelCount * 4)
    for (let i = 0, j = 0; i < data.length; i += 1, j += 4) {
      const v = data[i] ?? 0
      rgba[j] = v
      rgba[j + 1] = v
      rgba[j + 2] = v
      rgba[j + 3] = 255
    }
    return rgba
  }
  return null
}

const imageLikeToPngDataUrl = (raw: unknown): string | null => {
  const source = raw && typeof raw === 'object' && 'bitmap' in raw ? (raw as PdfJsImageLike).bitmap : raw
  if (isCanvasImageSource(source)) {
    const width = 'width' in source ? Number(source.width) : 0
    const height = 'height' in source ? Number(source.height) : 0
    if (!width || !height) return null
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(source, 0, 0)
      return canvas.toDataURL('image/png')
    } finally {
      releaseTransientCanvas(canvas)
    }
  }

  if (!raw || typeof raw !== 'object') return null
  const image = raw as PdfJsImageLike
  const width = image.width ?? 0
  const height = image.height ?? 0
  const rgba = rgbaFromPdfJsImage(image)
  if (!width || !height || !rgba) return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    releaseTransientCanvas(canvas)
  }
}

/** Erzeugt beschnittenes Raster-Crop für UI (JPEG statt PNG-DataURL, optional verkleinert). */
export const renderAltberichtPdfCropViewportToPreviewJpegBlob = async (
  pdfBytes: ArrayBuffer,
  page1Based: number,
  viewportScaleUsed: number,
  crop: AltberichtRasterPhotoCropViewportPx,
  options?: AltberichtPdfJsCacheOptions & {
    maxOutputEdgePx?: number
    jpegQuality?: number
  }
): Promise<Blob | null> => {
  if (typeof document === 'undefined') return null
  if (page1Based < 1) return null
  ensurePdfWorker()
  const jpegQuality = options?.jpegQuality ?? 0.82
  const maxEdge = options?.maxOutputEdgePx ?? ALTBERICHT_RASTER_PREVIEW_MAX_EDGE_PX
  const { doc, owned } = await openPdfDocumentForRender(pdfBytes, options?.pdfCacheKey ?? null)
  let page: import('pdfjs-dist').PDFPageProxy | undefined
  const canvases: HTMLCanvasElement[] = []
  try {
    if (page1Based > doc.numPages) return null
    page = await doc.getPage(page1Based)
    const viewport = page.getViewport({ scale: viewportScaleUsed })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    canvases.push(canvas)
    const taskR = page.render({ canvasContext: ctx, viewport })
    await taskR.promise

    const sx = Math.max(0, Math.floor(crop.sx))
    const sy = Math.max(0, Math.floor(crop.sy))
    let sw = Math.max(1, Math.ceil(crop.sw))
    let sh = Math.max(1, Math.ceil(crop.sh))
    sw = Math.min(sw, canvas.width - sx)
    sh = Math.min(sh, canvas.height - sy)
    if (sw < 4 || sh < 4) return null

    let out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    const octx = out.getContext('2d')
    if (!octx) return null
    canvases.push(out)
    octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)

    if (maxEdge > 0 && Math.max(sw, sh) > maxEdge) {
      const s = maxEdge / Math.max(sw, sh)
      const tw = Math.max(2, Math.floor(sw * s))
      const th = Math.max(2, Math.floor(sh * s))
      const small = document.createElement('canvas')
      small.width = tw
      small.height = th
      const sctx = small.getContext('2d')
      if (!sctx) return null
      canvases.push(small)
      sctx.drawImage(out, 0, 0, sw, sh, 0, 0, tw, th)
      out = small
    }

    return await new Promise<Blob | null>((resolve) => {
      out.toBlob((b) => resolve(b ?? null), 'image/jpeg', jpegQuality)
    })
  } catch {
    return null
  } finally {
    for (const c of canvases) releaseTransientCanvas(c)
    try {
      page?.cleanup()
    } catch {
      /* ignore pdf.js quirks */
    }
    if (owned) void doc.destroy()
  }
}

/** Volle Rasterauflösung als JPEG — z. B. Debug-ZIP (ohne zusätzliche Verkleinerung). */
export const renderAltberichtPdfCropViewportToFullJpegBlob = async (
  pdfBytes: ArrayBuffer,
  page1Based: number,
  viewportScaleUsed: number,
  crop: AltberichtRasterPhotoCropViewportPx,
  options?: AltberichtPdfJsCacheOptions & { jpegQuality?: number }
): Promise<Blob | null> =>
  renderAltberichtPdfCropViewportToPreviewJpegBlob(pdfBytes, page1Based, viewportScaleUsed, crop, {
    ...options,
    maxOutputEdgePx: 0,
    jpegQuality: options?.jpegQuality ?? 0.9,
  })

export const renderAltberichtPdfCropViewportToPngDataUrl = async (
  pdfBytes: ArrayBuffer,
  page1Based: number,
  viewportScaleUsed: number,
  crop: AltberichtRasterPhotoCropViewportPx,
  options?: AltberichtPdfJsCacheOptions
): Promise<string | null> => {
  if (typeof document === 'undefined') return null
  if (page1Based < 1) return null
  ensurePdfWorker()
  const { doc, owned } = await openPdfDocumentForRender(pdfBytes, options?.pdfCacheKey ?? null)
  let page: import('pdfjs-dist').PDFPageProxy | undefined
  const canvases: HTMLCanvasElement[] = []
  try {
    if (page1Based > doc.numPages) return null
    page = await doc.getPage(page1Based)
    const viewport = page.getViewport({ scale: viewportScaleUsed })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    canvases.push(canvas)
    const taskR = page.render({ canvasContext: ctx, viewport })
    await taskR.promise

    const sx = Math.max(0, Math.floor(crop.sx))
    const sy = Math.max(0, Math.floor(crop.sy))
    let sw = Math.max(1, Math.ceil(crop.sw))
    let sh = Math.max(1, Math.ceil(crop.sh))
    sw = Math.min(sw, canvas.width - sx)
    sh = Math.min(sh, canvas.height - sy)
    if (sw < 4 || sh < 4) return null

    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    const octx = out.getContext('2d')
    if (!octx) return null
    canvases.push(out)
    octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
    return out.toDataURL('image/png')
  } catch {
    return null
  } finally {
    for (const c of canvases) releaseTransientCanvas(c)
    try {
      page?.cleanup()
    } catch {
      /* ignore */
    }
    if (owned) void doc.destroy()
  }
}

export const renderAltberichtPdfPageToPngDataUrl = async (
  pdfBytes: ArrayBuffer,
  page1Based: number,
  /** Default = THUMB_SCALE (kleine UI-Vorschau). Für Galerie-Import: ALTBERICHT_PRODUCTIVE_PAGE_SCALE. */
  scale: number = THUMB_SCALE,
  options?: AltberichtPdfJsCacheOptions
): Promise<string | null> => {
  if (typeof document === 'undefined') return null
  if (page1Based < 1) return null
  ensurePdfWorker()
  const { doc, owned } = await openPdfDocumentForRender(pdfBytes, options?.pdfCacheKey ?? null)
  let page: import('pdfjs-dist').PDFPageProxy | undefined
  try {
    if (page1Based > doc.numPages) return null
    page = await doc.getPage(page1Based)
    return await renderPageToPng(page, scale)
  } catch {
    return null
  } finally {
    try {
      page?.cleanup()
    } catch {
      /* ignore */
    }
    if (owned) void doc.destroy()
  }
}

export type AltberichtPdfImageRenderResult = {
  dataUrl: string
  source: 'embedded_image' | 'page'
}

export const renderAltberichtPdfImageOrPageToPngDataUrl = async (
  pdfBytes: ArrayBuffer,
  page1Based: number,
  imageIndex: number,
  /** Skalierung nur für den Seiten-Fallback (Einzelbild bleibt nativ). */
  pageFallbackScale: number = ALTBERICHT_PRODUCTIVE_PAGE_SCALE,
  options?: AltberichtPdfJsCacheOptions
): Promise<AltberichtPdfImageRenderResult | null> => {
  if (typeof document === 'undefined') return null
  if (page1Based < 1 || imageIndex < 0) return null
  ensurePdfWorker()
  const { doc, owned } = await openPdfDocumentForRender(pdfBytes, options?.pdfCacheKey ?? null)
  let page: import('pdfjs-dist').PDFPageProxy | undefined
  try {
    if (page1Based > doc.numPages) return null
    page = await doc.getPage(page1Based)
    const opList = await page.getOperatorList()
    let seen = 0
    for (let i = 0; i < opList.fnArray.length; i += 1) {
      const fn = opList.fnArray[i]
      const kind =
        fn === pdfjs.OPS.paintImageXObject ||
        fn === pdfjs.OPS.paintInlineImageXObject ||
        fn === pdfjs.OPS.paintImageXObjectRepeat ||
        fn === pdfjs.OPS.paintInlineImageXObjectGroup
      if (!kind) continue
      if (seen !== imageIndex) {
        seen += 1
        continue
      }
      const args = opList.argsArray[i] as unknown[] | undefined
      const firstArg = args?.[0]
      const rawImage =
        typeof firstArg === 'string' ? await objectStoreGet(page, firstArg) : firstArg
      const imageDataUrl = imageLikeToPngDataUrl(rawImage)
      if (imageDataUrl) return { dataUrl: imageDataUrl, source: 'embedded_image' }
      break
    }
    const pageDataUrl = await renderPageToPng(page, pageFallbackScale)
    return pageDataUrl ? { dataUrl: pageDataUrl, source: 'page' } : null
  } catch {
    return null
  } finally {
    try {
      page?.cleanup()
    } catch {
      /* ignore */
    }
    if (owned) void doc.destroy()
  }
}
