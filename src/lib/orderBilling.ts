import type { Order, OrderBillingStatus } from '../types/order'

export const resolveOrderBillingStatus = (order: Pick<Order, 'billing_status' | 'status'>): OrderBillingStatus => {
  if (order.billing_status === 'open') return 'open'
  if (order.billing_status === 'prepared') return 'prepared'
  if (order.billing_status === 'billed') return 'billed'
  if (order.billing_status === 'cancelled') return 'cancelled'
  if (order.status === 'storniert') return 'cancelled'
  if (order.status === 'erledigt') return 'prepared'
  return 'open'
}

export const ORDER_BILLING_STATUS_LABELS: Record<OrderBillingStatus, string> = {
  open: 'Offen',
  prepared: 'Vorbereitet',
  billed: 'Abgerechnet',
  cancelled: 'Storniert',
}
