/**
 * PDF-Briefbogen → PNG-Data-URLs für jsPDF-Hintergrund.
 * Bei mehrseitigem PDF: Seite 1 = Erstdokument, Seite 2 = Folgeseiten (z. B. nur Fußzeile).
 * Nutzt pdf.js (nur Browser: Canvas).
 */
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let workerConfigured = false

const RENDER_SCALE = 2.5

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

const renderPdfPageToPngDataUrl = async (
  page: import('pdfjs-dist').PDFPageProxy
): Promise<string | null> => {
  const viewport = page.getViewport({ scale: RENDER_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const renderTask = page.render({ canvasContext: ctx, viewport })
  await renderTask.promise
  return canvas.toDataURL('image/png')
}

export type PdfLetterheadRasterPages = {
  firstPage: string | null
  followPage: string | null
}

/** Liest PDF, rasterisiert Seite 1; bei ≥2 Seiten Seite 2 als Folgevoralge, sonst = Seite 1. */
export const rasterizePdfBriefbogenToLetterheadPages = async (
  pdfBytes: ArrayBuffer
): Promise<PdfLetterheadRasterPages | null> => {
  if (typeof document === 'undefined') return null
  ensurePdfWorker()
  let doc: import('pdfjs-dist').PDFDocumentProxy | undefined
  try {
    const data = new Uint8Array(pdfBytes)
    const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
    doc = await loadingTask.promise
    if (doc.numPages < 1) return null
    const page1 = await doc.getPage(1)
    const firstPage = await renderPdfPageToPngDataUrl(page1)
    if (!firstPage) return null
    if (doc.numPages < 2) {
      return { firstPage, followPage: firstPage }
    }
    const page2 = await doc.getPage(2)
    const followRendered = await renderPdfPageToPngDataUrl(page2)
    return { firstPage, followPage: followRendered ?? firstPage }
  } catch {
    return null
  } finally {
    void doc?.destroy()
  }
}

export const renderPdfFirstPageToPngDataUrl = async (pdfBytes: ArrayBuffer): Promise<string | null> => {
  const r = await rasterizePdfBriefbogenToLetterheadPages(pdfBytes)
  return r?.firstPage ?? null
}
