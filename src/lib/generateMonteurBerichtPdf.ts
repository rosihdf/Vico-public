import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { paintLetterheadRasterOnCurrentPage, type LetterheadRasterPages } from '../../shared/pdfLetterhead'
import {
  DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM,
  layoutForBriefbogenDin,
  layoutForBriefbogenDinFollowPage,
  layoutPlain,
} from '../../shared/pdfBriefbogenLayout'
import type { BriefbogenDinMarginsMm } from '../../shared/pdfBriefbogenLayout'
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
  letterheadPages?: LetterheadRasterPages | null
  letterheadContentMargins?: BriefbogenDinMarginsMm | null
  letterheadFollowPageCompactTop?: boolean
  /** Wartung: automatische Liste geprüfter Türen (§7.2.4.4 / P2). */
  wartungInspectedDoorLabels?: string[]
  /** P8.F: Verweis, wenn Prüfprotokoll separat existiert. */
  pruefprotokollKurzverweis?: boolean
  /** Zusammenfassung je Tür für Wartung mit Prüfergebnis/Mängelzahl. */
  wartungDoorSummaries?: Array<{ doorLabel: string; passed: boolean; defects: number; protocolRef?: string | null }>
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
    letterheadPages,
    letterheadContentMargins,
    letterheadFollowPageCompactTop,
    wartungInspectedDoorLabels,
    pruefprotokollKurzverweis,
    wartungDoorSummaries,
  } = input

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const dinMargins = letterheadContentMargins ?? DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM
  const box = letterheadPages
    ? layoutForBriefbogenDin(pageW, pageH, dinMargins)
    : layoutPlain(pageW, pageH, 14)
  const yStartAfterBreak =
    letterheadPages && letterheadFollowPageCompactTop
      ? layoutForBriefbogenDinFollowPage(pageW, pageH, dinMargins).yStart
      : box.yStart
  const margin = box.left
  let y = box.yStart

  const applyLetterheadIfSet = (isFirstPageOfDocument: boolean) => {
    if (letterheadPages) {
      paintLetterheadRasterOnCurrentPage(doc, letterheadPages, isFirstPageOfDocument)
    }
  }

  applyLetterheadIfSet(true)

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
    ...(order.order_type === 'wartung' &&
    wartungInspectedDoorLabels &&
    wartungInspectedDoorLabels.length > 0
      ? ['Geprüfte Türen / Objekte:', ...wartungInspectedDoorLabels.map((l: string) => `  • ${l}`), '']
      : []),
    ...(pruefprotokollKurzverweis
      ? [
          'Hinweis: Ausführliches Prüfprotokoll (Checklisten Tür/Feststellanlage) liegt als separates PDF vor.',
          '',
        ]
      : []),
    `Ausgeführte Arbeiten:`,
    ...(completion.ausgeführte_arbeiten ?? '').split('\n').filter(Boolean).length
      ? (completion.ausgeführte_arbeiten ?? '').split('\n')
      : ['—'],
    '',
    `Arbeitszeit gesamt: ${sumWorkMinutes(extra.primary, extra.zusatz_monteure)} Min.`,
    `Haupt-Monteur: ${extra.primary.start || '—'} – ${extra.primary.end || '—'}, Pause ${extra.primary.pause_minuten} Min.`,
  ]

  for (const line of lines) {
    if (y > box.yMax - 8) {
      doc.addPage()
      y = yStartAfterBreak
      applyLetterheadIfSet(false)
    }
    doc.text(line, margin, y)
    y += 5
  }

  if (order.order_type === 'wartung' && wartungDoorSummaries && wartungDoorSummaries.length > 0) {
    if (y > box.yMax - 18) {
      doc.addPage()
      y = yStartAfterBreak
      applyLetterheadIfSet(false)
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Prüfzusammenfassung je Tür', margin, y)
    y += 6

    const col1 = Math.min(75, box.textWidth * 0.42)
    const col2 = 32
    const col3 = 18
    const col4 = box.textWidth - col1 - col2 - col3
    const rowH = 6
    const drawRow = (c1: string, c2: string, c3: string, c4: string, header = false) => {
      if (y > box.yMax - (rowH + 2)) {
        doc.addPage()
        y = yStartAfterBreak
        applyLetterheadIfSet(false)
      }
      if (header) {
        doc.setFillColor(241, 245, 249)
        doc.rect(margin, y - 4, box.textWidth, rowH, 'F')
        doc.setFont('helvetica', 'bold')
      } else {
        doc.setFont('helvetica', 'normal')
      }
      doc.setDrawColor(203, 213, 225)
      doc.rect(margin, y - 4, col1, rowH)
      doc.rect(margin + col1, y - 4, col2, rowH)
      doc.rect(margin + col1 + col2, y - 4, col3, rowH)
      doc.rect(margin + col1 + col2 + col3, y - 4, col4, rowH)
      doc.text(c1, margin + 1.5, y)
      doc.text(c2, margin + col1 + 1.5, y)
      doc.text(c3, margin + col1 + col2 + 1.5, y)
      doc.text(c4, margin + col1 + col2 + col3 + 1.5, y)
      y += rowH
    }

    drawRow('Tür/Tor', 'Status', 'Mängel', 'Protokoll', true)
    for (const summary of wartungDoorSummaries) {
      drawRow(
        String(summary.doorLabel || '—').slice(0, 60),
        summary.passed ? 'Bestanden' : 'Nicht best.',
        String(summary.defects ?? 0),
        String(summary.protocolRef || '—').slice(0, 40)
      )
    }
    y += 2
  }

  if (extra.zusatz_monteure.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Weitere Monteure:', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    for (const z of extra.zusatz_monteure) {
      if (y > box.yMax - 8) {
        doc.addPage()
        y = yStartAfterBreak
        applyLetterheadIfSet(false)
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
    if (y > box.yMax - 24) {
      doc.addPage()
      y = yStartAfterBreak
      applyLetterheadIfSet(false)
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
  const qrX = margin + box.textWidth - qrSize
  const qrY = box.yMax - qrSize - 2
  const pageNum = doc.getNumberOfPages()
  const yStartForQrLabel =
    letterheadPages && letterheadFollowPageCompactTop && pageNum > 1
      ? layoutForBriefbogenDinFollowPage(pageW, pageH, dinMargins).yStart
      : box.yStart
  const labelY = Math.max(yStartForQrLabel + 6, qrY - 4)
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
  doc.setFontSize(8)
  doc.text('Scan für schnellen Zugriff', qrX, labelY)

  return doc.output('blob')
}
