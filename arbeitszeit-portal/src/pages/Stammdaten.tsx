import { useState, useEffect, useCallback } from 'react'
import { fetchProfiles, getProfileDisplayName, updateSollMinutesPerMonth, updateSollMinutesPerWeek, type Profile } from '../lib/userService'
import { formatMinutes } from '../../../shared/format'

const Stammdaten = () => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftSoll, setDraftSoll] = useState<Record<string, string>>({})
  const [draftSollWeek, setDraftSollWeek] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    setLoading(true)
    fetchProfiles()
      .then((list) => {
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
    setError(null)
    setSavingId(p.id)
    const { error: errMonth } = await updateSollMinutesPerMonth(p.id, valueMonth)
    if (errMonth) {
      setSavingId(null)
      setError(errMonth.message)
      return
    }
    const { error: errWeek } = await updateSollMinutesPerWeek(p.id, valueWeek)
    setSavingId(null)
    if (errWeek) {
      setError(errWeek.message)
      return
    }
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, soll_minutes_per_month: valueMonth, soll_minutes_per_week: valueWeek } : x)))
  }

  const profilesWithZeiterfassung = profiles.filter((p) => p.role !== 'leser' && p.role !== 'kunde')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Stammdaten AZK</h2>
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
    </div>
  )
}

export default Stammdaten
