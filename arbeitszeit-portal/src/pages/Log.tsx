import { useState, useEffect, useCallback } from 'react'
import { fetchTimeEntryEditLog } from '../lib/timeService'
import { fetchProfiles, getProfileDisplayName, type Profile } from '../lib/userService'
import type { TimeEntryEditLogRow } from '../types/time'
import { formatTime, formatDateShort, formatDateTimeShort } from '../../../shared/format'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

const Log = () => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [logEntries, setLogEntries] = useState<TimeEntryEditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterUserId, setFilterUserId] = useState<string>('')

  const profilesWithZeiterfassung = profiles.filter((p) => p.role !== 'leser' && p.role !== 'kunde')

  const fetchLog = useCallback(() => {
    setLoading(true)
    const filters = {
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
      entryUserId: filterUserId || undefined,
    }
    fetchTimeEntryEditLog(pageSize, page * pageSize, filters).then((data) => {
      setLogEntries(data)
      setLoading(false)
    })
  }, [page, pageSize, dateFrom, dateTo, filterUserId])

  useEffect(() => {
    fetchProfiles().then(setProfiles)
  }, [])

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  const handleResetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setFilterUserId('')
    setPage(0)
  }

  const getEntryUserDisplayName = (entryUserId: string): string => {
    const p = profiles.find((x) => x.id === entryUserId)
    return p ? getProfileDisplayName(p) : '(Unbekannt)'
  }

  const hasNextPage = logEntries.length >= pageSize
  const hasPrevPage = page > 0
  const hasActiveFilters = dateFrom !== '' || dateTo !== '' || filterUserId !== ''

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Bearbeitungslog</h2>

      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
        <div>
          <label htmlFor="log-date-from" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Von (Eintrag-Datum)
          </label>
          <input
            id="log-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(0)
            }}
            className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
            aria-label="Filter von Datum"
          />
        </div>
        <div>
          <label htmlFor="log-date-to" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Bis (Eintrag-Datum)
          </label>
          <input
            id="log-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(0)
            }}
            className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
            aria-label="Filter bis Datum"
          />
        </div>
        <div>
          <label htmlFor="log-user" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Benutzer
          </label>
          <select
            id="log-user"
            value={filterUserId}
            onChange={(e) => {
              setFilterUserId(e.target.value)
              setPage(0)
            }}
            className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm min-w-[10rem]"
            aria-label="Filter nach Benutzer"
          >
            <option value="">Alle</option>
            {profilesWithZeiterfassung.map((p) => (
              <option key={p.id} value={p.id}>
                {getProfileDisplayName(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="log-page-size" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Einträge pro Seite
          </label>
          <select
            id="log-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(0)
            }}
            className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
            aria-label="Einträge pro Seite"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm"
            aria-label="Filter zurücksetzen"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Lade…</p>
      ) : logEntries.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Keine Bearbeitungen in diesem Filter / dieser Seite.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Bearbeitet am</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Eintrag (Datum / Benutzer)</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Vorher</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Nachher</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Grund</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Bearbeitet von</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDateTimeShort(row.edited_at)}
                    </td>
                    <td className="py-2 px-2">
                      {formatDateShort(row.entry_date)}
                      <br />
                      <span className="text-slate-500 dark:text-slate-400 text-xs">{getEntryUserDisplayName(row.entry_user_id)}</span>
                    </td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300">
                      {row.old_start != null ? (
                        <>
                          {formatTime(row.old_start)}
                          {row.old_end != null ? ` – ${formatTime(row.old_end)}` : ' – …'}
                        </>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">— (Neuanlage)</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-slate-700 dark:text-slate-300">
                      {formatTime(row.new_start)}
                      {row.new_end != null ? ` – ${formatTime(row.new_end)}` : ' – …'}
                    </td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300 max-w-[12rem]">{row.reason}</td>
                    <td className="py-2 px-2 text-slate-500 dark:text-slate-400">{row.editor_display_name ?? '(Unbekannt)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2">
            <span className="text-sm text-slate-600 dark:text-slate-300">Seite {page + 1}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!hasPrevPage}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                aria-label="Vorherige Seite"
              >
                Vorherige
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNextPage}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                aria-label="Nächste Seite"
              >
                Nächste
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Log
