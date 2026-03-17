import { supabase } from '../supabase'
import { compressImageFile } from './imageCompression'
import type {
  Customer,
  BV,
  Object as Obj,
  Order,
  OrderCompletion,
  MaintenanceReport,
  MaintenanceReportPhoto,
  MaintenanceReportSmokeDetector,
  MaintenanceReminder,
  MaintenanceContract,
  ObjectPhoto,
  ObjectDocument,
  ObjectDocumentType,
} from '../types'
import { CUSTOMER_COLUMNS, BV_COLUMNS, OBJECT_COLUMNS, MAINTENANCE_CONTRACT_COLUMNS, ORDER_COLUMNS, ORDER_COMPLETION_COLUMNS, OBJECT_PHOTO_COLUMNS, OBJECT_DOCUMENT_COLUMNS, MAINTENANCE_REPORT_COLUMNS, MAINTENANCE_REPORT_PHOTO_COLUMNS, MAINTENANCE_REPORT_SMOKE_DETECTOR_COLUMNS, PORTAL_USER_COLUMNS } from './dataColumns'
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

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

export const fetchCustomers = async (): Promise<Customer[]> => {
  if (isOnline()) {
    const { data, error } = await supabase.from('customers').select(CUSTOMER_COLUMNS).order('name')
    if (!error && data) {
      const customers = data as unknown as Customer[]
      setCachedCustomers(customers)
      return customers
    }
  }
  return getCachedCustomers() as Customer[]
}

export const fetchCustomerCount = async (): Promise<number> => {
  if (isOnline()) {
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .is('demo_user_id', null)
    if (!error && count !== null) return count
  }
  return (getCachedCustomers() as Customer[]).filter((c) => !c.demo_user_id).length
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
      return bvs
    }
  }
  return (getCachedBvs() as BV[]).filter((b) => b.customer_id === customerId)
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
      return objs
    }
  }
  return (getCachedObjects() as Obj[]).filter((o) => o.bv_id === bvId)
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
      return objs
    }
  }
  return (getCachedObjects() as Obj[]).filter((o) => o.customer_id === customerId && o.bv_id == null)
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
      return bvs
    }
  }
  return getCachedBvs() as BV[]
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
      return objs
    }
  }
  return getCachedObjects() as Obj[]
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

export const createMaintenanceReport = async (
  payload: MaintenanceReportPayload,
  smokeDetectors: { label: string; status: MaintenanceReportSmokeDetector['status'] }[]
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

  supabase.functions.invoke('notify-portal-on-report', {
    body: { report_id: reportTyped.id },
  }).catch(() => { /* fire-and-forget */ })

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
  if (!isOnline()) {
    const cached = getCachedOrders() as Order[]
    return cached.find((o) => o.id === orderId) ?? null
  }
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .single()
  if (error || !data) return null
  return data as unknown as Order
}

export const fetchOrdersAssignedTo = async (userId: string): Promise<Order[]> => {
  const all = await fetchOrders()
  if (!userId) return all
  return all.filter((o) => o.assigned_to === userId)
}

type OrderPayload = Omit<Order, 'id' | 'created_at' | 'updated_at'> & { updated_at?: string }

export const createOrder = async (
  payload: Omit<OrderPayload, 'created_by'>,
  userId: string | null
): Promise<{ data: Order | null; error: { message: string } | null }> => {
  const full = {
    ...payload,
    id: crypto.randomUUID(),
    object_id: payload.object_id || null,
    assigned_to: 'assigned_to' in payload && payload.assigned_to ? String(payload.assigned_to).trim() || null : null,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
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
  return { data: data ? (data as unknown as OrderCompletion) : null, error: error ? { message: error.message } : null }
}

export const updateOrderCompletion = async (
  id: string,
  updates: Partial<Omit<OrderCompletion, 'id' | 'order_id' | 'created_at'>>
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    return { error: { message: 'Offline: Nicht möglich' } }
  }
  const { error } = await supabase
    .from('order_completions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? { message: error.message } : null }
}

export const updateOrderStatus = async (
  id: string,
  status: Order['status']
): Promise<{ error: { message: string } | null }> => {
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

export const deleteOrder = async (
  id: string
): Promise<{ error: { message: string } | null }> => {
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
