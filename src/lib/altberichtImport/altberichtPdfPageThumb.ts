/**
 * Kleine Vorschau einer einzelnen PDF-Seite (nur Browser, pdf.js) — Altbericht-Import Experte.
 */
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const THUMB_SCALE = 0.4

let workerConfigured = false

const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

const renderPageToPng = async (page: import('pdfjs-dist').PDFPageProxy, scale: number): Promise<string | null> => {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const task = page.render({ canvasContext: ctx, viewport })
  await task.promise
  return canvas.toDataURL('image/png')
}

export const renderAltberichtPdfPageToPngDataUrl = async (
  pdfBytes: ArrayBuffer,
  page1Based: number
): Promise<string | null> => {
  if (typeof document === 'undefined') return null
  if (page1Based < 1) return null
  ensurePdfWorker()
  let doc: import('pdfjs-dist').PDFDocumentProxy | undefined
  try {
    const data = new Uint8Array(pdfBytes)
    const task = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
    doc = await task.promise
    if (page1Based > doc.numPages) return null
    const page = await doc.getPage(page1Based)
    return await renderPageToPng(page, THUMB_SCALE)
  } catch {
    return null
  } finally {
    void doc?.destroy()
  }
}
