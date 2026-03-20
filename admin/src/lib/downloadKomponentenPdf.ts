import { generateKomponentenPdf } from './generateKomponentenPdf'
import { komponentenPdfContent } from '../data/komponentenPdfContent'

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const downloadKomponentenPdf = () => {
  const blob = generateKomponentenPdf(komponentenPdfContent)
  triggerDownload(blob, 'Vico-Komponenten-Funktionen.pdf')
}
