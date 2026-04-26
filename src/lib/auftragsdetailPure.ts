import type { BV, Customer, OrderCompletion, OrderStatus, OrderType } from '../types'
import type { OrderCompletionExtraV1 } from '../types/orderCompletionExtra'
import type { MaintenanceReason } from '../types/maintenance'
import {
  FESTSTELL_MELDER_INTERVAL_ITEM_ID,
  type FeststellChecklistItemState,
} from './feststellChecklistCatalog'
import { sumWorkMinutes } from './monteurReportTime'
import { resolveReportDeliverySettings } from './reportDeliverySettings'

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  storniert: 'Storniert',
}

export const PROFILE_ROLES_ZUSATZ = new Set(['admin', 'mitarbeiter', 'teamleiter', 'operator'])
export const TIME_PICKER_HOURS = Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, '0'))
export const TIME_PICKER_MINUTES = Array.from({ length: 12 }, (_, idx) => String(idx * 5).padStart(2, '0'))

export const getTimeParts = (value: string): { hour: string; minute: string } => {
  const raw = (value ?? '').trim()
  if (!raw) return { hour: '', minute: '' }
  const [hour = '', minute = ''] = raw.split(':')
  return { hour: hour.slice(0, 2), minute: minute.slice(0, 2) }
}

export const mergeTimeParts = (hour: string, minute: string): string => {
  if (!hour && !minute) return ''
  return `${hour || '00'}:${minute || '00'}`
}

/** Minuten seit Mitternacht (nur gültige HH:MM) */
const hhmmToMinutesDay = (hhmm: string): number | null => {
  const raw = (hhmm ?? '').trim()
  if (!raw) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

const minutesDayToHhmm = (total: number): string => {
  const c = Math.max(0, Math.min(23 * 60 + 55, total))
  const h = Math.floor(c / 60)
  const min = c % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Ende nur am selben Kalendertag nach Beginn (Monteurbericht, 5-Minuten-Raster). */
export const clampEndAfterStartSameDay = (startHhmm: string, endHhmm: string): string => {
  const s = hhmmToMinutesDay(startHhmm)
  const e = hhmmToMinutesDay(endHhmm)
  if (s == null) return endHhmm
  if (e != null && e > s) return endHhmm
  const next = s + 5
  if (next > 23 * 60 + 55) return ''
  return minutesDayToHhmm(next)
}

export const endHourOptionsAfterStart = (startHhmm: string): string[] => {
  const sm = hhmmToMinutesDay(startHhmm)
  if (sm == null) return TIME_PICKER_HOURS
  return TIME_PICKER_HOURS.filter((h) => parseInt(h, 10) * 60 + 55 > sm)
}

export const endMinuteOptionsAfterStart = (startHhmm: string, endHour: string): string[] => {
  const sm = hhmmToMinutesDay(startHhmm)
  if (sm == null) return TIME_PICKER_MINUTES
  if (!endHour) return TIME_PICKER_MINUTES
  const eh = parseInt(endHour, 10)
  if (Number.isNaN(eh)) return TIME_PICKER_MINUTES
  return TIME_PICKER_MINUTES.filter((m) => eh * 60 + parseInt(m, 10) > sm)
}

export const normalizePauseMinutes = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value / 15) * 15
}

export const FESTSTELL_INTERVAL_SECTION_ID = 'sec-fst-intervall'

const getFeststellMelderInterval = (items: Record<string, FeststellChecklistItemState>) =>
  items[FESTSTELL_MELDER_INTERVAL_ITEM_ID]?.melder_interval

/** Eine gültige Melder-Option gewählt (inkl. „Nicht beurteilt“ / „Entfällt“) – analog validateFeststellChecklistComplete */
export const isFeststellMelderIntervalChosen = (items: Record<string, FeststellChecklistItemState>) => {
  const mi = getFeststellMelderInterval(items)
  return mi === 'ohne_5j' || mi === 'mit_8j' || mi === 'nicht_beurteilt' || mi === 'entfaellt'
}

export const orderTypeToMaintenanceReason = (t: OrderType): MaintenanceReason => {
  if (t === 'wartung') return 'regelwartung'
  if (t === 'reparatur') return 'reparatur'
  return 'sonstiges'
}

export const getMonteurReportRecipientEmail = (
  customer: Customer | undefined,
  bv: BV | undefined
): string | null => {
  const r = resolveReportDeliverySettings(customer, bv)
  if (!r.maintenance_report_email) return null
  return (r.maintenance_report_email_address || '').trim() || null
}

/** Einheitliche Pflichten für Monteursbericht vor Abschluss (Abstimmung „alles so“). */
export const getMonteurBerichtAbschlussBlocker = (p: {
  extra: OrderCompletionExtraV1
  ausgeführte: string
  completion: OrderCompletion | null
  printedTech: string
  printedCust: string
  sigTechDataUrl: string | null
  sigCustDataUrl: string | null
  monteurSignatureReplaceMode: boolean
  customerSignatureReplaceMode: boolean
}): string | null => {
  if (!p.extra.bericht_datum?.trim()) return 'Bitte ein Berichtsdatum angeben.'
  if (!p.ausgeführte.trim()) return 'Bitte „Ausgeführte Arbeiten“ ausfüllen.'
  if (sumWorkMinutes(p.extra.primary, p.extra.zusatz_monteure) <= 0) {
    return 'Bitte Arbeitszeit erfassen (Dauer größer 0 Min.).'
  }
  if (!p.printedTech.trim()) return 'Bitte Monteur-Namen für die Unterschrift angeben.'
  const techDraft =
    typeof p.sigTechDataUrl === 'string' && p.sigTechDataUrl.trim().startsWith('data:image')
  const techPath = Boolean(p.completion?.unterschrift_mitarbeiter_path?.trim())
  if (p.monteurSignatureReplaceMode && !techDraft) {
    return 'Bitte die neue Monteur-Unterschrift zeichnen.'
  }
  if (!techPath && !techDraft) return 'Bitte die Monteur-Unterschrift erfassen.'

  const hasCustDraft =
    typeof p.sigCustDataUrl === 'string' && p.sigCustDataUrl.trim().startsWith('data:image')
  const nameOk = p.printedCust.trim().length > 0
  const reasonOk = Boolean(p.extra.customer_signature_reason?.trim())
  const pathOnFile = Boolean(p.completion?.unterschrift_kunde_path?.trim())
  if (hasCustDraft) {
    return 'Bitte Kundennamen eintragen und die Kundenunterschrift speichern oder die Zeichnung löschen.'
  }
  if (p.customerSignatureReplaceMode) {
    return 'Bitte die Kunden-Unterschrift abschließen (Ersetzen beenden oder neu zeichnen).'
  }
  if (pathOnFile && !nameOk) return 'Bitte den Namen des Kunden bei der Unterschrift angeben.'
  if (!pathOnFile && !reasonOk) return 'Ohne Kundenunterschrift bitte einen Grund im Monteurbericht angeben.'
  return null
}
