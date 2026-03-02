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
