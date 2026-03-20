import { jsPDF } from 'jspdf'

const PAGE_H = 297
const MARGIN = 20
const MARGIN_BOTTOM = 25
const LINE_HEIGHT = 5
const FONT_SIZE = 10

export const generateKomponentenPdf = (content: string): Blob => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageW = doc.internal.pageSize.getWidth()
  const maxWidth = pageW - 2 * MARGIN
  let y = MARGIN

  const checkPageBreak = () => {
    if (y > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage()
      y = MARGIN
    }
  }

  const addLine = (text: string, opts?: { bold?: boolean; fontSize?: number }) => {
    checkPageBreak()
    doc.setFontSize(opts?.fontSize ?? FONT_SIZE)
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, MARGIN, y)
    y += lines.length * (opts?.fontSize ?? FONT_SIZE) * 0.5
  }

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      y += LINE_HEIGHT * 0.5
      continue
    }
    const isSectionHeader = /^\d+\.\s/.test(line) && !line.includes('Route:') && !line.includes('Funktionen:')
    const isMainHeader = /^[0-9]+\.\s/.test(line) && line.length < 60
    if (isMainHeader && !line.includes(':')) {
      addLine(line, { bold: true, fontSize: 11 })
    } else if (isSectionHeader) {
      addLine(line, { bold: true })
    } else {
      addLine(line)
    }
  }

  return doc.output('blob')
}
