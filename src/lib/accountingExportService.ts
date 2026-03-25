import type { Order, Customer, BV, OrderCompletion, OrderType, OrderStatus } from '../types'
import { getOrderObjectIds } from './orderUtils'
import { parseOrderCompletionExtra, materialLinesToText } from '../types/orderCompletionExtra'
import type { Profile } from './userService'
import { getProfileDisplayName } from './userService'
import { escapeCsvCell, prependUtf8Bom } from '../../shared/csvUtils'

const TYPE_DE: Record<OrderType, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

const STATUS_DE: Record<OrderStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  storniert: 'Storniert',
}

const truncateField = (s: string | null | undefined, max: number): string => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export const filterOrdersForAccountingExport = (
  orders: Order[],
  dateFrom: string,
  dateTo: string,
  includeStorniert: boolean
): Order[] =>
  orders.filter((o) => {
    const d = o.order_date || ''
    if (d < dateFrom || d > dateTo) return false
    if (!includeStorniert && o.status === 'storniert') return false
    return true
  })

/**
 * CSV für Buchhaltung/Abrechnung (Excel DE: Semikolon, UTF-8 BOM).
 * Hinweis: Kein Steuer-/Rechnungsersatz; Basis-Export bis ggf. SevDesk o. Ä.
 */
export const buildAccountingOrdersCsv = (
  orders: Order[],
  customers: Customer[],
  bvs: BV[],
  profiles: Profile[],
  completionByOrderId: Map<string, OrderCompletion>
): string => {
  const customerById = new Map(customers.map((c) => [c.id, c]))
  const bvById = new Map(bvs.map((b) => [b.id, b]))
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  const assigneeLabel = (userId: string | null): string => {
    if (!userId) return ''
    const p = profileById.get(userId)
    return p ? getProfileDisplayName(p) : userId
  }

  const headers = [
    'Auftrag_ID',
    'Auftragsdatum',
    'Auftragszeit',
    'Typ',
    'Status',
    'Kunde_ID',
    'Kunde_Name',
    'BV_ID',
    'BV_Name',
    'Objekt_ID',
    'Beschreibung',
    'Zugewiesen_Name',
    'Zugewiesen_Benutzer_ID',
    'Erstellt_von_Benutzer_ID',
    'Monteursbericht',
    'Arbeitszeit_Minuten',
    'Ausgefuehrte_Arbeiten_Auszug',
    'Material_Auszug',
    'Bericht_erstellt_am',
    'Monteur_Berichtsdatum',
    'Monteur_Material_Zeilen',
    'Monteur_Arbeitszeit_Min_Berechnet',
  ]

  const lines = [headers.join(';')]

  for (const o of orders) {
    const cust = customerById.get(o.customer_id)
    const bv = o.bv_id ? bvById.get(o.bv_id) : undefined
    const completion = completionByOrderId.get(o.id)
    const ex = completion
      ? parseOrderCompletionExtra(completion.completion_extra, '')
      : null
    const matLines = ex ? materialLinesToText(ex.material_lines) : ''
    lines.push(
      [
        escapeCsvCell(o.id),
        escapeCsvCell(o.order_date),
        escapeCsvCell(o.order_time),
        escapeCsvCell(TYPE_DE[o.order_type] ?? o.order_type),
        escapeCsvCell(STATUS_DE[o.status] ?? o.status),
        escapeCsvCell(o.customer_id),
        escapeCsvCell(cust?.name ?? ''),
        escapeCsvCell(o.bv_id),
        escapeCsvCell(bv?.name ?? ''),
        escapeCsvCell(getOrderObjectIds(o).join(', ')),
        escapeCsvCell(truncateField(o.description, 500)),
        escapeCsvCell(assigneeLabel(o.assigned_to)),
        escapeCsvCell(o.assigned_to),
        escapeCsvCell(o.created_by),
        escapeCsvCell(completion ? 'ja' : 'nein'),
        escapeCsvCell(completion?.arbeitszeit_minuten ?? ''),
        escapeCsvCell(truncateField(completion?.ausgeführte_arbeiten ?? null, 400)),
        escapeCsvCell(truncateField(completion?.material ?? null, 400)),
        escapeCsvCell(completion?.created_at ?? ''),
        escapeCsvCell(ex?.bericht_datum ?? ''),
        escapeCsvCell(truncateField(matLines || null, 500)),
        escapeCsvCell(completion?.arbeitszeit_minuten ?? ''),
      ].join(';')
    )
  }

  return prependUtf8Bom(lines.join('\n'))
}
