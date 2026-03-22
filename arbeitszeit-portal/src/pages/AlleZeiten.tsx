import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchTimeEntriesForUser,
  fetchTimeBreaksForEntry,
  getWeekBounds,
  getMonthBounds,
  calcWorkMinutes,
  updateTimeEntryAsAdmin,
  insertTimeEntryAsAdmin,
  approveTimeEntry,
  type TimeEntryEditReasonCode,
} from '../lib/timeService'
import { fetchProfiles, getProfileDisplayName, type Profile } from '../lib/userService'
import type { TimeEntry, TimeBreak } from '../types/time'
import { formatTime, formatMinutes } from '../../../shared/format'
import LocationMapModal from '../components/LocationMapModal'
import { exportZollCsv, exportZollPdf } from '../lib/exportCompliance'
import { supabase } from '../lib/supabase'

const EDIT_REASON_OPTIONS: { value: TimeEntryEditReasonCode; label: string }[] = [
  { value: 'korrektur', label: 'Korrektur (falsche Zeit)' },
  { value: 'nachreichung', label: 'Nachreichung (vergessen)' },
  { value: 'fehler', label: 'Technischer Fehler' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const toDatetimeLocal = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fromDatetimeLocal = (local: string): string => (local ? new Date(local).toISOString() : '')

const hasLocationStart = (e: TimeEntry): boolean =>
  e.location_start_lat != null && e.location_start_lon != null
const hasLocationEnd = (e: TimeEntry): boolean =>
  e.location_end_lat != null && e.location_end_lon != null

const getWeekDayDates = (weekFrom: string): string[] => {
  const from = new Date(weekFrom + 'T12:00:00')
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return out
}

const AlleZeiten = () => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [breaksMap, setBreaksMap] = useState<Record<string, TimeBreak[]>>({})
  const [loading, setLoading] = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editReasonCode, setEditReasonCode] = useState<TimeEntryEditReasonCode>('korrektur')
  const [editReasonText, setEditReasonText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [locationModal, setLocationModal] = useState<{ lat: number; lon: number; label: string } | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const [manualOpen, setManualOpen] = useState(false)
  const [manualWorkDate, setManualWorkDate] = useState('')
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [manualReasonCode, setManualReasonCode] = useState<TimeEntryEditReasonCode>('nachreichung')
  const [manualReasonText, setManualReasonText] = useState('')
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  const userId = selectedUserId || (profiles[0]?.id ?? '')
  const { from: weekFrom, to: weekTo } = getWeekBounds(selectedDate)
  const { from: monthFrom, to: monthTo } = getMonthBounds(selectedDate)
  const rangeFrom = viewMode === 'month' ? monthFrom : weekFrom
  const rangeTo = viewMode === 'month' ? monthTo : weekTo

  const profilesWithZeiterfassung = useMemo(
    () => profiles.filter((p) => p.role !== 'leser' && p.role !== 'kunde'),
    [profiles]
  )

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const data = await fetchTimeEntriesForUser(userId, rangeFrom, rangeTo)
    setEntries(data)
    const map: Record<string, TimeBreak[]> = {}
    for (const e of data) {
      map[e.id] = await fetchTimeBreaksForEntry(e.id)
    }
    setBreaksMap(map)
    setLoading(false)
  }, [userId, rangeFrom, rangeTo])

  useEffect(() => {
    fetchProfiles().then(setProfiles)
  }, [])

  useEffect(() => {
    if (profiles.length > 0 && !selectedUserId) {
      setSelectedUserId(profilesWithZeiterfassung[0]?.id ?? '')
    }
  }, [profiles.length, profilesWithZeiterfassung, selectedUserId])

  useEffect(() => {
    load()
  }, [load])

  const dayEntries = useMemo(() => entries.filter((e) => e.date === selectedDate), [entries, selectedDate])
  const daySum = useMemo(
    () => dayEntries.reduce((s, e) => s + calcWorkMinutes(e, breaksMap[e.id] ?? []), 0),
    [dayEntries, breaksMap]
  )
  const weekSum = useMemo(
    () => entries.reduce((s, e) => s + calcWorkMinutes(e, breaksMap[e.id] ?? []), 0),
    [entries, breaksMap]
  )
  const monthSum = useMemo(() => {
    const key = selectedDate.slice(0, 7)
    return entries
      .filter((e) => e.date.slice(0, 7) === key)
      .reduce((s, e) => s + calcWorkMinutes(e, breaksMap[e.id] ?? []), 0)
  }, [entries, breaksMap, selectedDate])

  const handleOpenEdit = (e: TimeEntry) => {
    setEditEntry(e)
    setEditStart(toDatetimeLocal(e.start))
    setEditEnd(e.end ? toDatetimeLocal(e.end) : '')
    setEditReasonCode('korrektur')
    setEditReasonText('')
    setEditError(null)
  }

  const handleCloseEdit = () => {
    setEditEntry(null)
  }

  const handleOpenManual = () => {
    setManualError(null)
    setManualWorkDate(selectedDate)
    setManualStart(`${selectedDate}T08:00`)
    setManualEnd(`${selectedDate}T16:00`)
    setManualReasonCode('nachreichung')
    setManualReasonText('')
    setManualOpen(true)
  }

  const handleCloseManual = () => {
    setManualOpen(false)
  }

  const handleSaveManual = async () => {
    if (!userId || !manualWorkDate.trim() || !manualStart.trim()) {
      setManualError('Arbeitstag, Start und Mitarbeiter sind erforderlich.')
      return
    }
    const startIso = fromDatetimeLocal(manualStart.trim())
    const endIso = manualEnd.trim() ? fromDatetimeLocal(manualEnd.trim()) : null
    if (!startIso) {
      setManualError('Startzeit ungültig.')
      return
    }
    if (endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setManualError('Ende muss nach Start liegen (oder Ende leer lassen).')
      return
    }
    const reason =
      manualReasonText.trim() ||
      EDIT_REASON_OPTIONS.find((o) => o.value === manualReasonCode)?.label ||
      manualReasonCode
    setManualSaving(true)
    setManualError(null)
    const { error } = await insertTimeEntryAsAdmin(
      userId,
      manualWorkDate.trim(),
      startIso,
      endIso,
      reason,
      manualReasonCode,
      null
    )
    setManualSaving(false)
    if (error) {
      setManualError(error.message)
      return
    }
    handleCloseManual()
    load()
  }

  const handleApprove = async (entry: TimeEntry, status: 'approved' | 'rejected') => {
    setApprovingId(entry.id)
    const { error } = await approveTimeEntry(entry.id, status)
    setApprovingId(null)
    if (error) {
      setEditError(error.message)
      return
    }
    setEntries((prev) =>
      prev.map((x) =>
        x.id === entry.id
          ? { ...x, approval_status: status, approved_by: '', approved_at: new Date().toISOString() }
          : x
      )
    )
  }

  const handleSaveEdit = async () => {
    if (!editEntry || !editStart.trim()) return
    setEditSaving(true)
    setEditError(null)
    const newStartIso = fromDatetimeLocal(editStart.trim())
    const newEndIso = editEnd.trim() ? fromDatetimeLocal(editEnd.trim()) : null
    const reason = editReasonText.trim() || EDIT_REASON_OPTIONS.find((o) => o.value === editReasonCode)?.label || editReasonCode
    const { error } = await updateTimeEntryAsAdmin(editEntry.id, newStartIso, newEndIso, reason, editReasonCode)
    setEditSaving(false)
    if (error) {
      setEditError(error.message)
      return
    }
    setEntries((prev) =>
      prev.map((x) =>
        x.id === editEntry.id ? { ...x, start: newStartIso, end: newEndIso, updated_at: new Date().toISOString() } : x
      )
    )
    handleCloseEdit()
    load()
  }

  const dayDates = useMemo(() => getWeekDayDates(weekFrom), [weekFrom])

  const handleExportCsv = () => {
    const profile = profilesWithZeiterfassung.find((p) => p.id === userId)
    const name = profile ? getProfileDisplayName(profile) : 'Unbekannt'
    const header = 'Datum;Mitarbeiter;Start;Ende;Pausen (Min);Arbeitszeit (Min);Notizen'
    const rows = entries.map((e) => {
      const breaks = breaksMap[e.id] ?? []
      const breakMin = breaks.reduce((s, b) => {
        if (!b.end) return s
        return s + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000)
      }, 0)
      const workMin = calcWorkMinutes(e, breaks)
      const startStr = e.start ? new Date(e.start).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : ''
      const endStr = e.end ? new Date(e.end).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : ''
      return [e.date, name, startStr, endStr, breakMin, workMin, (e.notes ?? '').replace(/;/g, ',')].join(';')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Zeiterfassung_${name.replace(/\s+/g, '_')}_${rangeFrom}_${rangeTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Alle Zeiten</h2>
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-800">
        <strong className="font-semibold">Stempel-Standorte (GPS):</strong> Beta – Kartenlinks nur, wenn Koordinaten
        gespeichert sind. Nach Live-Betrieb erneut prüfen; in der Entwicklung kann die Anzeige abweichen.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="az-user" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Benutzer
          </label>
          <select
            id="az-user"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-w-[12rem]"
            aria-label="Benutzer auswählen"
          >
            {profilesWithZeiterfassung.map((p) => (
              <option key={p.id} value={p.id}>
                {getProfileDisplayName(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                viewMode === mode ? 'bg-vico-primary text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-500'
              }`}
              aria-pressed={viewMode === mode}
            >
              {mode === 'day' ? 'Tag' : mode === 'week' ? 'Woche' : 'Monat'}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="az-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {viewMode === 'month' ? 'Monat' : 'Datum'}
          </label>
          <input
            id="az-date"
            type={viewMode === 'month' ? 'month' : 'date'}
            value={viewMode === 'month' ? selectedDate.slice(0, 7) : selectedDate}
            onChange={(e) => setSelectedDate(viewMode === 'month' ? e.target.value + '-01' : e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            aria-label={viewMode === 'month' ? 'Monat' : 'Datum'}
          />
        </div>
        <button
          type="button"
          onClick={handleOpenManual}
          disabled={!userId}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          aria-label="Zeit nachtragen (manueller Eintrag)"
          title="Wenn der Mitarbeiter vergessen hat zu stempeln"
        >
          Zeit nachtragen
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={entries.length === 0}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          aria-label="Als CSV exportieren"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => {
            const name = getProfileDisplayName(profiles.find((p) => p.id === userId) ?? { email: null, first_name: null, last_name: null })
            exportZollCsv(entries, breaksMap, name, rangeFrom, rangeTo)
          }}
          disabled={entries.length === 0}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          aria-label="Export für Zollprüfung (CSV)"
          title="MiLoG § 17 – Format für Zoll-/Mindestlohnprüfung"
        >
          Zollprüfung CSV
        </button>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              const name = getProfileDisplayName(
                profiles.find((p) => p.id === userId) ?? { email: null, first_name: null, last_name: null }
              )
              await exportZollPdf(entries, breaksMap, name, rangeFrom, rangeTo, supabase)
            })()
          }}
          disabled={entries.length === 0}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          aria-label="Export für Zollprüfung (PDF)"
          title="MiLoG § 17 – PDF für Zoll-/Mindestlohnprüfung"
        >
          Zollprüfung PDF
        </button>
      </div>

      {viewMode === 'day' && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Summe Tag: <strong>{formatMinutes(daySum)}</strong> · Summe Woche: {formatMinutes(weekSum)}
        </p>
      )}
      {viewMode === 'week' && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Summe Woche: <strong>{formatMinutes(weekSum)}</strong>
        </p>
      )}
      {viewMode === 'month' && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Summe Monat: <strong>{formatMinutes(monthSum)}</strong>
        </p>
      )}

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Lade…</p>
      ) : viewMode === 'day' ? (
        <ul className="space-y-2">
          {dayEntries.length === 0 ? (
            <li className="text-slate-500 dark:text-slate-400">Keine Einträge für diesen Tag.</li>
          ) : (
            dayEntries.map((e) => {
              const breaks = breaksMap[e.id] ?? []
              const min = calcWorkMinutes(e, breaks)
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                >
                  <div className="min-w-0 flex-1">
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{formatTime(e.start)}</span>
                      <span className="text-slate-500 dark:text-slate-400 mx-1">–</span>
                      <span
                        className={
                          e.end
                            ? 'font-medium text-slate-800 dark:text-slate-100'
                            : 'text-green-600 dark:text-green-400 font-medium'
                        }
                      >
                        {e.end ? formatTime(e.end) : 'läuft'}
                      </span>
                      <span className="ml-2 text-sm text-slate-600 dark:text-slate-300">{formatMinutes(min)}</span>
                    </div>
                    {(hasLocationStart(e) || hasLocationEnd(e)) && (
                      <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {hasLocationStart(e) && (
                          <button
                            type="button"
                            onClick={() =>
                              setLocationModal({
                                lat: e.location_start_lat!,
                                lon: e.location_start_lon!,
                                label: 'Standort Start',
                              })
                            }
                            className="hover:text-vico-primary underline text-left"
                            aria-label="Standort Start auf Karte anzeigen"
                          >
                            Standort Start
                          </button>
                        )}
                        {hasLocationEnd(e) && (
                          <button
                            type="button"
                            onClick={() =>
                              setLocationModal({
                                lat: e.location_end_lat!,
                                lon: e.location_end_lon!,
                                label: 'Standort Ende',
                              })
                            }
                            className="hover:text-vico-primary underline text-left"
                            aria-label="Standort Ende auf Karte anzeigen"
                          >
                            Standort Ende
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {e.approval_status === 'submitted' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(e, 'approved')}
                          disabled={approvingId === e.id}
                          className="text-sm px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          aria-label="Freigeben"
                        >
                          Freigeben
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(e, 'rejected')}
                          disabled={approvingId === e.id}
                          className="text-sm px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          aria-label="Ablehnen"
                        >
                          Ablehnen
                        </button>
                      </>
                    )}
                    {(e.approval_status === 'approved' || !e.approval_status) && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                        Freigegeben
                      </span>
                    )}
                    {e.approval_status === 'rejected' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
                        Abgelehnt
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(e)}
                      className="text-sm px-2 py-1 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-500"
                      aria-label="Eintrag bearbeiten"
                    >
                      Bearbeiten
                    </button>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      ) : viewMode === 'week' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {dayDates.map((dateStr) => {
            const dayEntriesForDate = entries.filter((e) => e.date === dateStr)
            const sum = dayEntriesForDate.reduce((s, e) => s + calcWorkMinutes(e, breaksMap[e.id] ?? []), 0)
            const d = new Date(dateStr + 'T12:00:00')
            const dayName = WEEKDAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]
            const isSelected = dateStr === selectedDate
            return (
              <div
                key={dateStr}
                className={`p-3 rounded-lg border ${isSelected ? 'border-vico-primary bg-vico-primary/10' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}
              >
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">
                  {dayName} {d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">{formatMinutes(sum)}</div>
                <ul className="space-y-1">
                  {dayEntriesForDate.map((e) => {
                    const breaks = breaksMap[e.id] ?? []
                    const min = calcWorkMinutes(e, breaks)
                    return (
                      <li key={e.id} className="flex justify-between items-start gap-1 text-xs">
                        <span>
                          {formatTime(e.start)}–{e.end ? formatTime(e.end) : '…'}
                          {e.approval_status === 'submitted' && (
                            <span className="ml-1 text-amber-600 dark:text-amber-400" title="Eingereicht">
                              ●
                            </span>
                          )}
                          {e.approval_status === 'rejected' && (
                            <span className="ml-1 text-red-600 dark:text-red-400" title="Abgelehnt">
                              ●
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          {formatMinutes(min)}
                          {e.approval_status === 'submitted' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(e, 'approved')}
                                disabled={approvingId === e.id}
                                className="text-green-600 dark:text-green-400 hover:underline"
                                aria-label="Freigeben"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApprove(e, 'rejected')}
                                disabled={approvingId === e.id}
                                className="text-red-600 dark:text-red-400 hover:underline"
                                aria-label="Ablehnen"
                              >
                                ✗
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(e)}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 underline"
                            aria-label="Bearbeiten"
                          >
                            Bearb.
                          </button>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 text-sm">
          {WEEKDAY_LABELS.map((l) => (
            <div key={l} className="font-medium text-slate-600 dark:text-slate-300 p-1 text-center">
              {l}
            </div>
          ))}
          {(() => {
            const first = new Date(monthFrom + 'T12:00:00')
            const startWeekday = first.getDay() === 0 ? 6 : first.getDay() - 1
            const last = new Date(monthTo + 'T12:00:00')
            const daysInMonth = last.getDate()
            const cells: React.ReactNode[] = []
            for (let i = 0; i < startWeekday; i++) {
              cells.push(<div key={`empty-${i}`} className="p-1" />)
            }
            for (let day = 1; day <= daysInMonth; day++) {
              const dateStr = `${monthFrom.slice(0, 4)}-${monthFrom.slice(5, 7)}-${String(day).padStart(2, '0')}`
              const dayEntriesForDate = entries.filter((e) => e.date === dateStr)
              const sum = dayEntriesForDate.reduce((s, e) => s + calcWorkMinutes(e, breaksMap[e.id] ?? []), 0)
              cells.push(
                <div
                  key={dateStr}
                  className="p-1 min-h-[3rem] border border-slate-100 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-center"
                  title={dateStr}
                >
                  <span className="text-slate-600 dark:text-slate-300">{day}</span>
                  {sum > 0 && <div className="text-xs text-slate-500 dark:text-slate-400">{formatMinutes(sum)}</div>}
                </div>
              )
            }
            return cells
          })()}
        </div>
      )}

      {manualOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-entry-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-600">
            <h3 id="manual-entry-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
              Zeit nachtragen
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Neuer Eintrag für{' '}
              <strong>
                {(() => {
                  const p = profilesWithZeiterfassung.find((x) => x.id === userId)
                  return p ? getProfileDisplayName(p) : 'Mitarbeiter'
                })()}
              </strong>
              , wenn die Zeiterfassung nicht gestartet wurde.
            </p>
            {manualError && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {manualError}
              </p>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <label htmlFor="manual-work-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Arbeitstag
                </label>
                <input
                  id="manual-work-date"
                  type="date"
                  value={manualWorkDate}
                  onChange={(e) => setManualWorkDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  aria-required
                />
              </div>
              <div>
                <label htmlFor="manual-start" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start
                </label>
                <input
                  id="manual-start"
                  type="datetime-local"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  aria-required
                />
              </div>
              <div>
                <label htmlFor="manual-end" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ende (optional)
                </label>
                <input
                  id="manual-end"
                  type="datetime-local"
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  aria-describedby={!manualEnd.trim() ? 'manual-end-hint' : undefined}
                />
                {!manualEnd.trim() && (
                  <p
                    id="manual-end-hint"
                    role="status"
                    className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:bg-amber-950/35 dark:text-amber-100 dark:border-amber-800"
                  >
                    <strong className="font-semibold">Hinweis:</strong> Ohne Ende wird ein <strong>offener</strong> Eintrag
                    angelegt (wie „läuft“ in der App). Für eine abgeschlossene Schicht bitte immer <strong>Ende</strong>{' '}
                    eintragen – leer lassen nur, wenn das bewusst gewünscht ist.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="manual-reason-code" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Grund (Pflicht)
                </label>
                <select
                  id="manual-reason-code"
                  value={manualReasonCode}
                  onChange={(e) => setManualReasonCode(e.target.value as TimeEntryEditReasonCode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  aria-required
                >
                  {EDIT_REASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="manual-reason-text" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Zusatz / Freitext (optional)
                </label>
                <input
                  id="manual-reason-text"
                  type="text"
                  value={manualReasonText}
                  onChange={(e) => setManualReasonText(e.target.value)}
                  placeholder="z. B. vergessen zu stempeln"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCloseManual}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => void handleSaveManual()}
                disabled={manualSaving || !manualStart.trim() || !manualWorkDate.trim()}
                className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50"
              >
                {manualSaving ? 'Speichern…' : 'Eintragen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-entry-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-600">
            <h3 id="edit-entry-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
              Zeiteintrag bearbeiten
            </h3>
            {editError && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {editError}
              </p>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <label htmlFor="edit-start" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start
                </label>
                <input
                  id="edit-start"
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  aria-required
                />
              </div>
              <div>
                <label htmlFor="edit-end" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ende (leer = läuft)
                </label>
                <input
                  id="edit-end"
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="edit-reason-code" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Grund (Pflicht)
                </label>
                <select
                  id="edit-reason-code"
                  value={editReasonCode}
                  onChange={(e) => setEditReasonCode(e.target.value as TimeEntryEditReasonCode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  aria-required
                >
                  {EDIT_REASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-reason-text" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Zusatz / Freitext (optional)
                </label>
                <input
                  id="edit-reason-text"
                  type="text"
                  value={editReasonText}
                  onChange={(e) => setEditReasonText(e.target.value)}
                  placeholder="z.B. Details zur Korrektur"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSaving || !editStart.trim()}
                className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50"
              >
                {editSaving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {locationModal && (
        <LocationMapModal
          lat={locationModal.lat}
          lon={locationModal.lon}
          label={locationModal.label}
          onClose={() => setLocationModal(null)}
        />
      )}
    </div>
  )
}

export default AlleZeiten
