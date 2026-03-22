/**
 * Versionsvergleich für semantische Versionen (z. B. 1.0.0, 1.2.3).
 * Es werden nur die führenden drei Zahlen (Major.Minor.Patch) ausgewertet; Suffixe wie „-beta“ werden ignoriert.
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

/** True, wenn die Zeichenkette mit Major.Minor.Patch (SemVer-Kern) beginnt – dann ist ein automatischer Vergleich sinnvoll. */
export const isSemverComparable = (v: string): boolean => parseVersion(v) !== null

/**
 * Vergleich **Build-Version** (z. B. `__APP_VERSION__`) mit der optional im Lizenzportal gepflegten **Anzeigeversion**.
 * Nur wenn beide SemVer-kompatibel sind; sonst `null` (kein automatischer Schluss).
 *
 * - `portal_ahead`: Portal dokumentiert eine neuere Version als der aktuelle Build.
 * - `build_ahead`: Build ist neuer als die Portal-Anzeige (Pflege im Mandanten nachziehen).
 * - `same`: Gleiche Major.Minor.Patch.
 */
export const getSemverPortalVsBuildRelation = (
  buildVersion: string,
  portalDisplayVersion: string | undefined | null
): 'portal_ahead' | 'build_ahead' | 'same' | null => {
  const p = portalDisplayVersion?.trim()
  if (!p) return null
  const bv = buildVersion.trim()
  if (!isSemverComparable(bv) || !isSemverComparable(p)) return null
  if (isNewerVersion(bv, p)) return 'portal_ahead'
  if (isNewerVersion(p, bv)) return 'build_ahead'
  return 'same'
}
