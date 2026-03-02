import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_PREFIX = 'vico-cache-'
const OUTBOX_KEY = 'vico-outbox'
const CACHE_KEYS = {
  customers: `${CACHE_PREFIX}customers`,
  bvs: `${CACHE_PREFIX}bvs`,
  objects: `${CACHE_PREFIX}objects`,
} as const

export type OutboxAction = 'insert' | 'update' | 'delete'

export type OutboxItem = {
  id: string
  table: 'customers' | 'bvs' | 'objects'
  action: OutboxAction
  payload: Record<string, unknown>
  tempId?: string
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
    const keys = [CACHE_KEYS.customers, CACHE_KEYS.bvs, CACHE_KEYS.objects, OUTBOX_KEY]
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
