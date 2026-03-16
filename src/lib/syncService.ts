import { supabase } from '../supabase'
import type { Customer, BV, Object as Obj, Order, ObjectPhoto, ObjectDocument, MaintenanceReminder } from '../types'
import { CUSTOMER_COLUMNS, BV_COLUMNS, OBJECT_COLUMNS, ORDER_COLUMNS, OBJECT_PHOTO_COLUMNS, OBJECT_DOCUMENT_COLUMNS, MAINTENANCE_REPORT_COLUMNS, MAINTENANCE_REPORT_PHOTO_COLUMNS, TIME_ENTRY_COLUMNS } from './dataColumns'
import {
  getOutbox,
  removeOutboxItem,
  getMaintenanceOutbox,
  removeMaintenanceOutboxItem,
  getObjectPhotoOutbox,
  removeObjectPhotoOutboxItem,
  getObjectDocumentOutbox,
  removeObjectDocumentOutboxItem,
  getTimeOutbox,
  removeTimeOutboxItem,
  getMaintenancePhotoOutbox,
  removeMaintenancePhotoOutboxItem,
  getEmailOutbox,
  removeEmailOutboxItem,
  setCachedCustomers,
  setCachedBvs,
  setCachedObjects,
  setCachedMaintenanceReports,
  getCachedMaintenanceReports,
  setCachedOrders,
  getCachedOrders,
  setCachedObjectPhotos,
  getCachedObjectPhotos,
  setCachedObjectDocuments,
  getCachedObjectDocuments,
  setCachedTimeEntries,
  getCachedTimeEntries,
  getCachedMaintenancePhotos,
  setCachedMaintenancePhotos,
  setCachedReminders,
  setCachedComponentSettings,
  getCachedComponentSettings,
  getCachedProfiles,
  getCachedCustomers,
  getCachedBvs,
  getCachedObjects,
  setCachedProfiles,
  setCachedAuditLog,
  setCachedLicense,
} from './offlineStorage'
import { fetchLicenseStatus } from './licenseService'
import { uploadMaintenancePdf, sendMaintenanceReportEmail } from './dataService'

const OBJECT_PHOTOS_BUCKET = 'object-photos'
const OBJECT_DOCUMENTS_BUCKET = 'object-documents'
const MAINTENANCE_PHOTOS_BUCKET = 'maintenance-photos'

export type SyncResult = { success: boolean; pendingCount: number; error?: string }

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Synchronisation hat zu lange gedauert (Timeout).'))
    }, timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

