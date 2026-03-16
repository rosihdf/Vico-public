/**
 * Holt die aktuelle Position (einmalig) für die Zeiterfassung.
 * Gibt null zurück bei Fehler oder wenn Geolocation nicht verfügbar ist.
 */
export type GeoPosition = { lat: number; lon: number }

export const getCurrentPosition = (): Promise<GeoPosition | null> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    const timeout = 10000
    const opts: PositionOptions = { enableHighAccuracy: false, timeout, maximumAge: 60000 }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      opts
    )
  })
}
