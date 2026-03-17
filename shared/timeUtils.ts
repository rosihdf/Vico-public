/** Gemeinsame Zeit-Utilities für Zeiterfassung (Haupt-App, Arbeitszeitenportal) */

export const TIME_ENTRY_COLUMNS =
  'id, user_id, date, start, end, notes, order_id, created_at, updated_at, location_start_lat, location_start_lon, location_end_lat, location_end_lon, approval_status, approved_by, approved_at'
export const TIME_BREAK_COLUMNS = 'id, time_entry_id, start, end, created_at'

const toLocalDateStr = (x: Date): string =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`

/** Liefert Montag und Sonntag (lokales Datum) der Woche, die dateStr enthält (YYYY-MM-DD). */
export const getWeekBounds = (dateStr: string): { from: string; to: string } => {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toLocalDateStr(monday), to: toLocalDateStr(sunday) }
}

/** Erster und letzter Tag des Monats (lokales Datum) für dateStr (YYYY-MM-DD). */
export const getMonthBounds = (dateStr: string): { from: string; to: string } => {
  const d = new Date(dateStr + 'T12:00:00')
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from: toLocalDateStr(first), to: toLocalDateStr(last) }
}

export type TimeEntryLike = { start: string; end: string | null }
export type TimeBreakLike = { start: string; end: string | null }

/** Berechnet Arbeitsminuten (Start–Ende minus Pausen). */
export const calcWorkMinutes = (
  entry: TimeEntryLike,
  breaks: TimeBreakLike[]
): number => {
  const start = new Date(entry.start).getTime()
  const end = entry.end ? new Date(entry.end).getTime() : Date.now()
  let total = (end - start) / 60000
  for (const b of breaks) {
    const bStart = new Date(b.start).getTime()
    const bEnd = b.end ? new Date(b.end).getTime() : Date.now()
    total -= (bEnd - bStart) / 60000
  }
  return Math.max(0, Math.floor(total))
}
