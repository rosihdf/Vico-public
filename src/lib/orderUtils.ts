import type { Order, OrderStatus } from '../types'

/** Alle zugeordneten Tür-/Tor-IDs (neu: object_ids, sonst object_id). */
export const getOrderObjectIds = (o: Pick<Order, 'object_id' | 'object_ids'>): string[] => {
  const fromArr = o.object_ids
  if (Array.isArray(fromArr) && fromArr.length > 0) return [...fromArr]
  if (o.object_id) return [o.object_id]
  return []
}

export type ActiveOrderObjectConflict = { objectId: string; orderId: string }

/** Gleicher Text wie in dataService (Client-Fehler vor API). */
export const ORDER_ACTIVE_PER_OBJECT_CONFLICT_MESSAGE =
  'Für mindestens eine gewählte Tür/Tor existiert bereits ein aktiver Auftrag (offen oder in Bearbeitung). Nutzen Sie den Link zum bestehenden Auftrag, schließen oder stornieren Sie ihn, oder erweitern Sie ihn (z. B. per QR-Zusammenführung).'

export const ORDER_ACTIVE_PER_OBJECT_CONFLICT_CODE = 'active_order_per_object' as const

export type OrderActivePerObjectError = {
  message: string
  code: typeof ORDER_ACTIVE_PER_OBJECT_CONFLICT_CODE
  conflicts: ActiveOrderObjectConflict[]
}

export const isOrderActivePerObjectError = (e: unknown): e is OrderActivePerObjectError =>
  typeof e === 'object' &&
  e !== null &&
  (e as { code?: unknown }).code === ORDER_ACTIVE_PER_OBJECT_CONFLICT_CODE &&
  Array.isArray((e as { conflicts?: unknown }).conflicts)

/** Eine Zeile pro betroffenem Auftrag (mehrere Türen am selben Auftrag → ein Link). */
export const groupActiveOrderConflictsByOrderId = (
  conflicts: ActiveOrderObjectConflict[]
): { orderId: string; objectIds: string[] }[] => {
  const m = new Map<string, string[]>()
  for (const c of conflicts) {
    const arr = m.get(c.orderId) ?? []
    if (!arr.includes(c.objectId)) arr.push(c.objectId)
    m.set(c.orderId, arr)
  }
  return [...m.entries()].map(([orderId, objectIds]) => ({ orderId, objectIds }))
}

/**
 * Pro object_id höchstens ein Auftrag mit Status offen oder in_bearbeitung (§11.19 / WP-ORD).
 * Prüfung gegen eine bekannte Auftragsliste (z. B. Cache); `excludeOrderId` = bearbeiteter Auftrag.
 */
export const findActiveOrderConflictsAmong = (
  orders: Pick<Order, 'id' | 'status' | 'object_id' | 'object_ids'>[],
  excludeOrderId: string | null,
  objectIds: string[],
  effectiveStatus: OrderStatus
): ActiveOrderObjectConflict[] => {
  if (effectiveStatus !== 'offen' && effectiveStatus !== 'in_bearbeitung') return []
  const want = [...new Set(objectIds.filter(Boolean))]
  if (want.length === 0) return []
  const seen = new Set<string>()
  const out: ActiveOrderObjectConflict[] = []
  for (const o of orders) {
    if (excludeOrderId && o.id === excludeOrderId) continue
    if (o.status !== 'offen' && o.status !== 'in_bearbeitung') continue
    const oids = getOrderObjectIds(o)
    for (const oid of want) {
      if (oids.includes(oid) && !seen.has(oid)) {
        seen.add(oid)
        out.push({ objectId: oid, orderId: o.id })
      }
    }
  }
  return out
}
