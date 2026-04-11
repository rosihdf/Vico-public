import type { ChecklistDisplayMode, ChecklistItemStatus } from '../lib/doorMaintenanceChecklistCatalog'
import {
  FESTSTELL_MELDER_INTERVAL_ITEM_ID,
  type FeststellChecklistItemState,
} from '../lib/feststellChecklistCatalog'

/** Wartungs-Checkliste pro Tür (Auftrag Wartung), in completion_extra eingebettet. */
export type WartungChecklistItemState = {
  status?: ChecklistItemStatus
  note?: string
  /** Hinweis/empfohlene Maßnahme ohne Mangelbefund. */
  advisory?: boolean
  advisory_note?: string
}

export type WartungFeststellChecklistePerObject = {
  saved_at?: string
  checklist_modus?: ChecklistDisplayMode
  items: Record<string, FeststellChecklistItemState>
}

export type WartungChecklistPerObject = {
  saved_at?: string
  /** Modus zum Zeitpunkt des Speicherns (für Protokoll/PDF). */
  checklist_modus?: ChecklistDisplayMode
  items: Record<string, WartungChecklistItemState>
  /** Nur bei `has_hold_open` am Objekt; gleicher Modus wie Tür-Checkliste. */
  feststell_checkliste?: WartungFeststellChecklistePerObject
}

export type WartungChecklistExtraV1 = {
  v: 1
  by_object_id: Record<string, WartungChecklistPerObject>
}

/** Audit: Abschluss trotz unvollständiger Wartungscheckliste („Trotzdem abschließen“). */
export type WartungChecklisteAbschlussBypassV1 = {
  at: string
  profile_id: string | null
  incomplete_object_ids: string[]
}

/** Struktur in order_completions.completion_extra (Version 1). */
export type OrderCompletionExtraV1 = {
  v: 1
  bericht_datum: string
  monteur_name: string
  primary: { start: string; end: string; pause_minuten: number }
  zusatz_monteure: Array<{
    profile_id?: string
    name: string
    start: string
    end: string
    pause_minuten: number
  }>
  material_lines: Array<{ anzahl: string; artikel: string }>
  parked?: boolean
  portal_teilen?: boolean
  wartung_checkliste?: WartungChecklistExtraV1
  /** Legacy: flache Feststell-Booleans (alt, weiterhin lesbar) */
  feststell_checklist?: Record<string, boolean>
  /** Legacy: eine Auswahl zum Melder-Wechselintervall */
  feststell_melder_interval?: FeststellChecklistItemState['melder_interval'] | null
  /** Falls Kunde nicht unterschreibt (Monteurbericht), dokumentierter Grund. */
  customer_signature_reason?: string | null
  wartung_checkliste_abschluss_bypass?: WartungChecklisteAbschlussBypassV1
}

export const defaultOrderCompletionExtra = (monteurName: string): OrderCompletionExtraV1 => {
  const today = new Date().toISOString().slice(0, 10)
  return {
    v: 1,
    bericht_datum: today,
    monteur_name: monteurName,
    primary: { start: '', end: '', pause_minuten: 0 },
    zusatz_monteure: [],
    material_lines: [{ anzahl: '', artikel: '' }],
    parked: false,
    portal_teilen: false,
    feststell_checklist: {},
    feststell_melder_interval: null,
    customer_signature_reason: null,
  }
}

const parseWartungChecklisteAbschlussBypass = (
  raw: unknown
): WartungChecklisteAbschlussBypassV1 | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const at = typeof o.at === 'string' ? o.at : ''
  if (!at) return undefined
  const profile_id = typeof o.profile_id === 'string' ? o.profile_id : null
  const incomplete_object_ids = Array.isArray(o.incomplete_object_ids)
    ? o.incomplete_object_ids.filter((id): id is string => typeof id === 'string')
    : []
  return { at, profile_id, incomplete_object_ids }
}

export const parseOrderCompletionExtra = (raw: unknown, monteurNameFallback: string): OrderCompletionExtraV1 => {
  if (raw && typeof raw === 'object' && (raw as OrderCompletionExtraV1).v === 1) {
    const x = raw as OrderCompletionExtraV1
    return {
      v: 1,
      bericht_datum: x.bericht_datum || new Date().toISOString().slice(0, 10),
      monteur_name: x.monteur_name || monteurNameFallback,
      primary: {
        start: x.primary?.start ?? '',
        end: x.primary?.end ?? '',
        pause_minuten: Number(x.primary?.pause_minuten) || 0,
      },
      zusatz_monteure: Array.isArray(x.zusatz_monteure) ? x.zusatz_monteure : [],
      material_lines:
        Array.isArray(x.material_lines) && x.material_lines.length > 0
          ? x.material_lines.map((m) => ({ anzahl: String(m.anzahl ?? ''), artikel: String(m.artikel ?? '') }))
          : [{ anzahl: '', artikel: '' }],
      parked: Boolean(x.parked),
      portal_teilen: Boolean(x.portal_teilen),
      wartung_checkliste: parseWartungCheckliste((x as { wartung_checkliste?: unknown }).wartung_checkliste),
      feststell_checklist:
        x.feststell_checklist && typeof x.feststell_checklist === 'object'
          ? { ...x.feststell_checklist }
          : {},
      feststell_melder_interval:
        x.feststell_melder_interval === 'ohne_5j' ||
        x.feststell_melder_interval === 'mit_8j' ||
        x.feststell_melder_interval === 'nicht_beurteilt' ||
        x.feststell_melder_interval === 'entfaellt'
          ? x.feststell_melder_interval
          : null,
      customer_signature_reason:
        x.customer_signature_reason != null ? String(x.customer_signature_reason).slice(0, 500) : null,
      wartung_checkliste_abschluss_bypass: parseWartungChecklisteAbschlussBypass(
        (x as { wartung_checkliste_abschluss_bypass?: unknown }).wartung_checkliste_abschluss_bypass
      ),
    }
  }
  return defaultOrderCompletionExtra(monteurNameFallback)
}

