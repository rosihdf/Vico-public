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
import { getMaintenancePhotoUrl } from './dataService'
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
  /** Wie Prüfprotokoll: Adresszeilen unter Kunde / Objekt-BV. */
  customerAddressLines?: string[]
  bvAddressLines?: string[]
  showAddressMode?: 'both' | 'bv_only'
  /** Noch nicht hochgeladene Canvas-Signaturen (z. B. PDF ohne Zwischenspeichern). */
  pendingTechnicianSignatureDataUrl?: string | null
  pendingCustomerSignatureDataUrl?: string | null
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
    customerAddressLines,
    bvAddressLines,
    showAddressMode = 'both',
    pendingTechnicianSignatureDataUrl,
    pendingCustomerSignatureDataUrl,
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

  const QR_SIZE_MM = 28
  /** Text nicht in den QR-Bereich unten rechts schreiben */
  const bodyYMax = box.yMax - QR_SIZE_MM - 14

  const applyLetterheadIfSet = (isFirstPageOfDocument: boolean) => {
    if (letterheadPages) {
      paintLetterheadRasterOnCurrentPage(doc, letterheadPages, isFirstPageOfDocument)
    }
  }

  const newPage = () => {
    doc.addPage()
    y = yStartAfterBreak
    applyLetterheadIfSet(false)
  }

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm <= bodyYMax) return
    newPage()
  }

  const drawSeparator = () => {
    const minAfter = 10
    if (y > bodyYMax - (8 + minAfter)) newPage()
    doc.setDrawColor(205, 212, 222)
    doc.setLineWidth(0.3)
    doc.line(margin, y, margin + box.textWidth, y)
    y += 5
  }

  const addSectionHeader = (title: string) => {
    if (y > bodyYMax - 10) newPage()
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, y - 3.5, box.textWidth, 7, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 41, 55)
    doc.text(title, margin + 2, y + 1)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
  }

  /** Unterkapitel je Tür/Posten (heller Balken, wie Prüfprotokoll-Sektionen aber kompakter). */
  const addSubsectionHeader = (title: string) => {
    if (y > bodyYMax - 9) newPage()
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin + 1.5, y - 2.8, box.textWidth - 3, 5.6, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(51, 65, 85)
    const t = doc.splitTextToSize(String(title || '—'), box.textWidth - 8)[0] ?? '—'
    doc.text(t, margin + 3.5, y + 1)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
  }

  const addLine = (text: string, size = 10) => {
    if (y > bodyYMax - 8) newPage()
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, box.textWidth)
    for (const ln of lines) {
      if (y > bodyYMax - 6) newPage()
      doc.text(ln, margin, y)
      y += size * 0.45
    }
    y += 2
  }

  const fitContain = (srcW: number, srcH: number, maxW: number, maxH: number) => {
    if (!Number.isFinite(srcW) || !Number.isFinite(srcH) || srcW <= 0 || srcH <= 0) {
      return { w: maxW, h: maxH, x: 0, y: 0 }
    }
    const scale = Math.min(maxW / srcW, maxH / srcH)
    const w = srcW * scale
    const h = srcH * scale
    return { w, h, x: (maxW - w) / 2, y: (maxH - h) / 2 }
  }

  /** Darstellung wie Prüfprotokoll-Abschluss (Name, Bild, Zeitpunkt). */
  const appendDigitalSignatureBlock = async (
    rolleLabel: string,
    namePrinted: string | null | undefined,
    storagePath: string | null | undefined,
    dateIso: string | null | undefined,
    inlinePngDataUrl?: string | null
  ) => {
    const displayName = (namePrinted ?? '').trim() || '—'
    addLine(`${rolleLabel}: ${displayName}`, 10)
    const inline = inlinePngDataUrl?.trim()
    const path = storagePath?.trim()

    const paintFromDataUrl = async (dataUrl: string) => {
      const resp = await fetch(dataUrl)
      const blob = await resp.blob()
      const bitmap = await createImageBitmap(blob)
      const sigW = 52
      const sigH = 16
      const target = fitContain(bitmap.width, bitmap.height, sigW, sigH)
      ensureSpace(sigH + 12)
      doc.setFontSize(9)
      doc.text('Digital signiert:', margin, y)
      y += 2
      doc.addImage(dataUrl, 'PNG', margin + target.x, y + target.y, target.w, target.h)
      y += sigH + 2
      doc.setFontSize(8)
      const sigDate = dateIso ? new Date(dateIso).toLocaleString('de-DE') : ''
      if (sigDate) {
        doc.text(`Signaturzeitpunkt: ${sigDate}`, margin, y)
        y += 4
      }
    }

    try {
      if (path) {
        const sigUrl = getMaintenancePhotoUrl(path)
        if (sigUrl) {
          const resp = await fetch(sigUrl)
          const blob = await resp.blob()
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => resolve(String(r.result ?? ''))
            r.onerror = () => reject(new Error('Signatur-Lesen fehlgeschlagen'))
            r.readAsDataURL(blob)
          })
          await paintFromDataUrl(dataUrl)
          return
        }
        addLine('Digital signiert: nicht darstellbar', 9)
        return
      }
      if (inline?.startsWith('data:image')) {
        await paintFromDataUrl(inline)
        return
      }
      addLine('Digital signiert: nicht vorhanden', 9)
    } catch {
      addLine('Digital signiert: nicht darstellbar', 9)
    }
  }

  /** Zwei Spalten wie Prüfprotokoll: Kunde inkl. Adresse | Objekt/BV inkl. Adresse + Tür/Tor */
  const addKundeObjektEinsatzortWiePruefprotokoll = () => {
    const showCustomer = showAddressMode !== 'bv_only'
    const showBv = Boolean(bvName && !bvName.startsWith('—'))
    const colGap = 6
    const colW = (box.textWidth - colGap) / 2
    const leftX = margin
    const rightX = margin + colW + colGap
    const lineH = 4.1
    doc.setFontSize(9)

    const splitToCol = (src: string[]) =>
      src.flatMap((ln) => doc.splitTextToSize(String(ln), colW).map((line: string) => String(line)))

    const leftLines = showCustomer
      ? splitToCol([customerName, ...(customerAddressLines ?? [])].filter(Boolean))
      : []
    const rightBvLines = showBv ? splitToCol([bvName, ...(bvAddressLines ?? [])].filter(Boolean)) : []
    const objLines = splitToCol([objectLabel || '—'])

    let leftBottom = 0
    if (showCustomer) {
      leftBottom = lineH + leftLines.length * lineH
    }
    const rightBottom = showBv
      ? lineH + rightBvLines.length * lineH + lineH + objLines.length * lineH
      : lineH + objLines.length * lineH
    const blockH = Math.max(leftBottom, rightBottom) + 4
    ensureSpace(blockH)
    const yTop = y

    if (showCustomer) {
      doc.setFont('helvetica', 'bold')
      doc.text('Kunde', leftX, yTop)
      doc.setFont('helvetica', 'normal')
      let yy = yTop + lineH
      for (const ln of leftLines) {
        doc.text(ln, leftX, yy)
        yy += lineH
      }
    }

    if (showBv) {
      doc.setFont('helvetica', 'bold')
      doc.text('Objekt/BV', rightX, yTop)
      doc.setFont('helvetica', 'normal')
      let yy = yTop + lineH
      for (const ln of rightBvLines) {
        doc.text(ln, rightX, yy)
        yy += lineH
      }
      doc.setFont('helvetica', 'bold')
      doc.text('Tür / Tor (Auftrag)', rightX, yy)
      doc.setFont('helvetica', 'normal')
      yy += lineH
      for (const ln of objLines) {
        doc.text(ln, rightX, yy)
        yy += lineH
      }
    } else {
      doc.setFont('helvetica', 'bold')
      doc.text('Tür / Tor (Auftrag)', rightX, yTop)
      doc.setFont('helvetica', 'normal')
      let yy = yTop + lineH
      for (const ln of objLines) {
        doc.text(ln, rightX, yy)
        yy += lineH
      }
    }

    y = yTop + blockH
  }

  /** Label-Spalte + Wert-Spalte (Tabellencharakter). */
  const addKeyValueRows = (rows: Array<{ label: string; value: string }>) => {
    const labelColW = 46
    const gap = 3
    const valueW = box.textWidth - labelColW - gap
    for (const { label, value } of rows) {
      const valueLines = doc.splitTextToSize(value || '—', valueW)
      const rowH = Math.max(4.6, valueLines.length * 4.2)
      ensureSpace(rowH + 1)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.text(label, margin, y + 3.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(15, 23, 42)
      let vy = y + 3.5
      for (const vl of valueLines) {
        doc.text(vl, margin + labelColW + gap, vy)
        vy += 4.2
      }
      doc.setDrawColor(241, 245, 249)
      doc.setLineWidth(0.2)
      doc.line(margin, y + rowH, margin + box.textWidth, y + rowH)
      y += rowH + 1.2
    }
    doc.setTextColor(0, 0, 0)
    y += 2
  }

  applyLetterheadIfSet(true)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42)
  doc.text('Monteursbericht', margin, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text('Auftragsnachweis', margin, y)
  doc.setTextColor(0, 0, 0)
  y += 6

  drawSeparator()

  addSectionHeader('Kunde & Einsatzort')
  addKundeObjektEinsatzortWiePruefprotokoll()
  drawSeparator()

  addSectionHeader('Auftrag & Termin')
  addKeyValueRows([
    { label: 'Auftrag-ID', value: order.id },
    { label: 'Berichtsdatum', value: extra.bericht_datum || '—' },
    {
      label: 'Auftragsdatum',
      value: `${order.order_date || '—'}${order.order_time ? ` · ${order.order_time.slice(0, 5)}` : ''}`,
    },
    { label: 'Auftragsart', value: orderTypeLabel },
    { label: 'Monteur (Bericht)', value: extra.monteur_name || '—' },
  ])
  drawSeparator()

  const hasWartungDoors =
    order.order_type === 'wartung' &&
    ((wartungDoorSummaries && wartungDoorSummaries.length > 0) ||
      (wartungInspectedDoorLabels && wartungInspectedDoorLabels.length > 0))

  if (hasWartungDoors) {
    addSectionHeader('Geprüfte Türen (je Posten)')
    if (wartungDoorSummaries && wartungDoorSummaries.length > 0) {
      for (const s of wartungDoorSummaries) {
        addSubsectionHeader(s.doorLabel || '—')
        const statusText = s.passed ? 'Bestanden' : 'Nicht bestanden'
        doc.setFontSize(9)
        if (y > bodyYMax - 14) newPage()
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(71, 85, 105)
        doc.text('Prüfergebnis', margin + 3.5, y + 3.5)
        doc.setFont('helvetica', 'normal')
        if (s.passed) doc.setTextColor(22, 101, 52)
        else doc.setTextColor(185, 28, 28)
        doc.text(statusText, margin + 38, y + 3.5)
        doc.setTextColor(0, 0, 0)
        y += 5.5
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(71, 85, 105)
        doc.text('Mängel (Anzahl)', margin + 3.5, y + 3.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(15, 23, 42)
        doc.text(String(s.defects ?? 0), margin + 38, y + 3.5)
        y += 5.5
        const ref = (s.protocolRef ?? '').trim()
        if (ref) {
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(71, 85, 105)
          doc.text('Nachweis', margin + 3.5, y + 3.5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(71, 85, 105)
          const refLines = doc.splitTextToSize(ref, box.textWidth - 42)
          let ry = y + 3.5
          for (const rl of refLines) {
            doc.text(rl, margin + 38, ry)
            ry += 4.1
          }
          y = ry + 1
        }
        doc.setTextColor(0, 0, 0)
        y += 3
      }
    } else if (wartungInspectedDoorLabels && wartungInspectedDoorLabels.length > 0) {
      for (const lbl of wartungInspectedDoorLabels) {
        addSubsectionHeader(lbl)
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        addLine('Prüfprotokoll je Tür als separates PDF.', 9)
        doc.setTextColor(0, 0, 0)
      }
    }
    drawSeparator()
  }

  if (pruefprotokollKurzverweis) {
    addSectionHeader('Hinweis Prüfprotokoll')
    addLine(
      'Ausführliche Prüfprotokolle (Checklisten Brandschutztür / Feststellanlage) liegen je geprüfter Tür als separates PDF vor.',
      9
    )
    drawSeparator()
  }

  addSectionHeader('Ausgeführte Arbeiten')
  const arbeit = (completion.ausgeführte_arbeiten ?? '').split('\n').filter(Boolean)
  if (arbeit.length === 0) {
    addLine('—', 10)
  } else {
    for (const line of arbeit) addLine(line, 10)
  }
  drawSeparator()

  addSectionHeader('Arbeitszeit')
  addKeyValueRows([
    {
      label: 'Summe (berechnet)',
      value: `${sumWorkMinutes(extra.primary, extra.zusatz_monteure)} Min.`,
    },
    {
      label: 'Haupt-Monteur',
      value: `${extra.primary.start || '—'} – ${extra.primary.end || '—'}, Pause ${extra.primary.pause_minuten} Min.`,
    },
  ])

  if (extra.zusatz_monteure.length > 0) {
    addSubsectionHeader('Weitere Monteure')
    for (const z of extra.zusatz_monteure) {
      ensureSpace(6)
      doc.setFontSize(9)
      doc.text(
        `${z.name}: ${z.start || '—'} – ${z.end || '—'}, Pause ${z.pause_minuten} Min.`,
        margin + 3.5,
        y + 3.5
      )
      y += 6.5
    }
    y += 2
  }
  drawSeparator()

  const mat = materialLinesToText(extra.material_lines)
  if (mat) {
    addSectionHeader('Material')
    for (const row of mat.split('\n')) {
      addLine(row, 9)
    }
    drawSeparator()
  }

  addSectionHeader('Unterschriften')
  const monteurNamePdf =
    (completion.unterschrift_mitarbeiter_name ?? '').trim() ||
    (extra.monteur_name ?? '').trim() ||
    '—'
  await appendDigitalSignatureBlock(
    'Monteur',
    monteurNamePdf,
    completion.unterschrift_mitarbeiter_path,
    completion.unterschrift_mitarbeiter_date,
    pendingTechnicianSignatureDataUrl ?? null
  )
  await appendDigitalSignatureBlock(
    'Kunde',
    completion.unterschrift_kunde_name,
    completion.unterschrift_kunde_path,
    completion.unterschrift_kunde_date,
    pendingCustomerSignatureDataUrl ?? null
  )
  if (!completion.unterschrift_kunde_path?.trim() && (extra.customer_signature_reason ?? '').trim()) {
    addLine(`Hinweis ohne Kundenunterschrift: ${String(extra.customer_signature_reason).trim()}`, 9)
  }
  drawSeparator()

  const qrDataUrl = await QRCode.toDataURL(scanUrl, { margin: 1, width: 120 })
  const qrX = margin + box.textWidth - QR_SIZE_MM
  const qrY = box.yMax - QR_SIZE_MM - 2
  const pageNum = doc.getNumberOfPages()
  const yStartForQrLabel =
    letterheadPages && letterheadFollowPageCompactTop && pageNum > 1
      ? layoutForBriefbogenDinFollowPage(pageW, pageH, dinMargins).yStart
      : box.yStart
  const labelY = Math.max(yStartForQrLabel + 6, qrY - 4)
  doc.setPage(pageNum)
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, QR_SIZE_MM, QR_SIZE_MM)
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Scan: Auftrag', qrX, labelY)
  doc.setTextColor(0, 0, 0)

  return doc.output('blob')
}
