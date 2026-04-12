import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchReleaseAuditLog, type ReleaseAuditLogFilters } from '../lib/mandantenReleaseService'

const ACTION_OPTIONS = [
  { value: '', label: 'Alle Aktionen' },
  { value: 'release.assign_active', label: 'Zuweisung (Go-Live)' },
  { value: 'release.rollback', label: 'Rollback' },
  { value: 'release.deploy_triggered', label: 'Deploy angestoßen' },
]

const ReleaseAudit = () => {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const f: ReleaseAuditLogFilters = {}
      if (action.trim()) f.action = action.trim()
      if (fromDate.trim()) f.fromDate = fromDate.trim()
      if (toDate.trim()) f.toDate = toDate.trim()
      const data = await fetchReleaseAuditLog(200, f)
      setRows(data as Record<string, unknown>[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [action, fromDate, toDate])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Release-Audit</h1>
          <p className="text-sm text-slate-500 mt-1">
            Protokolleinträge aus <code className="text-xs bg-slate-100 px-1 rounded">release_audit_log</code>.
          </p>
        </div>
        <Link
          to="/release-rollout"
          className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
        >
          Update-Assistent
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="audit-action" className="block text-xs font-medium text-slate-600 mb-1">
            Aktion
          </label>
          <select
            id="audit-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm min-w-[14rem]"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-from" className="block text-xs font-medium text-slate-600 mb-1">
            Von (Datum)
          </label>
          <input
            id="audit-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label htmlFor="audit-to" className="block text-xs font-medium text-slate-600 mb-1">
            Bis (Datum)
          </label>
          <input
            id="audit-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-vico-primary text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Lade…' : 'Aktualisieren'}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3" role="alert">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-700">Zeit</th>
              <th className="text-left px-3 py-2 font-medium text-slate-700">Aktion</th>
              <th className="text-left px-3 py-2 font-medium text-slate-700">Mandant</th>
              <th className="text-left px-3 py-2 font-medium text-slate-700">Kanal</th>
              <th className="text-left px-3 py-2 font-medium text-slate-700">Release</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Keine Einträge.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const id = String(r.id ?? i)
                return (
                  <tr key={id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {r.created_at != null ? String(r.created_at) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{String(r.action ?? '—')}</td>
                    <td className="px-3 py-2 font-mono text-xs max-w-[10rem] truncate">
                      {r.tenant_id != null ? String(r.tenant_id) : '—'}
                    </td>
                    <td className="px-3 py-2">{r.channel != null ? String(r.channel) : '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs max-w-[12rem] truncate">
                      {r.release_id != null ? String(r.release_id) : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ReleaseAudit
