/**
 * Feststellanlage – Checkliste DIN 14677 (§7.2.4.1), gemeinsamer Modus mit Tür-Checkliste.
 */

import type { ChecklistDisplayMode, ChecklistItemStatus } from './doorMaintenanceChecklistCatalog'

/** Ein Prüfpunkt „Rauchmelder-Austausch“ mit Radio statt OK/Mangel (§7.2.4.3.8). */
export const FESTSTELL_MELDER_INTERVAL_ITEM_ID = 'det-fst-int-melder-austausch'

export type FeststellChecklistItemState = {
  status?: ChecklistItemStatus
  note?: string
  /** Hinweis/empfohlene Maßnahme ohne Mangelbefund. */
  advisory?: boolean
  advisory_note?: string
  melder_interval?: 'ohne_5j' | 'mit_8j' | 'nicht_beurteilt' | 'entfaellt'
}

export type FeststellChecklistDetailItem = { id: string; label: string }

export type FeststellChecklistSectionDef = {
  id: string
  title: string
  details: FeststellChecklistDetailItem[]
}

export const FESTSTELL_CHECKLIST_SECTIONS: FeststellChecklistSectionDef[] = [
  {
    id: 'sec-fst-energie',
    title: 'Energieversorgung',
    details: [
      { id: 'det-fst-en-1', label: 'Netzanschluss vorhanden und gesichert' },
      { id: 'det-fst-en-2', label: 'Netzteil funktionsfähig' },
      { id: 'det-fst-en-3', label: 'Akkus/Batterien vorhanden und geprüft' },
      { id: 'det-fst-en-4', label: 'Störanzeige vorhanden und funktionsfähig' },
    ],
  },
  {
    id: 'sec-fst-haft',
    title: 'Haftmagnet / Feststelleinrichtung',
    details: [
      { id: 'det-fst-hf-1', label: 'Tür wird sicher offen gehalten' },
      { id: 'det-fst-hf-2', label: 'Haftmagnet hält zuverlässig (kein Abrutschen)' },
      { id: 'det-fst-hf-3', label: 'Mechanische Teile nicht verschlissen' },
      { id: 'det-fst-hf-4', label: 'Befestigung stabil' },
    ],
  },
  {
    id: 'sec-fst-rauch',
    title: 'Rauchmelder / Auslöseelemente',
    details: [
      { id: 'det-fst-rm-1', label: 'Rauchmelder sauber (nicht verschmutzt)' },
      { id: 'det-fst-rm-2', label: 'Keine Abdeckung oder Verstellung' },
      { id: 'det-fst-rm-3', label: 'Auslösung funktioniert zuverlässig (Test mit Prüfspray)' },
      { id: 'det-fst-rm-4', label: 'Melder richtig positioniert' },
    ],
  },
  {
    id: 'sec-fst-ausloes',
    title: 'Auslösung der Anlage',
    details: [
      { id: 'det-fst-al-1', label: 'Anlage löst bei Rauch sofort aus' },
      { id: 'det-fst-al-2', label: 'Tür schließt automatisch nach Auslösung' },
      { id: 'det-fst-al-3', label: 'Keine Verzögerung oder Fehlfunktion' },
      { id: 'det-fst-al-4', label: 'Manuelle Auslösung (Taster) funktioniert' },
    ],
  },
  {
    id: 'sec-fst-schliess',
    title: 'Schließfunktion nach Auslösung',
    details: [
      { id: 'det-fst-sf-1', label: 'Tür schließt vollständig und selbstständig' },
      { id: 'det-fst-sf-2', label: 'Schloss rastet korrekt ein' },
      { id: 'det-fst-sf-3', label: 'Tür bleibt nicht hängen' },
      { id: 'det-fst-sf-4', label: 'Schließgeschwindigkeit korrekt eingestellt' },
    ],
  },
  {
    id: 'sec-fst-gesamt',
    title: 'Gesamtsystemprüfung',
    details: [
      { id: 'det-fst-gs-1', label: 'Zusammenspiel aller Komponenten funktioniert' },
      { id: 'det-fst-gs-2', label: 'Keine Störungen im System' },
      { id: 'det-fst-gs-3', label: 'Anlage geht nach Reset wieder in Betrieb' },
      { id: 'det-fst-gs-4', label: 'Freigabe der Tür funktioniert ordnungsgemäß' },
    ],
  },
  {
    id: 'sec-fst-intervall',
    title: 'Wartung & Intervalle (DIN 14677)',
    details: [
      { id: 'det-fst-int-1', label: 'Betreiberprüfung regelmäßig (monatlich/vierteljährlich)' },
      { id: 'det-fst-int-2', label: 'Jährliche Wartung durch Fachkraft' },
      {
        id: FESTSTELL_MELDER_INTERVAL_ITEM_ID,
        label:
          'Austausch Rauchmelder: ohne Nachführung max. 5 Jahre / mit Nachführung max. 8 Jahre (eine Auswahl)',
      },
      { id: 'det-fst-int-4', label: 'Intervalle und Nachweise den Anforderungen entsprechend' },
    ],
  },
  {
    id: 'sec-fst-doku',
    title: 'Dokumentation',
    details: [
      { id: 'det-fst-dk-1', label: 'Prüfbuch vorhanden' },
      { id: 'det-fst-dk-2', label: 'Wartungsnachweise vollständig' },
      { id: 'det-fst-dk-3', label: 'Fachkraft nach DIN 14677-2 dokumentiert' },
      { id: 'det-fst-dk-4', label: 'Mängel und Maßnahmen festgehalten' },
    ],
  },
]

