/**
 * Holt die aktuelle Position (einmalig) für die Zeiterfassung.
 * Gibt null zurück bei Fehler oder wenn Geolocation nicht verfügbar ist.
 */
export type GeoPosition = { lat: number; lon: number }

export type GeoPositionWithDetails = GeoPosition & {
  accuracy?: number
  timestamp?: number
}

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

export type GetCurrentPositionOptions = {
  /** Höhere Genauigkeit (GPS statt Netzwerk), dauert länger */
  enableHighAccuracy?: boolean
  /** Timeout in ms */
  timeout?: number
  /** Cache-Alter in ms (0 = immer neu ermitteln) */
  maximumAge?: number
}

/**
 * Holt die aktuelle Position mit Details (Genauigkeit, Zeitstempel).
 * Für manuelle Standortabfrage durch Mitarbeiter (z.B. Button „Standort abfragen“).
 */
export const getCurrentPositionWithDetails = (
  options: GetCurrentPositionOptions = {}
): Promise<GeoPositionWithDetails | null> => {
  const {
    enableHighAccuracy = true,
    timeout = 20000,
    maximumAge = 0,
  } = options

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('[Geolocation] Nicht verfügbar (navigator.geolocation fehlt)')
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      (err) => {
        const code: GeolocationError =
          err.code === 1 ? 'permission_denied'
          : err.code === 2 ? 'position_unavailable'
          : err.code === 3 ? 'timeout'
          : 'unknown'
        console.warn('[Geolocation] Fehler:', code, err.message)
        resolve(null)
      },
      { enableHighAccuracy, timeout, maximumAge }
    )
  })
}

export { getOsmLink, formatCoords } from '../../shared/geolocationUtils'
