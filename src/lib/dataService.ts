import { supabase } from '../supabase'
import { compressImageFile } from './imageCompression'
import { checklistHasOpenMangel } from './doorMaintenanceChecklistCatalog'
import { checklistHasOpenMangelFeststell } from './feststellChecklistCatalog'
import { mergeChecklistProtocolForUpsert } from './checklistProtocol'
import {
  findActiveOrderConflictsAmong,
  getOrderObjectIds,
  ORDER_ACTIVE_PER_OBJECT_CONFLICT_CODE,
  ORDER_ACTIVE_PER_OBJECT_CONFLICT_MESSAGE,
  type OrderActivePerObjectError,
} from './orderUtils'

export { isOrderActivePerObjectError, type OrderActivePerObjectError } from './orderUtils'
export { ORDER_ACTIVE_PER_OBJECT_CONFLICT_MESSAGE } from './orderUtils'

export type OrderMutationError = OrderActivePerObjectError | { message: string }

import {
  buildAuthoritativeChecklistSnapshotsByObjectId,
  buildDraftChecklistSnapshotForObjectId,
  countByObjectIdFromProtocolRows,
  protocolMangelBadgeMapsFromRowsAndObjects,
  protocolOpenMangelRowsForObjectFromSnapshot,
  protocolOpenMangelRowsFromSnapshots,
  type AuthoritativeProtocolRowInput,
  type ProtocolOpenMangelRow,
} from './protocolOpenMangels'
import type {
  Customer,
  BV,
  Object as Obj,
  Order,
  OrderCompletion,
  MaintenanceReport,
  MaintenanceReportPhoto,
  ChecklistDefectPhoto,
  ChecklistDefectDraftPhoto,
  ChecklistMangelPhoto,
  ObjectDefectPhotoDisplay,
  MaintenanceReportSmokeDetector,
  MaintenanceReminder,
  MaintenanceContract,
  ObjectPhoto,
  ObjectDocument,
  ObjectDocumentType,
} from '../types'
import {
  CUSTOMER_COLUMNS,
  BV_COLUMNS,
  OBJECT_COLUMNS,
  MAINTENANCE_CONTRACT_COLUMNS,
  ORDER_COLUMNS,
  ORDER_COMPLETION_COLUMNS,
  OBJECT_PHOTO_COLUMNS,
  OBJECT_DOCUMENT_COLUMNS,
  MAINTENANCE_REPORT_COLUMNS,
  MAINTENANCE_REPORT_PHOTO_COLUMNS,
  MAINTENANCE_REPORT_SMOKE_DETECTOR_COLUMNS,
  PORTAL_USER_COLUMNS,
  CHECKLIST_DEFECT_PHOTO_COLUMNS,
  CHECKLIST_DEFECT_PHOTO_DRAFT_COLUMNS,
  OBJECT_DEFECT_PHOTO_COLUMNS,
} from './dataColumns'
import { isOnline } from '../../shared/networkUtils'
import {
  getCachedCustomers,
  setCachedCustomers,
  getCachedBvs,
  setCachedBvs,
  getCachedObjects,
  setCachedObjects,
  getCachedMaintenanceReports,
  setCachedMaintenanceReports,
  getCachedOrders,
  setCachedOrders,
  getCachedOrderCompletions,
  mergeCachedOrderCompletions,
  getCachedObjectPhotos,
  setCachedObjectPhotos,
  getObjectPhotoOutbox,
  addToObjectPhotoOutbox,
  removeObjectPhotoOutboxItem,
  getCachedObjectDocuments,
  setCachedObjectDocuments,
  getObjectDocumentOutbox,
  addToObjectDocumentOutbox,
  removeObjectDocumentOutboxItem,
  getCachedMaintenancePhotos,
  setCachedMaintenancePhotos,
  getMaintenancePhotoOutbox,
  addToMaintenancePhotoOutbox,
  removeMaintenancePhotoOutboxItem,
  getObjectDefectPhotoOutbox,
  addToObjectDefectPhotoOutbox,
  removeObjectDefectPhotoOutboxItem,
  getCachedReminders,
  setCachedReminders,
  getMaintenanceOutbox,
  addToMaintenanceOutbox,
  removeMaintenanceOutboxItem,
  addToOutbox,
  getCachedAuditLog,
  addToEmailOutbox,
} from './offlineStorage'

type Listener = () => void
const listeners: Listener[] = []
export const notifyDataChange = () => listeners.forEach((l) => l())
export const subscribeToDataChange = (fn: Listener) => {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

const isActiveCustomer = (c: Customer) => !c.archived_at
const isActiveBv = (b: BV) => !b.archived_at
const isActiveObject = (o: Obj) => !o.archived_at

export const fetchCustomers = async (): Promise<Customer[]> => {
  if (isOnline()) {
    const { data, error } = await supabase.from('customers').select(CUSTOMER_COLUMNS).order('name')
    if (!error && data) {
      const customers = data as unknown as Customer[]
      setCachedCustomers(customers)
      return customers.filter(isActiveCustomer)
    }
  }
  return (getCachedCustomers() as Customer[]).filter(isActiveCustomer)
}

/** Nur archivierte Kunden (für Archiv-Ansicht). Online: lädt und merged in den Cache. */
export const fetchArchivedCustomers = async (): Promise<Customer[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .not('archived_at', 'is', null)
      .order('name')
    if (!error && data) {
      const rows = data as unknown as Customer[]
      const all = getCachedCustomers() as Customer[]
      const ids = new Set(rows.map((c) => c.id))
      const kept = all.filter((c) => !ids.has(c.id))
      setCachedCustomers([...kept, ...rows])
      return rows
    }
  }
  return (getCachedCustomers() as Customer[]).filter((c) => Boolean(c.archived_at))
}

export const fetchCustomerCount = async (): Promise<number> => {
  if (isOnline()) {
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .is('demo_user_id', null)
      .is('archived_at', null)
    if (!error && count !== null) return count
  }
  return (getCachedCustomers() as Customer[]).filter((c) => !c.demo_user_id && isActiveCustomer(c)).length
}

export const fetchCustomer = async (id: string): Promise<Customer | null> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('id', id)
      .single()
    if (!error && data) {
      const customer = data as unknown as Customer
      const all = getCachedCustomers() as Customer[]
      const merged = all.some((c) => c.id === id)
        ? all.map((c) => (c.id === id ? customer : c))
        : [...all, customer]
      setCachedCustomers(merged)
      return customer
    }
  }
  return (getCachedCustomers() as Customer[]).find((c) => c.id === id) ?? null
}

export const fetchBv = async (id: string): Promise<BV | null> => {
  if (isOnline()) {
    const { data, error } = await supabase.from('bvs').select(BV_COLUMNS).eq('id', id).single()
    if (!error && data) {
      const bv = data as unknown as BV
      const all = getCachedBvs() as BV[]
      const merged = all.some((b) => b.id === id)
        ? all.map((b) => (b.id === id ? bv : b))
        : [...all, bv]
      setCachedBvs(merged)
      return bv
    }
  }
  return (getCachedBvs() as BV[]).find((b) => b.id === id) ?? null
}

export const fetchBvs = async (customerId: string): Promise<BV[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('bvs')
      .select(BV_COLUMNS)
      .eq('customer_id', customerId)
      .order('name')
    if (!error && data) {
      const bvs = data as unknown as BV[]
      const all = getCachedBvs() as BV[]
      const others = all.filter((b) => b.customer_id !== customerId)
      setCachedBvs([...others, ...bvs])
      return bvs.filter(isActiveBv)
    }
  }
  return (getCachedBvs() as BV[]).filter((b) => b.customer_id === customerId && isActiveBv(b))
}

export const fetchObject = async (objectId: string): Promise<Obj | null> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('objects')
      .select(OBJECT_COLUMNS)
      .eq('id', objectId)
      .single()
    if (!error && data) return data as unknown as Obj
  }
  return (getCachedObjects() as Obj[]).find((o) => o.id === objectId) ?? null
}

export const fetchObjects = async (bvId: string): Promise<Obj[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('objects')
      .select(OBJECT_COLUMNS)
      .eq('bv_id', bvId)
      .order('internal_id')
    if (!error && data) {
      const objs = data as unknown as Obj[]
      const all = getCachedObjects() as Obj[]
      const others = all.filter((o) => o.bv_id !== bvId)
      setCachedObjects([...others, ...objs])
      return objs.filter(isActiveObject)
    }
  }
  return (getCachedObjects() as Obj[]).filter((o) => o.bv_id === bvId && isActiveObject(o))
}

export const fetchObjectsDirectUnderCustomer = async (customerId: string): Promise<Obj[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('objects')
      .select(OBJECT_COLUMNS)
      .eq('customer_id', customerId)
      .is('bv_id', null)
      .order('internal_id')
    if (!error && data) {
      const objs = data as unknown as Obj[]
      const all = getCachedObjects() as Obj[]
      const others = all.filter((o) => !(o.customer_id === customerId && o.bv_id == null))
      setCachedObjects([...others, ...objs])
      return objs.filter(isActiveObject)
    }
  }
  return (getCachedObjects() as Obj[]).filter(
    (o) => o.customer_id === customerId && o.bv_id == null && isActiveObject(o)
  )
}

export const fetchMaintenanceContractsByCustomer = async (customerId: string): Promise<MaintenanceContract[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('maintenance_contracts')
    .select(MAINTENANCE_CONTRACT_COLUMNS)
    .eq('customer_id', customerId)
    .is('bv_id', null)
    .order('start_date', { ascending: false })
  if (error) return []
  return (data ?? []) as MaintenanceContract[]
}

export const fetchMaintenanceContractsByBv = async (bvId: string): Promise<MaintenanceContract[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('maintenance_contracts')
    .select(MAINTENANCE_CONTRACT_COLUMNS)
    .eq('bv_id', bvId)
    .order('start_date', { ascending: false })
  if (error) return []
  return (data ?? []) as MaintenanceContract[]
}

export const createMaintenanceContract = async (
  payload: { customer_id?: string | null; bv_id?: string | null; contract_number: string; start_date: string; end_date?: string | null }
): Promise<{ data: MaintenanceContract | null; error: { message: string } | null }> => {
  const full = {
    ...payload,
    customer_id: payload.customer_id ?? null,
    bv_id: payload.bv_id ?? null,
    end_date: payload.end_date?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (isOnline()) {
    const { data, error } = await supabase.from('maintenance_contracts').insert(full).select(MAINTENANCE_CONTRACT_COLUMNS).single()
    return { data: data ? (data as unknown as MaintenanceContract) : null, error: error ? { message: error.message } : null }
  }
  return { data: null, error: { message: 'Offline: Wartungsverträge nur online anlegbar.' } }
}

export const updateMaintenanceContract = async (
  id: string,
  payload: Partial<{ contract_number: string; start_date: string; end_date: string | null }>
): Promise<{ error: { message: string } | null }> => {
  const full = { ...payload, id, updated_at: new Date().toISOString() }
  if (isOnline()) {
    const { error } = await supabase.from('maintenance_contracts').update(full).eq('id', id)
    return { error: error ? { message: error.message } : null }
  }
  return { error: { message: 'Offline: Wartungsverträge nur online bearbeitbar.' } }
}

export const deleteMaintenanceContract = async (id: string): Promise<{ error: { message: string } | null }> => {
  if (isOnline()) {
    const { error } = await supabase.from('maintenance_contracts').delete().eq('id', id)
    return { error: error ? { message: error.message } : null }
  }
  return { error: { message: 'Offline: Wartungsverträge nur online löschbar.' } }
}

export const fetchAllBvs = async (): Promise<BV[]> => {
  if (isOnline()) {
    const { data, error } = await supabase.from('bvs').select(BV_COLUMNS).order('name')
    if (!error && data) {
      const bvs = data as unknown as BV[]
      setCachedBvs(bvs)
      return bvs.filter(isActiveBv)
    }
  }
  return (getCachedBvs() as BV[]).filter(isActiveBv)
}

export const fetchAllObjects = async (): Promise<Obj[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('objects')
      .select(OBJECT_COLUMNS)
      .order('internal_id')
    if (!error && data) {
      const objs = data as unknown as Obj[]
      setCachedObjects(objs)
      return objs.filter(isActiveObject)
    }
  }
  return (getCachedObjects() as Obj[]).filter(isActiveObject)
}

const mapReminderRow = (row: Record<string, unknown>): MaintenanceReminder => ({
  object_id: row.object_id as string,
  customer_id: row.customer_id as string,
  customer_name: (row.customer_name as string) ?? '',
  bv_id: row.bv_id as string,
  bv_name: (row.bv_name as string) ?? '',
  internal_id: (row.internal_id as string) ?? null,
  object_name: (row.object_name as string) ?? null,
  object_room: (row.object_room as string) ?? null,
  object_floor: (row.object_floor as string) ?? null,
  object_manufacturer: (row.object_manufacturer as string) ?? null,
  maintenance_interval_months: (row.maintenance_interval_months as number) ?? 0,
  last_maintenance_date: row.last_maintenance_date ? String(row.last_maintenance_date).slice(0, 10) : null,
  next_maintenance_date: row.next_maintenance_date ? String(row.next_maintenance_date).slice(0, 10) : null,
  status: (row.status as MaintenanceReminder['status']) ?? 'ok',
  days_until_due: row.days_until_due != null ? Number(row.days_until_due) : null,
})

export const fetchMaintenanceReminders = async (): Promise<MaintenanceReminder[]> => {
  if (!isOnline()) return (getCachedReminders() as MaintenanceReminder[]) ?? []
  const { data, error } = await supabase.rpc('get_maintenance_reminders')
  if (error || !Array.isArray(data)) return []
  const reminders = data.map((row: Record<string, unknown>) => mapReminderRow(row))
  setCachedReminders(reminders)
  return reminders
}

export type AuditLogEntry = {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  table_name: string
  record_id: string | null
  created_at: string
}

const mapAuditRow = (row: Record<string, unknown>): AuditLogEntry => ({
  id: row.id as string,
  user_id: (row.user_id as string) ?? null,
  user_email: (row.user_email as string) ?? null,
  action: (row.action as string) ?? '',
  table_name: (row.table_name as string) ?? '',
  record_id: (row.record_id as string) ?? null,
  created_at: row.created_at ? new Date(row.created_at as string).toISOString() : '',
})

export const fetchAuditLog = async (limit = 200, offset = 0): Promise<AuditLogEntry[]> => {
  if (!isOnline()) {
    return (getCachedAuditLog() as AuditLogEntry[]) ?? []
  }
  const { data, error } = await supabase.rpc('get_audit_log', { limit_rows: limit, offset_rows: offset })
  if (error || !Array.isArray(data)) return []
  return data.map((row: Record<string, unknown>) => mapAuditRow(row))
}

export type AuditLogDetailEntry = AuditLogEntry & { user_name?: string | null }

export const fetchAuditLogDetail = async (id: string): Promise<AuditLogDetailEntry | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase.rpc('get_audit_log_detail', { entry_id: id })
  if (error || !Array.isArray(data) || data.length === 0) return null
  const row = data[0] as Record<string, unknown>
  return {
    ...mapAuditRow(row),
    user_name: (row.user_name as string) ?? null,
  }
}

/** Eintrag für „Zuletzt bearbeitet“ auf der Startseite (nach DB-Spalte updated_at). */
export type DashboardRecentEdit = {
  key: string
  to: string
  title: string
  subtitle: string
  updatedAt: string
}

const ORDER_TYPE_LABELS_SHORT: Record<string, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

