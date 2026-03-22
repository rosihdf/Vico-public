import { useState, useEffect, useCallback } from 'react'
import {
  fetchProfiles,
  getProfileDisplayName,
  getMyRole,
  updateSollMinutes,
  updateVacationDays,
  updateUrlaubVjDeadlineOverride,
  type Profile,
} from '../lib/userService'
import { fetchUrlaubVjDeadlineSettings, setUrlaubVjDeadlineGlobal } from '../lib/leaveService'
import {
  fetchWorkSettings,
  updateWorkSettings,
  fetchWorkFreeDays,
  insertWorkFreeDay,
  deleteWorkFreeDay,
  refreshHolidays,
  BUNDESLAENDER,
  getWeekdayLabel,
  type WorkSettings,
  type WorkFreeDay,
} from '../lib/workSettingsService'
import { formatMinutes } from '../../../shared/format'

const Stammdaten = () => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftSoll, setDraftSoll] = useState<Record<string, string>>({})
  const [draftSollWeek, setDraftSollWeek] = useState<Record<string, string>>({})
  const [draftVacation, setDraftVacation] = useState<Record<string, string>>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [workSettings, setWorkSettings] = useState<WorkSettings | null>(null)
  const [workFreeDays, setWorkFreeDays] = useState<WorkFreeDay[]>([])
  const [holidaysRefreshing, setHolidaysRefreshing] = useState(false)
  const [holidaysMessage, setHolidaysMessage] = useState<string | null>(null)
  const [newFreeDate, setNewFreeDate] = useState('')
  const [newFreeLabel, setNewFreeLabel] = useState('')
  const [vjGlobalMonth, setVjGlobalMonth] = useState('3')
  const [vjGlobalDay, setVjGlobalDay] = useState('31')
  const [vjGlobalSaving, setVjGlobalSaving] = useState(false)
  const [draftVjMonth, setDraftVjMonth] = useState<Record<string, string>>({})
  const [draftVjDay, setDraftVjDay] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchProfiles(),
      getMyRole(),
      fetchWorkSettings(),
      fetchWorkFreeDays(),
    ])
      .then(([list, role, ws, freeDays]) => {
        setProfiles(list)
        setDraftSoll(
          list.reduce<Record<string, string>>((acc, p) => {
            acc[p.id] = p.soll_minutes_per_month != null ? String(p.soll_minutes_per_month) : ''
            return acc
          }, {})
        )
        setDraftSollWeek(
          list.reduce<Record<string, string>>((acc, p) => {
            acc[p.id] = p.soll_minutes_per_week != null ? String(p.soll_minutes_per_week) : ''
            return acc
          }, {})
        )
        setDraftVacation(
          list.reduce<Record<string, string>>((acc, p) => {
            acc[p.id] = p.vacation_days_per_year != null ? String(p.vacation_days_per_year) : ''
            return acc
          }, {})
        )
        setDraftVjMonth(
          list.reduce<Record<string, string>>((acc, p) => {
            acc[p.id] = p.urlaub_vj_deadline_month != null ? String(p.urlaub_vj_deadline_month) : ''
            return acc
          }, {})
        )
        setDraftVjDay(
          list.reduce<Record<string, string>>((acc, p) => {
            acc[p.id] = p.urlaub_vj_deadline_day != null ? String(p.urlaub_vj_deadline_day) : ''
            return acc
          }, {})
        )
        setIsAdmin(role === 'admin')
        if (role === 'admin') {
          void fetchUrlaubVjDeadlineSettings().then((s) => {
            setVjGlobalMonth(String(s.month))
            setVjGlobalDay(String(s.day))
          })
        }
        setWorkSettings(ws ?? null)
        setWorkFreeDays(freeDays ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSollChange = (profileId: string, value: string) => {
    setDraftSoll((prev) => ({ ...prev, [profileId]: value }))
  }
  const handleSollWeekChange = (profileId: string, value: string) => {
    setDraftSollWeek((prev) => ({ ...prev, [profileId]: value }))
  }
  const handleVacationChange = (profileId: string, value: string) => {
    setDraftVacation((prev) => ({ ...prev, [profileId]: value }))
  }

  const handleSaveSoll = async (p: Profile) => {
    const rawMonth = draftSoll[p.id]?.trim() ?? ''
    const valueMonth: number | null =
      rawMonth === '' ? null : parseInt(rawMonth, 10)
    if (
      rawMonth !== '' &&
      (valueMonth === null || isNaN(valueMonth) || valueMonth < 0)
    ) {
      setError('Bitte eine gültige Zahl (Minuten) für Soll/Monat eingeben.')
      return
    }
    const rawWeek = draftSollWeek[p.id]?.trim() ?? ''
    const valueWeek: number | null =
      rawWeek === '' ? null : parseInt(rawWeek, 10)
    if (
      rawWeek !== '' &&
      (valueWeek === null || isNaN(valueWeek) || valueWeek < 0)
    ) {
      setError('Bitte eine gültige Zahl (Minuten) für Soll/Woche eingeben.')
      return
    }
    const rawVacation = draftVacation[p.id]?.trim() ?? ''
    const valueVacation: number | null =
      rawVacation === '' ? null : parseFloat(rawVacation)
    if (
      rawVacation !== '' &&
      (valueVacation === null || isNaN(valueVacation) || valueVacation < 0)
    ) {
      setError('Bitte eine gültige Zahl für Urlaubstage/Jahr eingeben.')
      return
    }
    setError(null)
    setSavingId(p.id)
    let vjM: number | null | undefined
    let vjD: number | null | undefined
    if (isAdmin) {
      const rawVm = draftVjMonth[p.id]?.trim() ?? ''
      const rawVd = draftVjDay[p.id]?.trim() ?? ''
      if (rawVm === '' && rawVd === '') {
        vjM = null
        vjD = null
      } else {
        vjM = parseInt(rawVm, 10)
        vjD = parseInt(rawVd, 10)
        if (isNaN(vjM) || isNaN(vjD) || vjM < 1 || vjM > 12 || vjD < 1 || vjD > 31) {
          setError('Frist Resturlaub VJ: Tag (1–31) und Monat (1–12) beide ausfüllen oder beide leer lassen.')
          setSavingId(null)
          return
        }
      }
    }

    const [errSoll, errVacation, errVj] = await Promise.all([
      updateSollMinutes(p.id, valueMonth, valueWeek),
      updateVacationDays(p.id, valueVacation),
      isAdmin && vjM !== undefined
        ? updateUrlaubVjDeadlineOverride(p.id, vjM, vjD ?? null)
        : Promise.resolve({ error: null }),
    ])
    setSavingId(null)
    const err = errSoll || errVacation || errVj
    if (err?.error) {
      setError(err.error.message)
      return
    }
    setProfiles((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? {
              ...x,
              soll_minutes_per_month: valueMonth,
              soll_minutes_per_week: valueWeek,
              vacation_days_per_year: valueVacation,
              ...(isAdmin && vjM !== undefined
                ? { urlaub_vj_deadline_month: vjM, urlaub_vj_deadline_day: vjD ?? null }
                : {}),
            }
          : x
      )
    )
  }

  const handleSaveVjGlobal = async () => {
    if (!isAdmin) return
    const m = parseInt(vjGlobalMonth, 10)
    const d = parseInt(vjGlobalDay, 10)
    if (isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
      setError('Mandanten-Frist VJ: gültigen Tag und Monat eingeben.')
      return
    }
    setError(null)
    setVjGlobalSaving(true)
    const { error: err } = await setUrlaubVjDeadlineGlobal(m, d)
    setVjGlobalSaving(false)
    if (err) {
      setError(err.message)
      return
    }
  }

  const handleRefreshHolidays = async () => {
    setHolidaysMessage(null)
    setHolidaysRefreshing(true)
    const bundesland = workSettings?.bundesland ?? 'BE'
    const { error: err, count } = await refreshHolidays(bundesland)
    setHolidaysRefreshing(false)
    if (err) {
      setHolidaysMessage(err.message)
      return
    }
    setHolidaysMessage(`${count ?? 0} Feiertage aktualisiert (${bundesland}).`)
  }

  const handleSaveWorkSettings = async () => {
    if (!workSettings) return
    setError(null)
    const workDays = workSettings.work_days
    const hours = workSettings.hours_per_day
    const { error: err } = await updateWorkSettings(workSettings.id, workSettings.bundesland, workDays, hours)
    if (err) {
      setError(err.message)
      return
    }
    setHolidaysMessage(null)
  }

  const handleWorkSettingsChange = (updates: Partial<WorkSettings>) => {
    setWorkSettings((prev) => (prev ? { ...prev, ...updates } : null))
  }

  const handleToggleWorkDay = (day: number) => {
    if (!workSettings) return
    const current = workSettings.work_days
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b)
    handleWorkSettingsChange({ work_days: next })
  }

  const handleAddFreeDay = async () => {
    if (!newFreeDate.trim()) return
    setError(null)
    const { error: err } = await insertWorkFreeDay(newFreeDate.trim(), 'frei', newFreeLabel.trim() || null)
    if (err) {
      setError(err.message)
      return
    }
    setNewFreeDate('')
    setNewFreeLabel('')
    const days = await fetchWorkFreeDays()
    setWorkFreeDays(days)
  }

  const handleDeleteFreeDay = async (id: string) => {
    setError(null)
    const { error: err } = await deleteWorkFreeDay(id)
    if (err) {
      setError(err.message)
      return
    }
    setWorkFreeDays((prev) => prev.filter((d) => d.id !== id))
  }

  const profilesWithZeiterfassung = profiles.filter((p) => p.role !== 'leser' && p.role !== 'kunde')

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Stammdaten AZK</h2>

      {isAdmin && (
        <section className="space-y-3 p-4 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <h3 className="font-semibold text-slate-800 dark:text-amber-50">Resturlaub VJ – Mandanten-Frist (Orientierung)</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Standard-Frist im Kalenderjahr (z. B. 31.03.) für Hinweise im Urlaubsbereich; kein automatischer Verfall der Tage in
            der Datenbank. Pro Mitarbeiter optional unterhalb in der Tabelle überschreibbar.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-slate-700 dark:text-slate-300">
              Tag (1–31)
              <input
                type="number"
                min={1}
                max={31}
                value={vjGlobalDay}
                onChange={(e) => setVjGlobalDay(e.target.value)}
                className="block w-20 mt-0.5 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                aria-label="Frist Tag"
              />
            </label>
            <label className="text-sm text-slate-700 dark:text-slate-300">
              Monat (1–12)
              <input
                type="number"
                min={1}
                max={12}
                value={vjGlobalMonth}
                onChange={(e) => setVjGlobalMonth(e.target.value)}
                className="block w-20 mt-0.5 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                aria-label="Frist Monat"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleSaveVjGlobal()}
              disabled={vjGlobalSaving}
              className="px-3 py-1.5 rounded bg-vico-primary text-white text-sm hover:bg-vico-primary-hover disabled:opacity-50"
            >
              {vjGlobalSaving ? 'Speichern…' : 'Mandanten-Frist speichern'}
            </button>
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Feiertage & Arbeitseinstellungen</h3>

          {workSettings && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm text-slate-700 dark:text-slate-300">
                  Bundesland:
                  <select
                    value={workSettings.bundesland}
                    onChange={(e) => handleWorkSettingsChange({ bundesland: e.target.value })}
                    className="ml-2 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    aria-label="Bundesland"
                  >
                    {BUNDESLAENDER.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-700 dark:text-slate-300">
                  Std/Tag:
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={workSettings.hours_per_day}
                    onChange={(e) =>
                      handleWorkSettingsChange({ hours_per_day: parseFloat(e.target.value) || 8 })
                    }
                    className="ml-2 w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    aria-label="Stunden pro Tag"
                  />
                </label>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Arbeitstage: {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleToggleWorkDay(d)}
                      className={`mx-0.5 px-2 py-0.5 rounded text-sm ${
                        workSettings.work_days.includes(d)
                          ? 'bg-vico-primary text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                      }`}
                      aria-label={`${getWeekdayLabel(d)} ${workSettings.work_days.includes(d) ? 'abwählen' : 'wählen'}`}
                      aria-pressed={workSettings.work_days.includes(d)}
                    >
                      {getWeekdayLabel(d)}
                    </button>
                  ))}
                </span>
                <button
                  type="button"
                  onClick={handleSaveWorkSettings}
                  className="px-3 py-1 rounded bg-vico-primary text-white text-sm hover:bg-vico-primary-hover"
                >
                  Einstellungen speichern
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefreshHolidays}
              disabled={holidaysRefreshing}
              className="px-3 py-1.5 rounded bg-vico-primary text-white text-sm hover:bg-vico-primary-hover disabled:opacity-50"
              aria-label="Feiertage von feiertage-api.de laden"
            >
              {holidaysRefreshing ? 'Lade…' : 'Feiertage aktualisieren'}
            </button>
            {holidaysMessage && (
              <span
                className={`text-sm ${
                  holidaysMessage.includes('aktualisiert')
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {holidaysMessage}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Freie Tage (Betriebsferien, Brückentage)</h4>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={newFreeDate}
                onChange={(e) => setNewFreeDate(e.target.value)}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                aria-label="Datum"
              />
              <input
                type="text"
                value={newFreeLabel}
                onChange={(e) => setNewFreeLabel(e.target.value)}
                placeholder="z.B. Betriebsferien"
                className="w-40 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                aria-label="Bezeichnung"
              />
              <button
                type="button"
                onClick={handleAddFreeDay}
                disabled={!newFreeDate.trim()}
                className="px-3 py-1 rounded bg-vico-primary text-white text-sm hover:bg-vico-primary-hover disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
            {workFreeDays.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {workFreeDays.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span className="text-slate-700 dark:text-slate-300">{d.date}</span>
                    {d.label && <span className="text-slate-600 dark:text-slate-300">({d.label})</span>}
                    <button
                      type="button"
                      onClick={() => handleDeleteFreeDay(d.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs"
                      aria-label="Entfernen"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Soll-Arbeitszeit pro Monat und pro Woche (in Minuten) pro Mitarbeiter. Leer = nicht gesetzt. 40 h/Woche = 2400 Min, 40 h/Monat ≈ 2400 Min (bei 4,33 Wochen).
      </p>

      {error && (
        <p
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Lade…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-600">
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Mitarbeiter</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Rolle</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Soll Min/Monat</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Soll Min/Woche</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Urlaubstage/Jahr</th>
                {isAdmin && <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Frist VJ Tag/Mo</th>}
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {profilesWithZeiterfassung.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="py-2 px-2 text-slate-800 dark:text-slate-100">
                    {getProfileDisplayName(p)}
                    {p.email && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{p.email}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{p.role}</td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={0}
                      step={60}
                      value={draftSoll[p.id] ?? ''}
                      onChange={(e) => handleSollChange(p.id, e.target.value)}
                      placeholder="z.B. 2400"
                      className="w-28 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      aria-label={`Soll Min/Monat für ${getProfileDisplayName(p)}`}
                    />
                    {p.soll_minutes_per_month != null && (
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        = {p.soll_minutes_per_month != null ? formatMinutes(p.soll_minutes_per_month) : '–'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={0}
                      step={60}
                      value={draftSollWeek[p.id] ?? ''}
                      onChange={(e) => handleSollWeekChange(p.id, e.target.value)}
                      placeholder="z.B. 2400"
                      className="w-28 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      aria-label={`Soll Min/Woche für ${getProfileDisplayName(p)}`}
                    />
                    {p.soll_minutes_per_week != null && (
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        = {p.soll_minutes_per_week != null ? formatMinutes(p.soll_minutes_per_week) : '–'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={0}
                      max={365}
                      step={0.5}
                      value={draftVacation[p.id] ?? ''}
                      onChange={(e) => handleVacationChange(p.id, e.target.value)}
                      placeholder="z.B. 28"
                      className="w-24 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      aria-label={`Urlaubstage/Jahr für ${getProfileDisplayName(p)}`}
                    />
                  </td>
                  {isAdmin && (
                    <td className="py-2 px-2">
                      <div className="flex gap-1 items-center">
                        <input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="T"
                          value={draftVjDay[p.id] ?? ''}
                          onChange={(e) => setDraftVjDay((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="w-14 px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                          title="Optional: Tag Frist Resturlaub VJ"
                          aria-label={`VJ-Frist Tag ${getProfileDisplayName(p)}`}
                        />
                        <span className="text-slate-400 dark:text-slate-500">/</span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          placeholder="M"
                          value={draftVjMonth[p.id] ?? ''}
                          onChange={(e) => setDraftVjMonth((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="w-14 px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                          title="Optional: Monat Frist Resturlaub VJ"
                          aria-label={`VJ-Frist Monat ${getProfileDisplayName(p)}`}
                        />
                      </div>
                    </td>
                  )}
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      onClick={() => handleSaveSoll(p)}
                      disabled={savingId === p.id}
                      className="px-2 py-1 rounded bg-vico-primary text-white text-sm hover:bg-vico-primary-hover disabled:opacity-50"
                      aria-label="Speichern"
                    >
                      {savingId === p.id ? 'Speichern…' : 'Speichern'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && profilesWithZeiterfassung.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">Keine Mitarbeiter mit Zeiterfassung gefunden.</p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-6 pt-4 border-t border-slate-200 dark:border-slate-600" role="note">
        Zeiteinträge und Urlaubsdaten werden mindestens 8 Jahre aufbewahrt (ArbZG § 16, MiLoG § 17, Steuerrecht).
      </p>
    </div>
  )
}

export default Stammdaten
