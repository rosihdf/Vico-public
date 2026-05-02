import { supabase } from '../../supabase'
import { MAINTENANCE_REPORT_COLUMNS } from '../dataColumns'
import { isOnline } from '../../../shared/networkUtils'
import type { MaintenanceReport, OrderStatus, OrderType } from '../../types'
import { ORDER_TYPE_LABELS } from '../auftragsdetailPure'

type EmbeddedCustomerMini = {
  id: string
  name: string
  maintenance_report_email: boolean
  maintenance_report_email_address: string | null
} | null

type EmbeddedBvMini = {
  id: string
  name: string
  customer_id: string
  maintenance_report_email: boolean
  maintenance_report_email_address: string | null
  customers: EmbeddedCustomerMini
} | null

export type EmbeddedObjectMini = {
  id: string
  name: string | null
  internal_id: string | null
  bv_id: string | null
  customer_id: string | null
  archived_at: string | null
  customers: EmbeddedCustomerMini
  bvs: EmbeddedBvMini
}

type EmbeddedOrderMini = {
  id: string
  order_date: string
  order_type: OrderType
  description: string | null
  status: OrderStatus
} | null

export type MaintenanceReportCentralRow = {
  report: MaintenanceReport
  embeddedObject: EmbeddedObjectMini
  embeddedOrder: EmbeddedOrderMini
  customerName: string
  bvName: string
  customerIdForRoutes: string
  orderLabel: string
}

export type MaintenanceReportsCentralListResult = {
  rows: MaintenanceReportCentralRow[]
  /** Gesetzt bei Supabase-Fehlern (Teilladungen möglich – siehe rows). */
  errorMessage: string | null
}

const OBJECT_CENTRAL_COLUMNS =
  'id, name, internal_id, bv_id, customer_id, archived_at'

const CUSTOMER_CENTRAL_COLUMNS =
  'id, name, maintenance_report_email, maintenance_report_email_address'

const BV_CENTRAL_COLUMNS =
  'id, name, customer_id, maintenance_report_email, maintenance_report_email_address'

const ORDER_CENTRAL_COLUMNS = 'id, order_date, order_type, description, status'

const chunkIds = (ids: string[], chunkSize: number): string[][] => {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(ids.slice(i, i + chunkSize))
  }
  return out
}

const toCustomerMini = (row: Record<string, unknown>): EmbeddedCustomerMini => {
  const id = row.id != null ? String(row.id) : ''
  if (!id) return null
  return {
    id,
    name: row.name != null ? String(row.name) : '',
    maintenance_report_email: row.maintenance_report_email !== false,
    maintenance_report_email_address:
      row.maintenance_report_email_address != null ? String(row.maintenance_report_email_address) : null,
  }
}

const toBvMini = (
  row: Record<string, unknown>,
  custMap: Map<string, EmbeddedCustomerMini>
): EmbeddedBvMini => {
  const id = row.id != null ? String(row.id) : ''
  if (!id) return null
  const customer_id = row.customer_id != null ? String(row.customer_id) : ''
  const cust = customer_id ? custMap.get(customer_id) ?? null : null
  return {
    id,
    name: row.name != null ? String(row.name) : '',
    customer_id,
    maintenance_report_email: row.maintenance_report_email !== false,
    maintenance_report_email_address:
      row.maintenance_report_email_address != null ? String(row.maintenance_report_email_address) : null,
    customers: cust,
  }
}

const buildEmbeddedObjectMini = (
  objectId: string,
  objRow: Record<string, unknown> | undefined,
  bvMap: Map<string, EmbeddedBvMini>,
  customerMiniMap: Map<string, EmbeddedCustomerMini>
): EmbeddedObjectMini => {
  if (!objRow) {
    return {
      id: objectId,
      name: null,
      internal_id: null,
      bv_id: null,
      customer_id: null,
      archived_at: null,
      customers: null,
      bvs: null,
    }
  }

  const bvId = objRow.bv_id != null ? String(objRow.bv_id) : null
  const custId = objRow.customer_id != null ? String(objRow.customer_id) : null
  const directCust = custId ? customerMiniMap.get(custId) ?? null : null
  const bv = bvId ? bvMap.get(bvId) ?? null : null

  return {
    id: String(objRow.id),
    name: objRow.name != null ? String(objRow.name) : null,
    internal_id: objRow.internal_id != null ? String(objRow.internal_id) : null,
    bv_id: bvId,
    customer_id: custId,
    archived_at: objRow.archived_at != null ? String(objRow.archived_at) : null,
    customers: directCust,
    bvs: bv,
  }
}