const sortByUpdatedAtDesc = <T extends { updated_at: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

/**
 * Baut „Zuletzt bearbeitet“ aus lokalem Cache (Offline, gleiche Sichtbarkeit wie zuletzt synchronisiert).
 */
export const buildRecentEditsFromCache = (options: {
  includeMaster: boolean
  includeOrders: boolean
  scope?: 'all' | 'mine'
  userId?: string
}): DashboardRecentEdit[] => {
  const scope = options.scope ?? 'all'
  const uid = options.userId
  const perTable = 10
  const maxTotal = 10
  const raw: DashboardRecentEdit[] = []

  const includeMaster = options.includeMaster && scope !== 'mine'

  if (includeMaster) {
    const customers = sortByUpdatedAtDesc((getCachedCustomers() as Customer[]).filter(isActiveCustomer)).slice(
      0,
      perTable
    )
    for (const c of customers) {
      raw.push({
        key: `customer-${c.id}`,
        to: `/kunden?customerId=${c.id}`,
        title: `Kunde: ${c.name?.trim() || 'Ohne Namen'}`,
        subtitle: '',
        updatedAt: c.updated_at,
      })
    }
    const bvs = sortByUpdatedAtDesc((getCachedBvs() as BV[]).filter(isActiveBv)).slice(0, perTable)
    for (const b of bvs) {
      raw.push({
        key: `bv-${b.id}`,
        to: `/kunden?customerId=${b.customer_id}&bvId=${b.id}`,
        title: `Objekt/BV: ${b.name?.trim() || 'Ohne Namen'}`,
        subtitle: '',
        updatedAt: b.updated_at,
      })
    }
    const objs = sortByUpdatedAtDesc((getCachedObjects() as Obj[]).filter(isActiveObject)).slice(0, perTable)
    for (const o of objs) {
      const cid = o.customer_id
      if (!cid) continue
      const params = new URLSearchParams()
      params.set('customerId', cid)
      if (o.bv_id) params.set('bvId', o.bv_id)
      params.set('objectId', o.id)
      raw.push({
        key: `object-${o.id}`,
        to: `/kunden?${params.toString()}`,
        title: `Tür/Tor: ${o.name?.trim() || o.internal_id?.trim() || 'Ohne Namen'}`,
        subtitle: '',
        updatedAt: o.updated_at,
      })
    }
  }

  if (options.includeOrders) {
    let orders = sortByUpdatedAtDesc(getCachedOrders() as Order[])
    if (scope === 'mine' && uid) {
      orders = orders.filter((o) => o.assigned_to === uid || o.created_by === uid)
    }
    for (const o of orders.slice(0, perTable)) {
      const typeLabel = ORDER_TYPE_LABELS_SHORT[o.order_type] ?? o.order_type
      raw.push({
        key: `order-${o.id}`,
        to: `/auftrag/${o.id}`,
        title: `Auftrag: ${typeLabel} · ${o.order_date}`,
        subtitle: o.status ? `Status: ${o.status}` : '',
        updatedAt: o.updated_at,
      })
    }
  }

  raw.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return raw.slice(0, maxTotal)
}

/**
 * Liefert die zuletzt geänderten Stammdaten/Aufträge, die der Nutzer per RLS sehen darf.
 * @param options.includeMaster – Kunden, BVs, Objekte (Menü „Kunden“)
 * @param options.includeOrders – Aufträge (Menü „Auftrag“)
 * @param options.scope – „mine“: nur Aufträge mit assigned_to/created_by = userId (Stammdaten entfallen)
 */
export const fetchRecentEditsForDashboard = async (options: {
  includeMaster: boolean
  includeOrders: boolean
  scope?: 'all' | 'mine'
  userId?: string
}): Promise<DashboardRecentEdit[]> => {
  if (!isOnline()) return buildRecentEditsFromCache(options)
  const scope = options.scope ?? 'all'
  const uid = options.userId
  const perTable = 10
  const maxTotal = 10
  /** Supabase-Query-Builder sind thenable, aber kein `Promise` im TS-Sinne. */
  const promises: PromiseLike<unknown>[] = []
  let fetchCustomers = false
  let fetchBvs = false
  let fetchObjects = false
  let fetchOrders = false

  const includeMaster = options.includeMaster && scope !== 'mine'

  if (includeMaster) {
    fetchCustomers = true
    fetchBvs = true
    fetchObjects = true
    promises.push(
      supabase
        .from('customers')
        .select('id,name,updated_at')
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(perTable)
    )
    promises.push(
      supabase
        .from('bvs')
        .select('id,name,customer_id,updated_at')
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(perTable)
    )
    promises.push(
      supabase
        .from('objects')
        .select('id,name,internal_id,room,floor,manufacturer,bv_id,customer_id,updated_at')
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(perTable)
    )
  }
  if (options.includeOrders) {
    fetchOrders = true
    let orderQ = supabase
      .from('orders')
      .select('id,customer_id,bv_id,order_date,order_type,status,updated_at,assigned_to,created_by')
      .order('updated_at', { ascending: false })
      .limit(perTable)
    if (scope === 'mine' && uid) {
      orderQ = orderQ.or(`assigned_to.eq.${uid},created_by.eq.${uid}`)
    }
    promises.push(orderQ)
  }
  if (promises.length === 0) return []

  const results = await Promise.all(promises)
  const raw: DashboardRecentEdit[] = []
  let idx = 0

  if (fetchCustomers) {
    const { data, error } = results[idx++] as {
      data: { id: string; name: string; updated_at: string }[] | null
      error: { message: string } | null
    }
    if (!error && data) {
      for (const c of data) {
        raw.push({
          key: `customer-${c.id}`,
          to: `/kunden?customerId=${c.id}`,
          title: `Kunde: ${c.name?.trim() || 'Ohne Namen'}`,
          subtitle: '',
          updatedAt: c.updated_at,
        })
      }
    }
  }
  if (fetchBvs) {
    const { data, error } = results[idx++] as {
      data: { id: string; name: string; customer_id: string; updated_at: string }[] | null
      error: { message: string } | null
    }
    if (!error && data) {
      for (const b of data) {
        raw.push({
          key: `bv-${b.id}`,
          to: `/kunden?customerId=${b.customer_id}&bvId=${b.id}`,
          title: `Objekt/BV: ${b.name?.trim() || 'Ohne Namen'}`,
          subtitle: '',
          updatedAt: b.updated_at,
        })
      }
    }
  }
  if (fetchObjects) {
    const { data, error } = results[idx++] as {
      data: {
        id: string
        name: string | null
        internal_id: string | null
        room: string | null
        floor: string | null
        manufacturer: string | null
        bv_id: string | null
        customer_id: string | null
        updated_at: string
      }[] | null
      error: { message: string } | null
    }
    if (!error && data) {
      for (const o of data) {
        const cid = o.customer_id
        if (!cid) continue
        const params = new URLSearchParams()
        params.set('customerId', cid)
        if (o.bv_id) params.set('bvId', o.bv_id)
        params.set('objectId', o.id)
        raw.push({
          key: `object-${o.id}`,
          to: `/kunden?${params.toString()}`,
          title: `Tür/Tor: ${o.name?.trim() || o.internal_id?.trim() || 'Ohne Namen'}`,
          subtitle: '',
          updatedAt: o.updated_at,
        })
      }
    }
  }
  if (fetchOrders) {
    const { data, error } = results[idx] as {
      data: {
        id: string
        customer_id: string
        bv_id: string
        order_date: string
        order_type: string
        status: string
        updated_at: string
      }[] | null
      error: { message: string } | null
    }
    if (!error && data) {
      for (const o of data) {
        const typeLabel = ORDER_TYPE_LABELS_SHORT[o.order_type] ?? o.order_type
        raw.push({
          key: `order-${o.id}`,
          to: `/auftrag/${o.id}`,
          title: `Auftrag: ${typeLabel} · ${o.order_date}`,
          subtitle: o.status ? `Status: ${o.status}` : '',
          updatedAt: o.updated_at,
        })
      }
    }
  }

  raw.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return raw.slice(0, maxTotal)
}

type CustomerPayload = Omit<Customer, 'id' | 'created_at' | 'updated_at'> & {
  updated_at?: string
}
type BVPayload = Omit<BV, 'id' | 'created_at' | 'updated_at'> & { updated_at?: string }
type ObjectPayload = Omit<Obj, 'id' | 'created_at' | 'updated_at'> & { updated_at?: string }

export const createCustomer = async (
  payload: CustomerPayload
): Promise<{ data: Customer | null; error: { message: string } | null }> => {
  const full = { ...payload, updated_at: new Date().toISOString() }
  if (isOnline()) {
    const { data, error } = await supabase.from('customers').insert(full).select(CUSTOMER_COLUMNS).single()
    if (!error && data) {
      const customer = data as unknown as Customer
      setCachedCustomers([...(getCachedCustomers() as Customer[]), customer])
      return { data: customer, error: null }
    }
    return { data: null, error: error ? { message: error.message } : null }
  }
  const id = crypto.randomUUID()
  addToOutbox({ table: 'customers', action: 'insert', payload: { ...full, id }, tempId: id })
  const local: Customer = { ...full, id, created_at: new Date().toISOString(), updated_at: full.updated_at! }
  setCachedCustomers([...(getCachedCustomers() as Customer[]), local])
  notifyDataChange()
  return { data: local, error: null }
}

export const updateCustomer = async (
  id: string,
  payload: Partial<CustomerPayload>
): Promise<{ error: { message: string } | null }> => {
  const full = { ...payload, id, updated_at: new Date().toISOString() }
  if (isOnline()) {
    const { error } = await supabase.from('customers').update(full).eq('id', id)
    if (!error) {
      const arr = (getCachedCustomers() as Customer[]).map((c) => (c.id === id ? { ...c, ...full } : c))
      setCachedCustomers(arr)
    }
    return { error: error ? { message: error.message } : null }
  }
  addToOutbox({ table: 'customers', action: 'update', payload: full })
  const arr = (getCachedCustomers() as Customer[]).map((c) => (c.id === id ? { ...c, ...full } : c))
  setCachedCustomers(arr)
  notifyDataChange()
  return { error: null }
}

export const deleteCustomer = async (id: string): Promise<{ error: { message: string } | null }> => {
  if (isOnline()) {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (!error) setCachedCustomers((getCachedCustomers() as Customer[]).filter((c) => c.id !== id))
    return { error: error ? { message: error.message } : null }
  }
  addToOutbox({ table: 'customers', action: 'delete', payload: { id } })
  setCachedCustomers((getCachedCustomers() as Customer[]).filter((c) => c.id !== id))
  notifyDataChange()
  return { error: null }
}

export const createBv = async (
  payload: BVPayload
): Promise<{ data: BV | null; error: { message: string } | null }> => {
  const full = { ...payload, updated_at: new Date().toISOString() }
  if (isOnline()) {
    const { data, error } = await supabase.from('bvs').insert(full).select(BV_COLUMNS).single()
    if (!error && data) {
      const bv = data as unknown as BV
      const all = getCachedBvs() as BV[]
      setCachedBvs([...all, bv])
    }
    return { data: data ? (data as unknown as BV) : null, error: error ? { message: error.message } : null }
  }
  const id = crypto.randomUUID()
  addToOutbox({ table: 'bvs', action: 'insert', payload: { ...full, id }, tempId: id })
  const local: BV = { ...full, id, created_at: new Date().toISOString(), updated_at: full.updated_at! }
  const all = getCachedBvs() as BV[]
  setCachedBvs([...all, local])
  notifyDataChange()
  return { data: local, error: null }
}

export const updateBv = async (
  id: string,
  payload: Partial<BVPayload>
): Promise<{ error: { message: string } | null }> => {
  const full = { ...payload, id, updated_at: new Date().toISOString() }
  if (isOnline()) {
    const { error } = await supabase.from('bvs').update(full).eq('id', id)
    if (!error) {
      const arr = (getCachedBvs() as BV[]).map((b) => (b.id === id ? { ...b, ...full } : b))
      setCachedBvs(arr)
    }
    return { error: error ? { message: error.message } : null }
  }
  addToOutbox({ table: 'bvs', action: 'update', payload: full })
  const arr = (getCachedBvs() as BV[]).map((b) => (b.id === id ? { ...b, ...full } : b))
  setCachedBvs(arr)
  notifyDataChange()
  return { error: null }
}

export const deleteBv = async (id: string): Promise<{ error: { message: string } | null }> => {
  if (isOnline()) {
    const { error } = await supabase.from('bvs').delete().eq('id', id)
    if (!error) setCachedBvs((getCachedBvs() as BV[]).filter((b) => b.id !== id))
    return { error: error ? { message: error.message } : null }
  }
  addToOutbox({ table: 'bvs', action: 'delete', payload: { id } })
  setCachedBvs((getCachedBvs() as BV[]).filter((b) => b.id !== id))
  notifyDataChange()
  return { error: null }
}

export const createObject = async (
  payload: ObjectPayload
): Promise<{ data: Obj | null; error: { message: string } | null }> => {
  const full = { ...payload, updated_at: new Date().toISOString() }
  if (isOnline()) {
    const { data, error } = await supabase.from('objects').insert(full).select(OBJECT_COLUMNS).single()
    if (!error && data) {
      const obj = data as unknown as Obj
      const all = getCachedObjects() as Obj[]
      setCachedObjects([...all, obj])
    }
    return { data: data ? (data as unknown as Obj) : null, error: error ? { message: error.message } : null }
  }
  const id = crypto.randomUUID()
  addToOutbox({ table: 'objects', action: 'insert', payload: { ...full, id }, tempId: id })
  const local: Obj = { ...full, id, created_at: new Date().toISOString(), updated_at: full.updated_at! }
  const all = getCachedObjects() as Obj[]
  setCachedObjects([...all, local])
  notifyDataChange()
  return { data: local, error: null }
}

export const updateObject = async (
  id: string,
  payload: Partial<ObjectPayload>
): Promise<{ error: { message: string } | null }> => {
  const full = { ...payload, id, updated_at: new Date().toISOString() }
  if (isOnline()) {
    const { error } = await supabase.from('objects').update(full).eq('id', id)
    if (!error) {
      const arr = (getCachedObjects() as Obj[]).map((o) => (o.id === id ? { ...o, ...full } : o))
      setCachedObjects(arr)
    }
    return { error: error ? { message: error.message } : null }
  }
  addToOutbox({ table: 'objects', action: 'update', payload: full })
  const arr = (getCachedObjects() as Obj[]).map((o) => (o.id === id ? { ...o, ...full } : o))
  setCachedObjects(arr)
  notifyDataChange()
  return { error: null }
}

export const deleteObject = async (id: string): Promise<{ error: { message: string } | null }> => {
  if (isOnline()) {
    const { error } = await supabase.from('objects').delete().eq('id', id)
    if (!error) setCachedObjects((getCachedObjects() as Obj[]).filter((o) => o.id !== id))
    return { error: error ? { message: error.message } : null }
  }
  addToOutbox({ table: 'objects', action: 'delete', payload: { id } })
  setCachedObjects((getCachedObjects() as Obj[]).filter((o) => o.id !== id))
  notifyDataChange()
  return { error: null }
}

/** Tür/Tor aus Stammdaten ausblenden; Wartungsprotokolle & Aufträge bleiben erhalten (kein CASCADE-DELETE). */
export const archiveObject = async (id: string): Promise<{ error: { message: string } | null }> => {
  const t = new Date().toISOString()
  return updateObject(id, { archived_at: t })
}

/** Objekt/BV und alle zugehörigen Türen/Tore archivieren. Nur online (kaskadierte Updates). */
export const archiveBv = async (id: string): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    return { error: { message: 'Archivieren von Objekt/BV ist nur online möglich.' } }
  }
  const t = new Date().toISOString()
  const { error: eObj } = await supabase
    .from('objects')
    .update({ archived_at: t, updated_at: t })
    .eq('bv_id', id)
    .is('archived_at', null)
  if (eObj) return { error: { message: eObj.message } }
  const { error: eBv } = await supabase.from('bvs').update({ archived_at: t, updated_at: t }).eq('id', id)
  if (eBv) return { error: { message: eBv.message } }
  const bvs = (getCachedBvs() as BV[]).map((b) => (b.id === id ? { ...b, archived_at: t, updated_at: t } : b))
  setCachedBvs(bvs)
  setCachedObjects(
    (getCachedObjects() as Obj[]).map((o) => (o.bv_id === id ? { ...o, archived_at: t, updated_at: t } : o))
  )
  notifyDataChange()
  return { error: null }
}