export const processOutbox = async (): Promise<SyncResult> => {
  const box = getOutbox()
  if (box.length === 0) return { success: true, pendingCount: 0 }

  for (const item of [...box]) {
    try {
      if (item.table === 'component_settings' && item.action === 'update') {
        const { component_key, label, enabled, sort_order } = item.payload as {
          component_key: string
          label: string
          enabled: boolean
          sort_order: number
        }
        const { data: updated } = await supabase
          .from('component_settings')
          .update({ enabled, label, sort_order, updated_at: new Date().toISOString() })
          .eq('component_key', component_key)
          .select('id')
        if (!updated || updated.length === 0) {
          const { error: insertError } = await supabase.from('component_settings').insert({
            component_key,
            label,
            enabled,
            sort_order,
          })
          if (insertError) throw new Error(insertError.message)
        }
      } else if (item.action === 'insert') {
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
        if (item.table === 'object_documents' && storage_path) {
          await supabase.storage.from(OBJECT_DOCUMENTS_BUCKET).remove([storage_path])
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
  const pullStart = performance.now()

  const [custRes, bvRes, objRes, ordersRes, photosRes, docsRes, maintPhotosRes] = await Promise.all([
    supabase.from('customers').select(CUSTOMER_COLUMNS).order('name'),
    supabase.from('bvs').select(BV_COLUMNS).order('name'),
    supabase.from('objects').select(OBJECT_COLUMNS).order('internal_id'),
    supabase.from('orders').select(ORDER_COLUMNS).order('order_date', { ascending: false }),
    supabase.from('object_photos').select(OBJECT_PHOTO_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('object_documents').select(OBJECT_DOCUMENT_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('maintenance_report_photos').select(MAINTENANCE_REPORT_PHOTO_COLUMNS),
  ])

  const batch1Ms = Math.round(performance.now() - pullStart)

  if (!custRes.error) setCachedCustomers((custRes.data as unknown as Customer[]) ?? [])
  if (!bvRes.error) setCachedBvs((bvRes.data as unknown as BV[]) ?? [])
  if (!objRes.error) setCachedObjects((objRes.data as unknown as Obj[]) ?? [])
  if (!ordersRes.error) setCachedOrders((ordersRes.data ?? []) as unknown as Order[])
  if (!photosRes.error) setCachedObjectPhotos((photosRes.data ?? []) as unknown as ObjectPhoto[])
  if (!docsRes.error) setCachedObjectDocuments((docsRes.data ?? []) as unknown as ObjectDocument[])
  if (!maintPhotosRes.error) setCachedMaintenancePhotos((maintPhotosRes.data ?? []) as unknown as { id: string; report_id: string; storage_path: string | null; caption: string | null }[])

  const batch2Start = performance.now()

  // Zweite Runde parallel (reduziert Ladezeit gegenüber sequentiellen Requests)
  const [compSettingsRes, profilesRes, licenseStatus, auditRes, remindersRes] = await Promise.all([
    supabase.from('component_settings').select('component_key, enabled').order('sort_order', { ascending: true }),
    supabase.from('profiles').select('id, email, first_name, last_name, role, created_at, updated_at, soll_minutes_per_month, soll_minutes_per_week').order('email', { nullsFirst: false }),
    fetchLicenseStatus().catch(() => null),
    supabase.rpc('get_audit_log', { limit_rows: 200 }),
    supabase.rpc('get_maintenance_reminders'),
  ])

  if (Array.isArray(compSettingsRes.data)) {
    const map: Record<string, boolean> = {}
    compSettingsRes.data.forEach((row: { component_key: string; enabled: boolean }) => {
      map[row.component_key] = row.enabled
    })
    if (Object.keys(map).length > 0) setCachedComponentSettings(map)
  }
  if (!profilesRes.error && Array.isArray(profilesRes.data)) {
    setCachedProfiles(profilesRes.data)
  }
  if (licenseStatus) setCachedLicense(licenseStatus)
  if (Array.isArray(auditRes.data)) {
    const mapped = auditRes.data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      user_id: (row.user_id as string) ?? null,
      user_email: (row.user_email as string) ?? null,
      action: (row.action as string) ?? '',
      table_name: (row.table_name as string) ?? '',
      record_id: (row.record_id as string) ?? null,
      created_at: row.created_at ? new Date(row.created_at as string).toISOString() : '',
    }))
    setCachedAuditLog(mapped)
  }
  if (Array.isArray(remindersRes.data)) {
    setCachedReminders(
      remindersRes.data.map((row: Record<string, unknown>) => ({
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

  const batch2Ms = Math.round(performance.now() - batch2Start)
  const totalMs = Math.round(performance.now() - pullStart)
  console.info(
    `[Sync] pullFromServer: Batch1 (Stammdaten) ${batch1Ms}ms, Batch2 (Einstellungen/Profile/Lizenz/Audit/Reminders) ${batch2Ms}ms, gesamt ${totalMs}ms`
  )
}

const processMaintenanceOutbox = async (): Promise<SyncResult> => {
  const box = getMaintenanceOutbox()
  for (const item of [...box]) {
    try {
      const full = { ...item.reportPayload, updated_at: new Date().toISOString() }
      const { data: report, error } = await supabase
        .from('maintenance_reports')
        .insert(full)
        .select(MAINTENANCE_REPORT_COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      const reportRow = report as unknown as { id: string }
      if (report && item.smokeDetectors.length > 0) {
        const rows = item.smokeDetectors.map((sd) => ({
          report_id: reportRow.id,
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
        const path = `${reportRow.id}/${crypto.randomUUID()}.${photoItem.ext}`
        const binary = Uint8Array.from(atob(photoItem.fileBase64), (c) => c.charCodeAt(0))
        const blob = new Blob([binary], { type: `image/${photoItem.ext === 'jpg' ? 'jpeg' : photoItem.ext}` })
        const { error: uploadError } = await supabase.storage
          .from(MAINTENANCE_PHOTOS_BUCKET)
          .upload(path, blob, { upsert: false })
        if (uploadError) throw new Error(uploadError.message)
        const { error: photoError } = await supabase
          .from('maintenance_report_photos')
          .insert({ report_id: reportRow.id, storage_path: path, caption: photoItem.caption })
        if (photoError) throw new Error(photoError.message)
        removeMaintenancePhotoOutboxItem(photoItem.id)
      }
      const objectId = item.reportPayload.object_id as string
      const cached = getCachedMaintenanceReports(objectId) as Record<string, unknown>[]
      const filtered = cached.filter((r) => r.id !== item.tempId)
      setCachedMaintenanceReports(objectId, [report as unknown as Record<string, unknown>, ...filtered])
      removeMaintenanceOutboxItem(item.id)

      supabase.functions.invoke('notify-portal-on-report', {
        body: { report_id: reportRow.id },
      }).catch(() => { /* fire-and-forget */ })
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
      const { error } = await supabase
        .from('object_photos')
        .insert({
          object_id: item.object_id,
          storage_path: path,
          caption: item.caption,
        })
        .select(OBJECT_PHOTO_COLUMNS)
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

const processObjectDocumentOutbox = async (): Promise<SyncResult> => {
  const box = getObjectDocumentOutbox()
  for (const item of [...box]) {
    try {
      const path = `${item.object_id}/${crypto.randomUUID()}.${item.ext}`
      const binary = Uint8Array.from(atob(item.fileBase64), (c) => c.charCodeAt(0))
      const mimeType = item.ext === 'pdf' ? 'application/pdf' : `image/${item.ext === 'jpg' ? 'jpeg' : item.ext}`
      const blob = new Blob([binary], { type: mimeType })
      const { error: uploadError } = await supabase.storage
        .from(OBJECT_DOCUMENTS_BUCKET)
        .upload(path, blob, { upsert: false })
      if (uploadError) throw new Error(uploadError.message)
      const { error } = await supabase
        .from('object_documents')
        .insert({
          object_id: item.object_id,
          storage_path: path,
          document_type: item.document_type,
          title: item.title,
          file_name: item.file_name,
        })
        .select(OBJECT_DOCUMENT_COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      removeObjectDocumentOutboxItem(item.id)
    } catch (err) {
      return {
        success: false,
        pendingCount:
          getOutbox().length +
          getMaintenanceOutbox().length +
          getObjectPhotoOutbox().length +
          getObjectDocumentOutbox().length +
          getMaintenancePhotoOutbox().length +
          getEmailOutbox().length,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { success: true, pendingCount: getOutbox().length + getObjectPhotoOutbox().length }
}

const processTimeOutbox = async (): Promise<SyncResult> => {
  const box = getTimeOutbox()
  for (const item of [...box]) {
    try {
      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .insert({
          user_id: item.user_id,
          date: item.date,
          start: item.start,
          end: item.end,
          order_id: item.order_id ?? null,
          location_start_lat: item.location_start_lat ?? null,
          location_start_lon: item.location_start_lon ?? null,
          location_end_lat: item.location_end_lat ?? null,
          location_end_lon: item.location_end_lon ?? null,
        })
        .select(TIME_ENTRY_COLUMNS)
        .single()
      if (entryError || !entry) throw new Error(entryError?.message ?? 'Zeiteintrag fehlgeschlagen')
      const entryData = entry as unknown as { id: string }
      for (const b of item.breaks) {
        const { error: breakError } = await supabase
          .from('time_breaks')
          .insert({
            time_entry_id: entryData.id,
            start: b.start,
            end: b.end,
          })
        if (breakError) throw new Error(breakError.message)
      }
      removeTimeOutboxItem(item.id)
      const cached = getCachedTimeEntries() as { id: string }[]
      setCachedTimeEntries([entryData, ...cached.filter((c) => c.id !== item.tempId)])
    } catch (err) {
      return {
        success: false,
        pendingCount:
          getOutbox().length +
          getMaintenanceOutbox().length +
          getObjectPhotoOutbox().length +
          getObjectDocumentOutbox().length +
          getTimeOutbox().length +
          getMaintenancePhotoOutbox().length +
          getEmailOutbox().length,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { success: true, pendingCount: getOutbox().length + getObjectPhotoOutbox().length }
}

const processEmailOutbox = async (): Promise<SyncResult> => {
  const box = getEmailOutbox()
  for (const item of [...box]) {
    try {
      const binary = Uint8Array.from(atob(item.pdfBase64), (c) => c.charCodeAt(0))
      const blob = new Blob([binary], { type: 'application/pdf' })
      const { path, error: uploadError } = await uploadMaintenancePdf(item.reportId, blob)
      if (uploadError || !path) throw new Error(uploadError?.message ?? 'PDF-Upload fehlgeschlagen')
      const { error: sendError } = await sendMaintenanceReportEmail(path, item.toEmail, item.subject, item.filename)
      if (sendError) throw new Error(sendError.message)
      removeEmailOutboxItem(item.id)
    } catch (err) {
      return {
        success: false,
        pendingCount:
          getOutbox().length +
          getMaintenanceOutbox().length +
          getObjectPhotoOutbox().length +
          getObjectDocumentOutbox().length +
          getMaintenancePhotoOutbox().length +
          getEmailOutbox().length,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { success: true, pendingCount: 0 }
}

export const runSync = async (): Promise<SyncResult> => {
  const syncStart = performance.now()
  const pushResult = await processOutbox()
  if (!pushResult.success) return pushResult
  const maintResult = await processMaintenanceOutbox()
  if (!maintResult.success) return maintResult
  const photoResult = await processObjectPhotoOutbox()
  if (!photoResult.success) return photoResult
  const docResult = await processObjectDocumentOutbox()
  if (!docResult.success) return docResult
  const timeResult = await processTimeOutbox()
  if (!timeResult.success) return timeResult
  const emailResult = await processEmailOutbox()
  if (!emailResult.success) return emailResult
  const pushMs = Math.round(performance.now() - syncStart)
  try {
    await withTimeout(pullFromServer(), 60000)
    const totalMs = Math.round(performance.now() - syncStart)
    console.info(`[Sync] runSync: Push ${pushMs}ms, Pull siehe oben, gesamt ${totalMs}ms`)
    return { success: true, pendingCount: 0 }
  } catch (err) {
    return {
      success: false,
      pendingCount:
        getOutbox().length +
        getMaintenanceOutbox().length +
        getObjectPhotoOutbox().length +
        getObjectDocumentOutbox().length +
        getTimeOutbox().length +
        getMaintenancePhotoOutbox().length +
        getEmailOutbox().length,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export const getPendingCount = () =>
  getOutbox().length +
  getMaintenanceOutbox().length +
  getObjectPhotoOutbox().length +
  getObjectDocumentOutbox().length +
  getTimeOutbox().length +
  getMaintenancePhotoOutbox().length +
  getEmailOutbox().length

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
  let objectDocuments = getCachedObjectDocuments() as ObjectDocument[]
  let maintenancePhotos = getCachedMaintenancePhotos() as { id: string }[]
  for (const item of box) {
    if (item.action !== 'delete') continue
    const id = (item.payload as { id: string }).id
    if (item.table === 'object_photos') objectPhotos = objectPhotos.filter((p) => p.id !== id)
    if (item.table === 'object_documents') objectDocuments = objectDocuments.filter((d) => d.id !== id)
    if (item.table === 'maintenance_report_photos') maintenancePhotos = maintenancePhotos.filter((p) => p.id !== id)
  }
  setCachedObjectPhotos(objectPhotos)
  setCachedObjectDocuments(objectDocuments)
  setCachedMaintenancePhotos(maintenancePhotos)

  let componentSettings = getCachedComponentSettings()
  for (const item of box) {
    if (item.table !== 'component_settings' || item.action !== 'update') continue
    const { component_key, enabled } = item.payload as { component_key: string; enabled: boolean }
    componentSettings = { ...componentSettings, [component_key]: enabled }
  }
  if (Object.keys(componentSettings).length > 0) setCachedComponentSettings(componentSettings)

  let profiles = getCachedProfiles() as { id: string; first_name?: string | null; last_name?: string | null }[]
  for (const item of box) {
    if (item.table !== 'profiles' || item.action !== 'update') continue
    const row = item.payload as { id: string; first_name?: string | null; last_name?: string | null }
    profiles = profiles.map((p) =>
      p.id === row.id ? { ...p, first_name: row.first_name, last_name: row.last_name } : p
    )
  }
  if (profiles.length > 0) setCachedProfiles(profiles)
}
