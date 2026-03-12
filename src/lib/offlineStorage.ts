const CACHE_PREFIX = 'vico-cache-'
const OUTBOX_KEY = 'vico-outbox'
const MAINTENANCE_OUTBOX_KEY = 'vico-outbox-maintenance'
const OBJECT_PHOTO_OUTBOX_KEY = 'vico-outbox-object-photos'
const OBJECT_DOCUMENT_OUTBOX_KEY = 'vico-outbox-object-documents'
const MAINTENANCE_PHOTO_OUTBOX_KEY = 'vico-outbox-maintenance-photos'
const EMAIL_OUTBOX_KEY = 'vico-outbox-email'
const TIME_OUTBOX_KEY = 'vico-outbox-time'
const CACHE_KEYS = {
  customers: `${CACHE_PREFIX}customers`,
  bvs: `${CACHE_PREFIX}bvs`,
  objects: `${CACHE_PREFIX}objects`,
  maintenanceReports: `${CACHE_PREFIX}maintenance-reports`,
  orders: `${CACHE_PREFIX}orders`,
  objectPhotos: `${CACHE_PREFIX}object-photos`,
  objectDocuments: `${CACHE_PREFIX}object-documents`,
  timeEntries: `${CACHE_PREFIX}time-entries`,
  maintenancePhotos: `${CACHE_PREFIX}maintenance-photos`,
  reminders: `${CACHE_PREFIX}reminders`,
  componentSettings: `${CACHE_PREFIX}component-settings`,
  license: `${CACHE_PREFIX}license`,
  profiles: `${CACHE_PREFIX}profiles`,
  auditLog: `${CACHE_PREFIX}audit-log`,
} as const

export type OutboxAction = 'insert' | 'update' | 'delete'

export type OutboxItem = {
  id: string
  table: 'customers' | 'bvs' | 'objects' | 'orders' | 'object_photos' | 'object_documents' | 'time_entries' | 'time_breaks' | 'maintenance_report_photos' | 'component_settings' | 'profiles'
  action: OutboxAction
  payload: Record<string, unknown>
  tempId?: string
  timestamp: string
}

export type MaintenanceOutboxItem = {
  id: string
  reportPayload: Record<string, unknown>
  smokeDetectors: { label: string; status: string }[]
  tempId: string
  timestamp: string
}

const safeJsonParse = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const safeJsonSet = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('offlineStorage: set failed', e)
  }
}

export const getCachedCustomers = () => safeJsonParse<unknown[]>(CACHE_KEYS.customers, [])
export const setCachedCustomers = (data: unknown[]) => safeJsonSet(CACHE_KEYS.customers, data)

export const getCachedBvs = () => safeJsonParse<unknown[]>(CACHE_KEYS.bvs, [])
export const setCachedBvs = (data: unknown[]) => safeJsonSet(CACHE_KEYS.bvs, data)

export const getCachedObjects = () => safeJsonParse<unknown[]>(CACHE_KEYS.objects, [])
export const setCachedObjects = (data: unknown[]) => safeJsonSet(CACHE_KEYS.objects, data)

export const getCachedOrders = () => safeJsonParse<unknown[]>(CACHE_KEYS.orders, [])
export const setCachedOrders = (data: unknown[]) => safeJsonSet(CACHE_KEYS.orders, data)

export const getCachedObjectPhotos = () => safeJsonParse<unknown[]>(CACHE_KEYS.objectPhotos, [])
export const setCachedObjectPhotos = (data: unknown[]) => safeJsonSet(CACHE_KEYS.objectPhotos, data)

export type ObjectPhotoOutboxItem = {
  id: string
  object_id: string
  tempId: string
  fileBase64: string
  caption: string | null
  ext: string
  timestamp: string
}

export const getObjectPhotoOutbox = (): ObjectPhotoOutboxItem[] =>
  safeJsonParse<ObjectPhotoOutboxItem[]>(OBJECT_PHOTO_OUTBOX_KEY, [])
const setObjectPhotoOutbox = (items: ObjectPhotoOutboxItem[]) =>
  safeJsonSet(OBJECT_PHOTO_OUTBOX_KEY, items)

export const addToObjectPhotoOutbox = (item: Omit<ObjectPhotoOutboxItem, 'id' | 'timestamp'>) => {
  const full: ObjectPhotoOutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getObjectPhotoOutbox()
  box.push(full)
  setObjectPhotoOutbox(box)
  return full
}