/** Kunden inkl. aller BV und Türen/Tore archivieren. Nur online. */
export const archiveCustomer = async (id: string): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    return { error: { message: 'Archivieren eines Kunden ist nur online möglich.' } }
  }
  const t = new Date().toISOString()
  const { data: bvRows, error: bvFetchErr } = await supabase.from('bvs').select('id').eq('customer_id', id)
  if (bvFetchErr) return { error: { message: bvFetchErr.message } }
  const bvIds = (bvRows ?? []).map((r) => r.id as string)
  if (bvIds.length > 0) {
    const { error: eObjBv } = await supabase
      .from('objects')
      .update({ archived_at: t, updated_at: t })
      .in('bv_id', bvIds)
      .is('archived_at', null)
    if (eObjBv) return { error: { message: eObjBv.message } }
  }
  const { error: eObjDirect } = await supabase
    .from('objects')
    .update({ archived_at: t, updated_at: t })
    .eq('customer_id', id)
    .is('bv_id', null)
    .is('archived_at', null)
  if (eObjDirect) return { error: { message: eObjDirect.message } }
  const { error: eBvs } = await supabase.from('bvs').update({ archived_at: t, updated_at: t }).eq('customer_id', id)
  if (eBvs) return { error: { message: eBvs.message } }
  const { error: eCust } = await supabase.from('customers').update({ archived_at: t, updated_at: t }).eq('id', id)
  if (eCust) return { error: { message: eCust.message } }
  setCachedCustomers(
    (getCachedCustomers() as Customer[]).map((c) => (c.id === id ? { ...c, archived_at: t, updated_at: t } : c))
  )
  setCachedBvs((getCachedBvs() as BV[]).map((b) => (b.customer_id === id ? { ...b, archived_at: t, updated_at: t } : b)))
  setCachedObjects(
    (getCachedObjects() as Obj[]).map((o) => {
      if (o.customer_id === id && o.bv_id == null) return { ...o, archived_at: t, updated_at: t }
      if (o.bv_id && bvIds.includes(o.bv_id)) return { ...o, archived_at: t, updated_at: t }
      return o
    })
  )
  notifyDataChange()
  return { error: null }
}

/** Archivierten Kunden inkl. aller BV und Türen/Tore wiederherstellen. Nur online. */
export const unarchiveCustomer = async (id: string): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    return { error: { message: 'Wiederherstellen ist nur online möglich.' } }
  }
  const t = new Date().toISOString()
  const { data: bvRows, error: bvFetchErr } = await supabase.from('bvs').select('id').eq('customer_id', id)
  if (bvFetchErr) return { error: { message: bvFetchErr.message } }
  const bvIds = (bvRows ?? []).map((r) => r.id as string)
  if (bvIds.length > 0) {
    const { error: eObjBv } = await supabase
      .from('objects')
      .update({ archived_at: null, updated_at: t })
      .in('bv_id', bvIds)
    if (eObjBv) return { error: { message: eObjBv.message } }
  }
  const { error: eObjDirect } = await supabase
    .from('objects')
    .update({ archived_at: null, updated_at: t })
    .eq('customer_id', id)
    .is('bv_id', null)
  if (eObjDirect) return { error: { message: eObjDirect.message } }
  const { error: eBvs } = await supabase.from('bvs').update({ archived_at: null, updated_at: t }).eq('customer_id', id)
  if (eBvs) return { error: { message: eBvs.message } }
  const { error: eCust } = await supabase.from('customers').update({ archived_at: null, updated_at: t }).eq('id', id)
  if (eCust) return { error: { message: eCust.message } }
  setCachedCustomers(
    (getCachedCustomers() as Customer[]).map((c) => (c.id === id ? { ...c, archived_at: null, updated_at: t } : c))
  )
  setCachedBvs((getCachedBvs() as BV[]).map((b) => (b.customer_id === id ? { ...b, archived_at: null, updated_at: t } : b)))
  setCachedObjects(
    (getCachedObjects() as Obj[]).map((o) => {
      if (o.customer_id === id && o.bv_id == null) return { ...o, archived_at: null, updated_at: t }
      if (o.bv_id && bvIds.includes(o.bv_id)) return { ...o, archived_at: null, updated_at: t }
      return o
    })
  )
  notifyDataChange()
  return { error: null }
}

// --- Wartungsprotokolle ---

export const fetchMaintenanceReports = async (
  objectId: string
): Promise<MaintenanceReport[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('maintenance_reports')
      .select(MAINTENANCE_REPORT_COLUMNS)
      .eq('object_id', objectId)
      .order('maintenance_date', { ascending: false })
    if (!error && data) {
      const reports = data as unknown as MaintenanceReport[]
      setCachedMaintenanceReports(objectId, reports)
      return mergeMaintenanceCacheWithOutbox(objectId, reports)
    }
  }
  const cached = getCachedMaintenanceReports(objectId) as MaintenanceReport[]
  return mergeMaintenanceCacheWithOutbox(objectId, cached)
}

const mergeMaintenanceCacheWithOutbox = (
  objectId: string,
  cached: MaintenanceReport[]
): MaintenanceReport[] => {
  const pending = getMaintenanceOutbox().filter(
    (item) => (item.reportPayload.object_id as string) === objectId
  )
  const pendingReports: MaintenanceReport[] = pending.map((item) => ({
    id: item.tempId,
    object_id: objectId,
    maintenance_date: item.reportPayload.maintenance_date as string,
    maintenance_time: item.reportPayload.maintenance_time as string | null,
    technician_id: item.reportPayload.technician_id as string | null,
    reason: item.reportPayload.reason as MaintenanceReport['reason'],
    reason_other: item.reportPayload.reason_other as string | null,
    manufacturer_maintenance_done: item.reportPayload.manufacturer_maintenance_done as boolean,
    hold_open_checked: item.reportPayload.hold_open_checked as boolean | null,
    deficiencies_found: item.reportPayload.deficiencies_found as boolean,
    deficiency_description: item.reportPayload.deficiency_description as string | null,
    urgency: item.reportPayload.urgency as MaintenanceReport['urgency'],
    fixed_immediately: item.reportPayload.fixed_immediately as boolean,
    customer_signature_path: null,
    technician_signature_path: null,
    technician_name_printed: item.reportPayload.technician_name_printed as string | null,
    customer_name_printed: item.reportPayload.customer_name_printed as string | null,
    pdf_path: null,
    synced: false,
    created_at: item.timestamp,
    updated_at: item.timestamp,
  }))
  const all = [...pendingReports, ...cached]
  all.sort((a, b) => (b.maintenance_date || '').localeCompare(a.maintenance_date || ''))
  return all
}

export const fetchMaintenanceReportSmokeDetectors = async (
  reportId: string
): Promise<MaintenanceReportSmokeDetector[]> => {
  const pending = getMaintenanceOutbox().find((item) => item.tempId === reportId)
  if (pending) {
    return pending.smokeDetectors.map((sd, idx) => ({
      id: `temp-sd-${idx}`,
      report_id: reportId,
      smoke_detector_label: sd.label,
      status: sd.status as MaintenanceReportSmokeDetector['status'],
      created_at: new Date().toISOString(),
    }))
  }
  if (isOnline()) {
    const { data, error } = await supabase
      .from('maintenance_report_smoke_detectors')
      .select(MAINTENANCE_REPORT_SMOKE_DETECTOR_COLUMNS)
      .eq('report_id', reportId)
    if (error) return []
    return (data ?? []) as unknown as MaintenanceReportSmokeDetector[]
  }
  return []
}

type MaintenanceReportPayload = Omit<
  MaintenanceReport,
  'id' | 'created_at' | 'updated_at'
> & { updated_at?: string }

export type MonteurReportCustomerDeliveryMode =
  | 'none'
  | 'email_auto'
  | 'email_manual'
  | 'portal_notify'

export const fetchMonteurReportSettings = async (): Promise<{
  customer_delivery_mode: MonteurReportCustomerDeliveryMode
} | null> => {
  if (!isOnline()) return { customer_delivery_mode: 'none' }
  const { data, error } = await supabase
    .from('monteur_report_settings')
    .select('customer_delivery_mode')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  const m = (data as { customer_delivery_mode: string }).customer_delivery_mode
  const allowed: MonteurReportCustomerDeliveryMode[] = ['none', 'email_auto', 'email_manual', 'portal_notify']
  return {
    customer_delivery_mode: allowed.includes(m as MonteurReportCustomerDeliveryMode)
      ? (m as MonteurReportCustomerDeliveryMode)
      : 'none',
  }
}

export const updateMonteurReportSettings = async (
  mode: MonteurReportCustomerDeliveryMode
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online speicherbar.' } }
  const { error } = await supabase.from('monteur_report_settings').upsert(
    { id: 1, customer_delivery_mode: mode, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
  return { error: error ? { message: error.message } : null }
}

export type WartungChecklisteModus = 'compact' | 'detail'
export type PruefprotokollAddressMode = 'both' | 'bv_only'

export type MonteurReportSettingsFull = {
  customer_delivery_mode: MonteurReportCustomerDeliveryMode
  wartung_checkliste_modus: WartungChecklisteModus
  pruefprotokoll_address_mode: PruefprotokollAddressMode
  mangel_neuer_auftrag_default: boolean
  portal_share_monteur_report_pdf: boolean
  portal_share_pruefprotokoll_pdf: boolean
  portal_timeline_show_planned: boolean
  portal_timeline_show_termin: boolean
  portal_timeline_show_in_progress: boolean
}

export const fetchMonteurReportSettingsFull = async (): Promise<MonteurReportSettingsFull | null> => {
  if (!isOnline()) {
    return {
      customer_delivery_mode: 'none',
      wartung_checkliste_modus: 'detail',
      pruefprotokoll_address_mode: 'both',
      mangel_neuer_auftrag_default: true,
      portal_share_monteur_report_pdf: true,
      portal_share_pruefprotokoll_pdf: true,
      portal_timeline_show_planned: false,
      portal_timeline_show_termin: true,
      portal_timeline_show_in_progress: true,
    }
  }
  const { data, error } = await supabase
    .from('monteur_report_settings')
    .select(
      'customer_delivery_mode, wartung_checkliste_modus, pruefprotokoll_address_mode, mangel_neuer_auftrag_default, portal_share_monteur_report_pdf, portal_share_pruefprotokoll_pdf, portal_timeline_show_planned, portal_timeline_show_termin, portal_timeline_show_in_progress'
    )
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  const m = String(row.customer_delivery_mode ?? 'none')
  const allowed: MonteurReportCustomerDeliveryMode[] = ['none', 'email_auto', 'email_manual', 'portal_notify']
  const mod = row.wartung_checkliste_modus === 'compact' ? 'compact' : 'detail'
  const addrMode = row.pruefprotokoll_address_mode === 'bv_only' ? 'bv_only' : 'both'
  return {
    customer_delivery_mode: allowed.includes(m as MonteurReportCustomerDeliveryMode)
      ? (m as MonteurReportCustomerDeliveryMode)
      : 'none',
    wartung_checkliste_modus: mod,
    pruefprotokoll_address_mode: addrMode,
    mangel_neuer_auftrag_default: Boolean(row.mangel_neuer_auftrag_default ?? true),
    portal_share_monteur_report_pdf: Boolean(row.portal_share_monteur_report_pdf ?? true),
    portal_share_pruefprotokoll_pdf: Boolean(row.portal_share_pruefprotokoll_pdf ?? true),
    portal_timeline_show_planned: Boolean(row.portal_timeline_show_planned),
    portal_timeline_show_termin: row.portal_timeline_show_termin !== false,
    portal_timeline_show_in_progress: row.portal_timeline_show_in_progress !== false,
  }
}

export const updateMonteurReportWartungChecklisteSettings = async (patch: {
  wartung_checkliste_modus?: WartungChecklisteModus
  pruefprotokoll_address_mode?: PruefprotokollAddressMode
  mangel_neuer_auftrag_default?: boolean
}): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online speicherbar.' } }
  const { error } = await supabase
    .from('monteur_report_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return { error: error ? { message: error.message } : null }
}

export const updateMonteurReportPortalPdfShareSettings = async (patch: {
  portal_share_monteur_report_pdf: boolean
  portal_share_pruefprotokoll_pdf: boolean
  portal_timeline_show_planned: boolean
  portal_timeline_show_termin: boolean
  portal_timeline_show_in_progress: boolean
}): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online speicherbar.' } }
  const { error } = await supabase
    .from('monteur_report_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return { error: error ? { message: error.message } : null }
}

/** Wartungsprotokoll-Zeile aus Auftrags-Checkliste (Upsert je order_id + object_id). */
export const upsertWartungsChecklistProtocol = async (params: {
  orderId: string
  objectId: string
  maintenanceDate: string
  technicianId: string | null
  /** Tür-Checklisten-Block ({ modus, items, norms, order_id }) – optional wenn nur Feststell gespeichert wird. */
  checklistProtocol?: unknown
  /** Optionaler Feststellanlagen-Block; auslassen = bestehenden Block beibehalten. */
  feststellChecklistProtocol?: unknown
  deficiencyDescription: string | null
  deficienciesFound: boolean
}): Promise<{ data: MaintenanceReport | null; error: { message: string } | null }> => {
  if (!isOnline()) {
    return { data: null, error: { message: 'Checklisten-Protokoll ist nur online speicherbar.' } }
  }
  const now = new Date().toISOString()

  const { data: existing, error: exErr } = await supabase
    .from('maintenance_reports')
    .select('id, checklist_protocol')
    .eq('source_order_id', params.orderId)
    .eq('object_id', params.objectId)
    .maybeSingle()

  if (exErr) return { data: null, error: { message: exErr.message } }

  const protocolPatch: { door_checklist?: unknown; feststell_checklist?: unknown } = {}
  if (params.checklistProtocol !== undefined) protocolPatch.door_checklist = params.checklistProtocol
  if (params.feststellChecklistProtocol !== undefined)
    protocolPatch.feststell_checklist = params.feststellChecklistProtocol
  const mergedProtocol = mergeChecklistProtocolForUpsert(existing?.checklist_protocol, protocolPatch)

  const basePayload: MaintenanceReportPayload = {
    object_id: params.objectId,
    maintenance_date: params.maintenanceDate.slice(0, 10),
    maintenance_time: null,
    technician_id: params.technicianId,
    reason: 'regelwartung',
    reason_other: null,
    manufacturer_maintenance_done: false,
    hold_open_checked: null,
    deficiencies_found: params.deficienciesFound,
    deficiency_description: params.deficiencyDescription,
    urgency: null,
    fixed_immediately: !params.deficienciesFound,
    customer_signature_path: null,
    technician_signature_path: null,
    technician_name_printed: null,
    customer_name_printed: null,
    pdf_path: null,
    synced: true,
    source_order_id: params.orderId,
    checklist_protocol: mergedProtocol,
    updated_at: now,
  }

  if (existing?.id) {
    const { data: updated, error: upErr } = await supabase
      .from('maintenance_reports')
      .update({
        maintenance_date: basePayload.maintenance_date,
        technician_id: basePayload.technician_id,
        deficiencies_found: basePayload.deficiencies_found,
        deficiency_description: basePayload.deficiency_description,
        fixed_immediately: basePayload.fixed_immediately,
        checklist_protocol: mergedProtocol as Record<string, unknown>,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select(MAINTENANCE_REPORT_COLUMNS)
      .single()
    if (upErr) return { data: null, error: { message: upErr.message } }
    const reportTyped = updated as unknown as MaintenanceReport
    const cached = getCachedMaintenanceReports(params.objectId) as MaintenanceReport[]
    setCachedMaintenanceReports(
      params.objectId,
      [reportTyped, ...cached.filter((r) => r.id !== reportTyped.id)]
    )
    notifyDataChange()
    return { data: reportTyped, error: null }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('maintenance_reports')
    .insert(basePayload)
    .select(MAINTENANCE_REPORT_COLUMNS)
    .single()
  if (insErr) return { data: null, error: { message: insErr.message } }
  const reportTyped = inserted as unknown as MaintenanceReport
  const cached = getCachedMaintenanceReports(params.objectId) as MaintenanceReport[]
  setCachedMaintenanceReports(params.objectId, [reportTyped, ...cached])
  notifyDataChange()
  return { data: reportTyped, error: null }
}

export const fetchMaintenanceReportIdByOrderObject = async (
  orderId: string,
  objectId: string
): Promise<string | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select('id')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (error || !data?.id) return null
  return String(data.id)
}

/** Für Prüfprotokoll-PDF: Report-UUID und laufende Nummer (nach Migration immer gesetzt). */
export const fetchMaintenanceReportPruefprotokollMetaForOrderObject = async (
  orderId: string,
  objectId: string
): Promise<{ id: string; pruefprotokoll_laufnummer: number | null } | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select('id, pruefprotokoll_laufnummer')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (error || !data?.id) return null
  const n = data.pruefprotokoll_laufnummer
  const num = typeof n === 'number' ? n : n != null ? Number(n) : NaN
  if (!Number.isFinite(num) || num <= 0) return { id: String(data.id), pruefprotokoll_laufnummer: null }
  return { id: String(data.id), pruefprotokoll_laufnummer: Math.trunc(num) }
}

/** Gespeicherter Pfad zum Checklisten-Prüfprotokoll-PDF (Storage), falls vorhanden. */
export const fetchPruefprotokollPdfPathForOrderObject = async (
  orderId: string,
  objectId: string
): Promise<string | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select('pruefprotokoll_pdf_path')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (error || !data?.pruefprotokoll_pdf_path) return null
  const p = String(data.pruefprotokoll_pdf_path).trim()
  return p || null
}

export type DefectFollowupOpenRow = {
  id: string
  order_id: string | null
  object_id: string
  maintenance_report_id: string
  status: string
  notes: string | null
  assigned_to: string | null
  object_name: string | null
  object_internal_id: string | null
  object_customer_id: string | null
  object_bv_id: string | null
  /** Anzeigename Kunde (Join), falls verfügbar */
  object_customer_name: string | null
  /** Anzeigename Objekt/BV (Join), falls zugeordnet */
  object_bv_name: string | null
  maintenance_date: string
  deficiency_description: string | null
}

const embedJoinedRow = (v: unknown): Record<string, unknown> | null => {
  if (v == null) return null
  if (Array.isArray(v)) return (v[0] as Record<string, unknown> | undefined) ?? null
  return v as Record<string, unknown>
}

export const fetchDefectFollowupsOpen = async (): Promise<DefectFollowupOpenRow[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('defect_followups')
    .select(
      `id, order_id, object_id, maintenance_report_id, status, notes, assigned_to,
       objects ( name, internal_id, customer_id, bv_id, customers ( name ), bvs ( name ) ),
       maintenance_reports ( maintenance_date, deficiency_description )`
    )
    .neq('status', 'behoben')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => {
    const mr = row.maintenance_reports as Record<string, unknown> | Record<string, unknown>[] | undefined
    const mrOne = Array.isArray(mr) ? mr[0] : mr
    const oOne = embedJoinedRow(row.objects)
    const cust = embedJoinedRow(oOne?.customers)
    const bv = embedJoinedRow(oOne?.bvs)
    return {
      id: String(row.id),
      order_id: row.order_id != null ? String(row.order_id) : null,
      object_id: String(row.object_id),
      maintenance_report_id: String(row.maintenance_report_id),
      status: String(row.status ?? 'offen'),
      notes: row.notes != null ? String(row.notes) : null,
      assigned_to: row.assigned_to != null ? String(row.assigned_to) : null,
      object_name: oOne?.name != null ? String(oOne.name) : null,
      object_internal_id: oOne?.internal_id != null ? String(oOne.internal_id) : null,
      object_customer_id: oOne?.customer_id != null ? String(oOne.customer_id) : null,
      object_bv_id: oOne?.bv_id != null ? String(oOne.bv_id) : null,
      object_customer_name: cust?.name != null ? String(cust.name) : null,
      object_bv_name: bv?.name != null ? String(bv.name) : null,
      maintenance_date: mrOne?.maintenance_date != null ? String(mrOne.maintenance_date) : '',
      deficiency_description:
        mrOne?.deficiency_description != null ? String(mrOne.deficiency_description) : null,
    }
  })
}

export const updateDefectFollowup = async (params: {
  id: string
  status?: string
  notes?: string | null
  assigned_to?: string | null
}): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur bei Verbindung möglich.' } }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (params.status !== undefined) patch.status = params.status
  if (params.notes !== undefined) patch.notes = params.notes
  if (params.assigned_to !== undefined) patch.assigned_to = params.assigned_to
  const { error } = await supabase.from('defect_followups').update(patch).eq('id', params.id)
  if (!error) notifyDataChange()
  return { error: error ? { message: error.message } : null }
}

