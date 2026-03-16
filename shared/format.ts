/** Gemeinsame Formatierungsfunktionen für alle Vico-Apps */

export const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export const formatMinutes = (min: number): string => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${m.toString().padStart(2, '0')} h`
}

export const formatDate = (iso: string, options?: { dateStyle?: 'short' | 'medium' | 'long'; timeStyle?: 'short' }): string => {
  const d = new Date(iso)
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: options?.timeStyle ? '2-digit' : undefined,
    minute: options?.timeStyle ? '2-digit' : undefined,
    ...options,
  })
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