export const removeObjectPhotoOutboxItem = (id: string) => {
  setObjectPhotoOutbox(getObjectPhotoOutbox().filter((i) => i.id !== id))
}

export const getCachedObjectDocuments = () => safeJsonParse<unknown[]>(CACHE_KEYS.objectDocuments, [])
export const setCachedObjectDocuments = (data: unknown[]) => safeJsonSet(CACHE_KEYS.objectDocuments, data)

export type ObjectDocumentOutboxItem = {
  id: string
  object_id: string
  tempId: string
  fileBase64: string
  document_type: 'zeichnung' | 'zertifikat' | 'sonstiges'
  title: string | null
  file_name: string | null
  ext: string
  timestamp: string
}

export const getObjectDocumentOutbox = (): ObjectDocumentOutboxItem[] =>
  safeJsonParse<ObjectDocumentOutboxItem[]>(OBJECT_DOCUMENT_OUTBOX_KEY, [])
const setObjectDocumentOutbox = (items: ObjectDocumentOutboxItem[]) =>
  safeJsonSet(OBJECT_DOCUMENT_OUTBOX_KEY, items)

export const addToObjectDocumentOutbox = (item: Omit<ObjectDocumentOutboxItem, 'id' | 'timestamp'>) => {
  const full: ObjectDocumentOutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getObjectDocumentOutbox()
  box.push(full)
  setObjectDocumentOutbox(box)
  return full
}

export const removeObjectDocumentOutboxItem = (id: string) => {
  setObjectDocumentOutbox(getObjectDocumentOutbox().filter((i) => i.id !== id))
}

export type MaintenancePhotoOutboxItem = {
  id: string
  report_id: string
  tempId: string
  fileBase64: string
  caption: string | null
  ext: string
  timestamp: string
}

export const getMaintenancePhotoOutbox = (): MaintenancePhotoOutboxItem[] =>
  safeJsonParse<MaintenancePhotoOutboxItem[]>(MAINTENANCE_PHOTO_OUTBOX_KEY, [])
const setMaintenancePhotoOutbox = (items: MaintenancePhotoOutboxItem[]) =>
  safeJsonSet(MAINTENANCE_PHOTO_OUTBOX_KEY, items)

export const addToMaintenancePhotoOutbox = (item: Omit<MaintenancePhotoOutboxItem, 'id' | 'timestamp'>) => {
  const full: MaintenancePhotoOutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getMaintenancePhotoOutbox()
  box.push(full)
  setMaintenancePhotoOutbox(box)
  return full
}

export const removeMaintenancePhotoOutboxItem = (id: string) => {
  setMaintenancePhotoOutbox(getMaintenancePhotoOutbox().filter((i) => i.id !== id))
}

export const getCachedMaintenancePhotos = () => safeJsonParse<unknown[]>(CACHE_KEYS.maintenancePhotos, [])
export const setCachedMaintenancePhotos = (data: unknown[]) => safeJsonSet(CACHE_KEYS.maintenancePhotos, data)

export const getCachedReminders = () => safeJsonParse<unknown[]>(CACHE_KEYS.reminders, [])
export const setCachedReminders = (data: unknown[]) => safeJsonSet(CACHE_KEYS.reminders, data)

export const getCachedComponentSettings = () =>
  safeJsonParse<Record<string, boolean>>(CACHE_KEYS.componentSettings, {})
export const setCachedComponentSettings = (data: Record<string, boolean>) =>
  safeJsonSet(CACHE_KEYS.componentSettings, data)

export const getCachedLicense = () => safeJsonParse<unknown | null>(CACHE_KEYS.license, null)
export const setCachedLicense = (data: unknown | null) => safeJsonSet(CACHE_KEYS.license, data)

export const getCachedProfiles = () => safeJsonParse<unknown[]>(CACHE_KEYS.profiles, [])
export const setCachedProfiles = (data: unknown[]) => safeJsonSet(CACHE_KEYS.profiles, data)

export const getCachedAuditLog = () => safeJsonParse<unknown[]>(CACHE_KEYS.auditLog, [])
export const setCachedAuditLog = (data: unknown[]) => safeJsonSet(CACHE_KEYS.auditLog, data)

