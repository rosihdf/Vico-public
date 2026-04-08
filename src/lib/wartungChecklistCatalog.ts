/**
 * Wartungs-Checkliste pro Tür/Tor (P7, Offline über maintenance_reports.checklist_state).
 */
export type WartungChecklistItem = {
  id: string
  label: string
}

export const WARTUNG_CHECKLIST_ITEMS: WartungChecklistItem[] = [
  { id: 'w_visuell', label: 'Visuelle Kontrolle Türblatt / Rahmen' },
  { id: 'w_scharniere', label: 'Scharniere / Aufhängung geschmiert bzw. i. O.' },
  { id: 'w_schloss', label: 'Schließzylinder / Beschlag geprüft' },
  { id: 'w_dichtungen', label: 'Dichtungen / Absenkdichtung geprüft' },
  { id: 'w_antrieb', label: 'Antrieb / Motor (falls vorhanden) geprüft' },
  { id: 'w_sicherheit', label: 'Sicherheitsrelevante Funktionen (Notöffnung, Sensoren) geprüft' },
  { id: 'w_reinigung', label: 'Laufflächen / Führungen gereinigt' },
]

export const emptyWartungChecklistState = (): Record<string, boolean> =>
  Object.fromEntries(WARTUNG_CHECKLIST_ITEMS.map((i) => [i.id, false])) as Record<string, boolean>

export const mergeWartungChecklistState = (raw: Record<string, boolean> | undefined): Record<string, boolean> => {
  const out: Record<string, boolean> = {}
  for (const item of WARTUNG_CHECKLIST_ITEMS) {
    out[item.id] = Boolean(raw?.[item.id])
  }
  return out
}
