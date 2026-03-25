import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { paintLetterheadOnCurrentPage } from '../../shared/pdfLetterhead'
import type { Order, OrderCompletion } from '../types'
import { materialLinesToText, type OrderCompletionExtraV1 } from '../types/orderCompletionExtra'
import { sumWorkMinutes } from './monteurReportTime'

export type MonteurBerichtPdfInput = {
  order: Order
  completion: OrderCompletion
  extra: OrderCompletionExtraV1
  customerName: string
  bvName: string
  objectLabel: string
  orderTypeLabel: string
  /** Vollständige URL für QR (z. B. Link zum Auftrag) */
  scanUrl: string
  letterheadDataUrl?: string | null
}

export const generateMonteurBerichtPdf = async (input: MonteurBerichtPdfInput): Promise<Blob> => {
  const {
    order,
    completion,
    extra,
    customerName,
    bvName,
    objectLabel,
    orderTypeLabel,
    scanUrl,
    letterheadDataUrl,
  } = input

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  if (letterheadDataUrl) {
    paintLetterheadOnCurrentPage(doc, letterheadDataUrl)
  }

  doc.setFontSize(16)
  doc.text('Monteursbericht / Auftragsnachweis', margin, y)
  y += 8

  doc.setFontSize(10)
  const lines = [
    `Auftrag-ID: ${order.id}`,
    `Berichtsdatum: ${extra.bericht_datum}`,
    `Auftragsdatum: ${order.order_date}${order.order_time ? ` ${order.order_time.slice(0, 5)}` : ''}`,
    `Art: ${orderTypeLabel}`,
    `Kunde: ${customerName}`,
    `Objekt/BV: ${bvName}`,
    `Tür/Tor: ${objectLabel}`,
    `Monteur: ${extra.monteur_name}`,
    '',
    `Ausgeführte Arbeiten:`,
    ...(completion.ausgeführte_arbeiten ?? '').split('\n').filter(Boolean).length
      ? (completion.ausgeführte_arbeiten ?? '').split('\n')
      : ['—'],
    '',
    `Arbeitszeit gesamt: ${sumWorkMinutes(extra.primary, extra.zusatz_monteure)} Min.`,
    `Haupt-Monteur: ${extra.primary.start || '—'} – ${extra.primary.end || '—'}, Pause ${extra.primary.pause_minuten} Min.`,
  ]

  for (const line of lines) {
    if (y > 270) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin, y)
    y += 5
  }

  if (extra.zusatz_monteure.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Weitere Monteure:', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    for (const z of extra.zusatz_monteure) {
      if (y > 270) {
        doc.addPage()
        y = margin
      }
      doc.text(
        `${z.name}: ${z.start || '—'} – ${z.end || '—'}, Pause ${z.pause_minuten} Min.`,
        margin,
        y
      )
      y += 5
    }
  }

  const mat = materialLinesToText(extra.material_lines)
  if (mat) {
    if (y > 250) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.text('Material:', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    for (const row of mat.split('\n')) {
      doc.text(row, margin, y)
      y += 5
    }
  }

  const qrDataUrl = await QRCode.toDataURL(scanUrl, { margin: 1, width: 120 })
  const qrSize = 28
  doc.addImage(qrDataUrl, 'PNG', pageW - margin - qrSize, 250, qrSize, qrSize)
  doc.setFontSize(8)
  doc.text('Scan für schnellen Zugriff', pageW - margin - qrSize, 248)

  return doc.output('blob')
}
