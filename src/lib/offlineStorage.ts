const CACHE_PREFIX = 'vico-cache-'
const OUTBOX_KEY = 'vico-outbox'
const MAINTENANCE_OUTBOX_KEY = 'vico-outbox-maintenance'
const OBJECT_PHOTO_OUTBOX_KEY = 'vico-outbox-object-photos'
const MAINTENANCE_PHOTO_OUTBOX_KEY = 'vico-outbox-maintenance-photos'
const CACHE_KEYS = {
  customers: `${CACHE_PREFIX}customers`,
  bvs: `${CACHE_PREFIX}bvs`,
  objects: `${CACHE_PREFIX}objects`,
  maintenanceReports: `${CACHE_PREFIX}maintenance-reports`,
  orders: `${CACHE_PREFIX}orders`,
  objectPhotos: `${CACHE_PREFIX}object-photos`,
  maintenancePhotos: `${CACHE_PREFIX}maintenance-photos`,
  reminders: `${CACHE_PREFIX}reminders`,
  componentSettings: `${CACHE_PREFIX}component-settings`,
} as const

export type OutboxAction = 'insert' | 'update' | 'delete'

export type OutboxItem = {
  id: string
  table: 'customers' | 'bvs' | 'objects' | 'orders' | 'object_photos' | 'maintenance_report_photos' | 'component_settings'
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
