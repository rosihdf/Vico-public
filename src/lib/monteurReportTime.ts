/** HH:MM → Minuten seit Mitternacht */
const toMinutesOfDay = (hhmm: string): number | null => {
  const t = hhmm.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 47 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** Arbeitszeit in Minuten (Ende − Start − Pause).
 *  - Ende vor Start: typische Nachtschicht (≤ 12 h) → +24 h.
 *  - Längere „Über-Mitternacht“-Spans mit Ende vormittags und Beginn vormittags/nachmittags:
 *    oft 12h-/24h-Verwechslung (z. B. 10:00–03:00 statt 15:00) → Ende + 12 h, falls dadurch Ende &gt; Start am selben Tag.
 */
export const minutesBetweenWithPause = (
  start: string,
  end: string,
  pauseMinuten: number
): number | null => {
  const a = toMinutesOfDay(start)
  const b = toMinutesOfDay(end)
  if (a === null || b === null) return null
  let span = b - a
  if (span < 0) {
    const overnight = span + 24 * 60
    const maxNightShiftMin = 12 * 60
    if (overnight <= maxNightShiftMin) {
      span = overnight
    } else if (a < 13 * 60 && b < 12 * 60) {
      const endAsAfternoon = b + 12 * 60
      if (endAsAfternoon > a && endAsAfternoon < 24 * 60) {
        span = endAsAfternoon - a
      } else {
        span = overnight
      }
    } else {
      span = overnight
    }
  }
  const p = Math.max(0, Math.floor(Number(pauseMinuten) || 0))
  return Math.max(0, span - p)
}

export const sumWorkMinutes = (
  primary: { start: string; end: string; pause_minuten: number },
  zusatz: Array<{ start: string; end: string; pause_minuten: number }>
): number => {
  let sum = 0
  const p = minutesBetweenWithPause(primary.start, primary.end, primary.pause_minuten)
  if (p != null) sum += p
  for (const z of zusatz) {
    const m = minutesBetweenWithPause(z.start, z.end, z.pause_minuten)
    if (m != null) sum += m
  }
  return sum
}

/** Brutto-Zeit (ohne Pause) pro Zeile – für Plausibilitätshinweis Pause vs. Arbeitszeit */
const grossMinutesNoPause = (start: string, end: string): number => {
  return minutesBetweenWithPause(start, end, 0) ?? 0
}

/** Pause größer als Brutto-Arbeitszeit (nur Hinweis, kein Block) */
export const anyPauseExceedsGrossWork = (
  primary: { start: string; end: string; pause_minuten: number },
  zusatz: Array<{ start: string; end: string; pause_minuten: number }>
): boolean => {
  if (primary.start?.trim() && primary.end?.trim()) {
    const g = grossMinutesNoPause(primary.start, primary.end)
    if (primary.pause_minuten > g) return true
  }
  for (const z of zusatz) {
    if (z.start?.trim() && z.end?.trim()) {
      const g = grossMinutesNoPause(z.start, z.end)
      if (z.pause_minuten > g) return true
    }
  }
  return false
}
