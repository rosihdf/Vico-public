import { supabase } from '../supabase'
import type {
  Customer,
  BV,
  Object as Obj,
  Order,
  MaintenanceReport,
  MaintenanceReportPhoto,
  MaintenanceReportSmokeDetector,
  MaintenanceReminder,
  ObjectPhoto,
} from '../types'
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
    const { data, error } = await supabase.from('customers').select('*').order('name')
    if (!error && data) {
      setCachedCustomers(data as Customer[])
      return data as Customer[]
    }
  }
  return getCachedCustomers() as Customer[]
}

export const fetchCustomer = async (id: string): Promise<Customer | null> => {
  if (isOnline()) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single()
    if (!error && data) {
      const all = getCachedCustomers() as Customer[]
      const merged = all.some((c) => c.id === id)
        ? all.map((c) => (c.id === id ? (data as Customer) : c))
        : [...all, data as Customer]
      setCachedCustomers(merged)
      return data as Customer
    }
  }
  return (getCachedCustomers() as Customer[]).find((c) => c.id === id) ?? null
}

export const fetchBv = async (id: string): Promise<BV | null> => {
  if (isOnline()) {
    const { data, error } = await supabase.from('bvs').select('*').eq('id', id).single()
    if (!error && data) {
      const all = getCachedBvs() as BV[]
      const merged = all.some((b) => b.id === id)
        ? all.map((b) => (b.id === id ? (data as BV) : b))
        : [...all, data as BV]
      setCachedBvs(merged)
      return data as BV
    }
  }
  return (getCachedBvs() as BV[]).find((b) => b.id === id) ?? null
}

export const fetchBvs = async (customerId: string): Promise<BV[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('bvs')
      .select('*')
      .eq('customer_id', customerId)
      .order('name')
    if (!error && data) {
      const all = getCachedBvs() as BV[]
      const others = all.filter((b) => b.customer_id !== customerId)
      setCachedBvs([...others, ...(data as BV[])])
      return data as BV[]
    }
  }
  return (getCachedBvs() as BV[]).filter((b) => b.customer_id === customerId)
}

export const fetchObject = async (objectId: string): Promise<Obj | null> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('objects')
      .select('*')
      .eq('id', objectId)
      .single()
    if (!error && data) return data as Obj
  }
  return (getCachedObjects() as Obj[]).find((o) => o.id === objectId) ?? null
}

export const fetchObjects = async (bvId: string): Promise<Obj[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('objects')
      .select('*')
      .eq('bv_id', bvId)
      .order('internal_id')
    if (!error && data) {
      const all = getCachedObjects() as Obj[]
      const others = all.filter((o) => o.bv_id !== bvId)
      setCachedObjects([...others, ...(data as Obj[])])
      return data as Obj[]
    }
  }
  return (getCachedObjects() as Obj[]).filter((o) => o.bv_id === bvId)
}

export const fetchAllBvs = async (): Promise<BV[]> => {
  if (isOnline()) {
    const { data, error } = await supabase.from('bvs').select('*').order('name')
    if (!error && data) {
      setCachedBvs(data as BV[])
      return data as BV[]
    }
  }
  return getCachedBvs() as BV[]
}

