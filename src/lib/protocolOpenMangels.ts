/**
 * §11.17#4: Kundenliste / Zähler aus letztem abgeschlossenen Prüfungsauftrag
 * mit gespeicherter Checkliste pro object_id (nur Status „Mangel“).
 */

import {
  getChecklistItemIdsForMode,
  getSectionAndLabelForItemId,
  type ChecklistDisplayMode,
} from './doorMaintenanceChecklistCatalog'
import {
  FESTSTELL_MELDER_INTERVAL_ITEM_ID,
  getFeststellChecklistItemIdsForMode,
  getFeststellSectionAndLabelForItemId,
  type FeststellChecklistItemState,
} from './feststellChecklistCatalog'
import { getOrderObjectIds } from './orderUtils'
import type { Object as Obj, Order } from '../types'
import type {
  WartungChecklistPerObject,
  WartungFeststellChecklistePerObject,
} from '../types/orderCompletionExtra'
import { parseOrderCompletionExtra } from '../types/orderCompletionExtra'

const FESTSTELL_INTERVAL_SECTION_ID = 'sec-fst-intervall'

export type ProtocolMangelSource = 'tuer' | 'feststell'

export type ProtocolOpenMangelRow = {
  object_id: string
  source: ProtocolMangelSource
  item_id: string
  label: string
  section_title: string
  note: string | null
  order_id: string
  /** YYYY-MM-DD (Berichtsdatum, sonst Auftrag/completion) */
  established_on: string
}

export type AuthoritativeProtocolRowInput = {
  order: Pick<Order, 'id' | 'object_id' | 'object_ids' | 'updated_at'>
  completion_extra: unknown
  completion_created_at: string
}

export type AuthoritativeChecklistSnapshot = {
  per: WartungChecklistPerObject
  order_id: string
  established_on: string
}

const doorMode = (per: WartungChecklistPerObject): ChecklistDisplayMode =>
  per.checklist_modus === 'detail' ? 'detail' : 'compact'

const festMode = (fc: WartungFeststellChecklistePerObject): ChecklistDisplayMode =>
  fc.checklist_modus === 'detail' ? 'detail' : 'compact'

export const extractDoorMangelRowsFromPerObject = (
  per: WartungChecklistPerObject,
  ctx: { object_id: string; order_id: string; established_on: string }
): ProtocolOpenMangelRow[] => {
  const mode = doorMode(per)
  const items = per.items ?? {}
  const out: ProtocolOpenMangelRow[] = []
  for (const id of getChecklistItemIdsForMode(mode)) {
    const row = items[id]
    if (!row || row.status !== 'mangel') continue
    const meta = getSectionAndLabelForItemId(mode, id)
    out.push({
      object_id: ctx.object_id,
      source: 'tuer',
      item_id: id,
      label: meta?.label ?? id,
      section_title: meta?.sectionTitle ?? '',
      note: (row.note ?? '').trim() ? String(row.note).trim() : null,
      order_id: ctx.order_id,
      established_on: ctx.established_on,
    })
  }
  return out
}

export const extractFeststellMangelRowsFromFeststellBlock = (
  fc: WartungFeststellChecklistePerObject,
  ctx: { object_id: string; order_id: string; established_on: string }
): ProtocolOpenMangelRow[] => {
  const mode = festMode(fc)
  const items: Record<string, FeststellChecklistItemState> = fc.items ?? {}
  const out: ProtocolOpenMangelRow[] = []
  for (const id of getFeststellChecklistItemIdsForMode(mode)) {
    if (mode === 'compact' && id === FESTSTELL_INTERVAL_SECTION_ID) continue
    if (id === FESTSTELL_MELDER_INTERVAL_ITEM_ID) continue
    const row = items[id]
    if (!row || row.status !== 'mangel') continue
    const meta = getFeststellSectionAndLabelForItemId(mode, id)
    out.push({
      object_id: ctx.object_id,
      source: 'feststell',
      item_id: id,
      label: meta?.label ?? id,
      section_title: meta?.sectionTitle ?? '',
      note: (row.note ?? '').trim() ? String(row.note).trim() : null,
      order_id: ctx.order_id,
      established_on: ctx.established_on,
    })
  }
  return out
}

/**
 * Pro object_id gewinnt der **neueste** erledigte Prüfungsauftrag (updated_at),
 * der für diese Tür eine Checkliste mit `saved_at` enthält.
 *
 * **Bypass (WP-MANG-05):** Steht `object_id` in `wartung_checkliste_abschluss_bypass.incomplete_object_ids`,
 * gilt dieser Abschluss **nicht** als maßgeblich – es wird der nächstältere passende Auftrag genutzt
 * (oder keiner, wenn es keinen gibt). Ohne `wartung_checkliste` / ohne Completion-Zeile fehlt der Auftrag
 * in `inputs` → keine Änderung am Zähler für betroffene Türen über diesen Auftrag.
 */
