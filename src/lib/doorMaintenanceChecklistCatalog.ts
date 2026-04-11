/** Brandschutztür – Checkliste Sicht-/Funktionsprüfung (IDs stabil für Speicherung). */

export type ChecklistDisplayMode = 'compact' | 'detail'

export type ChecklistItemStatus = 'ok' | 'mangel' | 'nicht_geprueft' | 'entfaellt'

export type ChecklistDetailItem = { id: string; label: string }

export type ChecklistSectionDef = {
  id: string
  title: string
  details: ChecklistDetailItem[]
}

export const DOOR_MAINTENANCE_CHECKLIST_SECTIONS: ChecklistSectionDef[] = [
  {
    id: 'sec-tuerblatt-zarge',
    title: 'Türblatt und Zarge',
    details: [
      { id: 'det-tbz-1', label: 'Türblatt ohne Verformung, Risse oder Beschädigungen' },
      { id: 'det-tbz-2', label: 'Zarge fest verankert, keine Lockerung' },
      { id: 'det-tbz-3', label: 'Spaltmaße gleichmäßig und zulässig' },
      { id: 'det-tbz-4', label: 'Keine unzulässigen Bohrungen oder sonstigen Veränderungen' },
    ],
  },
  {
    id: 'sec-schliessfunktion',
    title: 'Schließfunktion',
    details: [
      { id: 'det-sf-1', label: 'Tür schließt selbstständig aus jeder Öffnungsposition' },
      { id: 'det-sf-2', label: 'Tür fällt vollständig ins Schloss (kein offener Spalt)' },
      { id: 'det-sf-3', label: 'Tür schleift nicht am Boden oder am Rahmen' },
      { id: 'det-sf-4', label: 'Tür wird nicht blockiert (z. B. Keile, Möbel)' },
    ],
  },
  {
    id: 'sec-beschlaege',
    title: 'Beschläge und Türschließer',
    details: [
      { id: 'det-b-1', label: 'Türschließer funktionsfähig und korrekt eingestellt' },
      { id: 'det-b-2', label: 'Bänder/Scharniere fest und nicht verschlissen' },
      { id: 'det-b-3', label: 'Schloss und Falle funktionieren einwandfrei' },
      { id: 'det-b-4', label: 'Panik-/Fluchttürbeschläge (falls vorhanden) geprüft' },
    ],
  },
  {
    id: 'sec-dichtungen',
    title: 'Dichtungen und Brandschutzfunktion',
    details: [
      { id: 'det-d-1', label: 'Intumeszenzstreifen (Brandschutzdichtung) vorhanden und intakt' },
      { id: 'det-d-2', label: 'Rauchdichtungen nicht beschädigt und nicht fehlend' },
      { id: 'det-d-3', label: 'Keine unzulässigen Überstreichungen oder Verklebungen' },
    ],
  },
  {
    id: 'sec-kennzeichnung',
    title: 'Kennzeichnung',
    details: [
      { id: 'det-k-1', label: 'Typenschild vorhanden und lesbar' },
      { id: 'det-k-2', label: 'Zulassung/CE-Kennzeichnung vorhanden' },
      { id: 'det-k-3', label: 'Keine unzulässigen Änderungen am Bauteil' },
    ],
  },
  {
    id: 'sec-dokumentation',
    title: 'Dokumentation',
    details: [
      { id: 'det-dok-1', label: 'Prüfung dokumentiert (Datum, Prüfer, Ergebnis)' },
      { id: 'det-dok-2', label: 'Mängel erfasst und bewertet' },
      { id: 'det-dok-3', label: 'Maßnahmen eingeleitet' },
    ],
  },
]

export const getChecklistItemIdsForMode = (mode: ChecklistDisplayMode): string[] => {
  if (mode === 'compact') {
    return DOOR_MAINTENANCE_CHECKLIST_SECTIONS.map((s) => s.id)
  }
  return DOOR_MAINTENANCE_CHECKLIST_SECTIONS.flatMap((s) => s.details.map((d) => d.id))
}

export const getSectionAndLabelForItemId = (
  mode: ChecklistDisplayMode,
  itemId: string
): { sectionTitle: string; label: string } | null => {
  if (mode === 'compact') {
    const sec = DOOR_MAINTENANCE_CHECKLIST_SECTIONS.find((s) => s.id === itemId)
    if (!sec) return null
    return { sectionTitle: sec.title, label: sec.title }
  }
  for (const sec of DOOR_MAINTENANCE_CHECKLIST_SECTIONS) {
    const d = sec.details.find((x) => x.id === itemId)
    if (d) return { sectionTitle: sec.title, label: d.label }
  }
  return null
}

/** Wie in der App: Kompakt „1.“, Detail „1.2“ (ohne nachgestelltes Leerzeichen). */
export const getChecklistItemNumberPrefix = (
  mode: ChecklistDisplayMode,
  itemId: string
): string | null => {
  if (mode === 'compact') {
    const i = DOOR_MAINTENANCE_CHECKLIST_SECTIONS.findIndex((s) => s.id === itemId)
    return i >= 0 ? `${i + 1}.` : null
  }
  for (let si = 0; si < DOOR_MAINTENANCE_CHECKLIST_SECTIONS.length; si += 1) {
    const sec = DOOR_MAINTENANCE_CHECKLIST_SECTIONS[si]
    const di = sec.details.findIndex((d) => d.id === itemId)
    if (di >= 0) return `${si + 1}.${di + 1}`
  }
  return null
}

