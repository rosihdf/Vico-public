import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_PREFIX = 'vico-cache-'
const OUTBOX_KEY = 'vico-outbox'
const MAINTENANCE_OUTBOX_KEY = 'vico-outbox-maintenance'
const OBJECT_PHOTO_OUTBOX_KEY = 'vico-outbox-object-photos'
const CACHE_KEYS = {
  customers: `${CACHE_PREFIX}customers`,
  bvs: `${CACHE_PREFIX}bvs`,
  objects: `${CACHE_PREFIX}objects`,
  maintenanceReports: `${CACHE_PREFIX}maintenance-reports`,
  orders: `${CACHE_PREFIX}orders`,
  objectPhotos: `${CACHE_PREFIX}object-photos`,
  reminders: `${CACHE_PREFIX}reminders`,
} as const

export type OutboxAction = 'insert' | 'update' | 'delete'

export type OutboxItem = {
  id: string
  table: 'customers' | 'bvs' | 'objects' | 'orders' | 'object_photos'
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

const memoryCache: Record<string, string> = {}
let isInitialized = false

const safeJsonParse = <T>(key: string, fallback: T): T => {
  try {
    const raw = memoryCache[key]
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const persist = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value)
  } catch (e) {
    console.warn('offlineStorage: persist failed', e)
  }
}

/** Muss beim App-Start vor Nutzung des Offline-Storages aufgerufen werden. */
export const initOfflineStorage = async (): Promise<void> => {
  if (isInitialized) return
  try {
    const keys = [
      CACHE_KEYS.customers,
      CACHE_KEYS.bvs,
      CACHE_KEYS.objects,
      CACHE_KEYS.maintenanceReports,
      CACHE_KEYS.orders,
      CACHE_KEYS.objectPhotos,
      CACHE_KEYS.reminders,
      OUTBOX_KEY,
      MAINTENANCE_OUTBOX_KEY,
      OBJECT_PHOTO_OUTBOX_KEY,
    ]
    const values = await AsyncStorage.multiGet(keys)
    values.forEach(([key, val]) => {
      if (key && val != null) memoryCache[key] = val
    })
    isInitialized = true
  } catch (e) {
    console.warn('offlineStorage: init failed', e)
    isInitialized = true
  }
}

/** Gibt an, ob init bereits durchgeführt wurde (für Tests). */
export const isOfflineStorageReady = () => isInitialized

export const getCachedCustomers = () => safeJsonParse<unknown[]>(CACHE_KEYS.customers, [])
export const setCachedCustomers = async (data: unknown[]): Promise<void> => {
  const str = JSON.stringify(data)
  memoryCache[CACHE_KEYS.customers] = str
  await persist(CACHE_KEYS.customers, str)
}

export const getCachedBvs = () => safeJsonParse<unknown[]>(CACHE_KEYS.bvs, [])
export const setCachedBvs = async (data: unknown[]): Promise<void> => {
  const str = JSON.stringify(data)
  memoryCache[CACHE_KEYS.bvs] = str
  await persist(CACHE_KEYS.bvs, str)
}

export const getCachedObjects = () => safeJsonParse<unknown[]>(CACHE_KEYS.objects, [])
export const setCachedObjects = async (data: unknown[]): Promise<void> => {
  const str = JSON.stringify(data)
  memoryCache[CACHE_KEYS.objects] = str
  await persist(CACHE_KEYS.objects, str)
}

export const getCachedMaintenanceReports = (objectId: string): unknown[] => {
  const map = safeJsonParse<Record<string, unknown[]>>(CACHE_KEYS.maintenanceReports, {})
  return map[objectId] ?? []
}
export const getCachedOrders = () => safeJsonParse<unknown[]>(CACHE_KEYS.orders, [])
export const setCachedOrders = async (data: unknown[]): Promise<void> => {
  const str = JSON.stringify(data)
  memoryCache[CACHE_KEYS.orders] = str
  await persist(CACHE_KEYS.orders, str)
}

