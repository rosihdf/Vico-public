import { getOrderObjectIds } from './orderUtils'
import type { Order, OrderType, OrderStatus } from '../types'

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  storniert: 'Storniert',
}

/** Einheitliche Höhe für Eingaben und Aktionen (Toolbar + Auftragszeilen). */
export const orderPageControlH = 'h-9 min-h-9'
export const orderPageSegmentBtn = `${orderPageControlH} px-3 inline-flex items-center justify-center text-sm font-medium`
export const orderPagePrimaryCta = `${orderPageControlH} px-4 inline-flex items-center justify-center font-medium`
export const orderListNativeControl = `${orderPageControlH} px-3 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100`
export const orderListActionBtn = `${orderPageControlH} px-3 text-sm inline-flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50`
export const orderListActionLink = `${orderListActionBtn} text-center`

/**
 * Listenzeile Zuweisen + Status: wirkt wie Dropdown (Chevron, rechter „Trigger“-Streifen),
 * unterscheidet sich optisch von Textfeldern und Aktions-Buttons.
 */
const orderListRowSelectChevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23475569' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")] dark:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23cbd5e1' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")] bg-[length:1.25rem] bg-[right_0.4rem_center] bg-no-repeat"
export const orderListRowSelect =
  `${orderPageControlH} pl-3 pr-9 min-w-0 text-sm font-medium cursor-pointer appearance-none border border-slate-300 dark:border-slate-600 rounded-lg ` +
  `bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 ` +
  /** Rechter Streifen: zeigt „hier öffnet sich die Liste“ neben dem Chevron */
  `shadow-[inset_-1.85rem_0_0_0_rgb(248_250_252)] dark:shadow-[inset_-1.85rem_0_0_0_rgb(51_65_85)] ` +
  `hover:bg-slate-50 hover:shadow-[inset_-1.85rem_0_0_0_rgb(241_245_249)] dark:hover:bg-slate-800/90 dark:hover:shadow-[inset_-1.85rem_0_0_0_rgb(71_85_105)] ` +
  `transition-[color,background-color,box-shadow] duration-150 ` +
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-vico-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ` +
  `${orderListRowSelectChevron}`

export const orderFormControl =
  'w-full h-9 min-h-9 px-3 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
/** Mehrzeilig – gleiche Optik wie Einzeiler, ohne feste Zeilenhöhe. */
export const orderFormTextarea =
  'w-full min-h-[4.5rem] px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
export const orderFormFooterBtn = `${orderPageControlH} px-4 inline-flex items-center justify-center text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-lg`

export type OrderFormState = {
  customer_id: string
  bv_id: string
  selectedObjectIds: string[]
  order_date: string
  order_time: string
  order_type: OrderType
  status: OrderStatus
  description: string
  assigned_to: string
}

export const INITIAL_FORM: OrderFormState = {
  customer_id: '',
  bv_id: '',
  selectedObjectIds: [],
  order_date: new Date().toISOString().slice(0, 10),
  order_time: '',
  order_type: 'wartung',
  status: 'offen',
  description: '',
  assigned_to: '',
}

export const orderToFormState = (o: Order): OrderFormState => ({
  customer_id: o.customer_id,
  bv_id: o.bv_id ?? '',
  selectedObjectIds: getOrderObjectIds(o),
  order_date: o.order_date,
  order_time: o.order_time ?? '',
  order_type: o.order_type,
  status: o.status,
  description: o.description ?? '',
  assigned_to: o.assigned_to ?? '',
})

/** Direkt Tür/Tor-Modal ohne Kundenliste; nach Schließen zurück zu Aufträgen (oder returnTo). */
export const buildObjektBearbeitenUrl = (o: Order): string => {
  const ids = getOrderObjectIds(o)
  const firstId = ids[0] ?? o.object_id
  if (!firstId) {
    const params = new URLSearchParams()
    params.set('customerId', o.customer_id)
    params.set('returnTo', '/auftrag')
    if (o.bv_id) params.set('bvId', o.bv_id)
    return `/kunden?${params.toString()}`
  }
  const params = new URLSearchParams()
  params.set('returnTo', '/auftrag')
  params.set('customerId', o.customer_id)
  if (o.bv_id) params.set('bvId', o.bv_id)
  return `/objekt/${firstId}/bearbeiten?${params.toString()}`
}
