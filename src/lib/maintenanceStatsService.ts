import type { MaintenanceReminder } from '../types'
import { escapeCsvCell, prependUtf8Bom } from '../../shared/csvUtils'

export type StatusTotals = {
  total: number
  overdue: number
  dueSoon: number
  ok: number
}

export type CustomerAggregateRow = {
  customer_id: string
  customer_name: string
  total: number
  overdue: number
  dueSoon: number
  ok: number
}

export type BvAggregateRow = {
  customer_id: string
  customer_name: string
  bv_id: string
  bv_name: string
  total: number
  overdue: number
  dueSoon: number
  ok: number
}

export const computeStatusTotals = (reminders: MaintenanceReminder[]): StatusTotals => {
  let overdue = 0
  let dueSoon = 0
  let ok = 0
  for (const r of reminders) {
    if (r.status === 'overdue') overdue++
    else if (r.status === 'due_soon') dueSoon++
    else ok++
  }
  return { total: reminders.length, overdue, dueSoon, ok }
}

export const aggregateRemindersByCustomer = (reminders: MaintenanceReminder[]): CustomerAggregateRow[] => {
  const map = new Map<string, CustomerAggregateRow>()
  for (const r of reminders) {
    const cur =
      map.get(r.customer_id) ??
      ({
        customer_id: r.customer_id,
        customer_name: r.customer_name || '–',
        total: 0,
        overdue: 0,
        dueSoon: 0,
        ok: 0,
      } satisfies CustomerAggregateRow)
    cur.total++
    if (r.status === 'overdue') cur.overdue++
    else if (r.status === 'due_soon') cur.dueSoon++
    else cur.ok++
    map.set(r.customer_id, cur)
  }
  return [...map.values()].sort(
    (a, b) => b.overdue - a.overdue || b.dueSoon - a.dueSoon || b.total - a.total
  )
}

export const aggregateRemindersByBv = (reminders: MaintenanceReminder[]): BvAggregateRow[] => {
  const key = (r: MaintenanceReminder) => `${r.customer_id}::${r.bv_id}`
  const map = new Map<string, BvAggregateRow>()
  for (const r of reminders) {
    const k = key(r)
    const cur =
      map.get(k) ??
      ({
        customer_id: r.customer_id,
        customer_name: r.customer_name || '–',
        bv_id: r.bv_id,
        bv_name: r.bv_name || '–',
        total: 0,
        overdue: 0,
        dueSoon: 0,
        ok: 0,
      } satisfies BvAggregateRow)
    cur.total++
    if (r.status === 'overdue') cur.overdue++
    else if (r.status === 'due_soon') cur.dueSoon++
    else cur.ok++
    map.set(k, cur)
  }
  return [...map.values()].sort(
    (a, b) => b.overdue - a.overdue || b.dueSoon - a.dueSoon || b.total - a.total
  )
}

/** CSV mit Semikolon (Excel DE); UTF-8 mit BOM für Excel. */
export const buildRemindersDetailCsv = (reminders: MaintenanceReminder[]): string => {
  const headers = [
    'Kunde',
    'Objekt/BV',
    'Objekt',
    'Interne_ID',
    'Status',
    'Naechste_Wartung',
    'Letzte_Wartung',
    'Tage_bis_faellig',
    'Intervall_Monate',
  ]
  const lines = [headers.join(';')]
  for (const r of reminders) {
    const objLabel = r.object_name?.trim() || r.internal_id || '–'
    lines.push(
      [
        escapeCsvCell(r.customer_name),
        escapeCsvCell(r.bv_name),
        escapeCsvCell(objLabel),
        escapeCsvCell(r.internal_id),
        escapeCsvCell(r.status),
        escapeCsvCell(r.next_maintenance_date),
        escapeCsvCell(r.last_maintenance_date),
        escapeCsvCell(r.days_until_due),
        escapeCsvCell(r.maintenance_interval_months),
      ].join(';')
    )
  }
  return prependUtf8Bom(lines.join('\n'))
}

export const buildCustomerAggregateCsv = (rows: CustomerAggregateRow[]): string => {
  const headers = ['Kunde_ID', 'Kunde', 'Gesamt', 'Ueberfaellig', 'Bald_faellig', 'OK']
  const lines = [headers.join(';')]
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.customer_id),
        escapeCsvCell(r.customer_name),
        escapeCsvCell(r.total),
        escapeCsvCell(r.overdue),
        escapeCsvCell(r.dueSoon),
        escapeCsvCell(r.ok),
      ].join(';')
    )
  }
  return prependUtf8Bom(lines.join('\n'))
}

export const buildBvAggregateCsv = (rows: BvAggregateRow[]): string => {
  const headers = ['Kunde_ID', 'Kunde', 'BV_ID', 'Objekt_BV', 'Gesamt', 'Ueberfaellig', 'Bald_faellig', 'OK']
  const lines = [headers.join(';')]
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.customer_id),
        escapeCsvCell(r.customer_name),
        escapeCsvCell(r.bv_id),
        escapeCsvCell(r.bv_name),
        escapeCsvCell(r.total),
        escapeCsvCell(r.overdue),
        escapeCsvCell(r.dueSoon),
        escapeCsvCell(r.ok),
      ].join(';')
    )
  }
  return prependUtf8Bom(lines.join('\n'))
}