export const buildAuthoritativeChecklistSnapshotsByObjectId = (
  inputs: AuthoritativeProtocolRowInput[]
): Map<string, AuthoritativeChecklistSnapshot> => {
  const sorted = [...inputs].sort((a, b) => {
    const ta = new Date(a.order.updated_at).getTime()
    const tb = new Date(b.order.updated_at).getTime()
    if (tb !== ta) return tb - ta
    return new Date(b.completion_created_at).getTime() - new Date(a.completion_created_at).getTime()
  })
  const map = new Map<string, AuthoritativeChecklistSnapshot>()
  for (const row of sorted) {
    const extra = parseOrderCompletionExtra(row.completion_extra, '')
    const by = extra.wartung_checkliste?.by_object_id
    if (!by) continue
    const bypassIncomplete = new Set(extra.wartung_checkliste_abschluss_bypass?.incomplete_object_ids ?? [])
    const established =
      (extra.bericht_datum && String(extra.bericht_datum).slice(0, 10)) ||
      (row.order.updated_at && String(row.order.updated_at).slice(0, 10)) ||
      (row.completion_created_at && row.completion_created_at.slice(0, 10)) ||
      ''
    const oids = getOrderObjectIds(row.order)
    for (const oid of oids) {
      if (map.has(oid)) continue
      if (bypassIncomplete.has(oid)) continue
      const per = by[oid]
      if (!per?.saved_at) continue
      map.set(oid, { per, order_id: row.order.id, established_on: established })
    }
  }
  return map
}

export const protocolOpenMangelRowsFromSnapshots = (
  snapshots: Map<string, AuthoritativeChecklistSnapshot>
): ProtocolOpenMangelRow[] => {
  const rows: ProtocolOpenMangelRow[] = []
  for (const [object_id, snap] of snapshots) {
    const ctx = { object_id, order_id: snap.order_id, established_on: snap.established_on }
    rows.push(...extractDoorMangelRowsFromPerObject(snap.per, ctx))
    const fc = snap.per.feststell_checkliste
    if (fc?.saved_at) {
      rows.push(...extractFeststellMangelRowsFromFeststellBlock(fc, ctx))
    }
  }
  return rows
}

/**
 * §11.17#4 Tür-Detail: **neuester** laufender Prüfungsauftrag (`offen` / `in_bearbeitung`) mit gespeicherter
 * Checkliste für diese `object_id` – nur Anzeige (Entwurf), **ohne** Einfluss auf Listen-Zähler.
 *
 * **Bypass:** Im Gegensatz zur maßgeblichen Aggregation wird `wartung_checkliste_abschluss_bypass` hier **nicht**
 * ausgewertet – der Monteur sieht den zuletzt gespeicherten Stand am laufenden Auftrag.
 */
export const buildDraftChecklistSnapshotForObjectId = (
  objectId: string,
  inputs: AuthoritativeProtocolRowInput[]
): AuthoritativeChecklistSnapshot | null => {
  const sorted = [...inputs].sort((a, b) => {
    const ta = new Date(a.order.updated_at).getTime()
    const tb = new Date(b.order.updated_at).getTime()
    if (tb !== ta) return tb - ta
    return new Date(b.completion_created_at).getTime() - new Date(a.completion_created_at).getTime()
  })
  for (const row of sorted) {
    const oids = getOrderObjectIds(row.order)
    if (!oids.includes(objectId)) continue
    const extra = parseOrderCompletionExtra(row.completion_extra, '')
    const by = extra.wartung_checkliste?.by_object_id
    if (!by) continue
    const per = by[objectId]
    if (!per?.saved_at) continue
    const established =
      (extra.bericht_datum && String(extra.bericht_datum).slice(0, 10)) ||
      (row.order.updated_at && String(row.order.updated_at).slice(0, 10)) ||
      (row.completion_created_at && row.completion_created_at.slice(0, 10)) ||
      ''
    return { per, order_id: row.order.id, established_on: established }
  }
  return null
}

export const protocolOpenMangelRowsForObjectFromSnapshot = (
  objectId: string,
  snap: AuthoritativeChecklistSnapshot | null
): ProtocolOpenMangelRow[] => {
  if (!snap) return []
  const ctx = { object_id: objectId, order_id: snap.order_id, established_on: snap.established_on }
  const rows: ProtocolOpenMangelRow[] = []
  rows.push(...extractDoorMangelRowsFromPerObject(snap.per, ctx))
  const fc = snap.per.feststell_checkliste
  if (fc?.saved_at) {
    rows.push(...extractFeststellMangelRowsFromFeststellBlock(fc, ctx))
  }
  return rows
}

export const countByObjectIdFromProtocolRows = (
  rows: ProtocolOpenMangelRow[]
): Record<string, number> => {
  const m: Record<string, number> = {}
  for (const r of rows) {
    m[r.object_id] = (m[r.object_id] ?? 0) + 1
  }
  return m
}

export const protocolMangelBadgeMapsFromRowsAndObjects = (
  rows: ProtocolOpenMangelRow[],
  objects: Pick<Obj, 'id' | 'customer_id' | 'bv_id'>[]
): { totalByCustomerId: Record<string, number>; byBvCompositeKey: Record<string, number> } => {
  const countByObject = countByObjectIdFromProtocolRows(rows)
  const objMap = new Map(objects.map((o) => [o.id, o]))
  const totalByCustomerId: Record<string, number> = {}
  const byBvCompositeKey: Record<string, number> = {}
  for (const [oid, n] of Object.entries(countByObject)) {
    const o = objMap.get(oid)
    if (!o?.customer_id) continue
    const cid = o.customer_id
    totalByCustomerId[cid] = (totalByCustomerId[cid] ?? 0) + n
    const bvKey = `${cid}::${o.bv_id ?? 'direct'}`
    byBvCompositeKey[bvKey] = (byBvCompositeKey[bvKey] ?? 0) + n
  }
  return { totalByCustomerId, byBvCompositeKey }
}
