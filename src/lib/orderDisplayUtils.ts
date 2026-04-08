import { fetchObject } from './dataService'
import { getOrderObjectIds } from './orderUtils'
import { getObjectDisplayName } from './objectUtils'
import type { Order } from '../types'

/** Bezeichnungen aller am Auftrag beteiligten Türen/Tore (für Monteurs-PDF / Kurzreferenz). */
export const fetchInspectedDoorLabelsForOrder = async (order: Order): Promise<string[]> => {
  const ids = getOrderObjectIds(order)
  const labels: string[] = []
  for (const id of ids) {
    const o = await fetchObject(id)
    labels.push(o ? getObjectDisplayName(o) : id.slice(0, 8))
  }
  return labels
}
