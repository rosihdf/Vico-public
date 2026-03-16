import { useState, useEffect, useCallback, useMemo } from 'react'
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
  getMonthBounds,
  getLastEndedEntry,
} from './lib/timeService'
import { fetchMyProfile, setGpsConsent } from './lib/userService'
import { getCurrentPosition } from './lib/geolocation'
import type { Profile } from './lib/userService'
import { useToast } from './ToastContext'
import { reportError } from './lib/errorReportService'
import { formatTime, formatMinutes, toDateStr } from '../shared/format'
import type { TimeEntry, TimeBreak } from './types'

const ELEVEN_HOURS_MS = 11 * 60 * 60 * 1000

const Arbeitszeit = () => {
  const { user } = useAuth()
  const { license } = useLicense()
  const { showError } = useToast()
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [breaksMap, setBreaksMap] = useState<Record<string, TimeBreak[]>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [lastEndedEntry, setLastEndedEntry] = useState<TimeEntry | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [gpsConsentChecked, setGpsConsentChecked] = useState(false)
  const [gpsConsentSaving, setGpsConsentSaving] = useState(false)

  const userId = user?.id ?? ''
  const canUse = license && hasFeature(license, 'arbeitszeiterfassung')
  const hasGpsConsent =
    myProfile?.gps_consent_at != null && myProfile?.gps_consent_revoked_at == null
  const showGpsConsentBlock = canUse && userId && (!myProfile?.gps_consent_at || myProfile?.gps_consent_revoked_at != null)

  const { from: monthFrom, to: monthTo } = getMonthBounds(selectedDate)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const data = await fetchTimeEntriesForUser(userId, monthFrom, monthTo)
    setWeekEntries(data)
    const map: Record<string, TimeBreak[]> = {}
    for (const e of data) {
      map[e.id] = await fetchTimeBreaksForEntry(e.id)
    }
    setBreaksMap(map)
    setLoading(false)
  }, [userId, monthFrom, monthTo])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (canUse && userId) {
      fetchMyProfile(userId).then(setMyProfile)
    }
  }, [canUse, userId])

  useEffect(() => {
    if (!userId) return
    getLastEndedEntry(userId).then(setLastEndedEntry)
  }, [userId, weekEntries])

  const entries = useMemo(
    () => weekEntries.filter((e) => e.date === selectedDate),
    [weekEntries, selectedDate]
  )
  const activeEntry = getActiveEntry(entries)
  const activeBreaks = activeEntry ? breaksMap[activeEntry.id] ?? [] : []
  const activeBreak = activeEntry ? getActiveBreak(activeEntry, activeBreaks) : null
  const todayWorkMinutes = useMemo(
    () =>
      entries.reduce((sum, e) => {
        const breaks = breaksMap[e.id] ?? []
        return sum + calcWorkMinutes(e, breaks)
      }, 0),
    [entries, breaksMap]
  )
  const weekWorkMinutes = useMemo(
    () =>
      weekEntries.reduce((sum, e) => {
        const breaks = breaksMap[e.id] ?? []
        return sum + calcWorkMinutes(e, breaks)
      }, 0),
    [weekEntries, breaksMap]
  )
  const monthWorkMinutes = useMemo(() => {
    const monthKey = selectedDate.slice(0, 7)
    return weekEntries
      .filter((e) => e.date.slice(0, 7) === monthKey)
      .reduce((sum, e) => sum + calcWorkMinutes(e, breaksMap[e.id] ?? []), 0)
  }, [weekEntries, breaksMap, selectedDate])

  const arbzgLessThan11hRest =
    !activeEntry &&
    lastEndedEntry?.end != null &&
    Date.now() - new Date(lastEndedEntry.end).getTime() < ELEVEN_HOURS_MS

  const handleStart = async () => {
    if (!userId || actionLoading) return
    setActionLoading(true)
    let location: { lat: number; lon: number } | null = null
    if (hasGpsConsent) {
      location = await getCurrentPosition()
    }
    const { data, error } = await startTimeEntry(userId, location)
    setActionLoading(false)
    if (error) {
      reportError({ message: error.message, path: '/arbeitszeit', source: 'zeiterfassung' })
      showError(error.message)
      return
    }
    if (data) {
      setWeekEntries((prev) => [data, ...prev])
      setBreaksMap((prev) => ({ ...prev, [data.id]: [] }))
    }
  }

  const handleEnd = async () => {
    if (!activeEntry || actionLoading) return
    const endIso = new Date().toISOString()
    setActionLoading(true)
    let location: { lat: number; lon: number } | null = null
    if (hasGpsConsent) {
      location = await getCurrentPosition()
    }
    const { error } = await endTimeEntry(activeEntry.id, userId, location)
    setActionLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    setWeekEntries((prev) =>
      prev.map((e) =>
        e.id === activeEntry.id ? { ...e, end: endIso, updated_at: endIso } : e
      )
    )
    setLastEndedEntry({ ...activeEntry, end: endIso, updated_at: endIso })
  }

  const handleGpsConsentConfirm = async () => {
    if (!userId || !gpsConsentChecked || gpsConsentSaving) return
    setGpsConsentSaving(true)
    const { error } = await setGpsConsent(userId)
    setGpsConsentSaving(false)
    if (error) {
      reportError({ message: error.message, path: '/arbeitszeit', source: 'zeiterfassung' })
      showError(error.message)
      return
    }
    const updated = await fetchMyProfile(userId)
    if (updated) setMyProfile(updated)
    setGpsConsentChecked(false)
  }

  const handlePauseStart = async () => {
    if (!activeEntry || actionLoading) return
    setActionLoading(true)
    const { data, error } = await startBreak(activeEntry.id, userId)
    setActionLoading(false)
    if (error) {
      reportError({ message: error.message, path: '/arbeitszeit', source: 'zeiterfassung' })
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
      reportError({ message: error.message, path: '/arbeitszeit', source: 'zeiterfassung' })
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
  const forgotToClockOut = activeEntry && (todayWorkMinutes >= 600 || hour >= 20)

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

      {showGpsConsentBlock && (
        <section
          className="mb-4 p-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
          aria-labelledby="gps-consent-heading"
        >
          <h3 id="gps-consent-heading" className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
            Optionale Standorterfassung
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
            Sie können optional Ihren Standort bei Arbeitsbeginn und -ende erfassen lassen. Die Erfassung erfolgt nur zu
            diesen Zeitpunkten, nicht dauerhaft. Rechtsgrundlage ist Ihre Einwilligung (§ 26 Abs. 2 BDSG, Art. 6 Abs. 1
            lit. a DSGVO). Die Angabe ist freiwillig; Sie können die Zeiterfassung auch ohne Ortung nutzen. Sie können
            die Einwilligung jederzeit widerrufen (z. B. in den Einstellungen).
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <input
              id="gps-consent-checkbox"
              type="checkbox"
              checked={gpsConsentChecked}
              onChange={(e) => setGpsConsentChecked(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
              aria-describedby="gps-consent-heading"
            />
            <label htmlFor="gps-consent-checkbox" className="text-sm text-slate-700 dark:text-slate-200">
              Ich habe die Informationen gelesen und bin einverstanden, dass mein Standort bei Arbeitsbeginn und -ende
              erfasst und gespeichert wird.
            </label>
          </div>
          <button
            type="button"
            onClick={handleGpsConsentConfirm}
            disabled={!gpsConsentChecked || gpsConsentSaving}
            className="mt-3 px-4 py-2 rounded-lg bg-vico-primary text-slate-800 dark:text-slate-200 font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Ortung aktivieren"
          >
            {gpsConsentSaving ? 'Wird gespeichert…' : 'Einverstanden und Ortung aktivieren'}
          </button>
        </section>
      )}

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

      {arbzgLessThan11hRest && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm"
        >
          ArbZG §5: Weniger als 11 Stunden Ruhe seit letztem Feierabend.
        </div>
      )}

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

      <div className="flex flex-wrap items-end gap-3 mb-6">
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

      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
        Heute: {formatMinutes(todayWorkMinutes)}
      </p>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-4">
        Diese Woche: {formatMinutes(weekWorkMinutes)}
      </p>

      <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Arbeitszeitkonto (Monat)</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-slate-600 dark:text-slate-300">
            Soll: {myProfile?.soll_minutes_per_month != null ? formatMinutes(myProfile.soll_minutes_per_month) : '–'}
          </span>
          <span className="text-slate-700 dark:text-slate-200 font-medium">
            Ist: {formatMinutes(monthWorkMinutes)}
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            Saldo:{' '}
            {myProfile?.soll_minutes_per_month != null ? (
              <span className={monthWorkMinutes - myProfile.soll_minutes_per_month >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                {formatMinutes(monthWorkMinutes - myProfile.soll_minutes_per_month)}
              </span>
            ) : (
              '–'
            )}
          </span>
        </div>
        {myProfile?.soll_minutes_per_month == null && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Soll-Arbeitszeit pro Monat kann von einem Admin im Arbeitszeitenportal hinterlegt werden.
          </p>
        )}
      </div>

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
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-medium">{formatTime(e.start)}</span>
                    <span className="text-slate-500 dark:text-slate-400 mx-1">–</span>
                    <span className={e.end ? 'font-medium' : 'text-green-600 dark:text-green-400'}>
                      {e.end ? formatTime(e.end) : 'läuft'}
                    </span>
                    <span className="ml-2 text-sm text-slate-600 dark:text-slate-300">
                      {formatMinutes(min)}
                    </span>
                  </div>
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
