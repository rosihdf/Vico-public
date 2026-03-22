/**
 * App-Versionen: global (`portal_settings.default_app_versions`) + mandantenspezifisch (`tenants.app_versions`).
 * Lizenz-API merged global → Mandant (Mandant überschreibt pro Key/Feld).
 */

export const APP_VERSION_KEYS = ['main', 'kundenportal', 'arbeitszeit_portal', 'admin'] as const

export type AppVersionKey = (typeof APP_VERSION_KEYS)[number]

export type AppVersionEntry = {
  version?: string
  releaseNotes?: string[]
  releaseLabel?: string
}

/** Partial map – nur gesetzte Keys werden serialisiert. */
export type AppVersionsMap = Partial<Record<AppVersionKey, AppVersionEntry>>

/** True, wenn der Eintrag für UI/Anzeige relevante Felder hat. */
export const hasAppVersionEntryContent = (i?: AppVersionEntry | null): boolean =>
  Boolean(i && (i.version || i.releaseLabel || (i.releaseNotes?.length ?? 0) > 0))

export const APP_VERSION_LABELS: Record<AppVersionKey, string> = {
  main: 'Haupt-App',
  kundenportal: 'Kundenportal',
  arbeitszeit_portal: 'Arbeitszeitenportal',
  admin: 'Lizenzmodul (Admin)',
}

const normalizeNotes = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined
  const o = v.filter((x) => typeof x === 'string')
  return o.length > 0 ? o : undefined
}

/** Normalisiert einen Eintrag aus DB (camelCase oder snake_case). */
export const normalizeAppVersionEntry = (raw: unknown): AppVersionEntry | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const version = typeof o.version === 'string' && o.version.trim() ? o.version.trim() : undefined
  const releaseLabelRaw =
    typeof o.releaseLabel === 'string'
      ? o.releaseLabel.trim()
      : typeof o.release_label === 'string'
        ? o.release_label.trim()
        : ''
  const releaseLabel = releaseLabelRaw || undefined
  const releaseNotes = normalizeNotes(o.releaseNotes) ?? normalizeNotes(o.release_notes)
  if (!version && !releaseLabel && (!releaseNotes || releaseNotes.length === 0)) return undefined
  return { version, releaseNotes, releaseLabel }
}

/** Map aus JSONB → API-Shape (nur Keys mit Inhalt). */
export const parseAppVersionsFromDb = (raw: unknown): AppVersionsMap | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Record<string, unknown>
  const out: AppVersionsMap = {}
  for (const k of APP_VERSION_KEYS) {
    const e = normalizeAppVersionEntry(src[k])
    if (e) out[k] = e
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const notesFromMergedObject = (o: Record<string, unknown>): string[] | undefined => {
  const n = normalizeNotes(o.releaseNotes) ?? normalizeNotes(o.release_notes)
  return n && n.length > 0 ? n : undefined
}

/**
 * Roh-JSON merge: globale Defaults + Mandant.
 * `releaseNotes`: nicht-leeres Mandanten-Array gewinnt, sonst global.
 */
export const mergeRawAppVersionsJson = (globalJson: unknown, tenantJson: unknown): Record<string, unknown> => {
  const g = globalJson && typeof globalJson === 'object' ? (globalJson as Record<string, unknown>) : {}
  const t = tenantJson && typeof tenantJson === 'object' ? (tenantJson as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const k of APP_VERSION_KEYS) {
    const gv = g[k]
    const tv = t[k]
    if (gv === undefined && tv === undefined) continue
    const go = gv && typeof gv === 'object' ? { ...(gv as Record<string, unknown>) } : {}
    const to = tv && typeof tv === 'object' ? (tv as Record<string, unknown>) : {}
    const merged: Record<string, unknown> = { ...go, ...to }
    const tNotes = notesFromMergedObject(to)
    const gNotes = notesFromMergedObject(go)
    if (tNotes && tNotes.length > 0) merged.releaseNotes = tNotes
    else if (gNotes && gNotes.length > 0) merged.releaseNotes = gNotes
    delete merged.release_notes
    out[k] = merged
  }
  return out
}