export const getCachedTimeEntries = () => safeJsonParse<unknown[]>(CACHE_KEYS.timeEntries, [])
export const setCachedTimeEntries = (data: unknown[]) => safeJsonSet(CACHE_KEYS.timeEntries, data)

export type TimeOutboxItem = {
  id: string
  tempId: string
  user_id: string
  date: string
  start: string
  end: string | null
  breaks: { start: string; end: string | null }[]
  timestamp: string
}

export const getTimeOutbox = (): TimeOutboxItem[] =>
  safeJsonParse<TimeOutboxItem[]>(TIME_OUTBOX_KEY, [])
const setTimeOutbox = (items: TimeOutboxItem[]) => safeJsonSet(TIME_OUTBOX_KEY, items)

export const addToTimeOutbox = (item: Omit<TimeOutboxItem, 'id' | 'timestamp'>) => {
  const full: TimeOutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getTimeOutbox()
  box.push(full)
  setTimeOutbox(box)
  return full
}

export const removeTimeOutboxItem = (id: string) => {
  setTimeOutbox(getTimeOutbox().filter((i) => i.id !== id))
}

export const updateTimeOutboxItem = (tempId: string, updater: (item: TimeOutboxItem) => TimeOutboxItem) => {
  const box = getTimeOutbox()
  const idx = box.findIndex((o) => o.tempId === tempId)
  if (idx < 0) return
  box[idx] = updater(box[idx])
  setTimeOutbox(box)
}

export const getCachedMaintenanceReports = (objectId: string): unknown[] => {
  const map = safeJsonParse<Record<string, unknown[]>>(CACHE_KEYS.maintenanceReports, {})
  return map[objectId] ?? []
}
export const setCachedMaintenanceReports = (objectId: string, reports: unknown[]) => {
  const map = safeJsonParse<Record<string, unknown[]>>(CACHE_KEYS.maintenanceReports, {})
  map[objectId] = reports
  safeJsonSet(CACHE_KEYS.maintenanceReports, map)
}

export const getMaintenanceOutbox = (): MaintenanceOutboxItem[] =>
  safeJsonParse<MaintenanceOutboxItem[]>(MAINTENANCE_OUTBOX_KEY, [])
const setMaintenanceOutbox = (items: MaintenanceOutboxItem[]) =>
  safeJsonSet(MAINTENANCE_OUTBOX_KEY, items)

export const addToMaintenanceOutbox = (item: Omit<MaintenanceOutboxItem, 'id' | 'timestamp'>) => {
  const full: MaintenanceOutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getMaintenanceOutbox()
  box.push(full)
  setMaintenanceOutbox(box)
  return full.id
}

export const removeMaintenanceOutboxItem = (id: string) => {
  setMaintenanceOutbox(getMaintenanceOutbox().filter((i) => i.id !== id))
}

export const getOutbox = (): OutboxItem[] => safeJsonParse<OutboxItem[]>(OUTBOX_KEY, [])
export const setOutbox = (items: OutboxItem[]) => safeJsonSet(OUTBOX_KEY, items)

export const addToOutbox = (item: Omit<OutboxItem, 'id' | 'timestamp'>) => {
  const full: OutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getOutbox()
  box.push(full)
  setOutbox(box)
  return full.id
}

export const removeOutboxItem = (id: string) => {
  setOutbox(getOutbox().filter((i) => i.id !== id))
}

export const clearOutbox = () => setOutbox([])

export type EmailOutboxItem = {
  id: string
  reportId: string
  pdfBase64: string
  toEmail: string
  subject: string
  filename: string
  timestamp: string
}

export const getEmailOutbox = (): EmailOutboxItem[] =>
  safeJsonParse<EmailOutboxItem[]>(EMAIL_OUTBOX_KEY, [])
const setEmailOutbox = (items: EmailOutboxItem[]) => safeJsonSet(EMAIL_OUTBOX_KEY, items)

export const addToEmailOutbox = (item: Omit<EmailOutboxItem, 'id' | 'timestamp'>) => {
  const full: EmailOutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getEmailOutbox()
  box.push(full)
  setEmailOutbox(box)
  return full.id
}

export const removeEmailOutboxItem = (id: string) => {
  setEmailOutbox(getEmailOutbox().filter((i) => i.id !== id))
}
