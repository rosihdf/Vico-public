import { jsPDF } from 'jspdf'
import { paintLetterheadRasterOnCurrentPage, type LetterheadRasterPages } from '../../shared/pdfLetterhead'
import type { Order } from '../types'
import type { Object as Obj } from '../types'
import type { WartungChecklistItemState } from '../types/orderCompletionExtra'
import {
  getChecklistItemIdsForMode,
  getSectionAndLabelForItemId,
  type ChecklistDisplayMode,
  type ChecklistItemStatus,
} from './doorMaintenanceChecklistCatalog'
import {
  getFeststellChecklistItemIdsForMode,
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

export type PruefprotokollPdfInput = {
  order: Order
  customerName: string
  bvName: string
  object: Obj
  berichtDatum: string
  monteurName: string
  doorMode: ChecklistDisplayMode
  doorItems: Record<string, WartungChecklistItemState>
  feststellMode: ChecklistDisplayMode
  feststellItems: Record<string, FeststellChecklistItemState>
  includeFeststell: boolean
  defectPhotosByItem?: Record<string, Array<{ storage_path: string; caption?: string | null }>>
  /** Optional: Mandanten-Briefbogen (Erst-/Folgeseite bei 2-seitigem PDF) */
  letterheadPages?: LetterheadRasterPages | null
}

const objectStammdatenLines = (o: Obj): string[] => {
  const lines: string[] = []
  if (o.internal_id) lines.push(`Interne ID: ${o.internal_id}`)
  if (o.name) lines.push(`Bezeichnung: ${o.name}`)
  if (o.manufacturer) lines.push(`Hersteller: ${o.manufacturer}`)
  if (o.build_year != null) lines.push(`Baujahr: ${o.build_year}`)
  if (o.floor) lines.push(`Etage: ${o.floor}`)
  if (o.room) lines.push(`Raum: ${o.room}`)
  if (o.door_position) lines.push(`Türposition: ${o.door_position}`)
  return lines.length > 0 ? lines : ['(Keine technischen Stammdaten hinterlegt)']
}

export const generatePruefprotokollPdf = async (input: PruefprotokollPdfInput): Promise<Blob> => {
  const {
    order,
    customerName,
    bvName,
    object: obj,
    berichtDatum,
    monteurName,
    doorMode,
    doorItems,
    feststellMode,
    feststellItems,
    includeFeststell,
    defectPhotosByItem,
    letterheadPages,
  } = input

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  let y = margin

  const applyLetterheadIfSet = (isFirstPageOfDocument: boolean) => {
    if (letterheadPages) {
      paintLetterheadRasterOnCurrentPage(doc, letterheadPages, isFirstPageOfDocument)
    }
  }

  applyLetterheadIfSet(true)

  const addLine = (text: string, size = 10) => {
    if (y > 275) {
      doc.addPage()
      y = margin
      applyLetterheadIfSet(false)
    }
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, 180)
    for (const ln of lines) {
      doc.text(ln, margin, y)
      y += size * 0.45
    }
    y += 2
  }

  const addPhotos = async (itemKey: string) => {
    const photos = defectPhotosByItem?.[itemKey] ?? []
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
        if (y > 230) {
          doc.addPage()
          y = margin
          applyLetterheadIfSet(false)
        }
        doc.setFontSize(8)
        if (p.caption) addLine(`Foto: ${p.caption}`, 8)
        doc.addImage(dataUrl, 'JPEG', margin, y, 60, 45)
        y += 48
      } catch {
        /* ignore image errors in PDF generation */
      }
    }
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Prüfprotokoll / Wartungscheckliste', margin, y)
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  addLine(`Auftrag-ID: ${order.id}`)
  addLine(`Prüfdatum: ${berichtDatum}`)
  addLine(`Kunde: ${customerName}`)
  addLine(`Objekt/BV: ${bvName}`)
  addLine(`Ausführend: ${monteurName}`)
  addLine('')
  doc.setFont('helvetica', 'bold')
  addLine('Technische Daten Tür/Tor')
  doc.setFont('helvetica', 'normal')
  for (const ln of objectStammdatenLines(obj)) {
    addLine(ln)
  }
  addLine('')
  doc.setFont('helvetica', 'bold')
  addLine('Brandschutztür – Checkliste')
  doc.setFont('helvetica', 'normal')
  addLine(`Modus: ${doorMode === 'compact' ? 'Kompakt' : 'Detail'}`)
  addLine('Normen (Hinweis): DIN EN 1634, DIN EN 16034, DIN 4102, DIN 18040')

  for (const id of getChecklistItemIdsForMode(doorMode)) {
    const meta = getSectionAndLabelForItemId(doorMode, id)
    const label = meta ? `${meta.sectionTitle}: ${meta.label}` : id
    const row = doorItems[id]
    const st = statusDe(row?.status)
    const note = (row?.note ?? '').trim()
    addLine(`• ${label}: ${st}${note ? ` – ${note}` : ''}`)
    if (row?.status === 'mangel') {
      await addPhotos(`door:${id}`)
    }
  }

  if (includeFeststell) {
    addLine('')
    doc.setFont('helvetica', 'bold')
    addLine('Feststellanlage – Checkliste (DIN 14677)')
    doc.setFont('helvetica', 'normal')
    addLine(`Modus: ${feststellMode === 'compact' ? 'Kompakt' : 'Detail'}`)
    addLine('Normen (Hinweis): DIN 14677-1, DIN 14677-2; EN 14637 Referenz')

    const INTERVAL_SEC = 'sec-fst-intervall'
    for (const id of getFeststellChecklistItemIdsForMode(feststellMode)) {
      if (feststellMode === 'compact' && id === INTERVAL_SEC) {
        const m = feststellItems[FESTSTELL_MELDER_INTERVAL_ITEM_ID]?.melder_interval
        addLine(`• Wartung & Intervalle – Rauchmelder-Austausch: ${melderDe(m)}`)
        continue
      }
      if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) {
        const m = feststellItems[id]?.melder_interval
        const meta = getFeststellSectionAndLabelForItemId(feststellMode, id)
        const label = meta ? meta.label : id
        addLine(`• ${label}: ${melderDe(m)}`)
        continue
      }
      const meta = getFeststellSectionAndLabelForItemId(feststellMode, id)
      const label = meta ? `${meta.sectionTitle}: ${meta.label}` : id
      const row = feststellItems[id]
      const st = statusDe(row?.status)
      const note = (row?.note ?? '').trim()
      addLine(`• ${label}: ${st}${note ? ` – ${note}` : ''}`)
      if (row?.status === 'mangel') {
        await addPhotos(`feststell:${id}`)
      }
    }
  }

  addLine('')
  addLine('Unterschrift Kunde: entfällt auf diesem Prüfprotokoll (siehe Monteursbericht).', 9)

  return doc.output('blob')
}
