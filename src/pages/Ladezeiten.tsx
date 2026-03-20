/**
 * J9: Ladezeiten-Monitoring / Performance-Dashboard
 * Zeigt Sync- und Startseiten-Ladezeiten (nur Admin).
 */
import { useState, useEffect, useCallback } from 'react'
import {
  getPerformanceMetrics,
  clearPerformanceMetrics,
  type MetricEntry,
  type PerformanceMetric,
  type StartseiteMetric,
} from '../lib/performanceMetricsService'
import { formatTimeFromTs, formatDateFromTs } from '../../shared/format'

const Bar = ({ value, max, label }: { value: number; max: number; label: string }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
        <div
          className="h-full bg-vico-primary rounded transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`${label}: ${value} ms`}
        />
      </div>
      <span className="w-14 text-xs font-medium text-slate-700 dark:text-slate-300 text-right shrink-0">
        {value} ms
      </span>
    </div>
  )
}

const SyncMetricRow = ({ m }: { m: PerformanceMetric }) => {
  const max = Math.max(m.batch1Ms, m.batch2Ms, m.totalMs, m.pushMs ?? 0, 1)
  return (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {formatDateFromTs(m.ts)} {formatTimeFromTs(m.ts)}
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.totalMs} ms gesamt</span>
      </div>
      <div className="space-y-1.5">
        <Bar value={m.batch1Ms} max={max} label="Batch1" />
        <Bar value={m.batch2Ms} max={max} label="Batch2" />
        {m.pushMs != null && <Bar value={m.pushMs} max={max} label="Push" />}
      </div>
    </div>
  )
}

const StartseiteMetricRow = ({ m }: { m: StartseiteMetric }) => (
  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-between">
    <span className="text-xs text-slate-500 dark:text-slate-400">
      {formatDateFromTs(m.ts)} {formatTimeFromTs(m.ts)}
    </span>
    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.loadDataMs} ms</span>
  </div>
)

const Ladezeiten = () => {
  const [metrics, setMetrics] = useState<MetricEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'sync' | 'startseite'>('all')

  const load = useCallback(() => {
    setMetrics(getPerformanceMetrics())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleClear = () => {
    if (confirm('Alle gespeicherten Ladezeiten-Metriken löschen?')) {
      clearPerformanceMetrics()
      load()
    }
  }

  const filtered = metrics.filter((m) => {
    if (filter === 'sync') return m.type === 'sync'
    if (filter === 'startseite') return m.type === 'startseite'
    return true
  })

  const syncMetrics = filtered.filter((m): m is PerformanceMetric => m.type === 'sync')
  const startseiteMetrics = filtered.filter((m): m is StartseiteMetric => m.type === 'startseite')

  const latestSync = syncMetrics[syncMetrics.length - 1]
  const latestStartseite = startseiteMetrics[startseiteMetrics.length - 1]

  return (
    <div className="p-4 max-w-2xl min-w-0">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Ladezeiten</h2>

      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Sync- und Startseiten-Ladezeiten (nur Admin). Metriken werden lokal gespeichert.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
            filter === 'all'
              ? 'bg-vico-primary text-white'
              : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
          aria-pressed={filter === 'all'}
        >
          Alle
        </button>
        <button
          type="button"
          onClick={() => setFilter('sync')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
            filter === 'sync'
              ? 'bg-vico-primary text-white'
              : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
          aria-pressed={filter === 'sync'}
        >
          Sync
        </button>
        <button
          type="button"
          onClick={() => setFilter('startseite')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
            filter === 'startseite'
              ? 'bg-vico-primary text-white'
              : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
          aria-pressed={filter === 'startseite'}
        >
          Startseite
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="ml-auto px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          aria-label="Metriken löschen"
        >
          Löschen
        </button>
      </div>

      {(latestSync || latestStartseite) && (
        <section
          className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
          aria-label="Letzte Messung"
        >
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Letzte Messung</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            {latestSync && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Sync:</span>{' '}
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  Batch1 {latestSync.batch1Ms} ms, Batch2 {latestSync.batch2Ms} ms, gesamt {latestSync.totalMs} ms
                </span>
              </div>
            )}
            {latestStartseite && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Startseite:</span>{' '}
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {latestStartseite.loadDataMs} ms
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      <section aria-label="Verlauf">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Verlauf ({filtered.length})</h3>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Noch keine Metriken. Startseite laden oder Sync ausführen.
          </p>
        ) : (
          <div className="space-y-3">
            {[...filtered].reverse().map((m, i) => (
              <div key={`${m.ts}-${i}`}>
                {m.type === 'sync' && <SyncMetricRow m={m} />}
                {m.type === 'startseite' && <StartseiteMetricRow m={m} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Ladezeiten