export const fetchAllObjects = async (): Promise<Obj[]> => {
  if (isOnline()) {
    const { data, error } = await supabase.from('objects').select('*').order('internal_id')
    if (!error && data) {
      setCachedObjects(data as Obj[])
      return data as Obj[]
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

export const fetchAuditLog = async (limit = 200): Promise<AuditLogEntry[]> => {
  if (!isOnline()) return []
  const { data, error } = await supabase.rpc('get_audit_log', { limit_rows: limit })
  if (error || !Array.isArray(data)) return []
  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    user_id: (row.user_id as string) ?? null,
    user_email: (row.user_email as string) ?? null,
    action: (row.action as string) ?? '',
    table_name: (row.table_name as string) ?? '',
    record_id: (row.record_id as string) ?? null,
    created_at: row.created_at ? new Date(row.created_at as string).toISOString() : '',
  }))
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
    const { data, error } = await supabase.from('customers').insert(full).select().single()
    if (!error && data) setCachedCustomers([...(getCachedCustomers() as Customer[]), data as Customer])
    return { data: data as Customer | null, error: error ? { message: error.message } : null }
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
    const { data, error } = await supabase.from('bvs').insert(full).select().single()
    if (!error && data) {
      const all = getCachedBvs() as BV[]
      setCachedBvs([...all, data as BV])
    }
    return { data: data as BV | null, error: error ? { message: error.message } : null }
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
    const { data, error } = await supabase.from('objects').insert(full).select().single()
    if (!error && data) {
      const all = getCachedObjects() as Obj[]
      setCachedObjects([...all, data as Obj])
    }
    return { data: data as Obj | null, error: error ? { message: error.message } : null }
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
      .select('*')
      .eq('object_id', objectId)
      .order('maintenance_date', { ascending: false })
    if (!error && data) {
      setCachedMaintenanceReports(objectId, data)
      const merged = mergeMaintenanceCacheWithOutbox(objectId, data as MaintenanceReport[])
      return merged
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
      .select('*')
      .eq('report_id', reportId)
    if (error) return []
    return (data ?? []) as MaintenanceReportSmokeDetector[]
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
    .select()
    .single()
  if (error) return { data: null, error: { message: error.message } }
  if (report && smokeDetectors.length > 0) {
    const rows = smokeDetectors.map((sd) => ({
      report_id: report.id,
      smoke_detector_label: sd.label,
      status: sd.status,
    }))
    await supabase.from('maintenance_report_smoke_detectors').insert(rows)
  }
  const cached = getCachedMaintenanceReports(payload.object_id) as MaintenanceReport[]
  setCachedMaintenanceReports(payload.object_id, [report, ...cached])
  notifyDataChange()
  return { data: report as MaintenanceReport, error: null }
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
      .select('*')
      .eq('report_id', reportId)
    if (error) return []
    return (data ?? []) as MaintenanceReportPhotoDisplay[]
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
  const path = `${reportId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(MAINTENANCE_PHOTOS_BUCKET)
    .upload(path, file, { upsert: false })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data: photo, error } = await supabase
    .from('maintenance_report_photos')
    .insert({ report_id: reportId, storage_path: path, caption: caption?.trim() || null })
    .select()
    .single()
  return { data: photo as MaintenanceReportPhotoDisplay, error: error ? { message: error.message } : null }
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

// --- Object Photos ---

export type ObjectPhotoDisplay = ObjectPhoto & { localDataUrl?: string }

const OBJECT_PHOTOS_BUCKET = 'object-photos'

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
      .select('*')
      .eq('object_id', objectId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as ObjectPhotoDisplay[]
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
  const path = `${objectId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(OBJECT_PHOTOS_BUCKET)
    .upload(path, file, { upsert: false })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data: photo, error } = await supabase
    .from('object_photos')
    .insert({ object_id: objectId, storage_path: path, caption: caption?.trim() || null })
    .select()
    .single()
  return { data: photo as ObjectPhotoDisplay, error: error ? { message: error.message } : null }
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
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as PortalUser[]
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

// --- Aufträge (Orders) ---

export const fetchOrders = async (): Promise<Order[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false })
    if (!error && data) {
      setCachedOrders(data)
      return (data ?? []) as Order[]
    }
  }
  return (getCachedOrders() as Order[]).sort(
    (a, b) => (b.order_date || '').localeCompare(a.order_date || '')
  )
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
  const { data, error } = await supabase.from('orders').insert(full).select().single()
  if (!error && data) {
    const cached = getCachedOrders() as Order[]
    setCachedOrders([data as Order, ...cached])
    notifyDataChange()
  }
  return { data: data as Order | null, error: error ? { message: error.message } : null }
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
