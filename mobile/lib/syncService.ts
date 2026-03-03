import { supabase } from './supabase'
import type { Customer, BV, Object as Obj, Order, ObjectPhoto } from './types'
import {
  getOutbox,
  removeOutboxItem,
  getMaintenanceOutbox,
  removeMaintenanceOutboxItem,
  getObjectPhotoOutbox,
  removeObjectPhotoOutboxItem,
  setCachedCustomers,
  setCachedBvs,
  setCachedObjects,
  setCachedMaintenanceReports,
  getCachedMaintenanceReports,
  setCachedOrders,
  setCachedObjectPhotos,
  setCachedReminders,
  getCachedCustomers,
  getCachedBvs,
  getCachedObjects,
} from './offlineStorage'

const OBJECT_PHOTOS_BUCKET = 'object-photos'

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
        const { error } = await supabase.from(item.table).delete().eq('id', id)
        if (error) throw new Error(error.message)
      }
      await removeOutboxItem(item.id)
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
  const [custRes, bvRes, objRes, ordersRes, photosRes] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('bvs').select('*').order('name'),
    supabase.from('objects').select('*').order('internal_id'),
    supabase.from('orders').select('*').order('order_date', { ascending: false }),
    supabase.from('object_photos').select('*').order('created_at', { ascending: false }),
  ])

  if (!custRes.error) await setCachedCustomers((custRes.data as Customer[]) ?? [])
  if (!bvRes.error) await setCachedBvs((bvRes.data as BV[]) ?? [])
  if (!objRes.error) await setCachedObjects((objRes.data as Obj[]) ?? [])
  if (!ordersRes.error) await setCachedOrders((ordersRes.data ?? []) as Order[])
  if (!photosRes.error) await setCachedObjectPhotos((photosRes.data ?? []) as ObjectPhoto[])
  const { data: remindersData } = await supabase.rpc('get_maintenance_reminders')
  if (Array.isArray(remindersData)) {
    await setCachedReminders(
      remindersData.map((row: Record<string, unknown>) => ({
        object_id: row.object_id,
        customer_id: row.customer_id,
        customer_name: row.customer_name ?? '',
        bv_id: row.bv_id,
        bv_name: row.bv_name ?? '',
        internal_id: row.internal_id ?? null,
        maintenance_interval_months: row.maintenance_interval_months ?? 0,
        last_maintenance_date: row.last_maintenance_date ? String(row.last_maintenance_date).slice(0, 10) : null,
        next_maintenance_date: row.next_maintenance_date ? String(row.next_maintenance_date).slice(0, 10) : null,
        status: (row.status as 'ok' | 'due_soon' | 'overdue') ?? 'ok',
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
      const objectId = item.reportPayload.object_id as string
      const cached = getCachedMaintenanceReports(objectId) as Record<string, unknown>[]
      const filtered = cached.filter((r) => r.id !== item.tempId)
      await setCachedMaintenanceReports(objectId, [report, ...filtered])
      await removeMaintenanceOutboxItem(item.id)
    } catch (err) {
      return {
        success: false,
        pendingCount: getOutbox().length + getMaintenanceOutbox().length,
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
      await removeObjectPhotoOutboxItem(item.id)
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

export const getPendingCount = (): number =>
  getOutbox().length + getMaintenanceOutbox().length + getObjectPhotoOutbox().length
