/** Gemeinsame Formatierungsfunktionen für Mandanten-Apps */

export const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export const formatMinutes = (min: number): string => {
  const sign = min < 0 ? '-' : ''
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}:${m.toString().padStart(2, '0')} h`
}

export const formatDateShort = (dateStr: string): string => {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export const formatDateTimeShort = (iso: string): string => {
  try {
    const d = new Date(iso)
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export const toDateStr = (d: Date): string => d.toISOString().slice(0, 10)

/** Zeitformat für Timestamp (ms) – z. B. Ladezeiten-Dashboard */
export const formatTimeFromTs = (ts: number): string =>
  new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Datumsformat für Timestamp (ms) */
export const formatDateFromTs = (ts: number): string =>
  new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
