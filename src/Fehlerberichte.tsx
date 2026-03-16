import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'
import { LoadingSpinner } from './components/LoadingSpinner'

export type AppErrorRow = {
  id: string
  user_id: string | null
  source: string
  message: string
  stack: string | null
  path: string | null
  user_agent: string | null
  created_at: string
  status: string
}

const SOURCE_LABELS: Record<string, string> = {
  main_app: 'Haupt-App',
  portal: 'Portal',
  admin: 'Admin',
  zeiterfassung: 'Zeiterfassung',
  arbeitszeit_portal: 'Arbeitszeitenportal',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  acknowledged: 'Angesehen',
  resolved: 'Behoben',
}

import { formatDateTimeShort } from '../shared/format'

const formatDate = formatDateTimeShort

const Fehlerberichte = () => {
  const { userRole } = useAuth()
  const [list, setList] = useState<AppErrorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterSource, setFilterSource] = useState<string>('')
  const [detail, setDetail] = useState<AppErrorRow | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!detail) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetail(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [detail])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('app_errors')
      .select('id, user_id, source, message, path, user_agent, created_at, status, stack')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filterStatus) {
      q = q.eq('status', filterStatus)
    }
    if (filterSource) {
      q = q.eq('source', filterSource)
    }
    const { data, error } = await q
    setLoading(false)
    if (error) {
      setList([])
      return
    }
    setList((data ?? []) as AppErrorRow[])
  }, [filterStatus, filterSource])

  useEffect(() => {
    load()
  }, [load])

  const handleStatusUpdate = async (id: string, status: 'new' | 'acknowledged' | 'resolved') => {
    setUpdatingId(id)
    await supabase.from('app_errors').update({ status }).eq('id', id)
    setList((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
    if (detail?.id === id) {
      setDetail((d) => (d?.id === id ? { ...d, status } : d))
    }
    setUpdatingId(null)
  }

  if (userRole !== 'admin') {
    return (
      <div className="p-4 max-w-xl">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Fehlerberichte</h2>
        <p className="text-slate-600 dark:text-slate-400">Nur für Administratoren sichtbar.</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-4xl">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Fehlerberichte</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Automatisch erfasste Fehler aus der App (JavaScript-Fehler, abgelehnte Promises, React Error Boundary).
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label htmlFor="filter-status" className="block text-xs text-slate-500 mb-1">
            Status
          </label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 text-sm"
            aria-label="Status filtern"
          >
            <option value="">Alle</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-source" className="block text-xs text-slate-500 mb-1">
            Quelle
          </label>
          <select
            id="filter-source"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 text-sm"
            aria-label="Quelle filtern"
          >
            <option value="">Alle</option>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => { setFilterStatus(''); setFilterSource('') }}
          className="self-end px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Filter zurücksetzen"
        >
          Zurücksetzen
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Lade Fehlerberichte…" size="md" className="py-8" />
      ) : list.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Keine Einträge.</p>
      ) : (
        <ul className="space-y-2" aria-label="Fehlerliste">
          {list.map((e) => (
            <li
              key={e.id}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer hover:border-vico-primary transition-colors"
              onClick={() => setDetail(e)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  setDetail(e)
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Fehler vom ${formatDate(e.created_at)}: ${e.message.slice(0, 50)}…`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">{formatDate(e.created_at)}</span>
                <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {SOURCE_LABELS[e.source] ?? e.source}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {STATUS_LABELS[e.status] ?? e.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 line-clamp-2">{e.message}</p>
              {e.path && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate" title={e.path}>
                  {e.path}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fehler-detail-title"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-w-2xl w-full max-h-[90vh] overflow-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="fehler-detail-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Fehlerdetails
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {formatDate(detail.created_at)} · {SOURCE_LABELS[detail.source] ?? detail.source} · {STATUS_LABELS[detail.status]}
            </p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Meldung</p>
            <pre className="mb-4 p-3 rounded bg-slate-100 dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words overflow-x-auto">
              {detail.message}
            </pre>
            {detail.path && (
              <>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Pfad</p>
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-300 break-all">{detail.path}</p>
              </>
            )}
            {detail.stack && (
              <>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Stack</p>
                <pre className="mb-4 p-3 rounded bg-slate-100 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words overflow-x-auto max-h-40">
                  {detail.stack}
                </pre>
              </>
            )}
            {detail.user_agent && (
              <>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">User-Agent</p>
                <p className="mb-4 text-xs text-slate-600 dark:text-slate-400 break-all">{detail.user_agent}</p>
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-600">
              {detail.status !== 'acknowledged' && (
                <button
                  type="button"
                  onClick={() => handleStatusUpdate(detail.id, 'acknowledged')}
                  disabled={updatingId === detail.id}
                  className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-500 disabled:opacity-50"
                  aria-label="Als angesehen markieren"
                >
                  Als angesehen
                </button>
              )}
              {detail.status !== 'resolved' && (
                <button
                  type="button"
                  onClick={() => handleStatusUpdate(detail.id, 'resolved')}
                  disabled={updatingId === detail.id}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  aria-label="Als behoben markieren"
                >
                  Als behoben
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Schließen"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Fehlerberichte