const orderLabelFrom = (ord: EmbeddedOrderMini): string => {
  if (!ord?.id) return '–'
  const desc = ord.description?.trim() ?? ''
  const short = desc.length > 48 ? `${desc.slice(0, 48)}…` : desc
  return `${ord.order_date} · ${ORDER_TYPE_LABELS[ord.order_type] ?? ord.order_type}${short ? ` · ${short}` : ''}`
}

const assembleRow = (
  report: MaintenanceReport,
  embeddedObject: EmbeddedObjectMini,
  embeddedOrder: EmbeddedOrderMini
): MaintenanceReportCentralRow => {
  const custDirect = embeddedObject.customers
  const bv = embeddedObject.bvs
  const custFromBv = bv?.customers
  const customerName =
    (custDirect?.name && custDirect.name.trim()) || (custFromBv?.name && custFromBv.name.trim()) || '–'
  const bvName = (bv?.name && bv.name.trim()) || '–'

  const customerIdForRoutes =
    (typeof embeddedObject.customer_id === 'string' && embeddedObject.customer_id) ||
    (typeof bv?.customer_id === 'string' && bv.customer_id) ||
    custDirect?.id ||
    custFromBv?.id ||
    ''

  return {
    report,
    embeddedObject,
    embeddedOrder,
    customerName,
    bvName,
    customerIdForRoutes,
    orderLabel: orderLabelFrom(embeddedOrder),
  }
}

/** Empfänger wie Tür-Wartungsseite: zuerst BV, dann Kunde (Stammdaten-Zeile). */
export const resolveMaintenanceReportRecipientEmail = (row: MaintenanceReportCentralRow): string | null => {
  const obj = row.embeddedObject
  const bvRow = obj.bvs
  const owningCustomer = obj.customers ?? obj.bvs?.customers ?? null
  const bvEmail =
    bvRow && bvRow.maintenance_report_email !== false
      ? (bvRow.maintenance_report_email_address ?? '').trim()
      : ''
  const custEmail =
    owningCustomer && owningCustomer.maintenance_report_email !== false
      ? (owningCustomer.maintenance_report_email_address ?? '').trim()
      : ''
  const chosen = (bvEmail || custEmail).trim()
  return chosen || null
}

/**
 * Lädt `maintenance_reports` und Stammdaten in getrennten Queries (ohne PostgREST-Embeds).
 * Robust gegen abweichende Relation-/FK-Namen in PostgREST.
 */
