import type { User } from '@supabase/supabase-js'
import { getOrderObjectIds } from './orderUtils'
import { getObjectDisplayName } from './objectUtils'
import { getProfileDisplayName, type Profile } from './userService'
import type { Order, Customer, BV, Object as Obj } from '../types'

/** Rollen wie in AuthContext; nur für reinen Listenfilter benötigt. */
export type AuftragListUserRole =
  | 'admin'
  | 'teamleiter'
  | 'mitarbeiter'
  | 'operator'
  | 'leser'
  | 'demo'
  | 'kunde'

export function buildParentOrderIdsWithChildren(orders: Order[]): Set<string> {
  const ids = new Set<string>()
  for (const row of orders) {
    if (row.related_order_id) ids.add(row.related_order_id)
  }
  return ids
}

export function isOrderLinkedForList(o: Order, parentOrderIdsWithChildren: Set<string>): boolean {
  return Boolean(o.related_order_id) || parentOrderIdsWithChildren.has(o.id)
}

export function filterOrdersByRole(
  orders: Order[],
  userRole: AuftragListUserRole | null,
  user: User | null,
): Order[] {
  if (userRole === 'admin' || userRole === 'leser') return orders
  if (user) return orders.filter((o) => o.assigned_to === user.id)
  return []
}

function statusMatchesArchiveMode(archiveMode: 'active' | 'archive', o: Order): boolean {
  if (archiveMode === 'active') {
    return o.status === 'offen' || o.status === 'in_bearbeitung'
  }
  return o.status === 'erledigt' || o.status === 'storniert'
}

/**
 * Gefilterte Aufträge für Liste/Kalender inkl. Index für Verknüpfungen (aus der vollen Order-Liste).
 */
export function deriveAuftragListView(
  orders: Order[],
  userRole: AuftragListUserRole | null,
  user: User | null,
  archiveMode: 'active' | 'archive',
  relationFilter: 'all' | 'linked' | 'unlinked',
): { displayOrders: Order[]; parentOrderIdsWithChildren: Set<string> } {
  const parentOrderIdsWithChildren = buildParentOrderIdsWithChildren(orders)
  const filteredByRole = filterOrdersByRole(orders, userRole, user)
  const displayOrders = filteredByRole
    .filter((o) => statusMatchesArchiveMode(archiveMode, o))
    .filter((o) => {
      if (relationFilter === 'linked') return isOrderLinkedForList(o, parentOrderIdsWithChildren)
      if (relationFilter === 'unlinked') return !isOrderLinkedForList(o, parentOrderIdsWithChildren)
      return true
    })
  return { displayOrders, parentOrderIdsWithChildren }
}

export type AuftragOrderListRow = Order & {
  customerName: string
  bvName: string
  isLinked: boolean
  hasChildren: boolean
}

export function getCustomerDisplayName(customers: Customer[], id: string): string {
  return customers.find((c) => c.id === id)?.name ?? '-'
}

export function getBvDisplayName(allBvs: BV[], id: string | null | undefined): string {
  if (!id) return '—'
  return allBvs.find((b) => b.id === id)?.name ?? '-'
}

export function mapOrdersWithListLabels(
  displayOrders: Order[],
  customers: Customer[],
  allBvs: BV[],
  parentOrderIdsWithChildren: Set<string>,
): AuftragOrderListRow[] {
  return displayOrders.map((o) => ({
    ...o,
    customerName: getCustomerDisplayName(customers, o.customer_id),
    bvName: getBvDisplayName(allBvs, o.bv_id),
    isLinked: isOrderLinkedForList(o, parentOrderIdsWithChildren),
    hasChildren: parentOrderIdsWithChildren.has(o.id),
  }))
}

export function orderObjectSummaryForOrder(o: Order, allObjects: Obj[]): string | null {
  const ids = getOrderObjectIds(o)
  if (ids.length === 0) return null
  if (ids.length === 1) {
    const obj = allObjects.find((x) => x.id === ids[0])
    return ` · ${obj ? getObjectDisplayName(obj) : ids[0].slice(0, 8)}`
  }
  return ` · ${ids.length} Türen/Tore`
}

export function getProfileLabelForOrderList(profiles: Profile[], id: string | null): string {
  if (!id) return '-'
  const p = profiles.find((x) => x.id === id)
  if (!p) return id.slice(0, 8)
  return getProfileDisplayName(p)
}
