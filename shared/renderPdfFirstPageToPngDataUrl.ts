/**
 * Erste PDF-Seite → PNG-Data-URL für jsPDF-Briefbogen-Hintergrund.
 * Nutzt pdf.js (nur Browser: Canvas).
 */
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let workerConfigured = false

const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

/** MIME-Sniff: %PDF- */
export const isPdfMagicBytes = (bytes: ArrayBuffer): boolean => {
  if (bytes.byteLength < 5) return false
  const a = new Uint8Array(bytes, 0, 5)
  return a[0] === 0x25 && a[1] === 0x50 && a[2] === 0x46 && a[3] === 0x44 && a[4] === 0x2d
}

export const renderPdfFirstPageToPngDataUrl = async (pdfBytes: ArrayBuffer): Promise<string | null> => {
  if (typeof document === 'undefined') return null
  ensurePdfWorker()
  let doc: import('pdfjs-dist').PDFDocumentProxy | undefined
  try {
    const data = new Uint8Array(pdfBytes)
    const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
    doc = await loadingTask.promise
    if (doc.numPages < 1) return null
    const page = await doc.getPage(1)
    const scale = 2.5
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const renderTask = page.render({ canvasContext: ctx, viewport })
    await renderTask.promise
    return canvas.toDataURL('image/png')
  } catch {
    return null
  } finally {
    void doc?.destroy()
  }
}
