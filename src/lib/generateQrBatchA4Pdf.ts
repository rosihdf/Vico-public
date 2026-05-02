import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import { getObjectDeepLinkUrl } from './objectQrUrl'

export type QrBatchPreset = 'mini' | 'mid' | 'max'

/** Zellmaße orientiert an HERMA/Avery-Referenz (siehe Vico.md §7.6.5). */
const PRESET_MM: Record<QrBatchPreset, { cellW: number; cellH: number; description: string }> = {
  mini: { cellW: 48.3, cellH: 25.4, description: 'Mini (~48,3×25,4 mm)' },
  mid: { cellW: 52.5, cellH: 29.7, description: 'Mittel (~52,5×29,7 mm)' },
  max: { cellW: 63.5, cellH: 38.1, description: 'Groß (~63,5×38,1 mm)' },
}

export type QrBatchPdfItem = {
  customerId: string
  bvId: string | null
  objectId: string
  objectName: string
  customerName: string
  bvName: string
}

export type GenerateQrBatchA4PdfOptions = {
  items: QrBatchPdfItem[]
  preset: QrBatchPreset
  /** z. B. Mandanten-App-Name (PDF-Metadaten) */
  brandLine?: string
}

const PAGE_W_MM = 210
const PAGE_H_MM = 297
const MARGIN_MM = 10
const GAP_MM = 2

const computeGrid = (cellW: number, cellH: number): { cols: number; perPage: number } => {
  const usableW = PAGE_W_MM - 2 * MARGIN_MM
  const usableH = PAGE_H_MM - 2 * MARGIN_MM
  const cols = Math.max(1, Math.floor((usableW + GAP_MM) / (cellW + GAP_MM)))
  const rowCount = Math.max(1, Math.floor((usableH + GAP_MM) / (cellH + GAP_MM)))
  return { cols, perPage: cols * rowCount }
}

/**
 * Erzeugt ein A4-PDF mit mehreren QR-Etiketten (eine URL pro Objekt).
 * Layout: Raster aus Zellmaßen + Abstand; automatischer Seitenumbruch.
 */
export const generateQrBatchA4Pdf = async (options: GenerateQrBatchA4PdfOptions): Promise<Blob> => {
  const { items, preset, brandLine } = options
  if (items.length === 0) {
    throw new Error('Keine Objekte ausgewählt.')
  }

  const { cellW, cellH } = PRESET_MM[preset]
  const { cols, perPage } = computeGrid(cellW, cellH)

  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' })
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(210, 210, 210)

  for (let i = 0; i < items.length; i++) {
    if (i > 0 && i % perPage === 0) {
      doc.addPage()
    }

    const localIndex = i % perPage
    const col = localIndex % cols
    const row = Math.floor(localIndex / cols)
    const x = MARGIN_MM + col * (cellW + GAP_MM)
    const y = MARGIN_MM + row * (cellH + GAP_MM)

    const item = items[i]
    const url = getObjectDeepLinkUrl(item.customerId, item.bvId, item.objectId)

    doc.setLineWidth(0.15)
    doc.rect(x, y, cellW, cellH)

    const pad = 1.2
    const textBlockReserve = Math.min(13, cellH * 0.42)
    const qrMm = Math.max(
      8,
      Math.min(cellW - 2 * pad, cellH - 2 * pad - textBlockReserve)
    )
    const qrX = x + (cellW - qrMm) / 2
    let cursorY = y + pad

    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 320,
    })
    doc.addImage(qrDataUrl, 'PNG', qrX, cursorY, qrMm, qrMm)
    cursorY += qrMm + 1.2

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    const titleLines = doc.splitTextToSize(item.objectName, cellW - 2 * pad).slice(0, 2)
    for (const line of titleLines) {
      doc.text(line, x + pad, cursorY)
      cursorY += 2.6
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    const subLines = doc
      .splitTextToSize(`${item.customerName} · ${item.bvName.trim() ? item.bvName : '–'}`, cellW - 2 * pad)
      .slice(0, 2)
    for (const line of subLines) {
      doc.text(line, x + pad, cursorY)
      cursorY += 2.3
    }
  }

  doc.setProperties({
    title: brandLine ? `${brandLine} – QR-Etiketten` : 'QR-Etiketten',
    subject: `ArioVan A4 QR-Batch (${PRESET_MM[preset].description})`,
  })

  return doc.output('blob')
}

export const getQrBatchPresetDescription = (preset: QrBatchPreset): string => PRESET_MM[preset].description
