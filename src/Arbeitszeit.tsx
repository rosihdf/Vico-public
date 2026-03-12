import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { hasFeature } from './lib/licenseService'
import {
  fetchTimeEntriesForUser,
  fetchTimeBreaksForEntry,
  startTimeEntry,
  endTimeEntry,
  startBreak,
  endBreak,
  getActiveEntry,
  getActiveBreak,
  calcWorkMinutes,
} from './lib/timeService'
import { useToast } from './ToastContext'
import type { TimeEntry, TimeBreak } from './types'

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

const formatMinutes = (min: number): string => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${m.toString().padStart(2, '0')} h`
}

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10)

const Arbeitszeit = () => {
  const { user } = useAuth()
  const { license } = useLicense()
  const { showError } = useToast()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [breaksMap, setBreaksMap] = useState<Record<string, TimeBreak[]>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))

  const userId = user?.id ?? ''
  const canUse = license && hasFeature(license, 'arbeitszeiterfassung')

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const data = await fetchTimeEntriesForUser(userId, selectedDate, selectedDate)
    setEntries(data)
    const map: Record<string, TimeBreak[]> = {}
    for (const e of data) {
      map[e.id] = await fetchTimeBreaksForEntry(e.id)
    }
    setBreaksMap(map)
    setLoading(false)
  }, [userId, selectedDate])

  useEffect(() => {
    load()
  }, [load])

  const activeEntry = getActiveEntry(entries)
  const activeBreaks = activeEntry ? breaksMap[activeEntry.id] ?? [] : []
  const activeBreak = activeEntry ? getActiveBreak(activeEntry, activeBreaks) : null
  const todayWorkMinutes = entries.reduce((sum, e) => {
    const breaks = breaksMap[e.id] ?? []
    return sum + calcWorkMinutes(e, breaks)
  }, 0)

  const handleStart = async () => {
    if (!userId || actionLoading) return
    setActionLoading(true)
    const { data, error } = await startTimeEntry(userId)
    setActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    if (data) {
      setEntries((prev) => [data, ...prev])
      setBreaksMap((prev) => ({ ...prev, [data.id]: [] }))
    }
  }

  const handleEnd = async () => {
    if (!activeEntry || actionLoading) return
    setActionLoading(true)
    const { error } = await endTimeEntry(activeEntry.id, userId)
    setActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    setEntries((prev) =>
      prev.map((e) =>
        e.id === activeEntry.id ? { ...e, end: new Date().toISOString() } : e
      )
    )
  }

  const handlePauseStart = async () => {
    if (!activeEntry || actionLoading) return
    setActionLoading(true)
    const { data, error } = await startBreak(activeEntry.id, userId)
    setActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    if (data) {
      setBreaksMap((prev) => ({
        ...prev,
        [activeEntry.id]: [...(prev[activeEntry.id] ?? []), data],
      }))
    }
  }

  const handlePauseEnd = async () => {
    if (!activeEntry || !activeBreak || actionLoading) return
    setActionLoading(true)
    const { error } = await endBreak(activeBreak.id, activeEntry.id, userId)
    setActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    setBreaksMap((prev) => ({
      ...prev,
      [activeEntry.id]: (prev[activeEntry.id] ?? []).map((b) =>
        b.id === activeBreak.id ? { ...b, end: new Date().toISOString() } : b
      ),
    }))
  }

  const arbzgHint = todayWorkMinutes >= 360 && !activeBreak && activeEntry
  const arbzg8h = todayWorkMinutes >= 480

  const now = new Date()
  const hour = now.getHours()
  const forgotToClockOut =
    activeEntry &&
    (todayWorkMinutes >= 600 || hour >= 20)

  if (!canUse) {
    return (
      <div className="p-4 max-w-xl">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
          Arbeitszeiterfassung
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Dieses Modul ist in Ihrer Lizenz nicht aktiviert.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-xl">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
        Arbeitszeiterfassung
      </h2>

      <div className="mb-4">
        <label htmlFor="arbeitszeit-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Datum
        </label>
        <input
          id="arbeitszeit-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          aria-label="Datum auswählen"
        />
      </div>

      {arbzgHint && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm"
        >
          ArbZG §4: Bei mehr als 6 Stunden Arbeitszeit sind mind. 30 Min Pause erforderlich.
        </div>
      )}

      {arbzg8h && (
        <div
          role="status"
          className="mb-4 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm"
        >
          Heute bereits 8 Stunden erfasst (§3 ArbZG).
        </div>
      )}

      {forgotToClockOut && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm"
        >
          Du hast noch nicht Feierabend gebucht. Vergessen?
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {!activeEntry && (
          <button
            type="button"
            onClick={handleStart}
            disabled={actionLoading}
            className="px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            aria-label="Arbeitsbeginn"
          >
            Start
          </button>
        )}
        {activeEntry && !activeBreak && (
          <>
            <button
              type="button"
              onClick={handlePauseStart}
              disabled={actionLoading}
              className="px-6 py-3 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
              aria-label="Pause starten"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={handleEnd}
              disabled={actionLoading}
              className="px-6 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              aria-label="Feierabend"
            >
              Ende
            </button>
          </>
        )}
        {activeEntry && activeBreak && (
          <button
            type="button"
            onClick={handlePauseEnd}
            disabled={actionLoading}
            className="px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            aria-label="Pause beenden"
          >
            Weiter
          </button>
        )}
      </div>

      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
        Heute: {formatMinutes(todayWorkMinutes)}
      </p>

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Lade…</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Keine Einträge für diesen Tag.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => {
            const breaks = breaksMap[e.id] ?? []
            const min = calcWorkMinutes(e, breaks)
            return (
              <li
                key={e.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{formatTime(e.start)}</span>
                    <span className="text-slate-500 dark:text-slate-400 mx-1">–</span>
                    <span className={e.end ? 'font-medium' : 'text-green-600 dark:text-green-400'}>
                      {e.end ? formatTime(e.end) : 'läuft'}
                    </span>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {formatMinutes(min)}
                  </span>
                </div>
                {breaks.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Pausen: {breaks.map((b) => `${formatTime(b.start)}–${b.end ? formatTime(b.end) : '…'}`).join(', ')}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Arbeitszeit
