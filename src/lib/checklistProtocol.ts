/**
 * Verschachteltes `checklist_protocol` in maintenance_reports (P0 / §7.2.4.3 Frage 9).
 * Alt-Daten: flaches Objekt mit modus/items/… = nur Tür-Block.
 */

export const CHECKLIST_PROTOCOL_VERSION = 1 as const

export type ChecklistProtocolV1Stored = {
  v: typeof CHECKLIST_PROTOCOL_VERSION
  door_checklist?: unknown
  feststell_checklist?: unknown
}

export const isLegacyDoorOnlyChecklistProtocol = (raw: unknown): boolean => {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  if (o.v === CHECKLIST_PROTOCOL_VERSION) return false
  return 'modus' in o || 'items' in o
}

export const parseChecklistProtocolBlocks = (
  raw: unknown
): { door_checklist: unknown | null; feststell_checklist: unknown | null } => {
  if (!raw || typeof raw !== 'object') {
    return { door_checklist: null, feststell_checklist: null }
  }
  const o = raw as Record<string, unknown>
  if (o.v === CHECKLIST_PROTOCOL_VERSION) {
    return {
      door_checklist: o.door_checklist ?? null,
      feststell_checklist: o.feststell_checklist ?? null,
    }
  }
  if (isLegacyDoorOnlyChecklistProtocol(raw)) {
    return { door_checklist: raw, feststell_checklist: null }
  }
  return { door_checklist: null, feststell_checklist: null }
}

/** Merge für Upsert: fehlende Patch-Keys behalten bestehende Blöcke. */
export const mergeChecklistProtocolForUpsert = (
  existingRaw: unknown,
  patch: { door_checklist?: unknown; feststell_checklist?: unknown }
): ChecklistProtocolV1Stored => {
  const parsed = parseChecklistProtocolBlocks(existingRaw)
  const door =
    patch.door_checklist !== undefined ? patch.door_checklist : parsed.door_checklist
  const feststell =
    patch.feststell_checklist !== undefined
      ? patch.feststell_checklist
      : parsed.feststell_checklist
  const out: ChecklistProtocolV1Stored = { v: CHECKLIST_PROTOCOL_VERSION }
  if (door != null) out.door_checklist = door
  if (feststell != null) out.feststell_checklist = feststell
  return out
}
