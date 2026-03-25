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

/** Arbeitszeit in Minuten (Ende − Start − Pause). Über Mitternacht: Ende &lt; Start → +24h. */
export const minutesBetweenWithPause = (
  start: string,
  end: string,
  pauseMinuten: number
): number | null => {
  const a = toMinutesOfDay(start)
  const b = toMinutesOfDay(end)
  if (a === null || b === null) return null
  let span = b - a
  if (span < 0) span += 24 * 60
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
