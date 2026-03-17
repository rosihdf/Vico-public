/**
 * Ladezeiten-Metriken für J9 Performance-Dashboard.
 * Speichert Sync- und Startseiten-Ladezeiten in localStorage.
 */

const STORAGE_KEY = 'vico-performance-metrics'
const MAX_ENTRIES = 50

export type PerformanceMetric = {
  ts: number
  type: 'sync'
  batch1Ms: number
  batch2Ms: number
  totalMs: number
  pushMs?: number
}

export type StartseiteMetric = {
  ts: number
  type: 'startseite'
  loadDataMs: number
}

export type MetricEntry = PerformanceMetric | StartseiteMetric

const loadEntries = (): MetricEntry[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveEntries = (entries: MetricEntry[]): void => {
  if (typeof window === 'undefined') return
  try {
    const trimmed = entries.slice(-MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore
  }
}

export const recordSyncMetrics = (params: {
  batch1Ms: number
  batch2Ms: number
  totalMs: number
  pushMs?: number
}): void => {
  const entries = loadEntries()
  entries.push({
    ts: Date.now(),
    type: 'sync',
    batch1Ms: params.batch1Ms,
    batch2Ms: params.batch2Ms,
    totalMs: params.totalMs,
    pushMs: params.pushMs,
  })
  saveEntries(entries)
}

export const recordStartseiteMetrics = (loadDataMs: number): void => {
  const entries = loadEntries()
  entries.push({
    ts: Date.now(),
    type: 'startseite',
    loadDataMs,
  })
  saveEntries(entries)
}

export const getPerformanceMetrics = (): MetricEntry[] => loadEntries()

export const clearPerformanceMetrics = (): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
