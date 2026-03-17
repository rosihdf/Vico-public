/**
 * Holt die aktuelle Position (einmalig) für die Zeiterfassung.
 * Gibt null zurück bei Fehler oder wenn Geolocation nicht verfügbar ist.
 */
export type GeoPosition = { lat: number; lon: number }

export type GeolocationError = 'unsupported' | 'permission_denied' | 'position_unavailable' | 'timeout' | 'unknown'

export const getCurrentPosition = (): Promise<GeoPosition | null> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('[Geolocation] Nicht verfügbar (navigator.geolocation fehlt)')
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    const timeout = 15000
    const opts: PositionOptions = { enableHighAccuracy: false, timeout, maximumAge: 60000 }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const code: GeolocationError =
          err.code === 1 ? 'permission_denied'
          : err.code === 2 ? 'position_unavailable'
          : err.code === 3 ? 'timeout'
          : 'unknown'
        console.warn('[Geolocation] Fehler:', code, err.message)
        resolve(null)
      },
      opts
    )
  })
}
