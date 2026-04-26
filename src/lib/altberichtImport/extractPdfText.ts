/**
 * Volltext aus PDF (Browser, pdf.js) – für Altbericht-Parser.
 */
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let workerConfigured = false

const ensurePdfWorker = (): void => {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

export const extractPdfPlainText = async (pdfBytes: ArrayBuffer): Promise<string> => {
  if (typeof window === 'undefined') {
    throw new Error('PDF-Textextraktion nur im Browser möglich')
  }
  ensurePdfWorker()
  const data = new Uint8Array(pdfBytes)
  const loadingTask = pdfjs.getDocument({ data, disableRange: true, disableStream: true })
  const doc = await loadingTask.promise
  try {
    const pageTexts: string[] = []
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const line = content.items
        .map((item) => (item && typeof item === 'object' && 'str' in item ? String((item as { str: string }).str) : ''))
        .join(' ')
      pageTexts.push(line.trim())
    }
    return pageTexts.filter(Boolean).join('\n\n').trim()
  } finally {
    void doc.destroy()
  }
}
