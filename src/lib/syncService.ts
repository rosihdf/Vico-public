import { supabase } from '../supabase'
import type { Customer, BV, Object as Obj, Order, ObjectPhoto, MaintenanceReminder } from '../types'
import {
  getOutbox,
  removeOutboxItem,
  getMaintenanceOutbox,
  removeMaintenanceOutboxItem,
  getObjectPhotoOutbox,
  removeObjectPhotoOutboxItem,
  getMaintenancePhotoOutbox,
  removeMaintenancePhotoOutboxItem,
  setCachedCustomers,
  setCachedBvs,
  setCachedObjects,
  setCachedMaintenanceReports,
  getCachedMaintenanceReports,
  setCachedOrders,
  getCachedOrders,
  setCachedObjectPhotos,
  getCachedObjectPhotos,
  getCachedMaintenancePhotos,
  setCachedMaintenancePhotos,
  setCachedReminders,
  setCachedComponentSettings,
  getCachedCustomers,
  getCachedBvs,
  getCachedObjects,
} from './offlineStorage'

const OBJECT_PHOTOS_BUCKET = 'object-photos'
const MAINTENANCE_PHOTOS_BUCKET = 'maintenance-photos'

export type SyncResult = { success: boolean; pendingCount: number; error?: string }

export const processOutbox = async (): Promise<SyncResult> => {
  const box = getOutbox()
  if (box.length === 0) return { success: true, pendingCount: 0 }

  for (const item of [...box]) {
    try {
      if (item.action === 'insert') {
        const { error } = await supabase.from(item.table).insert(item.payload)
        if (error) throw new Error(error.message)
      } else if (item.action === 'update') {
        const { id, ...rest } = item.payload as { id: string; [k: string]: unknown }
        const { error } = await supabase.from(item.table).update(rest).eq('id', id)
        if (error) throw new Error(error.message)
      } else if (item.action === 'delete') {
        const { id, storage_path } = item.payload as { id: string; storage_path?: string }
        if (item.table === 'object_photos' && storage_path) {
          await supabase.storage.from(OBJECT_PHOTOS_BUCKET).remove([storage_path])
        }
        if (item.table === 'maintenance_report_photos' && storage_path) {
          await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).remove([storage_path])
        }
        const { error } = await supabase.from(item.table).delete().eq('id', id)
        if (error) throw new Error(error.message)
      }
      removeOutboxItem(item.id)
    } catch (err) {
      return {
        success: false,
        pendingCount: getOutbox().length,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { success: true, pendingCount: 0 }
}

export const pullFromServer = async (): Promise<void> => {
  const [custRes, bvRes, objRes, ordersRes, photosRes, maintPhotosRes] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('bvs').select('*').order('name'),
    supabase.from('objects').select('*').order('internal_id'),
    supabase.from('orders').select('*').order('order_date', { ascending: false }),
    supabase.from('object_photos').select('*').order('created_at', { ascending: false }),
    supabase.from('maintenance_report_photos').select('*'),
  ])

  if (!custRes.error) setCachedCustomers((custRes.data as Customer[]) ?? [])
  if (!bvRes.error) setCachedBvs((bvRes.data as BV[]) ?? [])
  if (!objRes.error) setCachedObjects((objRes.data as Obj[]) ?? [])
  if (!ordersRes.error) setCachedOrders((ordersRes.data ?? []) as Order[])
  if (!photosRes.error) setCachedObjectPhotos((photosRes.data ?? []) as ObjectPhoto[])
  if (!maintPhotosRes.error) setCachedMaintenancePhotos((maintPhotosRes.data ?? []) as { id: string; report_id: string; storage_path: string | null; caption: string | null }[])
  const { data: compSettingsData } = await supabase
    .from('component_settings')
    .select('component_key, enabled')
    .order('sort_order', { ascending: true })
  if (Array.isArray(compSettingsData)) {
    const map: Record<string, boolean> = {}
    compSettingsData.forEach((row: { component_key: string; enabled: boolean }) => {
      map[row.component_key] = row.enabled
    })
    if (Object.keys(map).length > 0) setCachedComponentSettings(map)
  }
  const { data: remindersData } = await supabase.rpc('get_maintenance_reminders')
  if (Array.isArray(remindersData)) {
    setCachedReminders(
      remindersData.map((row: Record<string, unknown>) => ({
        object_id: row.object_id,
        customer_id: row.customer_id,
        customer_name: row.customer_name ?? '',
        bv_id: row.bv_id,
        bv_name: row.bv_name ?? '',
        internal_id: row.internal_id ?? null,
        object_name: row.object_name ?? null,
        object_room: row.object_room ?? null,
        object_floor: row.object_floor ?? null,
        object_manufacturer: row.object_manufacturer ?? null,
        maintenance_interval_months: row.maintenance_interval_months ?? 0,
        last_maintenance_date: row.last_maintenance_date ? String(row.last_maintenance_date).slice(0, 10) : null,
        next_maintenance_date: row.next_maintenance_date ? String(row.next_maintenance_date).slice(0, 10) : null,
        status: (row.status as MaintenanceReminder['status']) ?? 'ok',
        days_until_due: row.days_until_due != null ? Number(row.days_until_due) : null,
      }))
    )
  }
}