/** Für Kunden-Badges: Aggregation aus offenen Follow-ups (ohne RPC). */
export const fetchDefectFollowupBadgeMaps = async (): Promise<{
  totalByCustomerId: Record<string, number>
  byBvCompositeKey: Record<string, number>
  byObjectId: Record<string, number>
}> => {
  const rows = await fetchDefectFollowupsOpen()
  const totalByCustomerId: Record<string, number> = {}
  const byBvCompositeKey: Record<string, number> = {}
  const byObjectId: Record<string, number> = {}
  for (const r of rows) {
    const cid = r.object_customer_id
    if (!cid) continue
    totalByCustomerId[cid] = (totalByCustomerId[cid] ?? 0) + 1
    const bvKey = `${cid}::${r.object_bv_id ?? 'direct'}`
    byBvCompositeKey[bvKey] = (byBvCompositeKey[bvKey] ?? 0) + 1
    const oid = r.object_id
    if (oid) byObjectId[oid] = (byObjectId[oid] ?? 0) + 1
  }
  return { totalByCustomerId, byBvCompositeKey, byObjectId }
}

/** §11.17#4: offene Protokoll-Mängel für Listen-Zähler (letzter erledigter Prüfungsauftrag mit Checkliste). Offline: leer (WP-MANG-04). */
export type ProtocolOpenMangelsListCounters = {
  rows: ProtocolOpenMangelRow[]
  countByObjectId: Record<string, number>
  totalByCustomerId: Record<string, number>
  byBvCompositeKey: Record<string, number>
}

const ORDER_COMPLETION_IN_CHUNK = 200

const buildProtocolOpenMangelsListCountersFromMaps = (
  orderMap: Map<string, Order>,
  completionRows: { order_id: string; completion_extra: unknown; created_at: string }[],
  objectsForBadges: Pick<Obj, 'id' | 'customer_id' | 'bv_id'>[]
): ProtocolOpenMangelsListCounters => {
  const inputs: AuthoritativeProtocolRowInput[] = []
  for (const c of completionRows) {
    const ord = orderMap.get(String(c.order_id))
    if (!ord) continue
    inputs.push({
      order: {
        id: ord.id,
        object_id: ord.object_id,
        object_ids: ord.object_ids,
        updated_at: ord.updated_at,
      },
      completion_extra: c.completion_extra,
      completion_created_at: c.created_at != null ? String(c.created_at) : '',
    })
  }
  const snaps = buildAuthoritativeChecklistSnapshotsByObjectId(inputs)
  const rows = protocolOpenMangelRowsFromSnapshots(snaps)
  const countByObjectId = countByObjectIdFromProtocolRows(rows)
  const { totalByCustomerId, byBvCompositeKey } = protocolMangelBadgeMapsFromRowsAndObjects(rows, objectsForBadges)
  return { rows, countByObjectId, totalByCustomerId, byBvCompositeKey }
}

const cachedObjectsForProtocolBadges = (): Pick<Obj, 'id' | 'customer_id' | 'bv_id'>[] =>
  (getCachedObjects() as Obj[]).map((o) => ({
    id: o.id,
    customer_id: o.customer_id,
    bv_id: o.bv_id,
  }))

/** §11.17 / WP-MANG-04: online frisch + Cache-Merge; offline aus `orders` + `order_completions`-Cache (Pull/Sync). */
export const fetchProtocolOpenMangelsForListCounters = async (): Promise<ProtocolOpenMangelsListCounters> => {
  const empty: ProtocolOpenMangelsListCounters = {
    rows: [],
    countByObjectId: {},
    totalByCustomerId: {},
    byBvCompositeKey: {},
  }

  if (!isOnline()) {
    const orderMap = new Map<string, Order>()
    for (const o of getCachedOrders() as Order[]) {
      if (o.status !== 'erledigt' || o.order_type !== 'wartung' || !o.id) continue
      orderMap.set(String(o.id), o)
    }
    if (orderMap.size === 0) return empty
    const wanted = new Set(orderMap.keys())
    const completionRows = getCachedOrderCompletions().filter((c) => wanted.has(String(c.order_id)))
    return buildProtocolOpenMangelsListCountersFromMaps(orderMap, completionRows, cachedObjectsForProtocolBadges())
  }

  const { data: ordersData, error: oErr } = await supabase
    .from('orders')
    .select('id, object_id, object_ids, updated_at')
    .eq('status', 'erledigt')
    .eq('order_type', 'wartung')
  if (oErr || !ordersData?.length) return empty
  const orderMap = new Map<string, Order>()
  for (const raw of ordersData) {
    const o = raw as unknown as Order
    if (o?.id) orderMap.set(String(o.id), o)
  }
  const orderIds = [...orderMap.keys()]
  const allComps: { order_id: string; completion_extra: unknown; created_at: string }[] = []
  for (let i = 0; i < orderIds.length; i += ORDER_COMPLETION_IN_CHUNK) {
    const slice = orderIds.slice(i, i + ORDER_COMPLETION_IN_CHUNK)
    const { data: comps, error: cErr } = await supabase
      .from('order_completions')
      .select('order_id, completion_extra, created_at')
      .in('order_id', slice)
    if (cErr) return empty
    if (!comps) continue
    for (const c of comps) {
      allComps.push({
        order_id: String(c.order_id),
        completion_extra: c.completion_extra,
        created_at: c.created_at != null ? String(c.created_at) : '',
      })
    }
  }
  mergeCachedOrderCompletions(allComps)

  const { data: objBadgeRows, error: objBadgeErr } = await supabase
    .from('objects')
    .select('id, customer_id, bv_id')
    .is('archived_at', null)
  const objectsForBadges: Pick<Obj, 'id' | 'customer_id' | 'bv_id'>[] =
    !objBadgeErr && Array.isArray(objBadgeRows)
      ? (objBadgeRows as Pick<Obj, 'id' | 'customer_id' | 'bv_id'>[])
      : cachedObjectsForProtocolBadges()

  return buildProtocolOpenMangelsListCountersFromMaps(orderMap, allComps, objectsForBadges)
}

const buildProtocolDraftInputsForObjectFromOrders = (
  objectId: string,
  orderMap: Map<string, Order>,
  completionRows: { order_id: string; completion_extra: unknown; created_at: string }[]
): AuthoritativeProtocolRowInput[] => {
  const byOrderId = new Map<string, { order_id: string; completion_extra: unknown; created_at: string }>()
  for (const c of completionRows) {
    byOrderId.set(String(c.order_id), c)
  }
  const inputs: AuthoritativeProtocolRowInput[] = []
  for (const ord of orderMap.values()) {
    if (!ord.id) continue
    if (!getOrderObjectIds(ord).includes(objectId)) continue
    const c = byOrderId.get(String(ord.id))
    if (!c) continue
    inputs.push({
      order: {
        id: ord.id,
        object_id: ord.object_id,
        object_ids: ord.object_ids,
        updated_at: ord.updated_at,
      },
      completion_extra: c.completion_extra,
      completion_created_at: c.created_at != null ? String(c.created_at) : '',
    })
  }
  return inputs
}

/** §11.17#4: Protokoll-Mängel aus **laufendem** Prüfungsauftrag (Entwurf) für eine Tür – online oder aus Cache. */
export const fetchProtocolOpenMangelsDraftForObject = async (objectId: string): Promise<ProtocolOpenMangelRow[]> => {
  if (!objectId) return []
  const activeStatuses = new Set<Order['status']>(['offen', 'in_bearbeitung'])

  if (!isOnline()) {
    const orderMap = new Map<string, Order>()
    for (const o of getCachedOrders() as Order[]) {
      if (o.order_type !== 'wartung' || !o.id) continue
      if (!activeStatuses.has(o.status)) continue
      if (!getOrderObjectIds(o).includes(objectId)) continue
      orderMap.set(String(o.id), o)
    }
    if (orderMap.size === 0) return []
    const wanted = new Set(orderMap.keys())
    const completionRows = getCachedOrderCompletions().filter((c) => wanted.has(String(c.order_id)))
    const inputs = buildProtocolDraftInputsForObjectFromOrders(objectId, orderMap, completionRows)
    const snap = buildDraftChecklistSnapshotForObjectId(objectId, inputs)
    return protocolOpenMangelRowsForObjectFromSnapshot(objectId, snap)
  }

  const { data: ordersData, error: oErr } = await supabase
    .from('orders')
    .select('id, object_id, object_ids, updated_at, status, order_type')
    .in('status', ['offen', 'in_bearbeitung'])
    .eq('order_type', 'wartung')
  if (oErr || !ordersData?.length) return []

  const orderMap = new Map<string, Order>()
  for (const raw of ordersData) {
    const o = raw as unknown as Order
    if (!o?.id) continue
    if (!getOrderObjectIds(o).includes(objectId)) continue
    orderMap.set(String(o.id), o)
  }
  if (orderMap.size === 0) return []

  const orderIds = [...orderMap.keys()]
  const allComps: { order_id: string; completion_extra: unknown; created_at: string }[] = []
  for (let i = 0; i < orderIds.length; i += ORDER_COMPLETION_IN_CHUNK) {
    const slice = orderIds.slice(i, i + ORDER_COMPLETION_IN_CHUNK)
    const { data: comps, error: cErr } = await supabase
      .from('order_completions')
      .select('order_id, completion_extra, created_at')
      .in('order_id', slice)
    if (cErr) return []
    if (!comps) continue
    for (const c of comps) {
      allComps.push({
        order_id: String(c.order_id),
        completion_extra: c.completion_extra,
        created_at: c.created_at != null ? String(c.created_at) : '',
      })
    }
  }
  mergeCachedOrderCompletions(allComps)

  const inputs = buildProtocolDraftInputsForObjectFromOrders(objectId, orderMap, allComps)
  const snap = buildDraftChecklistSnapshotForObjectId(objectId, inputs)
  return protocolOpenMangelRowsForObjectFromSnapshot(objectId, snap)
}

export const insertDefectFollowupsForCompletedWartungOrder = async (params: {
  orderId: string
  byObject: import('../types/orderCompletionExtra').WartungChecklistExtraV1['by_object_id']
}): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: null }
  for (const objectId of Object.keys(params.byObject)) {
    const per = params.byObject[objectId]
    if (!per?.saved_at) continue
    const mode = per.checklist_modus === 'compact' ? 'compact' : 'detail'
    const items = per.items ?? {}
    const doorMangel = checklistHasOpenMangel(mode, items)
    const fc = per.feststell_checkliste
    const festMode = fc?.checklist_modus === 'compact' ? 'compact' : 'detail'
    const festMangel =
      Boolean(fc?.saved_at) && checklistHasOpenMangelFeststell(festMode, fc?.items ?? {})
    if (!doorMangel && !festMangel) continue
    const { data: rep } = await supabase
      .from('maintenance_reports')
      .select('id')
      .eq('source_order_id', params.orderId)
      .eq('object_id', objectId)
      .maybeSingle()
    if (!rep?.id) continue
    const { data: dup } = await supabase
      .from('defect_followups')
      .select('id')
      .eq('order_id', params.orderId)
      .eq('object_id', objectId)
      .neq('status', 'behoben')
      .maybeSingle()
    if (dup) continue
    const { error } = await supabase.from('defect_followups').insert({
      order_id: params.orderId,
      object_id: objectId,
      maintenance_report_id: rep.id,
      status: 'offen',
      updated_at: new Date().toISOString(),
    })
    if (error) return { error: { message: error.message } }
  }
  notifyDataChange()
  return { error: null }
}

export type MonteurReportOrgDigestSettings = {
  maintenance_digest_local_time: string
  maintenance_digest_timezone: string
  app_public_url: string | null
}

export const fetchMonteurReportOrgDigestSettings = async (): Promise<MonteurReportOrgDigestSettings | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('monteur_report_settings')
    .select('maintenance_digest_local_time, maintenance_digest_timezone, app_public_url')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    maintenance_digest_local_time: String(row.maintenance_digest_local_time ?? '07:00'),
    maintenance_digest_timezone: String(row.maintenance_digest_timezone ?? 'Europe/Berlin'),
    app_public_url: row.app_public_url != null ? String(row.app_public_url) : null,
  }
}