const STATUS_SET = new Set<ChecklistItemStatus>(['ok', 'mangel', 'nicht_geprueft', 'entfaellt'])

const MELDER_INTERVAL_SET = new Set<FeststellChecklistItemState['melder_interval']>([
  'ohne_5j',
  'mit_8j',
  'nicht_beurteilt',
  'entfaellt',
])

const parseFeststellCheckliste = (raw: unknown): WartungFeststellChecklistePerObject | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const f = raw as WartungFeststellChecklistePerObject
  const rawItems = f.items
  if (!rawItems || typeof rawItems !== 'object') return undefined
  const items: Record<string, FeststellChecklistItemState> = {}
  for (const [iid, row] of Object.entries(rawItems)) {
    if (!row || typeof row !== 'object') continue
    if (iid === FESTSTELL_MELDER_INTERVAL_ITEM_ID) {
      const mi = (row as FeststellChecklistItemState).melder_interval
      if (mi && MELDER_INTERVAL_SET.has(mi)) {
        items[iid] = { melder_interval: mi }
      }
      continue
    }
    const st = (row as FeststellChecklistItemState).status
    if (st && STATUS_SET.has(st)) {
      items[iid] = {
        status: st,
        note:
          typeof (row as FeststellChecklistItemState).note === 'string'
            ? (row as FeststellChecklistItemState).note
            : undefined,
        advisory: Boolean((row as FeststellChecklistItemState).advisory),
        advisory_note:
          typeof (row as FeststellChecklistItemState).advisory_note === 'string'
            ? (row as FeststellChecklistItemState).advisory_note
            : undefined,
      }
    }
  }
  return {
    saved_at: typeof f.saved_at === 'string' ? f.saved_at : undefined,
    checklist_modus:
      f.checklist_modus === 'compact' || f.checklist_modus === 'detail' ? f.checklist_modus : undefined,
    items,
  }
}

const parseWartungCheckliste = (raw: unknown): WartungChecklistExtraV1 | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const w = raw as WartungChecklistExtraV1
  if (w.v !== 1 || !w.by_object_id || typeof w.by_object_id !== 'object') return undefined
  const by_object_id: Record<string, WartungChecklistPerObject> = {}
  for (const [oid, po] of Object.entries(w.by_object_id)) {
    if (!po || typeof po !== 'object') continue
    const items: Record<string, WartungChecklistItemState> = {}
    const rawItems = (po as WartungChecklistPerObject).items
    if (rawItems && typeof rawItems === 'object') {
      for (const [iid, row] of Object.entries(rawItems)) {
        if (!row || typeof row !== 'object') continue
        const st = (row as WartungChecklistItemState).status
        if (st && STATUS_SET.has(st)) {
          items[iid] = {
            status: st,
            note: typeof (row as WartungChecklistItemState).note === 'string' ? (row as WartungChecklistItemState).note : undefined,
            advisory: Boolean((row as WartungChecklistItemState).advisory),
            advisory_note:
              typeof (row as WartungChecklistItemState).advisory_note === 'string'
                ? (row as WartungChecklistItemState).advisory_note
                : undefined,
          }
        }
      }
    }
    const entry: WartungChecklistPerObject = {
      saved_at: typeof (po as WartungChecklistPerObject).saved_at === 'string' ? (po as WartungChecklistPerObject).saved_at : undefined,
      checklist_modus:
        (po as WartungChecklistPerObject).checklist_modus === 'compact' ||
        (po as WartungChecklistPerObject).checklist_modus === 'detail'
          ? (po as WartungChecklistPerObject).checklist_modus
          : undefined,
      items,
    }
    const fest = parseFeststellCheckliste((po as WartungChecklistPerObject).feststell_checkliste)
    if (fest) entry.feststell_checkliste = fest
    by_object_id[oid] = entry
  }
  return { v: 1, by_object_id }
}

export const materialLinesToText = (lines: OrderCompletionExtraV1['material_lines']): string =>
  lines
    .filter((l) => l.artikel.trim() || l.anzahl.trim())
    .map((l) => `${l.anzahl.trim() || '—'}× ${l.artikel.trim()}`.trim())
    .join('\n')
