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
import type { Order } from '../types'
import type { Object as Obj } from '../types'
import type { WartungChecklistItemState } from '../types/orderCompletionExtra'
import {
  getChecklistItemIdsForMode,
  getChecklistItemNumberPrefix,
  getSectionAndLabelForItemId,
  type ChecklistDisplayMode,
  type ChecklistItemStatus,
} from './doorMaintenanceChecklistCatalog'
import {
  getFeststellChecklistItemIdsForMode,
  getFeststellChecklistItemNumberPrefix,
  getFeststellSectionAndLabelForItemId,
  FESTSTELL_MELDER_INTERVAL_ITEM_ID,
  type FeststellChecklistItemState,
} from './feststellChecklistCatalog'
import { getMaintenancePhotoUrl } from './dataService'

const statusDe = (s: ChecklistItemStatus | undefined): string => {
  if (!s) return '—'
  if (s === 'ok') return 'OK'
  if (s === 'mangel') return 'Mangel'
  if (s === 'nicht_geprueft') return 'Nicht geprüft'
  return 'Entfällt'
}

const melderDe = (m: FeststellChecklistItemState['melder_interval']): string => {
  if (m === 'ohne_5j') return 'Ohne Nachführung max. 5 J.'
  if (m === 'mit_8j') return 'Mit Nachführung max. 8 J.'
  if (m === 'nicht_beurteilt') return 'Nicht beurteilt'
  if (m === 'entfaellt') return 'Entfällt'
  return '—'
}

const buildDoorChecklistPdfHeading = (mode: ChecklistDisplayMode, id: string): string => {
  const num = getChecklistItemNumberPrefix(mode, id)
  const prefix = num ? `${num} ` : ''
  const meta = getSectionAndLabelForItemId(mode, id)
  if (mode === 'compact' && meta) return `${prefix}${meta.sectionTitle}`
  if (meta) return `${prefix}${meta.sectionTitle}: ${meta.label}`
  return `${prefix}${id}`
}

const buildFeststellChecklistPdfHeading = (mode: ChecklistDisplayMode, id: string): string => {
  const num = getFeststellChecklistItemNumberPrefix(mode, id)
  const prefix = num ? `${num} ` : ''
  const meta = getFeststellSectionAndLabelForItemId(mode, id)
  if (mode === 'compact' && meta) return `${prefix}${meta.sectionTitle}`
  if (meta) return `${prefix}${meta.sectionTitle}: ${meta.label}`
  return `${prefix}${id}`
}

export type PruefprotokollPdfInput = {
  /** Anzeige im Fuß, z. B. `PP-000042` (laufende Nummer) oder `PP-ENTW-…` bei Entwurf. */
  pruefprotokollNummer: string
  order: Order
  customerName: string
  bvName: string
  object: Obj
  berichtDatum: string
  monteurName: string
  customerAddressLines?: string[]
  bvAddressLines?: string[]
  showAddressMode?: 'both' | 'bv_only'
  portalProtocolUrl?: string | null
  doorMode: ChecklistDisplayMode
  doorItems: Record<string, WartungChecklistItemState>
  feststellMode: ChecklistDisplayMode
  feststellItems: Record<string, FeststellChecklistItemState>
  includeFeststell: boolean
  defectPhotosByItem?: Record<string, Array<{ storage_path: string; caption?: string | null }>>
  /** Optional: Mandanten-Briefbogen (Erst-/Folgeseite bei 2-seitigem PDF) */
  letterheadPages?: LetterheadRasterPages | null
  letterheadContentMargins?: BriefbogenDinMarginsMm | null
  letterheadFollowPageCompactTop?: boolean
  technicianSignaturePath?: string | null
  technicianSignatureDate?: string | null
}

const objectStammdatenLines = (o: Obj): string[] => {
  const lines: string[] = []
  const doorName = (o.name ?? '').trim()
  if (doorName) lines.push(`Tür / Tor: ${doorName}`)
  if (o.manufacturer) lines.push(`Hersteller: ${o.manufacturer}`)
  if (o.build_year != null) lines.push(`Baujahr: ${o.build_year}`)
  if (o.floor) lines.push(`Etage: ${o.floor}`)
  if (o.room) lines.push(`Raum: ${o.room}`)
  if (o.door_position) lines.push(`Türposition: ${o.door_position}`)
  return lines.length > 0 ? lines : ['(Keine technischen Stammdaten hinterlegt)']
}

