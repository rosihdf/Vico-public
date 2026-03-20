/**
 * Versionsvergleich für semantische Versionen (z. B. 1.0.0, 1.2.3)
 */
export const isNewerVersion = (current: string, latest: string): boolean => {
  if (!latest || !current) return false
  const cur = parseVersion(current)
  const lat = parseVersion(latest)
  if (!cur || !lat) return false
  for (let i = 0; i < 3; i++) {
    if (lat[i] > cur[i]) return true
    if (lat[i] < cur[i]) return false
  }
  return false
}

const parseVersion = (v: string): [number, number, number] | null => {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
}
