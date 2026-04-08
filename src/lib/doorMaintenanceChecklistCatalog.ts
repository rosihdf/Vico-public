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

export const buildDeficiencyTextFromChecklist = (
  mode: ChecklistDisplayMode,
  items: Record<string, { status?: ChecklistItemStatus; note?: string }>
): string => {
  const lines: string[] = []
  for (const id of getChecklistItemIdsForMode(mode)) {
    const row = items[id]
    if (!row || row.status !== 'mangel') continue
    const meta = getSectionAndLabelForItemId(mode, id)
    const head = meta ? `${meta.sectionTitle}: ${meta.label}` : id
    const note = (row.note ?? '').trim()
    lines.push(note ? `${head}\n${note}` : head)
  }
  return lines.join('\n\n---\n\n')
}

export const checklistHasOpenMangel = (
  mode: ChecklistDisplayMode,
  items: Record<string, { status?: ChecklistItemStatus; note?: string }>
): boolean =>
  getChecklistItemIdsForMode(mode).some((id) => items[id]?.status === 'mangel')

export const validateChecklistComplete = (
  mode: ChecklistDisplayMode,
  items: Record<string, { status?: ChecklistItemStatus; note?: string }>
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
  }
  return { ok: true }
}
