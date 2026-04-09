/**
 * Compliance-Exporte: Zollprüfung (MiLoG § 17), Urlaubsbescheinigung (§ 6 Abs. 2 BUrlG)
 * PDFs nutzen optional den Mandanten-Briefbogen (shared, gleiches Supabase-Projekt).
 */
import { LEAVE_TYPE_LABELS } from './leaveService'
import { jsPDF } from 'jspdf'
import type { TimeEntry, TimeBreak } from '../types/time'
import { calcWorkMinutes } from '../../../shared/timeUtils'
import { formatDateTimeShort } from '../../../shared/format'
import { paintLetterheadRasterOnCurrentPage } from '../../../shared/pdfLetterhead'
import { fetchBriefbogenLetterheadPagesForPdf } from '../../../shared/briefbogenClient'

/** CSV für Zoll-/Mindestlohnprüfung (MiLoG § 17): Beginn, Ende, Dauer, Pausen */
export const exportZollCsv = (
  entries: TimeEntry[],
  breaksMap: Record<string, TimeBreak[]>,
  employeeName: string,
  fromDate: string,
  toDate: string
): void => {
  const header = 'Datum;Beginn;Ende;Pausen (Min);Arbeitszeit netto (Min);Mitarbeiter'
  const rows = entries.map((e) => {
    const breaks = breaksMap[e.id] ?? []
    const breakMin = breaks.reduce((s, b) => {
      if (!b.end) return s
      return s + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000)
    }, 0)
    const workMin = calcWorkMinutes(e, breaks)
    const startStr = e.start ? formatDateTimeShort(e.start) : ''
    const endStr = e.end ? formatDateTimeShort(e.end) : ''
    return [e.date, startStr, endStr, breakMin, workMin, employeeName.replace(/;/g, ',')].join(';')
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Zeiterfassung_Zollpruefung_${employeeName.replace(/\s+/g, '_')}_${fromDate}_${toDate}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** PDF für Zollprüfung (optional Briefbogen-Hintergrund pro Seite) */
export const exportZollPdf = async (
  entries: TimeEntry[],
  breaksMap: Record<string, TimeBreak[]>,
  employeeName: string,
  fromDate: string,
  toDate: string,
  supabase: unknown
): Promise<void> => {
  const letterheadPages = await fetchBriefbogenLetterheadPagesForPdf(supabase)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  if (letterheadPages) {
    paintLetterheadRasterOnCurrentPage(doc, letterheadPages, true)
  }
  doc.setFontSize(10)
  doc.text(`Zeiterfassung für Zoll-/Mindestlohnprüfung (MiLoG § 17)`, 14, 10)
  doc.text(`Mitarbeiter: ${employeeName} | Zeitraum: ${fromDate} bis ${toDate}`, 14, 16)
  doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, 14, 22)

  const colWidths = [22, 35, 35, 25, 35, 60]
  const headers = ['Datum', 'Beginn', 'Ende', 'Pausen (Min)', 'Arbeitszeit (Min)', 'Mitarbeiter']
  let y = 30

  doc.setFont('helvetica', 'bold')
  headers.forEach((h, i) => {
    doc.text(h, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y)
  })
  y += 7
  doc.setFont('helvetica', 'normal')

  for (const e of entries) {
    if (y > 180) {
      doc.addPage('a4', 'landscape')
      if (letterheadPages) {
        paintLetterheadRasterOnCurrentPage(doc, letterheadPages, false)
      }
      y = 20
    }
    const breaks = breaksMap[e.id] ?? []
    const breakMin = breaks.reduce((s, b) => {
      if (!b.end) return s
      return s + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000)
    }, 0)
    const workMin = calcWorkMinutes(e, breaks)
    const startStr = e.start ? formatDateTimeShort(e.start) : ''
    const endStr = e.end ? formatDateTimeShort(e.end) : ''
    const row = [e.date, startStr, endStr, String(breakMin), String(workMin), employeeName]
    row.forEach((cell, i) => {
      doc.text(String(cell).slice(0, 25), 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y)
    })
    y += 6
  }

  doc.text('Aufbewahrung: Mindestens 2 Jahre (ArbZG § 16, MiLoG § 17), empfohlen 8 Jahre (Steuerrecht).', 14, 195)
  doc.save(`Zeiterfassung_Zollpruefung_${employeeName.replace(/\s+/g, '_')}_${fromDate}_${toDate}.pdf`)
}

export type LeaveForBescheinigung = {
  from_date: string
  to_date: string
  leave_type: string
  days_count: number | null
}

/** Urlaubsbescheinigung gemäß § 6 Abs. 2 BUrlG (optional Briefbogen) */
export const exportUrlaubsbescheinigungPdf = async (
  employeeName: string,
  year: number,
  approvedLeaves: LeaveForBescheinigung[],
  entitlementDays: number | null,
  supabase: unknown
): Promise<void> => {
  const totalDays = approvedLeaves.reduce((s, l) => s + (l.days_count ?? 0), 0)
  const letterheadPages = await fetchBriefbogenLetterheadPagesForPdf(supabase)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  if (letterheadPages) {
    paintLetterheadRasterOnCurrentPage(doc, letterheadPages, true)
  }
  doc.setFontSize(14)
  doc.text('Urlaubsbescheinigung', 105, 25, { align: 'center' })
  doc.setFontSize(10)
  doc.text(`gemäß § 6 Abs. 2 Bundesurlaubsgesetz (BUrlG)`, 105, 32, { align: 'center' })
  doc.text('', 14, 45)
  doc.text(`Hiermit wird bestätigt, dass im Kalenderjahr ${year}`, 14, 55)
  doc.text(`folgende Urlaubstage gewährt bzw. abgegolten wurden:`, 14, 62)
  doc.text('', 14, 72)
  doc.text(`Mitarbeiter/in: ${employeeName}`, 14, 80)
  doc.text(`Urlaubsanspruch ${year}: ${entitlementDays ?? '–'} Tage`, 14, 88)
  doc.text(`Gewährte/abgegoltene Tage: ${totalDays.toFixed(1)}`, 14, 96)
  doc.text('', 14, 106)
  doc.text('Einzelne Zeiträume:', 14, 114)
  let y = 122
  for (const l of approvedLeaves) {
    if (y > 260) break
    doc.text(
      `  ${l.from_date} – ${l.to_date}: ${l.days_count ?? '–'} Tage (${LEAVE_TYPE_LABELS[l.leave_type as keyof typeof LEAVE_TYPE_LABELS] ?? l.leave_type})`,
      14,
      y
    )
    y += 7
  }
  doc.text('', 14, y + 10)
  doc.text(`Ort, Datum: _________________________`, 14, 270)
  doc.text(`Unterschrift Arbeitgeber/Vorgesetzter`, 14, 278)
  doc.save(`Urlaubsbescheinigung_${employeeName.replace(/\s+/g, '_')}_${year}.pdf`)
}
