/**
 * On-demand-Rendering von Positions-Block-Ausschnitten.
 *
 * Ablauf:
 *  1. PDF aus Storage laden (Caller-Verantwortung).
 *  2. pdf.js TextContent extrahieren → Position-Anker (siehe altberichtPositionBlockGeometry.ts).
 *  3. Pro Sequenz die Seite vollständig in Canvas rendern und vertikal auf den Block-Bereich
 *     zuschneiden (PDF-Y → Canvas-Y über `viewport.transform`).
 *
 * Block-Render läuft pro Position isoliert (try/catch). Eine fehlschlagende Position
 * blockiert die anderen nicht.
 */

import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import {
  buildAltberichtPositionBlockBoxes,
  buildAltberichtPositionBlockBoxLookup,
  type AltberichtPositionBlockBox,
  type AltberichtPositionBlockBoxLookup,
} from './altberichtPositionBlockGeometry'
import { releaseTransientCanvas } from './altberichtPdfPageThumb'

let workerConfigured = false
const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

/**
 * In-Memory-Cache pro Datei: vermeidet, dass für jede Position separat
 * der gleiche Geometrie-Pass über das PDF läuft. Schlüssel ist Caller-Verantwortung
 * (z. B. file_id + parsed_at als Cache-Bust).
 */
const geometryCache = new Map<string, AltberichtPositionBlockBoxLookup>()

export const getCachedAltberichtPositionBlockLookup = (
  cacheKey: string
): AltberichtPositionBlockBoxLookup | undefined => geometryCache.get(cacheKey)

export const setCachedAltberichtPositionBlockLookup = (
  cacheKey: string,
  lookup: AltberichtPositionBlockBoxLookup
): void => {
  geometryCache.set(cacheKey, lookup)
}

export const clearAltberichtPositionBlockGeometryCache = (cacheKey?: string): void => {
  if (cacheKey === undefined) geometryCache.clear()
  else geometryCache.delete(cacheKey)
}

type PdfTextItemRaw = {
  str?: unknown
  transform?: unknown
  height?: unknown
}

const readBaselineYFromTransform = (transform: unknown): number | null => {
  if (!Array.isArray(transform) || transform.length < 6) return null
  const f = Number(transform[5])
  return Number.isFinite(f) ? f : null
}

const readItemHeight = (item: PdfTextItemRaw): number => {
  if (typeof item.height === 'number' && Number.isFinite(item.height)) return item.height
  if (Array.isArray(item.transform) && item.transform.length >= 4) {
    const d = Number(item.transform[3])
    if (Number.isFinite(d) && d > 0) return d
  }
  return 12
}

export const computeAltberichtPositionBlockBoxesFromPdfBytes = async (
  pdfBytes: ArrayBuffer
): Promise<AltberichtPositionBlockBox[]> => {
  if (typeof window === 'undefined') return []
  ensurePdfWorker()
  const data = new Uint8Array(pdfBytes.slice(0))
  const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  const doc = await loadingTask.promise
  try {
    const pages: Array<{
      pageNumber: number
      pageWidth: number
      pageHeight: number
      items: Array<{ text: string; baselineY: number; height: number }>
    }> = []
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items: Array<{ text: string; baselineY: number; height: number }> = []
      for (const raw of content.items as unknown as PdfTextItemRaw[]) {
        if (!raw || typeof raw !== 'object') continue
        const text = typeof raw.str === 'string' ? raw.str : ''
        if (!text.trim()) continue
        const baselineY = readBaselineYFromTransform(raw.transform)
        if (baselineY == null) continue
        items.push({ text, baselineY, height: readItemHeight(raw) })
      }
      pages.push({
        pageNumber: p,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        items,
      })
    }
    return buildAltberichtPositionBlockBoxes(pages)
  } finally {
    void doc.destroy()
  }
}

export type AltberichtPositionBlockRenderResult = {
  blob: Blob
  /** Block-Box, die tatsächlich verwendet wurde (nützlich für Debug/Anzeige). */
  box: AltberichtPositionBlockBox
}

export type AltberichtPositionBlockRenderError =
  | { code: 'no_block_for_sequence' }
  | { code: 'render_failed'; message: string }
  | { code: 'block_too_small' }

export const renderAltberichtPositionBlockToBlob = async (
  pdfBytes: ArrayBuffer,
  sequence: number,
  cachedLookup?: AltberichtPositionBlockBoxLookup,
  options: { scale?: number; type?: string; quality?: number } = {}
): Promise<AltberichtPositionBlockRenderResult | AltberichtPositionBlockRenderError> => {
  if (typeof window === 'undefined') return { code: 'render_failed', message: 'Browser-only' }
  ensurePdfWorker()

  let lookup = cachedLookup
  if (!lookup) {
    const boxes = await computeAltberichtPositionBlockBoxesFromPdfBytes(pdfBytes)
    lookup = buildAltberichtPositionBlockBoxLookup(boxes)
  }
  const box = lookup.bySequence.get(sequence)
  if (!box) return { code: 'no_block_for_sequence' }
  if (box.yTop - box.yBottom < 8) return { code: 'block_too_small' }

  const data = new Uint8Array(pdfBytes.slice(0))
  const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  let doc: pdfjs.PDFDocumentProxy | null = null
  let page: pdfjs.PDFPageProxy | null = null
  let canvas: HTMLCanvasElement | null = null
  let cropCanvas: HTMLCanvasElement | null = null
  try {
    doc = await loadingTask.promise
    page = await doc.getPage(box.pageNumber)
    const scale = options.scale ?? 1.5
    const viewport = page.getViewport({ scale })
    canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { code: 'render_failed', message: 'Canvas-Kontext nicht verfügbar' }
    await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0])
      .promise

    /**
     * PDF-Y → Canvas-Y umrechnen. viewport.height ist Pixelhöhe; PDF-Y wächst nach oben,
     * Canvas-Y nach unten. Mapping: canvasY = (pageHeight - pdfY) * scale.
     */
    const canvasYTop = Math.max(0, Math.floor((box.pageHeight - box.yTop) * scale) - 4)
    const canvasYBottom = Math.min(canvas.height, Math.ceil((box.pageHeight - box.yBottom) * scale) + 4)
    const cropHeight = Math.max(8, canvasYBottom - canvasYTop)

    cropCanvas = document.createElement('canvas')
    cropCanvas.width = canvas.width
    cropCanvas.height = cropHeight
    const cropCtx = cropCanvas.getContext('2d')
    if (!cropCtx) return { code: 'render_failed', message: 'Crop-Kontext nicht verfügbar' }
    cropCtx.drawImage(
      canvas,
      0,
      canvasYTop,
      canvas.width,
      cropHeight,
      0,
      0,
      canvas.width,
      cropHeight
    )
    const blob: Blob | null = await new Promise((resolve) =>
      cropCanvas!.toBlob((b) => resolve(b), options.type ?? 'image/jpeg', options.quality ?? 0.85)
    )
    if (!blob) return { code: 'render_failed', message: 'toBlob lieferte null' }
    return { blob, box }
  } catch (e) {
    return { code: 'render_failed', message: e instanceof Error ? e.message : String(e) }
  } finally {
    releaseTransientCanvas(canvas)
    releaseTransientCanvas(cropCanvas)
    try {
      page?.cleanup()
    } catch {
      /* ignore pdf.js cleanup quirks */
    }
    void doc?.destroy()
  }
}
