import { useState, useEffect, useCallback } from 'react'
import { fetchProfiles, getProfileDisplayName, getMyRole, updateSollMinutes, updateVacationDays, type Profile } from '../lib/userService'
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
        setIsAdmin(role === 'admin')
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
    const [errSoll, errVacation] = await Promise.all([
      updateSollMinutes(p.id, valueMonth, valueWeek),
      updateVacationDays(p.id, valueVacation),
    ])
    setSavingId(null)
    const err = errSoll || errVacation
    if (err?.error) {
      setError(err.error.message)
      return
    }
    setProfiles((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, soll_minutes_per_month: valueMonth, soll_minutes_per_week: valueWeek, vacation_days_per_year: valueVacation }
          : x
      )
    )
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
      <h2 className="text-lg font-bold text-slate-800">Stammdaten AZK</h2>

      {isAdmin && (
        <section className="space-y-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h3 className="font-semibold text-slate-800">Feiertage & Arbeitseinstellungen</h3>

          {workSettings && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm text-slate-700">
                  Bundesland:
                  <select
                    value={workSettings.bundesland}
                    onChange={(e) => handleWorkSettingsChange({ bundesland: e.target.value })}
                    className="ml-2 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
                    aria-label="Bundesland"
                  >
                    {BUNDESLAENDER.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-700">
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
                    className="ml-2 w-20 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
                    aria-label="Stunden pro Tag"
                  />
                </label>
                <span className="text-sm text-slate-600">
                  Arbeitstage: {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleToggleWorkDay(d)}
                      className={`mx-0.5 px-2 py-0.5 rounded text-sm ${
                        workSettings.work_days.includes(d)
                          ? 'bg-vico-primary text-white'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
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
              <span className={`text-sm ${holidaysMessage.includes('aktualisiert') ? 'text-green-700' : 'text-red-600'}`}>
                {holidaysMessage}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Freie Tage (Betriebsferien, Brückentage)</h4>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={newFreeDate}
                onChange={(e) => setNewFreeDate(e.target.value)}
                className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
                aria-label="Datum"
              />
              <input
                type="text"
                value={newFreeLabel}
                onChange={(e) => setNewFreeLabel(e.target.value)}
                placeholder="z.B. Betriebsferien"
                className="w-40 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
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
                    <span className="text-slate-700">{d.date}</span>
                    {d.label && <span className="text-slate-600">({d.label})</span>}
                    <button
                      type="button"
                      onClick={() => handleDeleteFreeDay(d.id)}
                      className="text-red-600 hover:text-red-800 text-xs"
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

      <p className="text-sm text-slate-600">
        Soll-Arbeitszeit pro Monat und pro Woche (in Minuten) pro Mitarbeiter. Leer = nicht gesetzt. 40 h/Woche = 2400 Min, 40 h/Monat ≈ 2400 Min (bei 4,33 Wochen).
      </p>

      {error && (
        <p className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Lade…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 font-medium text-slate-700">Mitarbeiter</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Rolle</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Soll Min/Monat</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Soll Min/Woche</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Urlaubstage/Jahr</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {profilesWithZeiterfassung.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2 text-slate-800">
                    {getProfileDisplayName(p)}
                    {p.email && (
                      <span className="block text-xs text-slate-500">{p.email}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-slate-600">{p.role}</td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={0}
                      step={60}
                      value={draftSoll[p.id] ?? ''}
                      onChange={(e) => handleSollChange(p.id, e.target.value)}
                      placeholder="z.B. 2400"
                      className="w-28 px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-800"
                      aria-label={`Soll Min/Monat für ${getProfileDisplayName(p)}`}
                    />
                    {p.soll_minutes_per_month != null && (
                      <span className="ml-2 text-xs text-slate-500">
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
                      className="w-28 px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-800"
                      aria-label={`Soll Min/Woche für ${getProfileDisplayName(p)}`}
                    />
                    {p.soll_minutes_per_week != null && (
                      <span className="ml-2 text-xs text-slate-500">
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
                      className="w-24 px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-800"
                      aria-label={`Urlaubstage/Jahr für ${getProfileDisplayName(p)}`}
                    />
                  </td>
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
        <p className="text-slate-500">Keine Mitarbeiter mit Zeiterfassung gefunden.</p>
      )}

      <p className="text-xs text-slate-500 mt-6 pt-4 border-t border-slate-200" role="note">
        Zeiteinträge und Urlaubsdaten werden mindestens 8 Jahre aufbewahrt (ArbZG § 16, MiLoG § 17, Steuerrecht).
      </p>
    </div>
  )
}

export default Stammdaten