export const fetchMaintenanceReportsCentralList = async (): Promise<MaintenanceReportsCentralListResult> => {
  if (!isOnline()) {
    return { rows: [], errorMessage: null }
  }

  const warnings: string[] = []

  const { data: reportsRaw, error: reportsErr } = await supabase
    .from('maintenance_reports')
    .select(MAINTENANCE_REPORT_COLUMNS)
    .order('maintenance_date', { ascending: false })
    .limit(800)

  if (reportsErr) {
    return { rows: [], errorMessage: reportsErr.message || 'Wartungsprotokolle konnten nicht geladen werden.' }
  }

  const reports = (reportsRaw ?? []) as unknown as MaintenanceReport[]
  if (reports.length === 0) {
    return { rows: [], errorMessage: null }
  }

  const objectIds = [...new Set(reports.map((r) => r.object_id).filter(Boolean))] as string[]

  const objectsMap = new Map<string, Record<string, unknown>>()
  for (const batch of chunkIds(objectIds, 100)) {
    const { data: objs, error: objErr } = await supabase
      .from('objects')
      .select(OBJECT_CENTRAL_COLUMNS)
      .in('id', batch)
    if (objErr) {
      warnings.push(`Objekte: ${objErr.message}`)
      continue
    }
    for (const row of objs ?? []) {
      const rec = row as Record<string, unknown>
      const id = rec.id != null ? String(rec.id) : ''
      if (id) objectsMap.set(id, rec)
    }
  }

  const bvIds = new Set<string>()
  for (const [, row] of objectsMap) {
    const bid = row.bv_id != null ? String(row.bv_id) : ''
    if (bid) bvIds.add(bid)
  }

  const bvRecordsMap = new Map<string, Record<string, unknown>>()
  const bvIdList = [...bvIds]
  for (const batch of chunkIds(bvIdList, 100)) {
    const { data: bvRows, error: bvErr } = await supabase.from('bvs').select(BV_CENTRAL_COLUMNS).in('id', batch)
    if (bvErr) {
      warnings.push(`Bauvorhaben (bvs): ${bvErr.message}`)
      continue
    }
    for (const row of bvRows ?? []) {
      const rec = row as Record<string, unknown>
      const id = rec.id != null ? String(rec.id) : ''
      if (id) bvRecordsMap.set(id, rec)
    }
  }

  const customerIds = new Set<string>()
  for (const [, row] of objectsMap) {
    const cid = row.customer_id != null ? String(row.customer_id) : ''
    if (cid) customerIds.add(cid)
  }
  for (const [, b] of bvRecordsMap) {
    const cid = b.customer_id != null ? String(b.customer_id) : ''
    if (cid) customerIds.add(cid)
  }

  const customerMiniMap = new Map<string, EmbeddedCustomerMini>()
  const custList = [...customerIds]
  for (const batch of chunkIds(custList, 100)) {
    const { data: custRows, error: cErr } = await supabase
      .from('customers')
      .select(CUSTOMER_CENTRAL_COLUMNS)
      .in('id', batch)
    if (cErr) {
      warnings.push(`Kunden: ${cErr.message}`)
      continue
    }
    for (const row of custRows ?? []) {
      const rec = row as Record<string, unknown>
      const mini = toCustomerMini(rec)
      if (mini) customerMiniMap.set(mini.id, mini)
    }
  }

  const bvMap = new Map<string, EmbeddedBvMini>()
  for (const [bid, rec] of bvRecordsMap) {
    bvMap.set(bid, toBvMini(rec, customerMiniMap))
  }

  const orderIds = [...new Set(reports.map((r) => r.source_order_id).filter(Boolean))] as string[]
  const orderMap = new Map<string, EmbeddedOrderMini>()
  for (const batch of chunkIds(orderIds, 100)) {
    const { data: ordRows, error: oErr } = await supabase
      .from('orders')
      .select(ORDER_CENTRAL_COLUMNS)
      .in('id', batch)
    if (oErr) {
      warnings.push(`Aufträge: ${oErr.message}`)
      continue
    }
    for (const row of ordRows ?? []) {
      const rec = row as Record<string, unknown>
      const id = rec.id != null ? String(rec.id) : ''
      if (!id) continue
      orderMap.set(id, {
        id,
        order_date: rec.order_date != null ? String(rec.order_date) : '',
        order_type: rec.order_type as OrderType,
        description: rec.description != null ? String(rec.description) : null,
        status: rec.status as OrderStatus,
      })
    }
  }

  const rows: MaintenanceReportCentralRow[] = []
  for (const report of reports) {
    const oid = report.object_id
    const objRow = objectsMap.get(oid)
    const embeddedObject = buildEmbeddedObjectMini(oid, objRow, bvMap, customerMiniMap)
    const oidOrder = report.source_order_id
    const embeddedOrder = oidOrder ? orderMap.get(oidOrder) ?? null : null
    rows.push(assembleRow(report, embeddedObject, embeddedOrder))
  }

  const errorMessage =
    warnings.length > 0 ? [...new Set(warnings)].join(' ') : null

  return { rows, errorMessage }
}