export const updateMonteurReportOrgDigestSettings = async (
  patch: Partial<MonteurReportOrgDigestSettings>
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online speicherbar.' } }
  const { error } = await supabase
    .from('monteur_report_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return { error: error ? { message: error.message } : null }
}

export type OpenDeficiencyReportRow = {
  id: string
  object_id: string
  maintenance_date: string
  deficiency_description: string | null
  object_name: string | null
  object_internal_id: string | null
  object_customer_id: string | null
  object_bv_id: string | null
  object_customer_name: string | null
  object_bv_name: string | null
}

export const fetchOpenDeficiencyReports = async (): Promise<OpenDeficiencyReportRow[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select(
      'id, object_id, maintenance_date, deficiency_description, objects ( name, internal_id, customer_id, bv_id, customers ( name ), bvs ( name ) )'
    )
    .eq('deficiencies_found', true)
    .eq('fixed_immediately', false)
    .order('maintenance_date', { ascending: false })
    .limit(400)
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => {
    const o = embedJoinedRow(row.objects)
    const cust = embedJoinedRow(o?.customers)
    const bv = embedJoinedRow(o?.bvs)
    return {
      id: String(row.id),
      object_id: String(row.object_id),
      maintenance_date: String(row.maintenance_date),
      deficiency_description:
        row.deficiency_description != null ? String(row.deficiency_description) : null,
      object_name: o?.name != null ? String(o.name) : null,
      object_internal_id: o?.internal_id != null ? String(o.internal_id) : null,
      object_customer_id: o?.customer_id != null ? String(o.customer_id) : null,
      object_bv_id: o?.bv_id != null ? String(o.bv_id) : null,
      object_customer_name: cust?.name != null ? String(cust.name) : null,
      object_bv_name: bv?.name != null ? String(bv.name) : null,
    }
  })
}

export const fetchOpenDeficiencyReportsForObject = async (objectId: string): Promise<OpenDeficiencyReportRow[]> => {
  if (!isOnline() || !objectId) return []
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select(
      'id, object_id, maintenance_date, deficiency_description, objects ( name, internal_id, customer_id, bv_id, customers ( name ), bvs ( name ) )'
    )
    .eq('object_id', objectId)
    .eq('deficiencies_found', true)
    .eq('fixed_immediately', false)
    .order('maintenance_date', { ascending: false })
    .limit(80)
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => {
    const o = embedJoinedRow(row.objects)
    const cust = embedJoinedRow(o?.customers)
    const bv = embedJoinedRow(o?.bvs)
    return {
      id: String(row.id),
      object_id: String(row.object_id),
      maintenance_date: String(row.maintenance_date),
      deficiency_description:
        row.deficiency_description != null ? String(row.deficiency_description) : null,
      object_name: o?.name != null ? String(o.name) : null,
      object_internal_id: o?.internal_id != null ? String(o.internal_id) : null,
      object_customer_id: o?.customer_id != null ? String(o.customer_id) : null,
      object_bv_id: o?.bv_id != null ? String(o.bv_id) : null,
      object_customer_name: cust?.name != null ? String(cust.name) : null,
      object_bv_name: bv?.name != null ? String(bv.name) : null,
    }
  })
}

/** Nach gespeichertem Wartungsprotokoll: letzte Wartung an der Tür/Feststellung setzen (wenn nicht manuell gesperrt). */
export const applyObjectMaintenanceDatesAfterReport = async (report: {
  object_id: string
  maintenance_date: string
  manufacturer_maintenance_done: boolean
  hold_open_checked: boolean | null
}): Promise<void> => {
  if (!isOnline()) return
  const obj = await fetchObject(report.object_id)
  if (!obj) return
  const d = report.maintenance_date.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return
  const patch: Partial<ObjectPayload> = {}
  if (report.manufacturer_maintenance_done && !obj.door_maintenance_date_manual) {
    const cur = obj.last_door_maintenance_date?.slice(0, 10)
    if (!cur || d >= cur) patch.last_door_maintenance_date = d
  }
  if (
    obj.has_hold_open &&
    report.hold_open_checked === true &&
    !obj.hold_open_last_maintenance_manual
  ) {
    const cur = obj.hold_open_last_maintenance_date?.slice(0, 10)
    if (!cur || d >= cur) patch.hold_open_last_maintenance_date = d
  }
  if (Object.keys(patch).length > 0) {
    await updateObject(report.object_id, patch)
  }
}

export const fetchMonteurPortalDeliveryEligible = async (objectId: string): Promise<boolean> => {
  if (!isOnline() || !objectId) return false
  const { data, error } = await supabase.rpc('monteur_portal_delivery_eligible', {
    p_object_id: objectId,
  })
  if (error) return false
  return Boolean(data)
}

export const notifyPortalOnMaintenanceReport = (reportId: string): void => {
  supabase.functions.invoke('notify-portal-on-report', { body: { report_id: reportId } }).catch(() => {
    /* fire-and-forget */
  })
}

export const createMaintenanceReport = async (
  payload: MaintenanceReportPayload,
  smokeDetectors: { label: string; status: MaintenanceReportSmokeDetector['status'] }[],
  options?: { skipPortalNotify?: boolean }
): Promise<{ data: MaintenanceReport | null; error: { message: string } | null }> => {
  const full = { ...payload, updated_at: new Date().toISOString() }
  if (!isOnline()) {
    const tempId = `temp-${crypto.randomUUID()}`
    addToMaintenanceOutbox({ reportPayload: full, smokeDetectors, tempId })
    const local: MaintenanceReport = {
      ...full,
      id: tempId,
      created_at: full.updated_at ?? new Date().toISOString(),
      updated_at: full.updated_at ?? new Date().toISOString(),
    } as MaintenanceReport
    notifyDataChange()
    return { data: local, error: null }
  }
  const { data: report, error } = await supabase
    .from('maintenance_reports')
    .insert(full)
    .select(MAINTENANCE_REPORT_COLUMNS)
    .single()
  if (error) return { data: null, error: { message: error.message } }
  const reportTyped = report as unknown as MaintenanceReport
  if (report && smokeDetectors.length > 0) {
    const rows = smokeDetectors.map((sd) => ({
      report_id: reportTyped.id,
      smoke_detector_label: sd.label,
      status: sd.status,
    }))
    await supabase.from('maintenance_report_smoke_detectors').insert(rows)
  }
  const cached = getCachedMaintenanceReports(payload.object_id) as MaintenanceReport[]
  setCachedMaintenanceReports(payload.object_id, [reportTyped, ...cached])
  notifyDataChange()

  if (!options?.skipPortalNotify) {
    notifyPortalOnMaintenanceReport(reportTyped.id)
  }

  await applyObjectMaintenanceDatesAfterReport({
    object_id: payload.object_id,
    maintenance_date: payload.maintenance_date,
    manufacturer_maintenance_done: Boolean(payload.manufacturer_maintenance_done),
    hold_open_checked: payload.hold_open_checked ?? null,
  })

  return { data: reportTyped, error: null }
}

export const updateMaintenanceReportSignatures = async (
  reportId: string,
  technicianPath: string | null,
  customerPath: string | null
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase
    .from('maintenance_reports')
    .update({
      technician_signature_path: technicianPath,
      customer_signature_path: customerPath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
  return { error: error ? { message: error.message } : null }
}

export const uploadSignatureToStorage = async (
  reportId: string,
  dataUrl: string,
  type: 'technician' | 'customer'
): Promise<{ path: string | null; error: { message: string } | null }> => {
  const base64 = dataUrl.split(',')[1]
  if (!base64) return { path: null, error: { message: 'Ungültige Signatur' } }
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'image/png' })
  const path = `signatures/${reportId}/${type}.png`
  const { error } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: true })
  return { path: error ? null : path, error: error ? { message: error.message } : null }
}

export const deleteMaintenanceReport = async (
  id: string
): Promise<{ error: { message: string } | null }> => {
  if (id.startsWith('temp-')) {
    const pending = getMaintenanceOutbox().find((item) => item.tempId === id)
    if (pending) {
      removeMaintenanceOutboxItem(pending.id)
      notifyDataChange()
      return { error: null }
    }
    return { error: { message: 'Offline-Protokoll nicht gefunden' } }
  }
  if (!isOnline()) {
    return { error: { message: 'Offline: Löschen nur bei Verbindung möglich' } }
  }
  const { error } = await supabase.from('maintenance_reports').delete().eq('id', id)
  if (!error) notifyDataChange()
  return { error: error ? { message: error.message } : null }
}

export type MaintenanceReportPhotoDisplay = MaintenanceReportPhoto & { localDataUrl?: string }

const fileToBase64Maintenance = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64 ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export const fetchMaintenanceReportPhotos = async (
  reportId: string
): Promise<MaintenanceReportPhotoDisplay[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('maintenance_report_photos')
      .select(MAINTENANCE_REPORT_PHOTO_COLUMNS)
      .eq('report_id', reportId)
    if (error) return []
    return (data ?? []) as unknown as MaintenanceReportPhotoDisplay[]
  }
  const cached = (getCachedMaintenancePhotos() as MaintenanceReportPhoto[]).filter(
    (p) => p.report_id === reportId
  )
  const outbox = getMaintenancePhotoOutbox().filter((o) => o.report_id === reportId)
  const pending: MaintenanceReportPhotoDisplay[] = outbox.map((o) => ({
    id: o.tempId,
    report_id: o.report_id,
    storage_path: null,
    caption: o.caption,
    created_at: o.timestamp,
    localDataUrl: `data:image/${o.ext === 'jpg' ? 'jpeg' : o.ext};base64,${o.fileBase64}`,
  }))
  return [...pending, ...cached]
}

const MAINTENANCE_PHOTOS_BUCKET = 'maintenance-photos'

