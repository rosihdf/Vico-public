import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchTimeEntriesForUser,
  fetchTimeBreaksForEntry,
  getWeekBounds,
  getMonthBounds,
  calcWorkMinutes,
  updateTimeEntryAsAdmin,
  type TimeEntryEditReasonCode,
} from '../lib/timeService'
import { fetchProfiles, getProfileDisplayName, type Profile } from '../lib/userService'
import type { TimeEntry, TimeBreak } from '../types/time'
import { formatTime, formatMinutes } from '../../../shared/format'

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
const osmLink = (lat: number, lon: number): string =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=17`

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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Alle Zeiten</h2>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="az-user" className="block text-sm font-medium text-slate-700 mb-1">
            Benutzer
          </label>
          <select
            id="az-user"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 min-w-[12rem]"
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
                viewMode === mode ? 'bg-vico-primary text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
              aria-pressed={viewMode === mode}
            >
              {mode === 'day' ? 'Tag' : mode === 'week' ? 'Woche' : 'Monat'}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="az-date" className="block text-sm font-medium text-slate-700 mb-1">
            {viewMode === 'month' ? 'Monat' : 'Datum'}
          </label>
          <input
            id="az-date"
            type={viewMode === 'month' ? 'month' : 'date'}
            value={viewMode === 'month' ? selectedDate.slice(0, 7) : selectedDate}
            onChange={(e) => setSelectedDate(viewMode === 'month' ? e.target.value + '-01' : e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800"
            aria-label={viewMode === 'month' ? 'Monat' : 'Datum'}
          />
        </div>
      </div>

      {viewMode === 'day' && (
        <p className="text-sm text-slate-600">
          Summe Tag: <strong>{formatMinutes(daySum)}</strong> · Summe Woche: {formatMinutes(weekSum)}
        </p>
      )}
      {viewMode === 'week' && (
        <p className="text-sm text-slate-600">
          Summe Woche: <strong>{formatMinutes(weekSum)}</strong>
        </p>
      )}
      {viewMode === 'month' && (
        <p className="text-sm text-slate-600">
          Summe Monat: <strong>{formatMinutes(monthSum)}</strong>
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Lade…</p>
      ) : viewMode === 'day' ? (
        <ul className="space-y-2">
          {dayEntries.length === 0 ? (
            <li className="text-slate-500">Keine Einträge für diesen Tag.</li>
          ) : (
            dayEntries.map((e) => {
              const breaks = breaksMap[e.id] ?? []
              const min = calcWorkMinutes(e, breaks)
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <div>
                      <span className="font-medium">{formatTime(e.start)}</span>
                      <span className="text-slate-500 mx-1">–</span>
                      <span className={e.end ? 'font-medium' : 'text-green-600'}>
                        {e.end ? formatTime(e.end) : 'läuft'}
                      </span>
                      <span className="ml-2 text-sm text-slate-600">{formatMinutes(min)}</span>
                    </div>
                    {(hasLocationStart(e) || hasLocationEnd(e)) && (
                      <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-500">
                        {hasLocationStart(e) && (
                          <a
                            href={osmLink(e.location_start_lat!, e.location_start_lon!)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-vico-primary underline"
                            aria-label="Standort Start auf Karte anzeigen"
                          >
                            Standort Start
                          </a>
                        )}
                        {hasLocationEnd(e) && (
                          <a
                            href={osmLink(e.location_end_lat!, e.location_end_lon!)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-vico-primary underline"
                            aria-label="Standort Ende auf Karte anzeigen"
                          >
                            Standort Ende
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(e)}
                    className="text-sm px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 shrink-0"
                    aria-label="Eintrag bearbeiten"
                  >
                    Bearbeiten
                  </button>
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
                className={`p-3 rounded-lg border ${isSelected ? 'border-vico-primary bg-vico-primary/10' : 'border-slate-200 bg-white'}`}
              >
                <div className="text-sm font-medium text-slate-800 mb-1">
                  {dayName} {d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="text-xs text-slate-600 mb-2">{formatMinutes(sum)}</div>
                <ul className="space-y-1">
                  {dayEntriesForDate.map((e) => {
                    const breaks = breaksMap[e.id] ?? []
                    const min = calcWorkMinutes(e, breaks)
                    return (
                      <li key={e.id} className="flex justify-between items-start gap-1 text-xs">
                        <span>
                          {formatTime(e.start)}–{e.end ? formatTime(e.end) : '…'}
                        </span>
                        <span className="flex items-center gap-1">
                          {formatMinutes(min)}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(e)}
                            className="text-slate-500 hover:text-slate-700 underline"
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
            <div key={l} className="font-medium text-slate-600 p-1 text-center">
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
                  className="p-1 min-h-[3rem] border border-slate-100 rounded bg-white text-center"
                  title={dateStr}
                >
                  <span className="text-slate-600">{day}</span>
                  {sum > 0 && <div className="text-xs text-slate-500">{formatMinutes(sum)}</div>}
                </div>
              )
            }
            return cells
          })()}
        </div>
      )}

      {editEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-entry-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto">
            <h3 id="edit-entry-title" className="text-lg font-bold text-slate-800 mb-4">
              Zeiteintrag bearbeiten
            </h3>
            {editError && (
              <p className="mb-3 text-sm text-red-600" role="alert">
                {editError}
              </p>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <label htmlFor="edit-start" className="block text-sm font-medium text-slate-700 mb-1">
                  Start
                </label>
                <input
                  id="edit-start"
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  aria-required
                />
              </div>
              <div>
                <label htmlFor="edit-end" className="block text-sm font-medium text-slate-700 mb-1">
                  Ende (leer = läuft)
                </label>
                <input
                  id="edit-end"
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>
              <div>
                <label htmlFor="edit-reason-code" className="block text-sm font-medium text-slate-700 mb-1">
                  Grund (Pflicht)
                </label>
                <select
                  id="edit-reason-code"
                  value={editReasonCode}
                  onChange={(e) => setEditReasonCode(e.target.value as TimeEntryEditReasonCode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
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
                <label htmlFor="edit-reason-text" className="block text-sm font-medium text-slate-700 mb-1">
                  Zusatz / Freitext (optional)
                </label>
                <input
                  id="edit-reason-text"
                  type="text"
                  value={editReasonText}
                  onChange={(e) => setEditReasonText(e.target.value)}
                  placeholder="z.B. Details zur Korrektur"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
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
    </div>
  )
}

export default AlleZeiten