const INTERVAL_SECTION_ID = 'sec-fst-intervall'

export const getFeststellChecklistItemIdsForMode = (mode: ChecklistDisplayMode): string[] => {
  if (mode === 'compact') {
    return FESTSTELL_CHECKLIST_SECTIONS.map((s) => s.id)
  }
  return FESTSTELL_CHECKLIST_SECTIONS.flatMap((s) => s.details.map((d) => d.id))
}

export const getFeststellSectionAndLabelForItemId = (
  mode: ChecklistDisplayMode,
  itemId: string
): { sectionTitle: string; label: string } | null => {
  if (mode === 'compact') {
    const sec = FESTSTELL_CHECKLIST_SECTIONS.find((s) => s.id === itemId)
    if (!sec) return null
    return { sectionTitle: sec.title, label: sec.title }
  }
  for (const sec of FESTSTELL_CHECKLIST_SECTIONS) {
    const d = sec.details.find((x) => x.id === itemId)
    if (d) return { sectionTitle: sec.title, label: d.label }
  }
  return null
}

/** Wie in der App: Kompakt „1.“, Detail „1.2“. */
export const getFeststellChecklistItemNumberPrefix = (
  mode: ChecklistDisplayMode,
  itemId: string
): string | null => {
  if (mode === 'compact') {
    const i = FESTSTELL_CHECKLIST_SECTIONS.findIndex((s) => s.id === itemId)
    return i >= 0 ? `${i + 1}.` : null
  }
  for (let si = 0; si < FESTSTELL_CHECKLIST_SECTIONS.length; si += 1) {
    const sec = FESTSTELL_CHECKLIST_SECTIONS[si]
    const di = sec.details.findIndex((d) => d.id === itemId)
    if (di >= 0) return `${si + 1}.${di + 1}`
  }
  return null
}

const MELDER_SET = new Set<FeststellChecklistItemState['melder_interval']>([
  'ohne_5j',
  'mit_8j',
  'nicht_beurteilt',
  'entfaellt',
])

export const buildDeficiencyTextFromFeststellChecklist = (
  mode: ChecklistDisplayMode,
  items: Record<string, FeststellChecklistItemState>
): string => {
  const lines: string[] = []
  for (const id of getFeststellChecklistItemIdsForMode(mode)) {
    if (mode === 'compact' && id === INTERVAL_SECTION_ID) continue
    if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) continue
    const row = items[id]
    if (!row) continue
    const meta = getFeststellSectionAndLabelForItemId(mode, id)
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

export const checklistHasOpenMangelFeststell = (
  mode: ChecklistDisplayMode,
  items: Record<string, FeststellChecklistItemState>
): boolean =>
  getFeststellChecklistItemIdsForMode(mode).some((id) => {
    if (mode === 'compact' && id === INTERVAL_SECTION_ID) return false
    if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) return false
    return items[id]?.status === 'mangel'
  })

export const countFeststellMangel = (
  mode: ChecklistDisplayMode,
  items: Record<string, FeststellChecklistItemState>
): number =>
  getFeststellChecklistItemIdsForMode(mode).reduce((acc, id) => {
    if (mode === 'compact' && id === INTERVAL_SECTION_ID) return acc
    if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) return acc
    return items[id]?.status === 'mangel' ? acc + 1 : acc
  }, 0)

