import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  calcSollMinutesForMonth,
  calcSollMinutesForYear,
  getWorkMinutesForUserInRange,
} from './lib/timeService'
import { fetchMyProfile, setGpsConsent } from './lib/userService'
import {
  fetchMyLeaveRequests,
  createLeaveRequest,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveRequest,
  type LeaveType,
} from './lib/leaveService'
import { getCurrentPosition } from './lib/geolocation'
import type { Profile } from './lib/userService'
import { useToast } from './ToastContext'
import { reportError } from './lib/errorReportService'
import { formatTime, formatMinutes, toDateStr } from '../shared/format'
import type { TimeEntry, TimeBreak } from './types'

const ELEVEN_HOURS_MS = 11 * 60 * 60 * 1000

const Arbeitszeit = () => {
  const { user, userRole } = useAuth()
  const { license } = useLicense()
  const { showError, showToast } = useToast()
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([])
  const [breaksMap, setBreaksMap] = useState<Record<string, TimeBreak[]>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [lastEndedEntry, setLastEndedEntry] = useState<TimeEntry | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [calculatedSoll, setCalculatedSoll] = useState<number | null>(null)
  const [yearSoll, setYearSoll] = useState<number | null>(null)
  const [yearIst, setYearIst] = useState<number>(0)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveFormFrom, setLeaveFormFrom] = useState('')
  const [leaveFormTo, setLeaveFormTo] = useState('')
  const [leaveFormType, setLeaveFormType] = useState<LeaveType>('urlaub')
  const [leaveFormNotes, setLeaveFormNotes] = useState('')
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)
  const [leavePanelOpen, setLeavePanelOpen] = useState(false)
  const [gpsConsentChecked, setGpsConsentChecked] = useState(false)
  const [gpsConsentSaving, setGpsConsentSaving] = useState(false)
  const [, setTick] = useState(0)

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

  const refreshProfile = useCallback(() => {
    if (canUse && userId) {
      fetchMyProfile(userId).then(setMyProfile)
    }
  }, [canUse, userId])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const [year, month] = useMemo(() => {
    const [y, m] = selectedDate.split('-').map(Number)
    return [y ?? new Date().getFullYear(), m ?? new Date().getMonth() + 1]
  }, [selectedDate])

  const { urlaubsanspruch, resturlaub } = useMemo(() => {
    const anspruch = myProfile?.vacation_days_per_year ?? 0
    const approvedUrlaub = leaveRequests
      .filter(
        (r) =>
          r.status === 'approved' &&
          r.leave_type === 'urlaub' &&
          r.from_date >= `${year}-01-01` &&
          r.from_date <= `${year}-12-31`
      )
      .reduce((sum, r) => sum + (r.days_count ?? 0), 0)
    return {
      urlaubsanspruch: anspruch,
      resturlaub: Math.max(0, anspruch - approvedUrlaub),
    }
  }, [myProfile?.vacation_days_per_year, leaveRequests, year])

  useEffect(() => {
    if (!userId || !canUse || myProfile?.soll_minutes_per_month != null) {
      setCalculatedSoll(null)
      return
    }
    calcSollMinutesForMonth(userId, year, month).then(setCalculatedSoll)
  }, [userId, canUse, myProfile?.soll_minutes_per_month, year, month])

  useEffect(() => {
    if (!userId || !canUse) return
    const yearFrom = `${year}-01-01`
    const yearTo = `${year}-12-31`
    calcSollMinutesForYear(userId, year).then(setYearSoll)
    getWorkMinutesForUserInRange(userId, yearFrom, yearTo).then(setYearIst)
  }, [userId, canUse, year])

  const loadLeaveRequests = useCallback(async () => {
    if (!userId) return
    const data = await fetchMyLeaveRequests(null, null, null)
    setLeaveRequests(data)
  }, [userId])

  useEffect(() => {
    loadLeaveRequests()
  }, [loadLeaveRequests])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshProfile()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refreshProfile])

  useEffect(() => {
    if (!userId) return
    getLastEndedEntry(userId).then(setLastEndedEntry)
  }, [userId, weekEntries])

  const entries = useMemo(
    () => weekEntries.filter((e) => e.date === selectedDate),
    [weekEntries, selectedDate]
  )
  const activeEntry = getActiveEntry(entries)
  const activeBreaks = useMemo(
    () => (activeEntry ? breaksMap[activeEntry.id] ?? [] : []),
    [activeEntry, breaksMap]
  )
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

  const sollMinutes = myProfile?.soll_minutes_per_month ?? calculatedSoll

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
      if (!location) {
        showToast('Stempelung gespeichert, aber Standort konnte nicht ermittelt werden. Prüfen Sie die Browser-Berechtigung für Standort und ob HTTPS verwendet wird.', 'info')
      }
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
      if (!location) {
        showToast('Stempelung gespeichert, aber Standort konnte nicht ermittelt werden. Prüfen Sie die Browser-Berechtigung.', 'info')
      }
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

  const handleLeaveSubmit = async () => {
    if (!leaveFormFrom || !leaveFormTo || leaveSubmitting) return
    if (leaveFormFrom > leaveFormTo) {
      showError('Von-Datum darf nicht nach Bis-Datum liegen.')
      return
    }
    setLeaveSubmitting(true)
    const { error } = await createLeaveRequest(leaveFormFrom, leaveFormTo, leaveFormType, leaveFormNotes || undefined)
    setLeaveSubmitting(false)
    if (error) {
      showError(error.message)
      return
    }
    showToast('Urlaubsantrag wurde gestellt.')
    setLeaveFormFrom('')
    setLeaveFormTo('')
    setLeaveFormNotes('')
    loadLeaveRequests()
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
    const breakMinutes = Math.floor((Date.now() - new Date(activeBreak.start).getTime()) / 60000)
    if (breakMinutes < 15) {
      showError(
        `ArbZG: Pausenblöcke müssen mindestens 15 Minuten dauern. Aktuell: ${breakMinutes} Min. Bitte noch ${15 - breakMinutes} Min. warten.`
      )
      return
    }
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

  const totalBreakMinutes = useMemo(
    () =>
      activeBreaks.reduce((sum, b) => {
        if (!b.end) return sum
        const ms = new Date(b.end).getTime() - new Date(b.start).getTime()
        return sum + Math.round(ms / 60000)
      }, 0),
    [activeBreaks]
  )
  const activeBreakMinutes = activeBreak
    ? Math.floor((Date.now() - new Date(activeBreak.start).getTime()) / 60000)
    : 0

  useEffect(() => {
    if (!activeBreak) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [activeBreak])

  const arbzg6hHint = todayWorkMinutes >= 360 && totalBreakMinutes < 30 && !activeBreak && activeEntry
  const arbzg9hHint = todayWorkMinutes >= 540 && totalBreakMinutes < 45 && !activeBreak && activeEntry
  const arbzgHint = arbzg6hHint || arbzg9hHint
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

      {(userRole === 'admin' || userRole === 'teamleiter') && (import.meta.env.VITE_ARBEITSZEIT_PORTAL_URL ?? '').trim() && (
        <div className="mb-6">
          <a
            href={(import.meta.env.VITE_ARBEITSZEIT_PORTAL_URL ?? '').trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover transition-colors"
            aria-label="Arbeitszeitenportal öffnen"
          >
            Arbeitszeitenportal öffnen
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}

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
            die Einwilligung jederzeit widerrufen (z. B. in den Einstellungen).
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

      {hasGpsConsent && (
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Standorterfassung aktiv. Einwilligung widerrufen:{' '}
          <Link to="/einstellungen" className="text-vico-primary hover:underline">
            Einstellungen
          </Link>
        </p>
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
          <p>
            {arbzg9hHint
              ? 'ArbZG §4: Bei mehr als 9 Stunden Arbeitszeit sind mind. 45 Min Pause erforderlich.'
              : 'ArbZG §4: Bei mehr als 6 Stunden Arbeitszeit sind mind. 30 Min Pause erforderlich.'}
          </p>
          {!activeBreak && activeEntry && (
            <button
              type="button"
              onClick={handlePauseStart}
              disabled={actionLoading}
              className="mt-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              aria-label="Pause jetzt starten (ArbZG-Empfehlung)"
            >
              Pause jetzt starten
            </button>
          )}
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
          <p className="font-medium">Du hast noch nicht Feierabend gebucht. Vergessen?</p>
          {activeEntry && !activeBreak && (
            <button
              type="button"
              onClick={handleEnd}
              disabled={actionLoading}
              className="mt-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              aria-label="Jetzt Feierabend buchen"
            >
              Jetzt Feierabend buchen
            </button>
          )}
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
          <>
            <button
              type="button"
              onClick={handlePauseEnd}
              disabled={actionLoading || activeBreakMinutes < 15}
              className="px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              aria-label="Pause beenden"
              title={activeBreakMinutes < 15 ? `ArbZG: Pause mind. 15 Min (noch ${15 - activeBreakMinutes} Min)` : undefined}
            >
              Weiter
            </button>
            {activeBreakMinutes < 15 && (
              <span className="text-sm text-slate-500 dark:text-slate-400 self-center">
                Pause mind. 15 Min (noch {15 - activeBreakMinutes} Min)
              </span>
            )}
          </>
        )}
      </div>

      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
        Heute: {formatMinutes(todayWorkMinutes)}
      </p>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-4">
        Diese Woche: {formatMinutes(weekWorkMinutes)}
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

      <div className="mt-6 mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Arbeitszeitkonto</h3>
          <button
            type="button"
            onClick={() => refreshProfile()}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
            aria-label="Soll/Ist aktualisieren"
          >
            Aktualisieren
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Monat ({selectedDate.slice(0, 7)})</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">
                Soll: {sollMinutes != null ? formatMinutes(sollMinutes) : 'nicht gesetzt'}
              </span>
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                Ist: {formatMinutes(monthWorkMinutes)}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                Saldo:{' '}
                {sollMinutes != null ? (
                  <span
                    className={
                      monthWorkMinutes - sollMinutes >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {formatMinutes(monthWorkMinutes - sollMinutes)}
                  </span>
                ) : (
                  '– (Soll fehlt)'
                )}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Gesamtjahr ({year})</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">
                Soll: {yearSoll != null ? formatMinutes(yearSoll) : '…'}
              </span>
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                Ist: {formatMinutes(yearIst)}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                Saldo:{' '}
                {yearSoll != null ? (
                  <span
                    className={
                      yearIst - yearSoll >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {formatMinutes(yearIst - yearSoll)}
                  </span>
                ) : (
                  '–'
                )}
              </span>
            </div>
          </div>
        </div>
        {sollMinutes == null && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Soll-Arbeitszeit pro Monat kann von einem Admin im Arbeitszeitenportal hinterlegt werden oder wird aus Arbeitstagen berechnet. Nach dem Setzen „Aktualisieren“ klicken.
          </p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1" role="note">
          Einträge bitte spätestens bis 7 Tage nach dem Arbeitstag erfassen (MiLoG § 17).
        </p>
      </div>

      <section
        className="mt-6 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
        aria-labelledby="urlaub-heading"
      >
        <button
          type="button"
          onClick={() => setLeavePanelOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={leavePanelOpen}
          aria-controls="urlaub-content"
          id="urlaub-heading"
        >
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Urlaubsanträge
          </h3>
          <span
            className="text-slate-500 dark:text-slate-400 transition-transform"
            aria-hidden
          >
            {leavePanelOpen ? '▼' : '▶'}
          </span>
        </button>
        {leavePanelOpen && (
          <div id="urlaub-content" className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span>
                Urlaubsanspruch: {urlaubsanspruch > 0 ? `${urlaubsanspruch} Tage` : '– (nicht in Stammdaten gesetzt)'}
              </span>
              {urlaubsanspruch > 0 && (
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Resturlaub {year}: {resturlaub} Tage
                </span>
              )}
            </div>
            <div>
              <label htmlFor="leave-from" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Von</label>
              <input
                id="leave-from"
                type="date"
                value={leaveFormFrom}
                onChange={(e) => setLeaveFormFrom(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 text-sm"
                aria-label="Urlaub von Datum"
              />
            </div>
            <div>
              <label htmlFor="leave-to" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Bis</label>
              <input
                id="leave-to"
                type="date"
                value={leaveFormTo}
                onChange={(e) => setLeaveFormTo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 text-sm"
                aria-label="Urlaub bis Datum"
              />
            </div>
            <div>
              <label htmlFor="leave-type" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Art</label>
              <select
                id="leave-type"
                value={leaveFormType}
                onChange={(e) => setLeaveFormType(e.target.value as LeaveType)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 text-sm"
                aria-label="Art des Urlaubs"
              >
                {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="leave-notes" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Notiz (optional)</label>
              <input
                id="leave-notes"
                type="text"
                value={leaveFormNotes}
                onChange={(e) => setLeaveFormNotes(e.target.value)}
                placeholder="z.B. Vertretung"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 text-sm w-full"
                aria-label="Notiz zum Urlaubsantrag"
              />
            </div>
            <button
              type="button"
              onClick={handleLeaveSubmit}
              disabled={!leaveFormFrom || !leaveFormTo || leaveSubmitting}
              className="px-4 py-2 rounded-lg bg-vico-primary text-slate-800 dark:text-slate-200 font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              aria-label="Urlaubsantrag stellen"
            >
              {leaveSubmitting ? 'Wird gesendet…' : 'Antrag stellen'}
            </button>
            {leaveRequests.length > 0 ? (
              <ul className="space-y-2 mt-4">
                {leaveRequests.map((lr) => (
                  <li
                    key={lr.id}
                    className="flex flex-wrap items-center gap-2 text-sm p-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                  >
                    <span className="text-slate-700 dark:text-slate-200">
                      {lr.from_date} – {lr.to_date}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">{LEAVE_TYPE_LABELS[lr.leave_type]}</span>
                    <span
                      className={
                        lr.status === 'approved'
                          ? 'text-green-600 dark:text-green-400'
                          : lr.status === 'rejected'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {LEAVE_STATUS_LABELS[lr.status]}
                    </span>
                    {lr.days_count != null && (
                      <span className="text-slate-500 dark:text-slate-400">({lr.days_count} Tage)</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">Keine Anträge.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default Arbeitszeit