export const buildDeficiencyTextFromChecklist = (
  mode: ChecklistDisplayMode,
  items: Record<string, { status?: ChecklistItemStatus; note?: string; advisory?: boolean; advisory_note?: string }>
): string => {
  const lines: string[] = []
  for (const id of getChecklistItemIdsForMode(mode)) {
    const row = items[id]
    if (!row) continue
    const meta = getSectionAndLabelForItemId(mode, id)
    const head = meta ? `${meta.sectionTitle}: ${meta.label}` : id
    if (row.status === 'mangel') {
      const note = (row.note ?? '').trim()
      lines.push(note ? `${head}\n${note}` : head)
    }
    if (row.advisory) {
      const adv = (row.advisory_note ?? '').trim()
      if (adv) lines.push(`${head}\nHinweis/empfohlene Maßnahme: ${adv}`)
    }
  }
  return lines.join('\n\n---\n\n')
}

export const checklistHasOpenMangel = (
  mode: ChecklistDisplayMode,
  items: Record<string, { status?: ChecklistItemStatus; note?: string }>
): boolean =>
  getChecklistItemIdsForMode(mode).some((id) => items[id]?.status === 'mangel')

export const countChecklistMangel = (
  mode: ChecklistDisplayMode,
  items: Record<string, { status?: ChecklistItemStatus; note?: string }>
): number =>
  getChecklistItemIdsForMode(mode).filter((id) => items[id]?.status === 'mangel').length

export const validateChecklistComplete = (
  mode: ChecklistDisplayMode,
  items: Record<string, { status?: ChecklistItemStatus; note?: string; advisory?: boolean; advisory_note?: string }>
): { ok: true } | { ok: false; message: string } => {
  const ids = getChecklistItemIdsForMode(mode)
  for (const id of ids) {
    const row = items[id]
    if (!row?.status) {
      return { ok: false, message: 'Bitte alle Prüfpunkte bewerten.' }
    }
    if (row.status === 'mangel' && !(row.note ?? '').trim()) {
      const meta = getSectionAndLabelForItemId(mode, id)
      return {
        ok: false,
        message: `Bei „Mangel“ ist eine Beschreibung erforderlich${meta ? `: ${meta.label}` : ''}.`,
      }
    }
    if (row.advisory && !(row.advisory_note ?? '').trim()) {
      const meta = getSectionAndLabelForItemId(mode, id)
      return {
        ok: false,
        message: `Bei „Hinweis/empfohlene Maßnahme“ ist eine Beschreibung erforderlich${meta ? `: ${meta.label}` : ''}.`,
      }
    }
  }
  return { ok: true }
}

export const normalizeDoorChecklistItemsForMode = (
  mode: ChecklistDisplayMode,
  items: Record<string, { status?: ChecklistItemStatus; note?: string; advisory?: boolean; advisory_note?: string }>
): Record<string, { status?: ChecklistItemStatus; note?: string; advisory?: boolean; advisory_note?: string }> => {
  const targetIds = getChecklistItemIdsForMode(mode)
  const hasTarget = targetIds.some((id) => items[id]?.status || items[id]?.advisory)
  if (hasTarget) return { ...items }

  const out: Record<string, { status?: ChecklistItemStatus; note?: string; advisory?: boolean; advisory_note?: string }> = {}
  if (mode === 'compact') {
    for (const sec of DOOR_MAINTENANCE_CHECKLIST_SECTIONS) {
      const detailRows = sec.details.map((d) => items[d.id]).filter(Boolean)
      if (detailRows.length === 0) continue
      const hasMangel = detailRows.some((r) => r?.status === 'mangel')
      const hasNicht = detailRows.some((r) => r?.status === 'nicht_geprueft')
      const hasOk = detailRows.some((r) => r?.status === 'ok')
      const hasEnt = detailRows.some((r) => r?.status === 'entfaellt')
      const note = detailRows.map((r) => (r?.note ?? '').trim()).find(Boolean)
      const adv = detailRows.some((r) => Boolean(r?.advisory))
      const advNote = detailRows.map((r) => (r?.advisory_note ?? '').trim()).find(Boolean)
      out[sec.id] = {
        status: hasMangel ? 'mangel' : hasNicht ? 'nicht_geprueft' : hasOk ? 'ok' : hasEnt ? 'entfaellt' : undefined,
        note: note || undefined,
        advisory: adv || undefined,
        advisory_note: advNote || undefined,
      }
    }
    return out
  }

  for (const sec of DOOR_MAINTENANCE_CHECKLIST_SECTIONS) {
    const src = items[sec.id]
    for (const d of sec.details) {
      out[d.id] = {
        status: src?.status,
        note: src?.note,
        advisory: src?.advisory,
        advisory_note: src?.advisory_note,
      }
    }
  }
  return out
}