export const uploadMaintenancePhoto = async (
  reportId: string,
  file: File,
  caption?: string
): Promise<{ data: MaintenanceReportPhotoDisplay | null; error: { message: string } | null }> => {
  const ext = file.name.split('.').pop() || 'jpg'
  if (!isOnline()) {
    const base64 = await fileToBase64Maintenance(file)
    const tempId = `temp-${crypto.randomUUID()}`
    addToMaintenancePhotoOutbox({
      report_id: reportId,
      tempId,
      fileBase64: base64,
      caption: caption?.trim() || null,
      ext,
    })
    notifyDataChange()
    const localDataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`
    return {
      data: {
        id: tempId,
        report_id: reportId,
        storage_path: null,
        caption: caption?.trim() || null,
        created_at: new Date().toISOString(),
        localDataUrl,
      },
      error: null,
    }
  }
  const blob = await compressImageFile(file)
  const uploadExt = blob.type === 'image/jpeg' ? 'jpg' : ext
  const path = `${reportId}/${crypto.randomUUID()}.${uploadExt}`
  const { error: uploadError } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: false, contentType: blob.type })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data: photo, error } = await supabase
    .from('maintenance_report_photos')
    .insert({ report_id: reportId, storage_path: path, caption: caption?.trim() || null })
    .select(MAINTENANCE_REPORT_PHOTO_COLUMNS)
    .single()
  return { data: photo ? (photo as unknown as MaintenanceReportPhotoDisplay) : null, error: error ? { message: error.message } : null }
}

export const fetchChecklistDefectPhotos = async (
  maintenanceReportId: string,
  objectId: string
): Promise<ChecklistDefectPhoto[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('checklist_defect_photos')
    .select(CHECKLIST_DEFECT_PHOTO_COLUMNS)
    .eq('maintenance_report_id', maintenanceReportId)
    .eq('object_id', objectId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as unknown as ChecklistDefectPhoto[]
}

/** Schlüssel `door:itemId` bzw. `feststell:itemId` wie in `checklist_defect_photos`. */
export const fetchChecklistDefectPhotosGroupedForOrderObject = async (
  orderId: string,
  objectId: string
): Promise<Record<string, ChecklistDefectPhoto[]>> => {
  if (!isOnline()) return {}
  const { data: rep } = await supabase
    .from('maintenance_reports')
    .select('id')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (!rep?.id) return {}
  const photos = await fetchChecklistDefectPhotos(rep.id, objectId)
  const out: Record<string, ChecklistDefectPhoto[]> = {}
  for (const p of photos) {
    const k = `${p.checklist_scope}:${p.checklist_item_id}`
    if (!out[k]) out[k] = []
    out[k].push(p)
  }
  return out
}

export const uploadChecklistDefectPhoto = async (params: {
  maintenanceReportId: string
  objectId: string
  checklistScope: 'door' | 'feststell'
  checklistItemId: string
  file: File
  caption?: string
}): Promise<{ data: ChecklistDefectPhoto | null; error: { message: string } | null }> => {
  if (!isOnline()) return { data: null, error: { message: 'Fotos sind nur online speicherbar.' } }
  const isImage = params.file.type.startsWith('image/')
  const payload = isImage ? await compressImageFile(params.file) : params.file
  const safeName = params.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, '-')
  const extFromName = safeName.includes('.') ? safeName.split('.').pop() ?? '' : ''
  const extFromType = (payload.type.split('/')[1] || '').toLowerCase()
  const ext = (extFromName || extFromType || (isImage ? 'jpg' : 'bin')).replace(/[^a-z0-9]/g, '')
  const path = `checklist-defects/${params.maintenanceReportId}/${params.objectId}/${params.checklistScope}/${params.checklistItemId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, payload, { upsert: false, contentType: payload.type || undefined })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data, error } = await supabase
    .from('checklist_defect_photos')
    .insert({
      maintenance_report_id: params.maintenanceReportId,
      object_id: params.objectId,
      checklist_scope: params.checklistScope,
      checklist_item_id: params.checklistItemId,
      storage_path: path,
      caption: params.caption ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(CHECKLIST_DEFECT_PHOTO_COLUMNS)
    .single()
  if (error) return { data: null, error: { message: error.message } }
  return { data: data as unknown as ChecklistDefectPhoto, error: null }
}

export const deleteChecklistDefectPhoto = async (
  photoId: string,
  storagePath: string | null
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online löschbar.' } }
  const { error } = await supabase.from('checklist_defect_photos').delete().eq('id', photoId)
  if (error) return { error: { message: error.message } }
  if (storagePath) {
    await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).remove([storagePath])
  }
  return { error: null }
}

export const mapDefectPhotoToMangel = (p: ChecklistDefectPhoto): ChecklistMangelPhoto => ({
  id: p.id,
  object_id: p.object_id,
  checklist_scope: p.checklist_scope,
  checklist_item_id: p.checklist_item_id,
  storage_path: p.storage_path,
  caption: p.caption,
  created_at: p.created_at,
  updated_at: p.updated_at,
  maintenance_report_id: p.maintenance_report_id,
  isDraft: false,
})

export const mapDraftPhotoToMangel = (d: ChecklistDefectDraftPhoto): ChecklistMangelPhoto => ({
  id: d.id,
  object_id: d.object_id,
  checklist_scope: d.checklist_scope,
  checklist_item_id: d.checklist_item_id,
  storage_path: d.storage_path,
  caption: d.caption,
  created_at: d.created_at,
  updated_at: d.updated_at,
  maintenance_report_id: null,
  isDraft: true,
})

export const fetchChecklistDefectPhotoDrafts = async (
  orderId: string,
  objectId: string
): Promise<ChecklistDefectDraftPhoto[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('checklist_defect_photo_drafts')
    .select(CHECKLIST_DEFECT_PHOTO_DRAFT_COLUMNS)
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as unknown as ChecklistDefectDraftPhoto[]
}

export const fetchChecklistDefectPhotoDraftsGroupedForOrderObject = async (
  orderId: string,
  objectId: string
): Promise<Record<string, ChecklistMangelPhoto[]>> => {
  const rows = await fetchChecklistDefectPhotoDrafts(orderId, objectId)
  const out: Record<string, ChecklistMangelPhoto[]> = {}
  for (const d of rows) {
    const k = `${d.checklist_scope}:${d.checklist_item_id}`
    if (!out[k]) out[k] = []
    out[k].push(mapDraftPhotoToMangel(d))
  }
  return out
}

export const mergeDraftAndFinalMangelPhotos = (
  draftGrouped: Record<string, ChecklistMangelPhoto[]>,
  finalGrouped: Record<string, ChecklistMangelPhoto[]>
): Record<string, ChecklistMangelPhoto[]> => {
  const keys = new Set([...Object.keys(draftGrouped), ...Object.keys(finalGrouped)])
  const out: Record<string, ChecklistMangelPhoto[]> = {}
  for (const k of keys) {
    const finals = finalGrouped[k] ?? []
    const drafts = draftGrouped[k] ?? []
    out[k] = [...finals, ...drafts]
  }
  return out
}

export const fetchChecklistMangelPhotosGroupedForOrderObject = async (
  orderId: string,
  objectId: string,
  maintenanceReportId: string | null
): Promise<Record<string, ChecklistMangelPhoto[]>> => {
  const draftGrouped = await fetchChecklistDefectPhotoDraftsGroupedForOrderObject(orderId, objectId)
  if (!maintenanceReportId) return draftGrouped
  const finals = await fetchChecklistDefectPhotos(maintenanceReportId, objectId)
  const finalGrouped: Record<string, ChecklistMangelPhoto[]> = {}
  for (const p of finals) {
    const k = `${p.checklist_scope}:${p.checklist_item_id}`
    if (!finalGrouped[k]) finalGrouped[k] = []
    finalGrouped[k].push(mapDefectPhotoToMangel(p))
  }
  return mergeDraftAndFinalMangelPhotos(draftGrouped, finalGrouped)
}

export const uploadChecklistDefectPhotoDraft = async (params: {
  orderId: string
  objectId: string
  checklistScope: 'door' | 'feststell'
  checklistItemId: string
  file: File
  caption?: string
}): Promise<{ data: ChecklistMangelPhoto | null; error: { message: string } | null }> => {
  if (!isOnline()) return { data: null, error: { message: 'Fotos sind nur online speicherbar.' } }
  const isImage = params.file.type.startsWith('image/')
  const payload = isImage ? await compressImageFile(params.file) : params.file
  const safeName = params.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, '-')
  const extFromName = safeName.includes('.') ? safeName.split('.').pop() ?? '' : ''
  const extFromType = (payload.type.split('/')[1] || '').toLowerCase()
  const ext = (extFromName || extFromType || (isImage ? 'jpg' : 'bin')).replace(/[^a-z0-9]/g, '')
  const path = `checklist-defect-drafts/${params.orderId}/${params.objectId}/${params.checklistScope}/${params.checklistItemId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, payload, { upsert: false, contentType: payload.type || undefined })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data, error } = await supabase
    .from('checklist_defect_photo_drafts')
    .insert({
      source_order_id: params.orderId,
      object_id: params.objectId,
      checklist_scope: params.checklistScope,
      checklist_item_id: params.checklistItemId,
      storage_path: path,
      caption: params.caption ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(CHECKLIST_DEFECT_PHOTO_DRAFT_COLUMNS)
    .single()
  if (error || !data) return { data: null, error: { message: error?.message ?? 'Speichern fehlgeschlagen.' } }
  return { data: mapDraftPhotoToMangel(data as unknown as ChecklistDefectDraftPhoto), error: null }
}

export const deleteChecklistDefectPhotoDraft = async (
  photoId: string,
  storagePath: string | null
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online löschbar.' } }
  const { error } = await supabase.from('checklist_defect_photo_drafts').delete().eq('id', photoId)
  if (error) return { error: { message: error.message } }
  if (storagePath) {
    await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).remove([storagePath])
  }
  return { error: null }
}

/** Entwurfsfotos in checklist_defect_photos übernehmen (gleicher storage_path), Entwurfszeilen löschen. */
export const promoteChecklistDefectPhotoDrafts = async (
  orderId: string,
  objectId: string,
  maintenanceReportId: string
): Promise<{ error: { message: string } | null; promoted: number }> => {
  if (!isOnline()) return { error: { message: 'Nur online möglich.' }, promoted: 0 }
  const { data: drafts, error: fe } = await supabase
    .from('checklist_defect_photo_drafts')
    .select(CHECKLIST_DEFECT_PHOTO_DRAFT_COLUMNS)
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
  if (fe) return { error: { message: fe.message }, promoted: 0 }
  const list = (drafts ?? []) as unknown as ChecklistDefectDraftPhoto[]
  if (list.length === 0) return { error: null, promoted: 0 }
  let n = 0
  for (const d of list) {
    const { error: ie } = await supabase.from('checklist_defect_photos').insert({
      maintenance_report_id: maintenanceReportId,
      object_id: d.object_id,
      checklist_scope: d.checklist_scope,
      checklist_item_id: d.checklist_item_id,
      storage_path: d.storage_path,
      caption: d.caption,
      updated_at: new Date().toISOString(),
    })
    if (ie) return { error: { message: ie.message }, promoted: n }
    n += 1
  }
  const { error: de } = await supabase
    .from('checklist_defect_photo_drafts')
    .delete()
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
  if (de) return { error: { message: de.message }, promoted: n }
  return { error: null, promoted: n }
}

const MAX_STAMMDATEN_DEFECT_PHOTOS = 3
const OBJECT_DEFECT_STORAGE_PREFIX = 'object-defect-stammdaten'

export const fetchObjectDefectPhotosForDefect = async (
  objectId: string,
  defectEntryId: string
): Promise<ObjectDefectPhotoDisplay[]> => {
  const pending = getObjectDefectPhotoOutbox()
    .filter((o) => o.object_id === objectId && o.defect_entry_id === defectEntryId)
    .map(
      (o): ObjectDefectPhotoDisplay => ({
        id: o.id,
        object_id: objectId,
        defect_entry_id: defectEntryId,
        storage_path: '',
        created_at: o.timestamp,
        localDataUrl: `data:image/${o.ext === 'jpg' ? 'jpeg' : o.ext};base64,${o.fileBase64}`,
      })
    )
  if (!isOnline()) return pending
  const { data, error } = await supabase
    .from('object_defect_photos')
    .select(OBJECT_DEFECT_PHOTO_COLUMNS)
    .eq('object_id', objectId)
    .eq('defect_entry_id', defectEntryId)
    .order('created_at', { ascending: true })
  if (error || !data) return pending
  const server = data as unknown as ObjectDefectPhotoDisplay[]
  return [...server, ...pending]
}

export const uploadObjectDefectPhoto = async (params: {
  objectId: string
  defectEntryId: string
  file: File
}): Promise<{ data: ObjectDefectPhotoDisplay | null; error: { message: string } | null }> => {
  const existing = await fetchObjectDefectPhotosForDefect(params.objectId, params.defectEntryId)
  if (existing.length >= MAX_STAMMDATEN_DEFECT_PHOTOS) {
    return { data: null, error: { message: 'Maximal 3 Fotos pro Mangel.' } }
  }
  if (!isOnline()) {
    const base64 = await fileToBase64Maintenance(params.file)
    const ext = params.file.name.split('.').pop() || 'jpg'
    const item = addToObjectDefectPhotoOutbox({
      object_id: params.objectId,
      defect_entry_id: params.defectEntryId,
      fileBase64: base64,
      ext,
    })
    notifyDataChange()
    return {
      data: {
        id: item.id,
        object_id: params.objectId,
        defect_entry_id: params.defectEntryId,
        storage_path: '',
        created_at: item.timestamp,
        localDataUrl: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`,
      },
      error: null,
    }
  }
  const blob = await compressImageFile(params.file)
  const uploadExt = blob.type === 'image/jpeg' ? 'jpg' : params.file.name.split('.').pop() || 'jpg'
  const path = `${OBJECT_DEFECT_STORAGE_PREFIX}/${params.objectId}/${params.defectEntryId}/${crypto.randomUUID()}.${uploadExt}`
  const { error: uploadError } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: false, contentType: blob.type })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data, error } = await supabase
    .from('object_defect_photos')
    .insert({
      object_id: params.objectId,
      defect_entry_id: params.defectEntryId,
      storage_path: path,
    })
    .select(OBJECT_DEFECT_PHOTO_COLUMNS)
    .single()
  if (error) {
    await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).remove([path])
    return { data: null, error: { message: error.message } }
  }
  return { data: data as unknown as ObjectDefectPhotoDisplay, error: null }
}

export const deleteObjectDefectPhoto = async (
  photoId: string,
  storagePath: string | null | undefined
): Promise<{ error: { message: string } | null }> => {
  const pending = getObjectDefectPhotoOutbox().find((o) => o.id === photoId)
  if (pending) {
    removeObjectDefectPhotoOutboxItem(photoId)
    notifyDataChange()
    return { error: null }
  }
  if (!isOnline()) {
    if (storagePath) {
      addToOutbox({
        table: 'object_defect_photos',
        action: 'delete',
        payload: { id: photoId, storage_path: storagePath },
      })
      notifyDataChange()
      return { error: null }
    }
    return { error: { message: 'Offline: Löschen nicht möglich.' } }
  }
  if (storagePath) {
    await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).remove([storagePath])
  }
  const { error } = await supabase.from('object_defect_photos').delete().eq('id', photoId)
  if (!error) notifyDataChange()
  return { error: error ? { message: error.message } : null }
}

export const deleteAllObjectDefectPhotosForEntry = async (
  objectId: string,
  defectEntryId: string
): Promise<{ error: { message: string } | null }> => {
  const list = await fetchObjectDefectPhotosForDefect(objectId, defectEntryId)
  for (const p of list) {
    const { error } = await deleteObjectDefectPhoto(p.id, p.storage_path || null)
    if (error) return { error }
  }
  return { error: null }
}

export const getObjectDefectPhotoDisplayUrl = (p: ObjectDefectPhotoDisplay): string =>
  p.localDataUrl ?? (p.storage_path ? getMaintenancePhotoUrl(p.storage_path) : '')

export const getMaintenancePhotoUrl = (storagePath: string): string => {
  const { data } = supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .getPublicUrl(storagePath)
  return data.publicUrl
}

export const getMaintenancePhotoDisplayUrl = (p: MaintenanceReportPhotoDisplay): string =>
  p.localDataUrl ?? (p.storage_path ? getMaintenancePhotoUrl(p.storage_path) : '')

export const deleteMaintenancePhoto = async (
  photoId: string,
  storagePath: string | null
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    if (photoId.startsWith('temp-')) {
      const outbox = getMaintenancePhotoOutbox()
      const item = outbox.find((o) => o.tempId === photoId)
      if (item) removeMaintenancePhotoOutboxItem(item.id)
    } else {
      addToOutbox({
        table: 'maintenance_report_photos',
        action: 'delete',
        payload: { id: photoId, storage_path: storagePath },
      })
      const cached = (getCachedMaintenancePhotos() as MaintenanceReportPhoto[]).filter(
        (p) => p.id !== photoId
      )
      setCachedMaintenancePhotos(cached)
    }
    notifyDataChange()
    return { error: null }
  }
  if (storagePath) {
    await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).remove([storagePath])
  }
  const { error } = await supabase
    .from('maintenance_report_photos')
    .delete()
    .eq('id', photoId)
  if (!error) {
    const cached = (getCachedMaintenancePhotos() as MaintenanceReportPhoto[]).filter(
      (p) => p.id !== photoId
    )
    setCachedMaintenancePhotos(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export const uploadMaintenancePdf = async (
  reportId: string,
  blob: Blob
): Promise<{ path: string | null; error: { message: string } | null }> => {
  const path = `pdf/${reportId}.pdf`
  const { error } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: true })
  return { path: error ? null : path, error: error ? { message: error.message } : null }
}

/** Monteursbericht-PDF an bestehendes Auftrags-Wartungsprotokoll hängen (gleiche object_id). */
export const attachMonteurPdfToOrderChecklistProtocol = async (
  orderId: string,
  objectId: string,
  pdfBlob: Blob
): Promise<{ reportId: string | null; error: { message: string } | null }> => {
  if (!isOnline()) return { reportId: null, error: { message: 'Nur online.' } }
  const { data: existing, error: qErr } = await supabase
    .from('maintenance_reports')
    .select('id')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (qErr) return { reportId: null, error: { message: qErr.message } }
  if (!existing?.id) return { reportId: null, error: null }
  const up = await uploadMaintenancePdf(existing.id, pdfBlob)
  if (up.error) return { reportId: null, error: up.error }
  if (up.path) {
    const { error: pErr } = await updateMaintenanceReportPdfPath(existing.id, up.path)
    if (pErr) return { reportId: null, error: { message: pErr.message } }
  }
  notifyPortalOnMaintenanceReport(existing.id)
  return { reportId: existing.id, error: null }
}

/** Prüfprotokoll-PDF an die Auftrags-Wartungszeile (gleiche object_id) hängen. */
export const attachPruefprotokollPdfToOrderChecklistProtocol = async (
  orderId: string,
  objectId: string,
  pdfBlob: Blob
): Promise<{ reportId: string | null; error: { message: string } | null }> => {
  if (!isOnline()) return { reportId: null, error: { message: 'Nur online.' } }
  const { data: existing, error: qErr } = await supabase
    .from('maintenance_reports')
    .select('id')
    .eq('source_order_id', orderId)
    .eq('object_id', objectId)
    .maybeSingle()
  if (qErr) return { reportId: null, error: { message: qErr.message } }
  if (!existing?.id) return { reportId: null, error: { message: 'Kein Protokoll für diese Tür.' } }
  const up = await uploadPruefprotokollPdf(existing.id, pdfBlob)
  if (up.error) return { reportId: null, error: up.error }
  if (up.path) {
    const { error: pErr } = await updateMaintenanceReportPruefprotokollPdfPath(existing.id, up.path)
    if (pErr) return { reportId: null, error: pErr }
  }
  notifyPortalOnMaintenanceReport(existing.id)
  return { reportId: existing.id, error: null }
}

export const uploadOrderCompletionSignature = async (
  completionId: string,
  dataUrl: string,
  type: 'technician' | 'customer'
): Promise<{ path: string | null; error: { message: string } | null }> => {
  const base64 = dataUrl.split(',')[1]
  if (!base64) return { path: null, error: { message: 'Ungültige Signatur' } }
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'image/png' })
  const path = `order-completion-signatures/${completionId}/${type}.png`
  const { error } = await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).upload(path, blob, { upsert: true })
  return { path: error ? null : path, error: error ? { message: error.message } : null }
}

/** Prüfer-Unterschrift für Wartungs-Prüfliste pro Tür (completion_extra / Prüfprotokoll-PDF). */
export const uploadWartungChecklistInspectorSignature = async (
  completionId: string,
  objectId: string,
  dataUrl: string
): Promise<{ path: string | null; error: { message: string } | null }> => {
  const base64 = dataUrl.split(',')[1]
  if (!base64) return { path: null, error: { message: 'Ungültige Signatur' } }
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'image/png' })
  const path = `order-completion-checklist-signatures/${completionId}/${objectId}/inspector.png`
  const { error } = await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).upload(path, blob, { upsert: true })
  return { path: error ? null : path, error: error ? { message: error.message } : null }
}

export const uploadMonteurBerichtPdf = async (
  completionId: string,
  blob: Blob
): Promise<{ path: string | null; error: { message: string } | null }> => {
  const path = `monteur-berichte/${completionId}.pdf`
  const { error } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: true })
  return { path: error ? null : path, error: error ? { message: error.message } : null }
}

export const updateMaintenanceReportPdfPath = async (
  reportId: string,
  pdfPath: string
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase
    .from('maintenance_reports')
    .update({ pdf_path: pdfPath, updated_at: new Date().toISOString() })
    .eq('id', reportId)
  return { error: error ? { message: error.message } : null }
}

export const uploadPruefprotokollPdf = async (
  reportId: string,
  blob: Blob
): Promise<{ path: string | null; error: { message: string } | null }> => {
  const path = `pruefprotokolle/${reportId}.pdf`
  const { error } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: true })
  return { path: error ? null : path, error: error ? { message: error.message } : null }
}

export const updateMaintenanceReportPruefprotokollPdfPath = async (
  reportId: string,
  pdfPath: string
): Promise<{ error: { message: string } | null }> => {
  const { error } = await supabase
    .from('maintenance_reports')
    .update({ pruefprotokoll_pdf_path: pdfPath, updated_at: new Date().toISOString() })
    .eq('id', reportId)
  return { error: error ? { message: error.message } : null }
}

