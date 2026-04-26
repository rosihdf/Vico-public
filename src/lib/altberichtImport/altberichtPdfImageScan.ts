/**
 * Erkennung eingebetteter Bilder in PDFs über pdf.js Operatorliste (ohne OCR/CV).
 * Nur Browser (wie extractPdfText).
 */
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export const ALTBERICHT_PDF_IMAGE_SCAN_VERSION = 'pdfjs_operator_v1'

let workerConfigured = false

const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

export type AltberichtEmbeddedImageScanOpKind =
  | 'paintImageXObject'
  | 'paintInlineImageXObject'
  | 'paintImageMaskXObject'
  | 'paintInlineImageXObjectGroup'
  | 'paintImageMaskXObjectGroup'
  | 'paintImageXObjectRepeat'
  | 'paintImageMaskXObjectRepeat'
  | 'paintSolidColorImageMask'

export type AltberichtEmbeddedImageDraft = {
  pageNumber: number
  imageIndex: number
  opKind: AltberichtEmbeddedImageScanOpKind
}

export type ImagePaintOpsTable = {
  paintImageXObject: number
  paintInlineImageXObject: number
  paintImageMaskXObject: number
  paintInlineImageXObjectGroup: number
  paintImageMaskXObjectGroup: number
  paintImageXObjectRepeat: number
  paintImageMaskXObjectRepeat: number
  paintSolidColorImageMask: number
}

/** Reine Klassifikation (Unit-Tests mit Mock-`OPS` oder `pdfjs.OPS`). */
export const classifyImagePaintOp = (fn: number, OPS: ImagePaintOpsTable): AltberichtEmbeddedImageScanOpKind | null => {
  if (fn === OPS.paintImageXObject) return 'paintImageXObject'
  if (fn === OPS.paintInlineImageXObject) return 'paintInlineImageXObject'
  if (fn === OPS.paintImageMaskXObject) return 'paintImageMaskXObject'
  if (fn === OPS.paintInlineImageXObjectGroup) return 'paintInlineImageXObjectGroup'
  if (fn === OPS.paintImageMaskXObjectGroup) return 'paintImageMaskXObjectGroup'
  if (fn === OPS.paintImageXObjectRepeat) return 'paintImageXObjectRepeat'
  if (fn === OPS.paintImageMaskXObjectRepeat) return 'paintImageMaskXObjectRepeat'
  if (fn === OPS.paintSolidColorImageMask) return 'paintSolidColorImageMask'
  return null
}

export const collectEmbeddedImageDraftsFromFnArray = (fnArray: number[], OPS: ImagePaintOpsTable): AltberichtEmbeddedImageDraft[] => {
  const out: AltberichtEmbeddedImageDraft[] = []
  let imgOnPage = 0
  for (const fn of fnArray) {
    const kind = classifyImagePaintOp(fn, OPS)
    if (!kind) continue
    out.push({ pageNumber: 0, imageIndex: imgOnPage, opKind: kind })
    imgOnPage += 1
  }
  return out
}

/** Setzt Seitennummer (1-basiert) und fortlaufenden imageIndex pro Seite. */
export const finalizeDraftsPerPage = (
  perPage: AltberichtEmbeddedImageDraft[][]
): AltberichtEmbeddedImageDraft[] => {
  const all: AltberichtEmbeddedImageDraft[] = []
  for (let p = 0; p < perPage.length; p += 1) {
    const pageNum = p + 1
    const list = perPage[p]!
    for (let i = 0; i < list.length; i += 1) {
      all.push({ ...list[i]!, pageNumber: pageNum, imageIndex: i })
    }
  }
  return all
}

/**
 * Liefert pro eingebettetem Bild-Zeichenbefehl eine Zeile (Seite, Index, OP-Art).
 */
export const scanAltberichtPdfForEmbeddedImages = async (
  pdfBytes: ArrayBuffer
): Promise<AltberichtEmbeddedImageDraft[]> => {
  if (typeof window === 'undefined') {
    throw new Error('PDF-Bildscan nur im Browser möglich')
  }
  ensurePdfWorker()
  const data = new Uint8Array(pdfBytes)
  const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  const doc = await loadingTask.promise
  const OPS = pdfjs.OPS as ImagePaintOpsTable
  try {
    const perPage: AltberichtEmbeddedImageDraft[][] = []
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p)
      const opList = await page.getOperatorList()
      const fnArray = opList.fnArray
      const pageDrafts: AltberichtEmbeddedImageDraft[] = []
      for (const fn of fnArray) {
        const kind = classifyImagePaintOp(fn, OPS)
        if (!kind) continue
        pageDrafts.push({ pageNumber: p, imageIndex: pageDrafts.length, opKind: kind })
      }
      perPage.push(pageDrafts)
    }
    return finalizeDraftsPerPage(perPage)
  } finally {
    void doc.destroy()
  }
}