const countMangels = (items: Record<string, { status?: ChecklistItemStatus }>): number =>
  Object.values(items).filter((r) => r?.status === 'mangel').length

const formatDateDe = (raw: string): string => {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return t
  return d.toLocaleDateString('de-DE')
}

/**
 * Anzeige im PDF-Fuß: laufende Nummer `PP-000042` aus DB, sonst Entwurfs-Kennung (kein Report / alte DB).
 */
export const formatPruefprotokollNummerForPdf = (
  pruefprotokollLaufnummer: number | null | undefined,
  orderId: string,
  objectId: string
): string => {
  if (pruefprotokollLaufnummer != null && Number.isFinite(pruefprotokollLaufnummer) && pruefprotokollLaufnummer > 0) {
    return `PP-${String(Math.trunc(pruefprotokollLaufnummer)).padStart(6, '0')}`
  }
  const o = orderId.replace(/-/g, '').slice(0, 8)
  const ob = objectId.replace(/-/g, '').slice(0, 8)
  return `PP-ENTW-${o}-${ob}`
}

export const generatePruefprotokollPdf = async (input: PruefprotokollPdfInput): Promise<Blob> => {
  const {
    pruefprotokollNummer,
    customerName,
    bvName,
    object: obj,
    berichtDatum,
    monteurName,
    customerAddressLines,
    bvAddressLines,
    showAddressMode,
    portalProtocolUrl,
    doorMode,
    doorItems,
    feststellMode,
    feststellItems,
    includeFeststell,
    defectPhotosByItem,
    letterheadPages,
    letterheadContentMargins,
    letterheadFollowPageCompactTop,
    technicianSignaturePath,
    technicianSignatureDate,
  } = input

  const willDrawPortalQr = Boolean(portalProtocolUrl?.trim())
  /** Unten rechts auf dem **Blatt** (Seitenrand), nicht nur im Textfeld. */
  const PORTAL_QR_SIZE_MM = 26
  const PORTAL_QR_MARGIN_MM = 7

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

  /** Abstand Blattunterkante → untere Kante QR (mm). Größer = QR höher; inkl. Platz für „Portal-Link“ unter dem QR oberhalb der Fußzeile. */
  const bottomBandForQrMm = 32
  const portalQrTopY = pageH - bottomBandForQrMm - PORTAL_QR_SIZE_MM
  /** Mit Portal-QR: Texthöhe begrenzen, sonst läuft der Fließtext in den QR-Bereich (Überlappung mit QR/Fuß). */
  const contentYMax = willDrawPortalQr ? Math.min(box.yMax, portalQrTopY - 4) : box.yMax

  const applyLetterheadIfSet = (isFirstPageOfDocument: boolean) => {
    if (letterheadPages) {
      paintLetterheadRasterOnCurrentPage(doc, letterheadPages, isFirstPageOfDocument)
    }
  }

  applyLetterheadIfSet(true)

  const drawSeparator = () => {
    const minSpaceAfterSeparator = 10
    // Verhindert "verwaiste" Trennlinien am Seitenende:
    // Linie und nachfolgender Inhalt bleiben zusammen.
    if (y > contentYMax - (8 + minSpaceAfterSeparator)) {
      doc.addPage()
      y = yStartAfterBreak
      applyLetterheadIfSet(false)
    }
    doc.setDrawColor(205, 212, 222)
    doc.setLineWidth(0.3)
    doc.line(margin, y, margin + box.textWidth, y)
    y += 5
  }

  const addSectionHeader = (title: string) => {
    if (y > contentYMax - 10) {
      doc.addPage()
      y = yStartAfterBreak
      applyLetterheadIfSet(false)
    }
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, y - 3.5, box.textWidth, 7, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title, margin + 2, y + 1)
    y += 8
    doc.setFont('helvetica', 'normal')
  }

  const addLine = (text: string, size = 10) => {
    if (y > contentYMax - 8) {
      doc.addPage()
      y = yStartAfterBreak
      applyLetterheadIfSet(false)
    }
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, box.textWidth)
    for (const ln of lines) {
      if (y > contentYMax - 6) {
        doc.addPage()
        y = yStartAfterBreak
        applyLetterheadIfSet(false)
      }
      doc.text(ln, margin, y)
      y += size * 0.45
    }
    y += 2
  }

  const ensureSpaceForBlock = (requiredHeight: number) => {
    if (y + requiredHeight <= contentYMax) return
    doc.addPage()
    y = yStartAfterBreak
    applyLetterheadIfSet(false)
  }

  /** Seitenumbruch mitten in der Checkliste: neue Seite beginnt mit derselben Sektion (Fortsetzung). */
  const ensureSpaceForChecklistItem = (requiredHeight: number, checklistSectionTitle: string) => {
    if (y + requiredHeight <= contentYMax) return
    doc.addPage()
    y = yStartAfterBreak
    applyLetterheadIfSet(false)
    addSectionHeader(`${checklistSectionTitle} (Fortsetzung)`)
  }

  const estimateLineBlockHeight = (text: string, size = 10, width = box.textWidth) => {
    const lines = doc.splitTextToSize(text, width)
    return lines.length * size * 0.45 + 2
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

  const drawStatusBadge = (status: ChecklistItemStatus | undefined, x: number, yTop: number) => {
    const st = status ?? undefined
    const cfg =
      st === 'ok'
        ? { label: 'OK', icon: 'ok' as const, iconColor: [22, 163, 74] as const }
        : st === 'mangel'
          ? { label: 'MANGEL', icon: 'mangel' as const, iconColor: [220, 38, 38] as const }
          : st === 'nicht_geprueft'
            ? { label: 'NICHT GEPRÜFT', icon: 'neutral' as const, iconColor: [71, 85, 105] as const }
            : { label: 'ENTFÄLLT', icon: 'neutral' as const, iconColor: [71, 85, 105] as const }
    const iconCx = x + 3.2
    const iconCy = yTop + 3.25
    doc.setDrawColor(cfg.iconColor[0], cfg.iconColor[1], cfg.iconColor[2])
    doc.setLineWidth(0.5)
    if (cfg.icon === 'ok') {
      doc.circle(iconCx, iconCy, 1.8)
      doc.line(iconCx - 1.0, iconCy + 0.1, iconCx - 0.2, iconCy + 1.0)
      doc.line(iconCx - 0.2, iconCy + 1.0, iconCx + 1.2, iconCy - 0.8)
    } else if (cfg.icon === 'mangel') {
      doc.circle(iconCx, iconCy, 1.8)
      doc.line(iconCx - 0.9, iconCy - 0.9, iconCx + 0.9, iconCy + 0.9)
      doc.line(iconCx - 0.9, iconCy + 0.9, iconCx + 0.9, iconCy - 0.9)
    } else {
      doc.circle(iconCx, iconCy, 1.8)
      doc.line(iconCx - 0.9, iconCy, iconCx + 0.9, iconCy)
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(31, 41, 55)
    doc.text(cfg.label, x + 6.2, yTop + 4.4)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
  }

  const mangelLayout = (() => {
    const colGap = 4
    const leftW = Math.max(42, box.textWidth * 0.42 - colGap / 2)
    const rightW = box.textWidth - leftW - colGap
    const photoGap = 2
    const thumbW = (rightW - photoGap * 2) / 3
    const thumbH = 28
    const leftLineH = 4
    return { colGap, leftW, rightW, photoGap, thumbW, thumbH, leftLineH }
  })()

  const estimateMangelDetailsHeight = (status: string, note: string, advisoryNote = '') => {
    const statusLines = doc.splitTextToSize(`Status: ${status}`, mangelLayout.leftW)
    const noteLines = note ? doc.splitTextToSize(`Mangelhinweis: ${note}`, mangelLayout.leftW) : []
    const advisoryLines = advisoryNote
      ? doc.splitTextToSize(`Hinweis/empfohlene Maßnahme: ${advisoryNote}`, mangelLayout.leftW)
      : []
    const leftLinesTotal = statusLines.length + noteLines.length + advisoryLines.length
    const leftH = Math.max(mangelLayout.thumbH, leftLinesTotal * mangelLayout.leftLineH + 2)
    return Math.max(mangelLayout.thumbH, leftH) + 2
  }

  const estimateHintDetailsHeight = (status: string, hint: string) => {
    const statusLines = doc.splitTextToSize(`Status: ${status}`, mangelLayout.leftW)
    const hintLines = hint ? doc.splitTextToSize(`Hinweis/empfohlene Maßnahme: ${hint}`, mangelLayout.leftW) : []
    const leftLinesTotal = statusLines.length + hintLines.length
    const leftH = Math.max(mangelLayout.thumbH, leftLinesTotal * mangelLayout.leftLineH + 2)
    return Math.max(mangelLayout.thumbH, leftH) + 2
  }

  const addMangelDetailsWithPhotos = async (itemKey: string, status: string, note: string, advisoryNote = '') => {
    const photos = (defectPhotosByItem?.[itemKey] ?? []).slice(0, 3)
    const noteText = note ? `Mangelhinweis: ${note}` : ''
    const noteLines = noteText ? doc.splitTextToSize(noteText, mangelLayout.leftW) : []
    const advisoryText = advisoryNote ? `Hinweis/empfohlene Maßnahme: ${advisoryNote}` : ''
    const advisoryLines = advisoryText ? doc.splitTextToSize(advisoryText, mangelLayout.leftW) : []
    const blockH = estimateMangelDetailsHeight(status, note, advisoryNote)

    const blockTop = y
    const leftX = margin
    const rightX = margin + mangelLayout.leftW + mangelLayout.colGap

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    drawStatusBadge('mangel', leftX, blockTop)
    let leftY = blockTop + 9.3
    for (const ln of noteLines) {
      doc.text(ln, leftX, leftY)
      leftY += mangelLayout.leftLineH
    }
    for (const ln of advisoryLines) {
      doc.text(ln, leftX, leftY)
      leftY += mangelLayout.leftLineH
    }

    let idx = 0
    for (const p of photos) {
      const url = getMaintenancePhotoUrl(p.storage_path)
      if (!url) continue
      try {
        const resp = await fetch(url)
        const blob = await resp.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result ?? ''))
          r.onerror = () => reject(new Error('Bild-Lesen fehlgeschlagen'))
          r.readAsDataURL(blob)
        })
        const bitmap = await createImageBitmap(blob)
        const target = fitContain(bitmap.width, bitmap.height, mangelLayout.thumbW, mangelLayout.thumbH)
        const x = rightX + idx * (mangelLayout.thumbW + mangelLayout.photoGap)
        doc.addImage(dataUrl, 'JPEG', x + target.x, blockTop + target.y, target.w, target.h)
        idx += 1
      } catch {
        /* ignore image errors in PDF generation */
      }
    }

    y = blockTop + blockH
  }

  const addHintDetailsWithPhotos = async (itemKey: string, status: string, hint: string) => {
    const photos = (defectPhotosByItem?.[itemKey] ?? []).slice(0, 3)
    const hintText = hint ? `Hinweis/empfohlene Maßnahme: ${hint}` : ''
    const hintLines = hintText ? doc.splitTextToSize(hintText, mangelLayout.leftW) : []
    const blockH = estimateHintDetailsHeight(status, hint)
    const blockTop = y
    const leftX = margin
    const rightX = margin + mangelLayout.leftW + mangelLayout.colGap

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    drawStatusBadge('ok', leftX, blockTop)
    let leftY = blockTop + 9.3
    for (const ln of hintLines) {
      doc.text(ln, leftX, leftY)
      leftY += mangelLayout.leftLineH
    }
    let idx = 0
    for (const p of photos) {
      const url = getMaintenancePhotoUrl(p.storage_path)
      if (!url) continue
      try {
        const resp = await fetch(url)
        const blob = await resp.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result ?? ''))
          r.onerror = () => reject(new Error('Bild-Lesen fehlgeschlagen'))
          r.readAsDataURL(blob)
        })
        const bitmap = await createImageBitmap(blob)
        const target = fitContain(bitmap.width, bitmap.height, mangelLayout.thumbW, mangelLayout.thumbH)
        const x = rightX + idx * (mangelLayout.thumbW + mangelLayout.photoGap)
        doc.addImage(dataUrl, 'JPEG', x + target.x, blockTop + target.y, target.w, target.h)
        idx += 1
      } catch {
        /* ignore image errors in PDF generation */
      }
    }
    y = blockTop + blockH
  }

  const paintDocumentFooters = () => {
    const totalPages = doc.getNumberOfPages()
    const footerY = pageH - 5.5
    const nrText = `Prüfprotokoll-Nr. ${pruefprotokollNummer}`
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    const lineStep = 3.2
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p)
      const nrLines = doc.splitTextToSize(nrText, Math.min(box.textWidth * 0.58, 95))
      let yy = footerY - (nrLines.length - 1) * lineStep
      for (const line of nrLines) {
        doc.text(line, margin, yy)
        yy += lineStep
      }
      const pageLabel = `Seite ${p} / ${totalPages}`
      const pageWLabel = doc.getTextWidth(pageLabel)
      let pageLabelX = margin + box.textWidth - pageWLabel
      if (willDrawPortalQr && p === totalPages) {
        const qrLeftX = pageW - PORTAL_QR_MARGIN_MM - PORTAL_QR_SIZE_MM
        pageLabelX = Math.max(margin, qrLeftX - 5 - pageWLabel)
      }
      doc.text(pageLabel, pageLabelX, footerY)
    }
    doc.setTextColor(0, 0, 0)
  }

  const addAddressColumns = () => {
    const showCustomer = showAddressMode !== 'bv_only'
    const showBv = Boolean(bvName && !bvName.startsWith('—'))
    if (!showCustomer && !showBv) return

    const colGap = 6
    const colW = (box.textWidth - colGap) / 2
    const leftX = margin
    const rightX = margin + colW + colGap
    const lineH = 4.1

    const customerLines: string[] = showCustomer
      ? [customerName, ...(customerAddressLines ?? [])].filter(Boolean)
      : []
    const bvLines: string[] = showBv
      ? ['Objekt/BV', bvName, ...(bvAddressLines ?? [])].filter(Boolean)
      : []

    const splitLines = (src: string[]) =>
      src.flatMap((ln) => doc.splitTextToSize(String(ln), colW).map((line: string) => String(line)))

    const leftLines = splitLines(customerLines)
    const rightLines = splitLines(bvLines)
    const rows = Math.max(leftLines.length, rightLines.length, 1)
    const blockH = rows * lineH + 4
    ensureSpaceForBlock(blockH)

    const yTop = y
    if (showCustomer) {
      doc.setFont('helvetica', 'normal')
      let yy = yTop
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
      for (const ln of rightLines.slice(1)) {
        doc.text(ln, rightX, yy)
        yy += lineH
      }
    }
    y = yTop + blockH
  }

  const doorMangels = countMangels(doorItems)
  const festMangels = includeFeststell ? countMangels(feststellItems) : 0
  const totalMangels = doorMangels + festMangels
  const passed = totalMangels === 0
  const normLabel = includeFeststell
    ? 'nach DIN EN 1634 / DIN EN 16034 / DIN 4102 / DIN 18040 / DIN 14677'
    : 'nach DIN EN 1634 / DIN EN 16034 / DIN 4102 / DIN 18040'

  const titleMain = 'Prüfprotokoll'
  const titleNumPart = ` · ${pruefprotokollNummer}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  const wMain = doc.getTextWidth(titleMain)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const wNum = doc.getTextWidth(titleNumPart)
  const fullTitleW = wMain + wNum
  if (fullTitleW <= box.textWidth - 2) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(titleMain, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(titleNumPart, margin + wMain, y + 0.8)
    y += 7
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    const wrap = doc.splitTextToSize(`${titleMain}${titleNumPart}`, box.textWidth)
    let wy = y
    for (const tl of wrap) {
      doc.text(tl, margin, wy)
      wy += 5.4
    }
    y = wy
  }
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(normLabel, margin, y)
  y += 6
  drawSeparator()
  doc.setFont('helvetica', 'normal')
  addLine(`Geprüft am: ${formatDateDe(berichtDatum)}`)
  addAddressColumns()
  drawSeparator()

  const objStLines = objectStammdatenLines(obj)
  const pruefobjektBlockH =
    8 + objStLines.reduce((acc, ln) => acc + estimateLineBlockHeight(ln, 10), 0) + 10
  ensureSpaceForBlock(pruefobjektBlockH)
  addSectionHeader('Prüfobjekt')
  for (const ln of objStLines) addLine(ln)
  drawSeparator()

  const DOOR_CHECKLIST_SECTION = 'Checkliste Brandschutztür'
  addSectionHeader(DOOR_CHECKLIST_SECTION)

  for (const id of getChecklistItemIdsForMode(doorMode)) {
    const label = buildDoorChecklistPdfHeading(doorMode, id)
    const row = doorItems[id]
    const st = statusDe(row?.status)
    const note = (row?.note ?? '').trim()
    const advisory = Boolean(row?.advisory)
    const advisoryNote = (row?.advisory_note ?? '').trim()
    const estimatedItemHeight =
      estimateLineBlockHeight(label, 10) +
      (row?.status === 'mangel'
        ? estimateMangelDetailsHeight(st, note, advisory ? advisoryNote : '')
        : advisory
          ? estimateHintDetailsHeight(st, advisoryNote)
          : estimateLineBlockHeight(`Status: ${st}`, 9) + (note ? estimateLineBlockHeight(`Mangelhinweis: ${note}`, 9) : 0)) +
      3
    ensureSpaceForChecklistItem(estimatedItemHeight, DOOR_CHECKLIST_SECTION)
    doc.setFont('helvetica', 'bold')
    addLine(label, 10)
    doc.setFont('helvetica', 'normal')
    if (row?.status === 'mangel') {
      await addMangelDetailsWithPhotos(`door:${id}`, st, note, advisory ? advisoryNote : '')
    } else if (advisory) {
      await addHintDetailsWithPhotos(`door:${id}`, st, advisoryNote)
    } else {
      const blockH = 8 + (note ? estimateLineBlockHeight(`Mangelhinweis: ${note}`, 9) : 0)
      ensureSpaceForChecklistItem(blockH, DOOR_CHECKLIST_SECTION)
      drawStatusBadge(row?.status, margin, y - 1)
      y += 7
      if (note) addLine(`Mangelhinweis: ${note}`, 9)
    }
    drawSeparator()
  }

  const FEST_CHECKLIST_SECTION = 'Checkliste Feststellanlage'

  if (includeFeststell) {
    addSectionHeader(FEST_CHECKLIST_SECTION)
    addLine('Norm: DIN 14677')
    drawSeparator()

    const INTERVAL_SEC = 'sec-fst-intervall'
    for (const id of getFeststellChecklistItemIdsForMode(feststellMode)) {
      if (feststellMode === 'compact' && id === INTERVAL_SEC) {
        const m = feststellItems[FESTSTELL_MELDER_INTERVAL_ITEM_ID]?.melder_interval
        const p = getFeststellChecklistItemNumberPrefix(feststellMode, INTERVAL_SEC)
        const prefix = p ? `${p} ` : ''
        const intervalLine = `${prefix}Wartung & Intervalle – Rauchmelder-Austausch: ${melderDe(m)}`
        ensureSpaceForChecklistItem(estimateLineBlockHeight(intervalLine, 10) + 8, FEST_CHECKLIST_SECTION)
        addLine(intervalLine)
        drawSeparator()
        continue
      }
      if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) {
        const m = feststellItems[id]?.melder_interval
        const num = getFeststellChecklistItemNumberPrefix(feststellMode, id)
        const np = num ? `${num} ` : ''
        const meta = getFeststellSectionAndLabelForItemId(feststellMode, id)
        const label = meta ? meta.label : id
        const melderLine = `${np}${label}: ${melderDe(m)}`
        ensureSpaceForChecklistItem(estimateLineBlockHeight(melderLine, 10) + 8, FEST_CHECKLIST_SECTION)
        addLine(melderLine)
        drawSeparator()
        continue
      }
      const label = buildFeststellChecklistPdfHeading(feststellMode, id)
      const row = feststellItems[id]
      const st = statusDe(row?.status)
      const note = (row?.note ?? '').trim()
      const advisory = Boolean(row?.advisory)
      const advisoryNote = (row?.advisory_note ?? '').trim()
      const estimatedItemHeight =
        estimateLineBlockHeight(label, 10) +
        (row?.status === 'mangel'
          ? estimateMangelDetailsHeight(st, note, advisory ? advisoryNote : '')
          : advisory
            ? estimateHintDetailsHeight(st, advisoryNote)
            : estimateLineBlockHeight(`Status: ${st}`, 9) + (note ? estimateLineBlockHeight(`Mangelhinweis: ${note}`, 9) : 0)) +
        3
      ensureSpaceForChecklistItem(estimatedItemHeight, FEST_CHECKLIST_SECTION)
      doc.setFont('helvetica', 'bold')
      addLine(label, 10)
      doc.setFont('helvetica', 'normal')
      if (row?.status === 'mangel') {
        await addMangelDetailsWithPhotos(`feststell:${id}`, st, note, advisory ? advisoryNote : '')
      } else if (advisory) {
        await addHintDetailsWithPhotos(`feststell:${id}`, st, advisoryNote)
      } else {
        const blockH = 8 + (note ? estimateLineBlockHeight(`Mangelhinweis: ${note}`, 9) : 0)
        ensureSpaceForChecklistItem(blockH, FEST_CHECKLIST_SECTION)
        drawStatusBadge(row?.status, margin, y - 1)
        y += 7
        if (note) addLine(`Mangelhinweis: ${note}`, 9)
      }
      drawSeparator()
    }
  }

  const estimateAbschlussBlockHeight = (): number => {
    let h = 8 + 24 + 6 + estimateLineBlockHeight(`Geprüft von (Prüfer): ${monteurName}`, 10)
    if (technicianSignaturePath) h += 4 + 18 + 8
    else h += estimateLineBlockHeight('Digital signiert (Prüfer): nicht vorhanden', 9) + 4
    return h + 8
  }
  ensureSpaceForBlock(estimateAbschlussBlockHeight())
  addSectionHeader('Abschluss')

  const summaryTop = y
  const summaryH = 22
  if (passed) {
    doc.setFillColor(236, 253, 245)
    doc.setDrawColor(134, 239, 172)
  } else {
    doc.setFillColor(254, 226, 226)
    doc.setDrawColor(252, 165, 165)
  }
  doc.setLineWidth(0.4)
  doc.rect(margin, summaryTop, box.textWidth, summaryH, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  if (passed) doc.setTextColor(21, 128, 61)
  else doc.setTextColor(185, 28, 28)
  doc.text(`Prüfung: ${passed ? 'Bestanden' : 'Nicht bestanden'}`, margin + 3, summaryTop + 8)
  doc.setFontSize(11)
  doc.text(`Mängel gesamt: ${totalMangels}`, margin + 3, summaryTop + 16)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  y = summaryTop + summaryH + 5

  addLine(`Geprüft von (Prüfer): ${monteurName}`)
  if (technicianSignaturePath) {
    try {
      const sigUrl = getMaintenancePhotoUrl(technicianSignaturePath)
      if (sigUrl) {
        const resp = await fetch(sigUrl)
        const blob = await resp.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result ?? ''))
          r.onerror = () => reject(new Error('Signatur-Lesen fehlgeschlagen'))
          r.readAsDataURL(blob)
        })
        const bitmap = await createImageBitmap(blob)
        const sigW = 52
        const sigH = 16
        const target = fitContain(bitmap.width, bitmap.height, sigW, sigH)
        ensureSpaceForBlock(sigH + 10)
        doc.setFontSize(9)
        doc.text('Digital signiert (Prüfer):', margin, y)
        y += 2
        doc.addImage(dataUrl, 'PNG', margin + target.x, y + target.y, target.w, target.h)
        y += sigH + 2
        doc.setFontSize(8)
        const sigDate = technicianSignatureDate ? new Date(technicianSignatureDate).toLocaleString('de-DE') : ''
        if (sigDate) doc.text(`Signaturzeitpunkt: ${sigDate}`, margin, y)
        y += 4
      } else {
        addLine('Digital signiert (Prüfer)', 9)
      }
    } catch {
      addLine('Digital signiert (Prüfer)', 9)
    }
  } else {
    addLine('Digital signiert (Prüfer): nicht vorhanden', 9)
  }

  let portalQrDataUrl: string | null = null
  if (willDrawPortalQr) {
    try {
      portalQrDataUrl = await QRCode.toDataURL(portalProtocolUrl!.trim(), { margin: 1, width: 200 })
    } catch {
      portalQrDataUrl = null
    }
  }

  if (portalQrDataUrl) {
    const tpBefore = doc.getNumberOfPages()
    doc.setPage(tpBefore)
    if (y > portalQrTopY - 2) {
      doc.addPage()
      y = yStartAfterBreak
      applyLetterheadIfSet(false)
    }
  }

  paintDocumentFooters()

  if (portalQrDataUrl) {
    const tp = doc.getNumberOfPages()
    doc.setPage(tp)
    const qrX = pageW - PORTAL_QR_MARGIN_MM - PORTAL_QR_SIZE_MM
    const qrY = portalQrTopY
    doc.addImage(portalQrDataUrl, 'PNG', qrX, qrY, PORTAL_QR_SIZE_MM, PORTAL_QR_SIZE_MM)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(100, 116, 139)
    const cap = 'Portal-Link'
    const capW = doc.getTextWidth(cap)
    doc.text(cap, qrX + Math.max(0, (PORTAL_QR_SIZE_MM - capW) / 2), qrY + PORTAL_QR_SIZE_MM + 3.2)
    doc.setTextColor(0, 0, 0)
  }
  return doc.output('blob')
}