export const sendMaintenanceReportEmail = async (
  pdfStoragePath: string,
  toEmail: string,
  subject: string,
  filename: string
): Promise<{ error: { message: string } | null }> => {
  const { data, error } = await supabase.functions.invoke('send-maintenance-report', {
    body: { pdfStoragePath, toEmail, subject, filename },
  })
  if (error) return { error: { message: error.message } }
  const bodyError = (data as { error?: string })?.error
  if (bodyError) return { error: { message: bodyError } }
  return { error: null }
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

export const sendMaintenanceReportEmailOrQueue = async (
  pdfBlob: Blob,
  reportId: string,
  toEmail: string,
  subject: string,
  filename: string
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    const pdfBase64 = await blobToBase64(pdfBlob)
    addToEmailOutbox({ reportId, pdfBase64, toEmail, subject, filename })
    notifyDataChange()
    return { error: null }
  }
  const { path, error: uploadError } = await uploadMaintenancePdf(reportId, pdfBlob)
  if (uploadError || !path) return { error: uploadError ?? { message: 'PDF-Upload fehlgeschlagen' } }
  return sendMaintenanceReportEmail(path, toEmail, subject, filename)
}

// --- Object Photos ---

export type ObjectPhotoDisplay = ObjectPhoto & { localDataUrl?: string }

const OBJECT_PHOTOS_BUCKET = 'object-photos'
const OBJECT_DOCUMENTS_BUCKET = 'object-documents'

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64 ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export const fetchObjectPhotos = async (objectId: string): Promise<ObjectPhotoDisplay[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('object_photos')
      .select(OBJECT_PHOTO_COLUMNS)
      .eq('object_id', objectId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as unknown as ObjectPhotoDisplay[]
  }
  const cached = (getCachedObjectPhotos() as ObjectPhoto[]).filter((p) => p.object_id === objectId)
  const outbox = getObjectPhotoOutbox().filter((o) => o.object_id === objectId)
  const pending: ObjectPhotoDisplay[] = outbox.map((o) => ({
    id: o.tempId,
    object_id: o.object_id,
    storage_path: '',
    caption: o.caption,
    created_at: o.timestamp,
    localDataUrl: `data:image/${o.ext === 'jpg' ? 'jpeg' : o.ext};base64,${o.fileBase64}`,
  }))
  const merged = [...pending, ...cached]
  merged.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  return merged
}

