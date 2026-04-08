/** Hilfen für Wartungs-Ampel und Fälligkeit im Tür/Tor-Formular */

export type MaintenanceAmpel = 'gray' | 'red' | 'green'

const parseYmd = (s: string): { y: number; m: number; d: number } | null => {
  const t = s.trim().slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, m: mo, d }
}

/** Liefert ISO-Datum (YYYY-MM-DD) `dateStr` + `months` Monate (Kalendermonate). */
export const addMonthsToYmd = (dateStr: string, months: number): string => {
  const p = parseYmd(dateStr)
  if (!p) return dateStr.slice(0, 10)
  const dt = new Date(p.y, p.m - 1 + months, p.d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const computeMaintenanceAmpel = (opts: {
  active: boolean
  lastDateYmd: string | null | undefined
  intervalMonths: number | null | undefined
}): MaintenanceAmpel => {
  if (!opts.active) return 'gray'
  const n = opts.intervalMonths
  if (n == null || n <= 0) return 'gray'
  const last = opts.lastDateYmd?.trim().slice(0, 10) ?? ''
  if (!last || !parseYmd(last)) return 'red'
  const nextDue = addMonthsToYmd(last, n)
  const today = new Date().toISOString().slice(0, 10)
  return nextDue < today ? 'red' : 'green'
}
