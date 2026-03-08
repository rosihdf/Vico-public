import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { fetchAuditLog, type AuditLogEntry } from './lib/dataService'

const TABLE_LABELS: Record<string, string> = {
  customers: 'Kunden',
  bvs: 'BVs',
  objects: 'Objekte',
  orders: 'Aufträge',
  profiles: 'Profile',
  maintenance_reports: 'Wartungsprotokolle',
  maintenance_report_photos: 'Wartungsfotos',
  maintenance_report_smoke_detectors: 'Rauchmelder',
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Angelegt',
  insert: 'Angelegt',
  UPDATE: 'Geändert',
  update: 'Geändert',
  DELETE: 'Gelöscht',
  delete: 'Gelöscht',
}

const formatDate = (iso: string) => {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const Historie = () => {
  const { userRole } = useAuth()
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadLog = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchAuditLog()
    setEntries(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadLog()
  }, [loadLog])

  if (userRole !== 'admin') {
    return (
      <div className="p-4">
        <p className="text-slate-600">Zugriff nur für Admins.</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Historie</h2>
        <button
          type="button"
          onClick={loadLog}
          disabled={isLoading}
          className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
          aria-label="Historie aktualisieren"
        >
          Aktualisieren
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-600">Lade Historie…</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-600 py-8 text-center">Noch keine Einträge in der Historie.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Zeit</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Benutzer</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Aktion</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Tabelle</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Datensatz</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-4 text-slate-600 whitespace-nowrap">
                      {formatDate(e.created_at)}
                    </td>
                    <td className="py-2 px-4 text-slate-700">
                      {e.user_email || '–'}
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          (e.action === 'INSERT' || e.action === 'insert')
                            ? 'bg-green-100 text-green-800'
                            : (e.action === 'UPDATE' || e.action === 'update')
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-slate-700">
                      {TABLE_LABELS[e.table_name] ?? e.table_name}
                    </td>
                    <td className="py-2 px-4 text-slate-500 font-mono text-xs">
                      {e.record_id ? e.record_id.slice(0, 8) + '…' : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Historie
