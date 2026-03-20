/** OpenStreetMap-Link für Koordinaten. */
export const getOsmLink = (lat: number, lon: number): string =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=17`

/** Koordinaten formatiert (z.B. 52.5200° N, 13.4050° O). */
export const formatCoords = (lat: number, lon: number): string => {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'O' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`
}
