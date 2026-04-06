/**
 * §11.20 Mandanten-App-Releases – Payload der Lizenz-API (`mandantenReleases`).
 */

export type MandantenReleaseChannel = 'main' | 'kundenportal' | 'arbeitszeit_portal'

export type MandantenReleaseType = 'bugfix' | 'feature' | 'major'

export type MandantenReleaseApiEntry = {
  id: string
  version: string
  releaseType: MandantenReleaseType
  title: string | null
  notes: string | null
  moduleTags: string[]
  /** Zeile „Betrifft: …“ aus Modul-Tags */
  affectsLine: string | null
  forceHardReload: boolean
}

export type MandantenReleasesApiPayload = {
  channel: MandantenReleaseChannel
  active: MandantenReleaseApiEntry | null
  /** Bis N Einträge (§11.20 #9), typisch 3 */
  incoming: MandantenReleaseApiEntry[]
  /**
   * Zeitpunkt der letzten Änderung der Kanal-Zuweisung im Lizenzportal (Go-Live, Rollback, Zurücksetzen).
   * Mandanten-Apps können damit einen sanften „Neu laden“-Hinweis zeigen.
   */
  releaseAssignmentUpdatedAt?: string | null
}

const isReleaseType = (v: string): v is MandantenReleaseType =>
  v === 'bugfix' || v === 'feature' || v === 'major'

const parseEntry = (raw: unknown): MandantenReleaseApiEntry | null => {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : null
  const version = typeof o.version === 'string' ? o.version : null
  const rt = typeof o.releaseType === 'string' ? o.releaseType : ''
  if (!id || !version || !isReleaseType(rt)) return null
  const tags = Array.isArray(o.moduleTags)
    ? o.moduleTags.filter((x): x is string => typeof x === 'string')
    : []
  return {
    id,
    version,
    releaseType: rt,
    title: o.title != null ? String(o.title) : null,
    notes: o.notes != null ? String(o.notes) : null,
    moduleTags: tags,
    affectsLine: o.affectsLine != null ? String(o.affectsLine) : null,
    forceHardReload: Boolean(o.forceHardReload),
  }
}

export const parseMandantenReleasesPayload = (raw: unknown): MandantenReleasesApiPayload | null => {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const ch = typeof o.channel === 'string' ? o.channel : ''
  if (ch !== 'main' && ch !== 'kundenportal' && ch !== 'arbeitszeit_portal') return null
  const active = o.active === null || o.active === undefined ? null : parseEntry(o.active)
  const inc = Array.isArray(o.incoming) ? o.incoming.map(parseEntry).filter(Boolean) as MandantenReleaseApiEntry[] : []
  let releaseAssignmentUpdatedAt: string | null | undefined
  if ('releaseAssignmentUpdatedAt' in o) {
    const v = o.releaseAssignmentUpdatedAt
    if (v === null) releaseAssignmentUpdatedAt = null
    else if (typeof v === 'string' && v.trim()) releaseAssignmentUpdatedAt = v.trim()
    else releaseAssignmentUpdatedAt = null
  }
  return {
    channel: ch,
    active,
    incoming: inc,
    ...(releaseAssignmentUpdatedAt !== undefined ? { releaseAssignmentUpdatedAt } : {}),
  }
}

export const mandantenReleasesHasIncoming = (p: MandantenReleasesApiPayload | null | undefined): boolean =>
  Boolean(p && p.incoming.length > 0)

/** §11.20#7: Aktiver Release erzwingt harten Reload (Major / Admin-Vorgabe). */
export const getActiveReleaseRequiringHardReload = (
  p: MandantenReleasesApiPayload | null | undefined
): MandantenReleaseApiEntry | null => {
  if (!p?.active?.forceHardReload) return null
  return p.active
}

/** Incoming-Pilot: mindestens ein Release mit forceHardReload (Hinweis im Banner). */
export const incomingReleasesHaveHardReloadHint = (p: MandantenReleasesApiPayload | null | undefined): boolean =>
  Boolean(p?.incoming.some((i) => i.forceHardReload))
