import type { Object as Obj, ObjectDefectEntry } from '../types/object'

const isValidStatus = (s: unknown): s is ObjectDefectEntry['status'] =>
  s === 'open' || s === 'resolved'

/** JSON aus DB / Cache validieren und normalisieren */
export const parseObjectDefectsStructured = (raw: unknown): ObjectDefectEntry[] => {
  if (!Array.isArray(raw)) return []
  const out: ObjectDefectEntry[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
    const text = typeof o.text === 'string' ? o.text : ''
    if (!id) continue
    const status = isValidStatus(o.status) ? o.status : 'open'
    const created_at =
      typeof o.created_at === 'string' && o.created_at.trim() ? o.created_at.trim() : new Date().toISOString()
    const resolved_at =
      typeof o.resolved_at === 'string' && o.resolved_at.trim() ? o.resolved_at.trim() : null
    out.push({
      id,
      text,
      status,
      created_at,
      resolved_at: status === 'resolved' ? resolved_at : null,
    })
  }
  return out
}

/** Strukturierte Einträge aus Objekt (JSON bevorzugt, sonst Legacy-Text) */
export const defectEntriesFromObject = (obj: Obj): ObjectDefectEntry[] => {
  const structured = parseObjectDefectsStructured(obj.defects_structured)
  if (structured.length > 0) return structured
  return legacyDefectsTextToEntries(obj.defects)
}

/** Einmalige Übernahme aus dem Legacy-Feld `objects.defects` (Freitext) */
export const legacyDefectsTextToEntries = (text: string | null | undefined): ObjectDefectEntry[] => {
  const t = (text ?? '').trim()
  if (!t) return []
  const parts = t.includes('\n\n') ? t.split(/\n\n+/) : [t]
  const now = new Date().toISOString()
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({
      id: crypto.randomUUID(),
      text: p,
      status: 'open' as const,
      created_at: now,
      resolved_at: null,
    }))
}

/** Für Spalte `defects` (Legacy / Kurzansicht): nur offene Mängel, mehrzeilig */
export const openDefectsToLegacyText = (entries: ObjectDefectEntry[]): string | null => {
  const open = entries.filter((e) => e.status === 'open').map((e) => e.text.trim()).filter(Boolean)
  if (open.length === 0) return null
  return open.join('\n\n')
}

export const normalizeDefectEntriesForSave = (entries: ObjectDefectEntry[]): ObjectDefectEntry[] =>
  entries
    .map((e) => ({
      ...e,
      text: e.text.trim(),
      resolved_at: e.status === 'resolved' ? e.resolved_at ?? new Date().toISOString() : null,
    }))
    .filter((e) => e.text.length > 0)