export const uploadObjectPhoto = async (
  objectId: string,
  file: File,
  caption?: string
): Promise<{ data: ObjectPhotoDisplay | null; error: { message: string } | null }> => {
  const ext = file.name.split('.').pop() || 'jpg'
  if (!isOnline()) {
    const base64 = await fileToBase64(file)
    const tempId = `temp-${crypto.randomUUID()}`
    addToObjectPhotoOutbox({
      object_id: objectId,
      tempId,
      fileBase64: base64,
      caption: caption?.trim() || null,
      ext,
    })
    notifyDataChange()
    const localDataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`
    return {
      data: {
        id: tempId,
        object_id: objectId,
        storage_path: '',
        caption: caption?.trim() || null,
        created_at: new Date().toISOString(),
        localDataUrl,
      },
      error: null,
    }
  }
  const blob = await compressImageFile(file)
  const uploadExt = blob.type === 'image/jpeg' ? 'jpg' : ext
  const path = `${objectId}/${crypto.randomUUID()}.${uploadExt}`
  const { error: uploadError } = await supabase.storage
    .from(OBJECT_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: false, contentType: blob.type })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data: photo, error } = await supabase
    .from('object_photos')
    .insert({ object_id: objectId, storage_path: path, caption: caption?.trim() || null })
    .select(OBJECT_PHOTO_COLUMNS)
    .single()
  return { data: photo ? (photo as unknown as ObjectPhotoDisplay) : null, error: error ? { message: error.message } : null }
}

export const deleteObjectPhoto = async (
  photoId: string,
  storagePath: string
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    if (photoId.startsWith('temp-')) {
      const outbox = getObjectPhotoOutbox()
      const item = outbox.find((o) => o.tempId === photoId)
      if (item) removeObjectPhotoOutboxItem(item.id)
    } else {
      addToOutbox({
        table: 'object_photos',
        action: 'delete',
        payload: { id: photoId, storage_path: storagePath },
      })
      const cached = (getCachedObjectPhotos() as ObjectPhoto[]).filter((p) => p.id !== photoId)
      setCachedObjectPhotos(cached)
    }
    notifyDataChange()
    return { error: null }
  }
  await supabase.storage.from(OBJECT_PHOTOS_BUCKET).remove([storagePath])
  const { error } = await supabase.from('object_photos').delete().eq('id', photoId)
  if (!error) {
    const cached = (getCachedObjectPhotos() as ObjectPhoto[]).filter((p) => p.id !== photoId)
    setCachedObjectPhotos(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export const getObjectPhotoUrl = (storagePath: string): string => {
  const { data } = supabase.storage
    .from(OBJECT_PHOTOS_BUCKET)
    .getPublicUrl(storagePath)
  return data.publicUrl
}

export const getObjectPhotoDisplayUrl = (p: ObjectPhotoDisplay): string =>
  p.localDataUrl ?? getObjectPhotoUrl(p.storage_path)

const copyObjectStorageFileToNewObject = async (
  sourcePath: string,
  targetObjectId: string
): Promise<string | null> => {
  if (!isOnline()) return null
  const { data: blob, error } = await supabase.storage.from(OBJECT_PHOTOS_BUCKET).download(sourcePath)
  if (error || !blob) return null
  const ext = sourcePath.includes('.') ? sourcePath.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg' : 'jpg'
  const safeExt = ext.length > 0 && ext.length < 8 ? ext : 'jpg'
  const newPath = `${targetObjectId}/${crypto.randomUUID()}.${safeExt}`
  const contentType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
  const { error: upErr } = await supabase.storage.from(OBJECT_PHOTOS_BUCKET).upload(newPath, blob, {
    contentType,
    upsert: false,
  })
  if (upErr) return null
  return newPath
}

const copyObjectDocumentStorageFileToNewObject = async (
  sourcePath: string,
  targetObjectId: string
): Promise<string | null> => {
  if (!isOnline()) return null
  const { data: blob, error } = await supabase.storage.from(OBJECT_DOCUMENTS_BUCKET).download(sourcePath)
  if (error || !blob) return null
  const ext = sourcePath.includes('.') ? sourcePath.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'pdf' : 'pdf'
  const safeExt = ext.length > 0 && ext.length < 8 ? ext : 'pdf'
  const newPath = `${targetObjectId}/${crypto.randomUUID()}.${safeExt}`
  const contentType =
    blob.type && blob.type.length > 0 ? blob.type : safeExt === 'pdf' ? 'application/pdf' : 'application/octet-stream'
  const { error: upErr } = await supabase.storage.from(OBJECT_DOCUMENTS_BUCKET).upload(newPath, blob, {
    contentType,
    upsert: false,
  })
  if (upErr) return null
  return newPath
}

/** Bezeichnung der Tür für eine Kopie: „… (Duplikat)“ bzw. „Duplikat“ wenn leer. */
const markDuplicateObjectName = (name: string | null | undefined): string | null => {
  const t = name?.trim() ?? ''
  if (!t) return 'Duplikat'
  if (/\(Duplikat\)\s*$/i.test(t)) return t
  return `${t} (Duplikat)`
}

const objectRowToCreatePayload = (o: Obj): ObjectPayload => ({
  bv_id: o.bv_id,
  customer_id: o.customer_id,
  name: o.name,
  internal_id: o.internal_id,
  door_position: o.door_position,
  internal_door_number: o.internal_door_number,
  floor: o.floor,
  room: o.room,
  type_tuer: o.type_tuer,
  type_sektionaltor: o.type_sektionaltor,
  type_schiebetor: o.type_schiebetor,
  type_freitext: o.type_freitext,
  wing_count: o.wing_count,
  manufacturer: o.manufacturer,
  build_year: o.build_year,
  lock_manufacturer: o.lock_manufacturer,
  lock_type: o.lock_type,
  has_hold_open: o.has_hold_open,
  hold_open_manufacturer: o.hold_open_manufacturer,
  hold_open_type: o.hold_open_type,
  hold_open_approval_no: o.hold_open_approval_no,
  hold_open_approval_date: o.hold_open_approval_date,
  smoke_detector_count: o.smoke_detector_count,
  smoke_detector_build_years: o.smoke_detector_build_years,
  panic_function: o.panic_function,
  accessories_items: o.accessories_items ?? null,
  accessories: o.accessories,
  maintenance_by_manufacturer: o.maintenance_by_manufacturer,
  hold_open_maintenance: o.hold_open_maintenance,
  defects: o.defects,
  defects_structured: o.defects_structured ?? null,
  remarks: o.remarks,
  maintenance_interval_months: o.maintenance_interval_months ?? null,
  last_door_maintenance_date: o.last_door_maintenance_date ?? null,
  door_maintenance_date_manual: o.door_maintenance_date_manual ?? false,
  hold_open_last_maintenance_date: o.hold_open_last_maintenance_date ?? null,
  hold_open_maintenance_interval_months: o.hold_open_maintenance_interval_months ?? null,
  hold_open_last_maintenance_manual: o.hold_open_last_maintenance_manual ?? false,
  profile_photo_path: null,
})

export type DuplicateObjectOptions = {
  copyGalleryPhotos: boolean
  copyProfilePhoto: boolean
  copyDocuments: boolean
}

/**
 * Neue Tür/Tor mit neuer ID; Stammdaten von der Quelle.
 * Bezeichnung (name) erhält „ (Duplikat)“; interne ID mit Suffix „-Duplikat-…“.
 * Profilfoto / Galerie / Dokumente nur bei gesetzter Option (jeweils eigene Storage-Dateien).
 */
export const duplicateObjectFromSource = async (
  sourceId: string,
  options: DuplicateObjectOptions
): Promise<{ data: Obj | null; error: { message: string } | null }> => {
  if (!isOnline()) {
    return { data: null, error: { message: 'Kopieren ist nur online möglich.' } }
  }
  const source = await fetchObject(sourceId)
  if (!source) return { data: null, error: { message: 'Tür/Tor nicht gefunden.' } }

  const baseInternal = source.internal_id?.trim() || 'TUER'
  const newInternal = `${baseInternal}-Duplikat-${crypto.randomUUID().slice(0, 8)}`
  const payload = {
    ...objectRowToCreatePayload(source),
    internal_id: newInternal,
    name: markDuplicateObjectName(source.name),
  }

  const { data: newObj, error: createErr } = await createObject(payload)
  if (createErr || !newObj) {
    return { data: null, error: createErr ?? { message: 'Anlegen fehlgeschlagen.' } }
  }

  let nextProfilePath: string | null = null
  if (options.copyProfilePhoto && source.profile_photo_path?.trim()) {
    const p = await copyObjectStorageFileToNewObject(source.profile_photo_path.trim(), newObj.id)
    if (p) nextProfilePath = p
  }
  if (nextProfilePath) {
    const { error: upErr } = await updateObject(newObj.id, { profile_photo_path: nextProfilePath })
    if (upErr) {
      return { data: newObj, error: null }
    }
  }

  if (options.copyGalleryPhotos) {
    const photos = await fetchObjectPhotos(sourceId)
    for (const ph of photos) {
      if (!ph.storage_path) continue
      const newPath = await copyObjectStorageFileToNewObject(ph.storage_path, newObj.id)
      if (!newPath) continue
      await supabase.from('object_photos').insert({
        object_id: newObj.id,
        storage_path: newPath,
        caption: ph.caption?.trim() || null,
      })
    }
  }

  if (options.copyDocuments) {
    const docs = await fetchObjectDocuments(sourceId)
    for (const doc of docs) {
      if (!doc.storage_path?.trim()) continue
      const newPath = await copyObjectDocumentStorageFileToNewObject(doc.storage_path.trim(), newObj.id)
      if (!newPath) continue
      await supabase.from('object_documents').insert({
        object_id: newObj.id,
        storage_path: newPath,
        document_type: doc.document_type,
        title: doc.title?.trim() || null,
        file_name: doc.file_name ?? null,
      })
    }
  }

  const fresh = await fetchObject(newObj.id)
  return { data: fresh ?? newObj, error: null }
}

export const setObjectProfilePhoto = async (
  objectId: string,
  file: File
): Promise<{ path: string | null; error: { message: string } | null }> => {
  if (!isOnline()) return { path: null, error: { message: 'Profilfoto nur online speicherbar.' } }
  const existing = await fetchObject(objectId)
  const oldPath = existing?.profile_photo_path?.trim() || null

  const blob = await compressImageFile(file)
  const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png'
  const newPath = `${objectId}/profile-${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(OBJECT_PHOTOS_BUCKET)
    .upload(newPath, blob, { upsert: false, contentType: blob.type || 'image/jpeg' })
  if (uploadError) return { path: null, error: { message: uploadError.message } }

  const { error: dbErr } = await updateObject(objectId, { profile_photo_path: newPath })
  if (dbErr) {
    await supabase.storage.from(OBJECT_PHOTOS_BUCKET).remove([newPath])
    return { path: null, error: { message: dbErr.message } }
  }

  if (oldPath && oldPath !== newPath) {
    await supabase.storage.from(OBJECT_PHOTOS_BUCKET).remove([oldPath]).catch(() => {})
  }

  return { path: newPath, error: null }
}

export const removeObjectProfilePhoto = async (
  objectId: string,
  currentPath: string | null | undefined
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Nur online möglich.' } }
  const path = currentPath?.trim()
  if (path) {
    await supabase.storage.from(OBJECT_PHOTOS_BUCKET).remove([path]).catch(() => {})
  }
  return updateObject(objectId, { profile_photo_path: null })
}

// --- Object Documents ---

export type ObjectDocumentDisplay = ObjectDocument & { localDataUrl?: string }

export const fetchObjectDocuments = async (objectId: string): Promise<ObjectDocumentDisplay[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('object_documents')
      .select(OBJECT_DOCUMENT_COLUMNS)
      .eq('object_id', objectId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as unknown as ObjectDocumentDisplay[]
  }
  const cached = (getCachedObjectDocuments() as ObjectDocument[]).filter((d) => d.object_id === objectId)
  const outbox = getObjectDocumentOutbox().filter((o) => o.object_id === objectId)
  const pending: ObjectDocumentDisplay[] = outbox.map((o) => ({
    id: o.tempId,
    object_id: o.object_id,
    storage_path: '',
    document_type: o.document_type,
    title: o.title,
    file_name: o.file_name,
    created_at: o.timestamp,
    localDataUrl: `data:application/octet-stream;base64,${o.fileBase64}`,
  }))
  const merged = [...pending, ...cached]
  merged.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  return merged
}

export const uploadObjectDocument = async (
  objectId: string,
  file: File,
  documentType: ObjectDocumentType,
  title?: string
): Promise<{ data: ObjectDocumentDisplay | null; error: { message: string } | null }> => {
  const ext = file.name.split('.').pop() || 'pdf'
  const fileName = file.name
  if (!isOnline()) {
    const base64 = await fileToBase64(file)
    const tempId = `temp-${crypto.randomUUID()}`
    addToObjectDocumentOutbox({
      object_id: objectId,
      tempId,
      fileBase64: base64,
      document_type: documentType,
      title: title?.trim() || null,
      file_name: fileName,
      ext,
    })
    notifyDataChange()
    return {
      data: {
        id: tempId,
        object_id: objectId,
        storage_path: '',
        document_type: documentType,
        title: title?.trim() || null,
        file_name: fileName,
        created_at: new Date().toISOString(),
        localDataUrl: `data:application/octet-stream;base64,${base64}`,
      },
      error: null,
    }
  }
  const path = `${objectId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(OBJECT_DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: false })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data: doc, error } = await supabase
    .from('object_documents')
    .insert({
      object_id: objectId,
      storage_path: path,
      document_type: documentType,
      title: title?.trim() || null,
      file_name: fileName,
    })
    .select(OBJECT_DOCUMENT_COLUMNS)
    .single()
  return { data: doc ? (doc as unknown as ObjectDocumentDisplay) : null, error: error ? { message: error.message } : null }
}

export const deleteObjectDocument = async (
  documentId: string,
  storagePath: string
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    if (documentId.startsWith('temp-')) {
      const outbox = getObjectDocumentOutbox()
      const item = outbox.find((o) => o.tempId === documentId)
      if (item) removeObjectDocumentOutboxItem(item.id)
    } else {
      addToOutbox({
        table: 'object_documents',
        action: 'delete',
        payload: { id: documentId, storage_path: storagePath },
      })
      const cached = (getCachedObjectDocuments() as ObjectDocument[]).filter((d) => d.id !== documentId)
      setCachedObjectDocuments(cached)
    }
    notifyDataChange()
    return { error: null }
  }
  await supabase.storage.from(OBJECT_DOCUMENTS_BUCKET).remove([storagePath])
  const { error } = await supabase.from('object_documents').delete().eq('id', documentId)
  if (!error) {
    const cached = (getCachedObjectDocuments() as ObjectDocument[]).filter((d) => d.id !== documentId)
    setCachedObjectDocuments(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export const getObjectDocumentUrl = (storagePath: string): string => {
  const { data } = supabase.storage
    .from(OBJECT_DOCUMENTS_BUCKET)
    .getPublicUrl(storagePath)
  return data.publicUrl
}

// --- Kundenportal ---

export type PortalUser = {
  id: string
  customer_id: string
  email: string
  user_id: string | null
  invited_by: string | null
  invited_at: string
  created_at: string
}

export const fetchPortalUsers = async (customerId: string): Promise<PortalUser[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('customer_portal_users')
    .select(PORTAL_USER_COLUMNS)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as unknown as PortalUser[]
}

export const invitePortalUser = async (
  customerId: string,
  email: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('invite-portal-user', {
    body: { customer_id: customerId, email },
  })
  if (error) return { success: false, error: error.message }
  const bodyError = (data as { error?: string })?.error
  if (bodyError) return { success: false, error: bodyError }
  return { success: true }
}

export const deletePortalUser = async (
  id: string
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) return { error: { message: 'Offline: Nicht möglich' } }
  const { error } = await supabase.from('customer_portal_users').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}

export type PortalUserAssignment = {
  id: string
  user_id: string | null
  customer_id: string
  email: string
}

const PORTAL_ASSIGNMENT_COLUMNS = 'id, user_id, customer_id, email'

export const fetchAllPortalUserAssignments = async (): Promise<PortalUserAssignment[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('customer_portal_users')
    .select(PORTAL_ASSIGNMENT_COLUMNS)
  if (error) return []
  return (data ?? []) as PortalUserAssignment[]
}

export const linkPortalUserToCustomer = async (
  userId: string,
  email: string,
  customerId: string
): Promise<{ error: string | null }> => {
  if (!isOnline()) return { error: 'Offline: Nicht möglich' }
  const { error } = await supabase.from('customer_portal_users').insert({
    user_id: userId,
    email,
    customer_id: customerId,
  })
  return { error: error?.message ?? null }
}

// --- Portal-Objekt/BV-Sichtbarkeit (Whitelist) ---

export type PortalVisibilityRow = { user_id: string; customer_id: string; bv_id: string }

export const fetchPortalVisibility = async (userId: string): Promise<PortalVisibilityRow[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('portal_user_object_visibility')
    .select('user_id, customer_id, bv_id')
    .eq('user_id', userId)
  if (error) return []
  return (data ?? []) as PortalVisibilityRow[]
}

export const setPortalVisibilityForCustomer = async (
  userId: string,
  customerId: string,
  bvIds: string[]
): Promise<{ error: string | null }> => {
  if (!isOnline()) return { error: 'Offline: Nicht möglich' }
  const { error: delErr } = await supabase
    .from('portal_user_object_visibility')
    .delete()
    .eq('user_id', userId)
    .eq('customer_id', customerId)
  if (delErr) return { error: delErr.message }
  if (bvIds.length === 0) return { error: null }
  const rows = bvIds.map((bv_id) => ({ user_id: userId, customer_id: customerId, bv_id }))
  const { error: insErr } = await supabase.from('portal_user_object_visibility').insert(rows)
  return { error: insErr?.message ?? null }
}

// --- Aufträge (Orders) ---

export const fetchOrders = async (): Promise<Order[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .order('order_date', { ascending: false })
    if (!error && data) {
      const orders = data as unknown as Order[]
      setCachedOrders(orders)
      return orders
    }
  }
  return (getCachedOrders() as Order[]).sort(
    (a, b) => (b.order_date || '').localeCompare(a.order_date || '')
  )
}

export const fetchOrderById = async (orderId: string): Promise<Order | null> => {
  const fromCache = () => {
    const cached = getCachedOrders() as Order[]
    return cached.find((o) => o.id === orderId) ?? null
  }
  if (!isOnline()) {
    return fromCache()
  }
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .single()
  if (error || !data) return fromCache()
  return data as unknown as Order
}

/** Ab 15 Türen: weiche Warnung vor Zusammenführung (§7.2.4.6). */
export const QR_MERGE_DOOR_WARNING_THRESHOLD = 15

/**
 * Offene Aufträge ohne Monteursbericht (keine order_completion), gleicher Kunde/BV/Typ,
 * ohne die gescannte Tür – für QR-Zusammenführung (§7.2.4.6).
 */
export const fetchOrdersForQrMergeCandidates = async (params: {
  customerId: string
  bvId: string | null
  newObjectId: string
  orderType: Order['order_type']
}): Promise<Order[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('customer_id', params.customerId)
    .eq('order_type', params.orderType)
    .in('status', ['offen', 'in_bearbeitung'])
  if (error || !Array.isArray(data)) return []
  const rows = data as unknown as Order[]
  const pBv = params.bvId ?? null
  const bvParity = rows.filter((o) => (o.bv_id ?? null) === pBv)
  if (bvParity.length === 0) return []
  const ids = bvParity.map((o) => o.id)
  const { data: comps } = await supabase.from('order_completions').select('order_id').in('order_id', ids)
  const withCompletion = new Set(
    (comps as { order_id: string }[] | null)?.map((r) => r.order_id).filter(Boolean) ?? []
  )
  return bvParity.filter((o) => {
    if (withCompletion.has(o.id)) return false
    if (getOrderObjectIds(o).includes(params.newObjectId)) return false
    return true
  })
}

export const fetchOrdersAssignedTo = async (userId: string): Promise<Order[]> => {
  const all = await fetchOrders()
  if (!userId) return all
  return all.filter((o) => o.assigned_to === userId)
}

type OrderPayload = Omit<Order, 'id' | 'created_at' | 'updated_at'> & { updated_at?: string }

const normalizeOrderObjectFields = (
  objectId: string | null | undefined,
  objectIds: string[] | null | undefined
): { object_id: string | null; object_ids: string[] | null } => {
  const unique = [...new Set((objectIds ?? []).filter(Boolean))]
  if (unique.length > 0) {
    return { object_id: unique[0] ?? null, object_ids: unique }
  }
  const single = objectId?.trim() || null
  return { object_id: single, object_ids: single ? [single] : null }
}

const assertNoActiveOrderConflict = (
  excludeOrderId: string | null,
  objectIds: string[],
  effectiveStatus: Order['status']
): OrderActivePerObjectError | null => {
  const orders = getCachedOrders() as Order[]
  const conflicts = findActiveOrderConflictsAmong(orders, excludeOrderId, objectIds, effectiveStatus)
  if (conflicts.length === 0) return null
  return {
    message: ORDER_ACTIVE_PER_OBJECT_CONFLICT_MESSAGE,
    code: ORDER_ACTIVE_PER_OBJECT_CONFLICT_CODE,
    conflicts,
  }
}

export const createOrder = async (
  payload: Omit<OrderPayload, 'created_by'>,
  userId: string | null
): Promise<{ data: Order | null; error: OrderMutationError | null }> => {
  const { object_id, object_ids } = normalizeOrderObjectFields(payload.object_id, payload.object_ids)
  const full = {
    ...payload,
    id: crypto.randomUUID(),
    object_id,
    object_ids,
    assigned_to: 'assigned_to' in payload && payload.assigned_to ? String(payload.assigned_to).trim() || null : null,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const conflictErr = assertNoActiveOrderConflict(
    null,
    object_ids ?? [],
    full.status as Order['status']
  )
  if (conflictErr) return { data: null, error: conflictErr }
  if (!isOnline()) {
    addToOutbox({ table: 'orders', action: 'insert', payload: full })
    const cached = getCachedOrders() as Order[]
    setCachedOrders([full as Order, ...cached])
    notifyDataChange()
    return { data: full as Order, error: null }
  }
  const { data, error } = await supabase.from('orders').insert(full).select(ORDER_COLUMNS).single()
  if (!error && data) {
    const order = data as unknown as Order
    const cached = getCachedOrders() as Order[]
    setCachedOrders([order, ...cached])
    notifyDataChange()
    return { data: order, error: null }
  }
  return { data: null, error: error ? { message: error.message } : null }
}

// --- Order Completions (Monteursbericht) ---

export const fetchCompletionByOrderId = async (orderId: string): Promise<OrderCompletion | null> => {
  if (!isOnline()) return null
  const { data, error } = await supabase
    .from('order_completions')
    .select(ORDER_COMPLETION_COLUMNS)
    .eq('order_id', orderId)
    .maybeSingle()
  if (error) return null
  return data as unknown as OrderCompletion | null
}

/** Alle Monteursberichte (nur online; für Buchhaltungs-Export / Auswertungen). */
export const fetchAllOrderCompletions = async (): Promise<OrderCompletion[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase.from('order_completions').select(ORDER_COMPLETION_COLUMNS)
  if (error || !Array.isArray(data)) return []
  return data as unknown as OrderCompletion[]
}

export const createOrderCompletion = async (
  payload: Omit<OrderCompletion, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: OrderCompletion | null; error: { message: string } | null }> => {
  if (!isOnline()) {
    return { data: null, error: { message: 'Offline: Nicht möglich' } }
  }
  const { data, error } = await supabase
    .from('order_completions')
    .insert(payload)
    .select(ORDER_COMPLETION_COLUMNS)
    .single()
  if (!error && data) {
    const oc = data as unknown as OrderCompletion
    mergeCachedOrderCompletions([
      {
        order_id: String(oc.order_id),
        completion_extra: oc.completion_extra,
        created_at: oc.created_at != null ? String(oc.created_at) : '',
      },
    ])
  }
  return { data: data ? (data as unknown as OrderCompletion) : null, error: error ? { message: error.message } : null }
}

export const updateOrderCompletion = async (
  id: string,
  updates: Partial<Omit<OrderCompletion, 'id' | 'order_id' | 'created_at'>>
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    return { error: { message: 'Offline: Nicht möglich' } }
  }
  const { data, error } = await supabase
    .from('order_completions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('order_id, completion_extra, created_at')
    .maybeSingle()
  if (!error && data) {
    mergeCachedOrderCompletions([
      {
        order_id: String(data.order_id),
        completion_extra: data.completion_extra,
        created_at: data.created_at != null ? String(data.created_at) : '',
      },
    ])
  }
  return { error: error ? { message: error.message } : null }
}

export const updateOrderStatus = async (
  id: string,
  status: Order['status']
): Promise<{ error: OrderMutationError | null }> => {
  const cachedOrder = (getCachedOrders() as Order[]).find((o) => o.id === id)
  const oids = cachedOrder ? getOrderObjectIds(cachedOrder) : []
  const conflictErr = assertNoActiveOrderConflict(id, oids, status)
  if (conflictErr) return { error: conflictErr }
  const updated_at = new Date().toISOString()
  if (!isOnline()) {
    addToOutbox({ table: 'orders', action: 'update', payload: { id, status, updated_at } })
    const cached = (getCachedOrders() as Order[]).map((o) =>
      o.id === id ? { ...o, status, updated_at } : o
    )
    setCachedOrders(cached)
    notifyDataChange()
    return { error: null }
  }
  const { error } = await supabase.from('orders').update({ status, updated_at }).eq('id', id)
  if (!error) {
    const cached = (getCachedOrders() as Order[]).map((o) =>
      o.id === id ? { ...o, status, updated_at } : o
    )
    setCachedOrders(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export const updateOrderAssignedTo = async (
  id: string,
  assignedTo: string | null
): Promise<{ error: { message: string } | null }> => {
  const updated_at = new Date().toISOString()
  const val = assignedTo || null
  if (!isOnline()) {
    addToOutbox({ table: 'orders', action: 'update', payload: { id, assigned_to: val, updated_at } })
    const cached = (getCachedOrders() as Order[]).map((o) =>
      o.id === id ? { ...o, assigned_to: val, updated_at } : o
    )
    setCachedOrders(cached)
    notifyDataChange()
    return { error: null }
  }
  const { error } = await supabase.from('orders').update({ assigned_to: val, updated_at }).eq('id', id)
  if (!error) {
    const cached = (getCachedOrders() as Order[]).map((o) =>
      o.id === id ? { ...o, assigned_to: val, updated_at } : o
    )
    setCachedOrders(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export const updateOrderDate = async (
  id: string,
  orderDate: string
): Promise<{ error: { message: string } | null }> => {
  const updated_at = new Date().toISOString()
  if (!isOnline()) {
    addToOutbox({ table: 'orders', action: 'update', payload: { id, order_date: orderDate, updated_at } })
    const cached = (getCachedOrders() as Order[]).map((o) =>
      o.id === id ? { ...o, order_date: orderDate, updated_at } : o
    )
    setCachedOrders(cached)
    notifyDataChange()
    return { error: null }
  }
  const { error } = await supabase.from('orders').update({ order_date: orderDate, updated_at }).eq('id', id)
  if (!error) {
    const cached = (getCachedOrders() as Order[]).map((o) =>
      o.id === id ? { ...o, order_date: orderDate, updated_at } : o
    )
    setCachedOrders(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export type OrderUpdatePayload = {
  customer_id: string
  bv_id: string | null
  object_ids: string[]
  order_date: string
  order_time: string | null
  order_type: Order['order_type']
  status: Order['status']
  description: string | null
  assigned_to: string | null
}

export const updateOrder = async (
  id: string,
  payload: OrderUpdatePayload
): Promise<{ error: OrderMutationError | null }> => {
  const { object_id, object_ids } = normalizeOrderObjectFields(null, payload.object_ids)
  const updated_at = new Date().toISOString()
  const row = {
    customer_id: payload.customer_id,
    bv_id: payload.bv_id,
    object_id,
    object_ids,
    order_date: payload.order_date,
    order_time: payload.order_time,
    order_type: payload.order_type,
    status: payload.status,
    description: payload.description,
    assigned_to: payload.assigned_to,
    updated_at,
  }
  const conflictErr = assertNoActiveOrderConflict(id, object_ids ?? [], payload.status)
  if (conflictErr) return { error: conflictErr }
  if (!isOnline()) {
    addToOutbox({ table: 'orders', action: 'update', payload: { id, ...row } })
    const cached = (getCachedOrders() as Order[]).map((o) => (o.id === id ? { ...o, ...row } as Order : o))
    setCachedOrders(cached)
    notifyDataChange()
    return { error: null }
  }
  const { error } = await supabase.from('orders').update(row).eq('id', id)
  if (!error) {
    const cached = (getCachedOrders() as Order[]).map((o) => (o.id === id ? { ...o, ...row } as Order : o))
    setCachedOrders(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export const deleteOrder = async (
  id: string
): Promise<{ error: { message: string } | null }> => {
  const cachedOrder = (getCachedOrders() as Order[]).find((o) => o.id === id)
  if (cachedOrder?.status === 'erledigt' || cachedOrder?.status === 'storniert') {
    return { error: { message: 'Erledigte oder stornierte Aufträge können nicht gelöscht werden.' } }
  }
  if (isOnline()) {
    const { data: row } = await supabase.from('orders').select('status').eq('id', id).maybeSingle()
    const st = (row as { status?: string } | null)?.status
    if (st === 'erledigt' || st === 'storniert') {
      return { error: { message: 'Erledigte oder stornierte Aufträge können nicht gelöscht werden.' } }
    }
  }
  if (!isOnline()) {
    addToOutbox({ table: 'orders', action: 'delete', payload: { id } })
    const cached = (getCachedOrders() as Order[]).filter((o) => o.id !== id)
    setCachedOrders(cached)
    notifyDataChange()
    return { error: null }
  }
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (!error) {
    const cached = (getCachedOrders() as Order[]).filter((o) => o.id !== id)
    setCachedOrders(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}
