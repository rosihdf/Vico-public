import type { Order } from '../types'

/** Alle zugeordneten Tür-/Tor-IDs (neu: object_ids, sonst object_id). */
export const getOrderObjectIds = (o: Pick<Order, 'object_id' | 'object_ids'>): string[] => {
  const fromArr = o.object_ids
  if (Array.isArray(fromArr) && fromArr.length > 0) return [...fromArr]
  if (o.object_id) return [o.object_id]
  return []
}