export const validateFeststellChecklistComplete = (
  mode: ChecklistDisplayMode,
  items: Record<string, FeststellChecklistItemState>
): { ok: true } | { ok: false; message: string } => {
  const ids = getFeststellChecklistItemIdsForMode(mode)
  for (const id of ids) {
    if (mode === 'compact' && id === INTERVAL_SECTION_ID) {
      const mi = items[FESTSTELL_MELDER_INTERVAL_ITEM_ID]?.melder_interval
      if (!mi || !MELDER_SET.has(mi)) {
        return { ok: false, message: 'Bitte beim Punkt Rauchmelder-Austausch eine Option wählen.' }
      }
      continue
    }
    if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) {
      const mi = items[id]?.melder_interval
      if (!mi || !MELDER_SET.has(mi)) {
        return { ok: false, message: 'Bitte beim Punkt Rauchmelder-Austausch eine Option wählen.' }
      }
      continue
    }
    const row = items[id]
    if (!row?.status) {
      return { ok: false, message: 'Bitte alle Feststellanlagen-Prüfpunkte bewerten.' }
    }
    if (row.status === 'mangel' && !(row.note ?? '').trim()) {
      const meta = getFeststellSectionAndLabelForItemId(mode, id)
      return {
        ok: false,
        message: `Bei „Mangel“ ist eine Beschreibung erforderlich${meta ? `: ${meta.label}` : ''}.`,
      }
    }
    if (row.advisory && !(row.advisory_note ?? '').trim()) {
      const meta = getFeststellSectionAndLabelForItemId(mode, id)
      return {
        ok: false,
        message: `Bei „Hinweis/empfohlene Maßnahme“ ist eine Beschreibung erforderlich${meta ? `: ${meta.label}` : ''}.`,
      }
    }
  }
  return { ok: true }
}

export const initEmptyFeststellChecklistItems = (
  mode: ChecklistDisplayMode
): Record<string, FeststellChecklistItemState> => {
  const m: Record<string, FeststellChecklistItemState> = {}
  for (const id of getFeststellChecklistItemIdsForMode(mode)) {
    m[id] = {}
  }
  if (mode === 'compact') {
    m[FESTSTELL_MELDER_INTERVAL_ITEM_ID] = {}
  }
  return m
}

export const countFeststellIncompleteItems = (
  mode: ChecklistDisplayMode,
  items: Record<string, FeststellChecklistItemState>
): number => {
  const ids = getFeststellChecklistItemIdsForMode(mode)
  let n = 0
  for (const id of ids) {
    if (mode === 'compact' && id === INTERVAL_SECTION_ID) {
      if (!items[FESTSTELL_MELDER_INTERVAL_ITEM_ID]?.melder_interval) n += 1
      continue
    }
    if (mode === 'detail' && id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) {
      if (!items[id]?.melder_interval) n += 1
      continue
    }
    if (!items[id]?.status) n += 1
  }
  return n
}

export const normalizeFeststellChecklistItemsForMode = (
  mode: ChecklistDisplayMode,
  items: Record<string, FeststellChecklistItemState>
): Record<string, FeststellChecklistItemState> => {
  const targetIds = getFeststellChecklistItemIdsForMode(mode)
  const hasTarget = targetIds.some((id) => items[id]?.status || items[id]?.melder_interval || items[id]?.advisory)
  if (hasTarget) return { ...items }

  const out: Record<string, FeststellChecklistItemState> = {}
  if (mode === 'compact') {
    for (const sec of FESTSTELL_CHECKLIST_SECTIONS) {
      if (sec.id === INTERVAL_SECTION_ID) {
        out[sec.id] = {}
        const interval = items[FESTSTELL_MELDER_INTERVAL_ITEM_ID]?.melder_interval
        if (interval) out[FESTSTELL_MELDER_INTERVAL_ITEM_ID] = { melder_interval: interval }
        continue
      }
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

  for (const sec of FESTSTELL_CHECKLIST_SECTIONS) {
    if (sec.id === INTERVAL_SECTION_ID) {
      out[FESTSTELL_MELDER_INTERVAL_ITEM_ID] = {
        melder_interval: items[FESTSTELL_MELDER_INTERVAL_ITEM_ID]?.melder_interval,
      }
      continue
    }
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

const ALL_FESTSTELL_LEGACY_BOOLEAN_KEYS: string[] = FESTSTELL_CHECKLIST_SECTIONS.flatMap((s) => [
  s.id,
  ...s.details.map((d) => d.id),
])

/** Legacy flache Booleans für alte RPC/JSON-Pfade. */
export const mergeFeststellChecklistState = (
  raw: Record<string, boolean> | undefined
): Record<string, boolean> => {
  const out: Record<string, boolean> = {}
  for (const id of ALL_FESTSTELL_LEGACY_BOOLEAN_KEYS) {
    out[id] = Boolean(raw?.[id])
  }
  return out
}

export const isFeststellMelderInterval = (
  v: string
): v is NonNullable<FeststellChecklistItemState['melder_interval']> =>
  MELDER_SET.has(v as NonNullable<FeststellChecklistItemState['melder_interval']>)
