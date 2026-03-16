import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { LoadingSpinner } from './components/LoadingSpinner'
import { fetchAuditLog, fetchAuditLogDetail, type AuditLogEntry } from './lib/dataService'

const TABLE_LABELS: Record<string, string> = {
  customers: 'Kunden',
  bvs: 'Objekt/BV',
  objects: 'Tür/Tor',
  orders: 'Aufträge',
  order_completions: 'Monteursbericht',
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
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailEntry, setDetailEntry] = useState<AuditLogEntry | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const pageSize = 200

  const handleRowClick = useCallback(async (entry: AuditLogEntry) => {
    if (detailId === entry.id) {
      setDetailId(null)
      setDetailEntry(null)
      return
    }
    setDetailId(entry.id)
    setDetailLoading(true)
    const d = await fetchAuditLogDetail(entry.id)
    setDetailEntry(d ?? null)
    setDetailLoading(false)
  }, [detailId])

  const loadLog = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchAuditLog(pageSize)
    setEntries(data)
    setOffset(data.length)
    setHasMore(data.length === pageSize)
    setIsLoading(false)
  }, [])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    const data = await fetchAuditLog(pageSize, offset)
    if (data.length > 0) {
      setEntries((prev) => [...prev, ...data])
      setOffset((prev) => prev + data.length)
      setHasMore(data.length === pageSize)
    } else {
      setHasMore(false)
    }
    setIsLoadingMore(false)
  }, [offset, hasMore, isLoadingMore])

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
        <LoadingSpinner message="Lade Historie…" className="py-8" />
      ) : entries.length === 0 ? (
        <p className="text-slate-600 py-8 text-center">Noch keine Einträge in der Historie.</p>
      ) : (
        <>
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
                    <React.Fragment key={e.id}>
                      <tr
                        onClick={() => handleRowClick(e)}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(ev) => ev.key === 'Enter' && handleRowClick(e)}
                        aria-label={`Details anzeigen für Eintrag ${formatDate(e.created_at)}`}
                      >
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
                      {detailId === e.id && (
                        <tr key={`${e.id}-detail`} className="bg-slate-50 border-b border-slate-200">
                          <td colSpan={5} className="py-3 px-4">
                            {detailLoading ? (
                              <LoadingSpinner message="Details…" size="sm" className="py-2" />
                            ) : detailEntry ? (
                              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <dt className="text-slate-500">Zeit</dt>
                                <dd className="text-slate-800">{formatDate(detailEntry.created_at)}</dd>
                                <dt className="text-slate-500">Benutzer</dt>
                                <dd className="text-slate-800">{(detailEntry as { user_name?: string }).user_name || detailEntry.user_email || '–'}</dd>
                                <dt className="text-slate-500">E-Mail</dt>
                                <dd className="text-slate-800">{detailEntry.user_email || '–'}</dd>
                                <dt className="text-slate-500">Aktion</dt>
                                <dd className="text-slate-800">{ACTION_LABELS[detailEntry.action] ?? detailEntry.action}</dd>
                                <dt className="text-slate-500">Tabelle</dt>
                                <dd className="text-slate-800">{TABLE_LABELS[detailEntry.table_name] ?? detailEntry.table_name}</dd>
                                <dt className="text-slate-500">Datensatz-ID</dt>
                                <dd className="text-slate-800 font-mono text-xs break-all">{detailEntry.record_id || '–'}</dd>
                              </dl>
                            ) : (
                              <p className="text-slate-500">Details nicht geladen.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
                aria-label="Ältere Einträge laden"
              >
                {isLoadingMore ? 'Lade…' : 'Ältere Einträge laden'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Historie