const processMaintenanceOutbox = async (): Promise<SyncResult> => {
  const box = getMaintenanceOutbox()
  for (const item of [...box]) {
    try {
      const full = { ...item.reportPayload, updated_at: new Date().toISOString() }
      const { data: report, error } = await supabase
        .from('maintenance_reports')
        .insert(full)
        .select()
        .single()
      if (error) throw new Error(error.message)
      if (report && item.smokeDetectors.length > 0) {
        const rows = item.smokeDetectors.map((sd) => ({
          report_id: report.id,
          smoke_detector_label: sd.label,
          status: sd.status,
        }))
        const { error: sdError } = await supabase
          .from('maintenance_report_smoke_detectors')
          .insert(rows)
        if (sdError) throw new Error(sdError.message)
      }
      const photoOutbox = getMaintenancePhotoOutbox().filter((p) => p.report_id === item.tempId)
      for (const photoItem of photoOutbox) {
        const path = `${report!.id}/${crypto.randomUUID()}.${photoItem.ext}`
        const binary = Uint8Array.from(atob(photoItem.fileBase64), (c) => c.charCodeAt(0))
        const blob = new Blob([binary], { type: `image/${photoItem.ext === 'jpg' ? 'jpeg' : photoItem.ext}` })
        const { error: uploadError } = await supabase.storage
          .from(MAINTENANCE_PHOTOS_BUCKET)
          .upload(path, blob, { upsert: false })
        if (uploadError) throw new Error(uploadError.message)
        const { error: photoError } = await supabase
          .from('maintenance_report_photos')
          .insert({ report_id: report!.id, storage_path: path, caption: photoItem.caption })
        if (photoError) throw new Error(photoError.message)
        removeMaintenancePhotoOutboxItem(photoItem.id)
      }
      const objectId = item.reportPayload.object_id as string
      const cached = getCachedMaintenanceReports(objectId) as Record<string, unknown>[]
      const filtered = cached.filter((r) => r.id !== item.tempId)
      setCachedMaintenanceReports(objectId, [report, ...filtered])
      removeMaintenanceOutboxItem(item.id)
    } catch (err) {
      return {
        success: false,
        pendingCount: getOutbox().length + getMaintenanceOutbox().length + getMaintenancePhotoOutbox().length,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { success: true, pendingCount: getOutbox().length }
}

const processObjectPhotoOutbox = async (): Promise<SyncResult> => {
  const box = getObjectPhotoOutbox()
  for (const item of [...box]) {
    try {
      const path = `${item.object_id}/${crypto.randomUUID()}.${item.ext}`
      const binary = Uint8Array.from(atob(item.fileBase64), (c) => c.charCodeAt(0))
      const blob = new Blob([binary], { type: `image/${item.ext === 'jpg' ? 'jpeg' : item.ext}` })
      const { error: uploadError } = await supabase.storage
        .from(OBJECT_PHOTOS_BUCKET)
        .upload(path, blob, { upsert: false })
      if (uploadError) throw new Error(uploadError.message)
      const { data: photo, error } = await supabase
        .from('object_photos')
        .insert({
          object_id: item.object_id,
          storage_path: path,
          caption: item.caption,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      removeObjectPhotoOutboxItem(item.id)
    } catch (err) {
      return {
        success: false,
        pendingCount:
          getOutbox().length + getMaintenanceOutbox().length + getObjectPhotoOutbox().length,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { success: true, pendingCount: getOutbox().length + getMaintenanceOutbox().length }
}

export const runSync = async (): Promise<SyncResult> => {
  const pushResult = await processOutbox()
  if (!pushResult.success) return pushResult
  const maintResult = await processMaintenanceOutbox()
  if (!maintResult.success) return maintResult
  const photoResult = await processObjectPhotoOutbox()
  if (!photoResult.success) return photoResult
  await pullFromServer()
  return { success: true, pendingCount: 0 }
}

export const getPendingCount = () =>
  getOutbox().length + getMaintenanceOutbox().length + getObjectPhotoOutbox().length + getMaintenancePhotoOutbox().length

export const mergeCacheWithOutbox = () => {
  const box = getOutbox()
  if (box.length === 0) return

  let customers = getCachedCustomers() as Customer[]
  let bvs = getCachedBvs() as BV[]
  let objects = getCachedObjects() as Obj[]

  for (const item of box) {
    if (item.action === 'delete') {
      const id = (item.payload as { id: string }).id
      if (item.table === 'customers') customers = customers.filter((c) => c.id !== id)
      if (item.table === 'bvs') bvs = bvs.filter((b) => b.id !== id)
      if (item.table === 'objects') objects = objects.filter((o) => o.id !== id)
    } else if (item.action === 'insert' || item.action === 'update') {
      const row = item.payload as Record<string, unknown>
      const id = row.id as string
      if (item.table === 'customers') {
        customers = customers.filter((c) => c.id !== id)
        customers.push(row as unknown as Customer)
      }
      if (item.table === 'bvs') {
        bvs = bvs.filter((b) => b.id !== id)
        bvs.push(row as unknown as BV)
      }
      if (item.table === 'objects') {
        objects = objects.filter((o) => o.id !== id)
        objects.push(row as unknown as Obj)
      }
    }
  }

  setCachedCustomers(customers)
  setCachedBvs(bvs)
  setCachedObjects(objects)

  let orders = getCachedOrders() as Order[]
  for (const item of box) {
    if (item.table !== 'orders') continue
    if (item.action === 'delete') {
      const id = (item.payload as { id: string }).id
      orders = orders.filter((o) => o.id !== id)
    } else if (item.action === 'insert') {
      const row = item.payload as Record<string, unknown>
      const id = row.id as string
      orders = orders.filter((o) => o.id !== id)
      orders.push(row as unknown as Order)
    } else if (item.action === 'update') {
      const row = item.payload as Record<string, unknown>
      const id = row.id as string
      const existing = orders.find((o) => o.id === id)
      orders = orders.filter((o) => o.id !== id)
      if (existing) orders.push({ ...existing, ...row } as Order)
    }
  }
  setCachedOrders(orders)

  let objectPhotos = getCachedObjectPhotos() as ObjectPhoto[]
  let maintenancePhotos = getCachedMaintenancePhotos() as { id: string }[]
  for (const item of box) {
    if (item.action !== 'delete') continue
    const id = (item.payload as { id: string }).id
    if (item.table === 'object_photos') objectPhotos = objectPhotos.filter((p) => p.id !== id)
    if (item.table === 'maintenance_report_photos') maintenancePhotos = maintenancePhotos.filter((p) => p.id !== id)
  }
  setCachedObjectPhotos(objectPhotos)
  setCachedMaintenancePhotos(maintenancePhotos)
}
