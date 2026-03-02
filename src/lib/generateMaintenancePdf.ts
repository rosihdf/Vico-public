import { jsPDF } from 'jspdf'
import { getMaintenancePhotoUrl } from './dataService'
import type {
  MaintenanceReport,
  Customer,
  BV,
  Object as Obj,
  MaintenanceReason,
  MaintenanceUrgency,
  SmokeDetectorStatus,
} from '../types'

const REASON_LABELS: Record<MaintenanceReason | string, string> = {
  regelwartung: 'Regelwartung',
  reparatur: 'Reparatur',
  nachpruefung: 'Nachprüfung',
  sonstiges: 'Sonstiges',
}

const URGENCY_LABELS: Record<MaintenanceUrgency | string, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
}

const STATUS_LABELS: Record<SmokeDetectorStatus | string, string> = {
  ok: 'OK',
  defekt: 'Defekt',
  ersetzt: 'Ersetzt',
}

const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result as string)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export type MaintenancePdfData = {
  report: MaintenanceReport
  customer: Customer
  bv: BV
  object: Obj
  smokeDetectors: { label: string; status: SmokeDetectorStatus }[]
  photos: { storage_path: string | null; caption: string | null }[]
  technicianSignaturePath: string | null
  customerSignaturePath: string | null
}

export const generateMaintenancePdf = async (
  data: MaintenancePdfData
): Promise<Blob> => {
  const {
    report,
    customer,
    bv,
    object,
    smokeDetectors,
    photos,
    technicianSignaturePath,
    customerSignaturePath,
  } = data

  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin
  const lineH = 6
  const smallLineH = 5

  const addText = (text: string, opts?: { fontSize?: number; fontStyle?: string }) => {
    doc.setFontSize(opts?.fontSize ?? 10)
    doc.setFont('helvetica', (opts?.fontStyle as 'normal' | 'bold') ?? 'normal')
    doc.text(text, margin, y)
    y += opts?.fontSize ? opts.fontSize * 0.5 : lineH
  }

  addText('Wartungsprotokoll', { fontSize: 16, fontStyle: 'bold' })
  y += 4

  addText(`${customer.name}`, { fontSize: 12, fontStyle: 'bold' })
  if (bv.name && bv.name !== customer.name) {
    addText(`Betreuungsverantwortlich: ${bv.name}`, { fontSize: 10 })
  }
  const addr = [bv.street, [bv.postal_code, bv.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  if (addr) addText(addr, { fontSize: 9 })
  y += 4

  addText(`Objekt: ${object.internal_id ?? '–'}`, { fontSize: 10, fontStyle: 'bold' })
  if (object.door_position) addText(`Türposition: ${object.door_position}`)
  if (object.room) addText(`Raum: ${object.room}`)
  y += 4

  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  addText(`Datum: ${report.maintenance_date}${report.maintenance_time ? ` · ${report.maintenance_time}` : ''}`, { fontStyle: 'bold' })
  addText(`Prüfgrund: ${report.reason ? REASON_LABELS[report.reason] : '–'}${report.reason_other ? ` (${report.reason_other})` : ''}`)
  addText(`Wartung nach Herstellerangaben: ${report.manufacturer_maintenance_done ? 'Ja' : 'Nein'}`)
  if (object.has_hold_open) {
    addText(`Feststellanlage geprüft: ${report.hold_open_checked === true ? 'Ja' : report.hold_open_checked === false ? 'Nein' : '–'}`)
  }
  y += 4

  if (smokeDetectors.length > 0) {
    addText('Rauchmelder', { fontStyle: 'bold' })
    smokeDetectors.forEach((sd) => {
      addText(`  ${sd.label}: ${STATUS_LABELS[sd.status] || sd.status}`)
    })
    y += 4
  }

  if (report.deficiencies_found) {
    addText('Mängel festgestellt', { fontStyle: 'bold' })
    addText(report.deficiency_description || 'Keine Beschreibung')
    addText(`Dringlichkeit: ${report.urgency ? URGENCY_LABELS[report.urgency] : '–'}`)
    addText(`Sofort behoben: ${report.fixed_immediately ? 'Ja' : 'Nein'}`)
    y += 4
  }

  const hasSignatures = technicianSignaturePath || customerSignaturePath
  if (hasSignatures) {
    y += 4
    addText('Unterschriften', { fontStyle: 'bold' })
    const sigW = 45
    const sigH = 25
    const startX = margin

    if (technicianSignaturePath) {
      addText('Techniker:', { fontSize: 9 })
      const url = getMaintenancePhotoUrl(technicianSignaturePath)
      const base64 = await fetchImageAsBase64(url)
      if (base64) {
        try {
          doc.addImage(base64, 'PNG', startX, y, sigW, sigH)
        } catch {
          addText('[Signatur konnte nicht eingefügt werden]', { fontSize: 8 })
        }
      } else {
        addText('[Signatur nicht geladen]', { fontSize: 8 })
      }
      y += sigH + 2
      if (report.technician_name_printed) {
        addText(report.technician_name_printed, { fontSize: 9 })
      }
      y += 2
    }

    if (customerSignaturePath) {
      addText('Kunde:', { fontSize: 9 })
      const url = getMaintenancePhotoUrl(customerSignaturePath)
      const base64 = await fetchImageAsBase64(url)
      if (base64) {
        try {
          doc.addImage(base64, 'PNG', startX, y, sigW, sigH)
        } catch {
          addText('[Signatur konnte nicht eingefügt werden]', { fontSize: 8 })
        }
      } else {
        addText('[Signatur nicht geladen]', { fontSize: 8 })
      }
      y += sigH + 2
      if (report.customer_name_printed) {
        addText(report.customer_name_printed, { fontSize: 9 })
      }
      y += 2
    }
  }

  if (photos.length > 0) {
    y += 4
    if (y > 250) {
      doc.addPage()
      y = margin
    }
    addText('Fotos', { fontStyle: 'bold' })
    const imgW = 40
    const imgH = 30
    const imgGap = 4
    const captionH = 6
    const rowH = imgH + captionH
    const perRow = Math.floor((pageW - 2 * margin) / (imgW + imgGap))
    let col = 0
    for (const p of photos) {
      if (!p.storage_path) continue
      if (y + rowH > 285) {
        doc.addPage()
        y = margin
        col = 0
      }
      const x = margin + col * (imgW + imgGap)
      const url = getMaintenancePhotoUrl(p.storage_path)
      const base64 = await fetchImageAsBase64(url)
      if (base64) {
        const imgFormat = base64.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        try {
          doc.addImage(base64, imgFormat, x, y, imgW, imgH)
        } catch {
          doc.rect(x, y, imgW, imgH)
          doc.setFontSize(6)
          doc.text('Foto', x + 2, y + imgH / 2)
        }
      } else {
        doc.rect(x, y, imgW, imgH)
        doc.setFontSize(6)
        doc.text('–', x + 2, y + imgH / 2)
      }
      doc.setFontSize(7)
      doc.text((p.caption || '').slice(0, 28) || '–', x, y + imgH + 4)
      col++
      if (col >= perRow) {
        col = 0
        y += rowH + imgGap
      }
    }
    if (col > 0) y += rowH + imgGap
  }

  return doc.output('blob')
}