export const getCachedObjectPhotos = () => safeJsonParse<unknown[]>(CACHE_KEYS.objectPhotos, [])
export const setCachedObjectPhotos = async (data: unknown[]): Promise<void> => {
  const str = JSON.stringify(data)
  memoryCache[CACHE_KEYS.objectPhotos] = str
  await persist(CACHE_KEYS.objectPhotos, str)
}

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
const setObjectPhotoOutbox = async (items: ObjectPhotoOutboxItem[]): Promise<void> => {
  const str = JSON.stringify(items)
  memoryCache[OBJECT_PHOTO_OUTBOX_KEY] = str
  await persist(OBJECT_PHOTO_OUTBOX_KEY, str)
}

export const addToObjectPhotoOutbox = async (
  item: Omit<ObjectPhotoOutboxItem, 'id' | 'timestamp'>
): Promise<ObjectPhotoOutboxItem> => {
  const full: ObjectPhotoOutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getObjectPhotoOutbox()
  box.push(full)
  await setObjectPhotoOutbox(box)
  return full
}

export const removeObjectPhotoOutboxItem = async (id: string): Promise<void> => {
  await setObjectPhotoOutbox(getObjectPhotoOutbox().filter((i) => i.id !== id))
}

export const getCachedReminders = () => safeJsonParse<unknown[]>(CACHE_KEYS.reminders, [])
export const setCachedReminders = async (data: unknown[]): Promise<void> => {
  const str = JSON.stringify(data)
  memoryCache[CACHE_KEYS.reminders] = str
  await persist(CACHE_KEYS.reminders, str)
}

export const setCachedMaintenanceReports = async (
  objectId: string,
  reports: unknown[]
): Promise<void> => {
  const map = safeJsonParse<Record<string, unknown[]>>(CACHE_KEYS.maintenanceReports, {})
  map[objectId] = reports
  const str = JSON.stringify(map)
  memoryCache[CACHE_KEYS.maintenanceReports] = str
  await persist(CACHE_KEYS.maintenanceReports, str)
}

export const getMaintenanceOutbox = (): MaintenanceOutboxItem[] =>
  safeJsonParse<MaintenanceOutboxItem[]>(MAINTENANCE_OUTBOX_KEY, [])
const setMaintenanceOutbox = async (items: MaintenanceOutboxItem[]): Promise<void> => {
  const str = JSON.stringify(items)
  memoryCache[MAINTENANCE_OUTBOX_KEY] = str
  await persist(MAINTENANCE_OUTBOX_KEY, str)
}

export const addToMaintenanceOutbox = async (
  item: Omit<MaintenanceOutboxItem, 'id' | 'timestamp'>
): Promise<string> => {
  const full: MaintenanceOutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getMaintenanceOutbox()
  box.push(full)
  await setMaintenanceOutbox(box)
  return full.id
}

export const removeMaintenanceOutboxItem = async (id: string): Promise<void> => {
  await setMaintenanceOutbox(getMaintenanceOutbox().filter((i) => i.id !== id))
}

export const getOutbox = (): OutboxItem[] => safeJsonParse<OutboxItem[]>(OUTBOX_KEY, [])
export const setOutbox = async (items: OutboxItem[]): Promise<void> => {
  const str = JSON.stringify(items)
  memoryCache[OUTBOX_KEY] = str
  await persist(OUTBOX_KEY, str)
}

export const addToOutbox = async (
  item: Omit<OutboxItem, 'id' | 'timestamp'>
): Promise<string> => {
  const full: OutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  const box = getOutbox()
  box.push(full)
  await setOutbox(box)
  return full.id
}

export const removeOutboxItem = async (id: string): Promise<void> => {
  await setOutbox(getOutbox().filter((i) => i.id !== id))
}

export const clearOutbox = async (): Promise<void> => setOutbox([])
