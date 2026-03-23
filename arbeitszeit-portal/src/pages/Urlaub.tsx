import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  fetchLeaveBalanceSnapshot,
  acknowledgeLeaveVjHint,
  fetchLeaveExtraEntitlements,
  insertLeaveExtraEntitlement,
  deleteLeaveExtraEntitlement,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveRequest,
  type LeaveType,
  type LeaveStatus,
  type LeaveBalanceSnapshot,
  type LeaveExtraEntitlement,
} from '../lib/leaveService'
import { exportUrlaubsbescheinigungPdf } from '../lib/exportCompliance'
import { fetchProfiles, getProfileDisplayName, getMyRole, type Profile } from '../lib/userService'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

const YEAR_OPTIONS = (): number[] => {
  const y = new Date().getFullYear()
  return [y - 2, y - 1, y, y + 1]
}

const formatDeDate = (iso: string): string => {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
  } catch {
    return iso
  }
}

const Urlaub = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canApprove, setCanApprove] = useState(false)
  const [filterUserId, setFilterUserId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterYear, setFilterYear] = useState<number>(() => new Date().getFullYear())
  const [showCreate, setShowCreate] = useState(false)
  const [createFrom, setCreateFrom] = useState('')
  const [createTo, setCreateTo] = useState('')
  const [createType, setCreateType] = useState<LeaveType>('urlaub')
  const [createNotes, setCreateNotes] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [balance, setBalance] = useState<LeaveBalanceSnapshot | null>(null)
  const [extras, setExtras] = useState<LeaveExtraEntitlement[]>([])
  const [partialId, setPartialId] = useState<string | null>(null)
  const [partialFrom, setPartialFrom] = useState('')
  const [partialTo, setPartialTo] = useState('')
  const [ackSaving, setAckSaving] = useState(false)
  const [extraDays, setExtraDays] = useState('')
  const [extraExpires, setExtraExpires] = useState('')
  const [extraTitle, setExtraTitle] = useState('Zusatzurlaub')
  const [extraSaving, setExtraSaving] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [teamBalanceRows, setTeamBalanceRows] = useState<
    Array<{ profile: Profile; balance: LeaveBalanceSnapshot | null }>
  >([])
  const [teamBalancesLoading, setTeamBalancesLoading] = useState(false)

  const profilesWithZeiterfassung = useMemo(
    () => profiles.filter((p) => p.role !== 'leser' && p.role !== 'kunde'),
    [profiles]
  )

  const nameQueryNorm = nameQuery.trim().toLowerCase()

  const filteredRequests = useMemo(() => {
    if (!nameQueryNorm) return requests
    return requests.filter((r) => {
      const n = (r.user_name ?? '').toLowerCase()
      const e = (r.user_email ?? '').toLowerCase()
      return n.includes(nameQueryNorm) || e.includes(nameQueryNorm)
    })
  }, [requests, nameQueryNorm])

  const filteredTeamRows = useMemo(() => {
    if (!nameQueryNorm) return teamBalanceRows
    return teamBalanceRows.filter(({ profile }) => {
      const name = getProfileDisplayName(profile).toLowerCase()
      const email = (profile.email ?? '').toLowerCase()
      return name.includes(nameQueryNorm) || email.includes(nameQueryNorm)
    })
  }, [teamBalanceRows, nameQueryNorm])

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => setCurrentUserId(data.user?.id ?? ''))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [role, profs, reqs] = await Promise.all([
      getMyRole(),
      fetchProfiles(),
      fetchLeaveRequests(
        filterUserId || null,
        `${filterYear}-01-01`,
        `${filterYear}-12-31`,
        (filterStatus || null) as LeaveStatus | null
      ),
    ])
    setIsAdmin(role === 'admin')
    setCanApprove(role === 'admin' || role === 'teamleiter')
    setProfiles(profs)
    setRequests(reqs)
    setLoading(false)
  }, [filterUserId, filterStatus, filterYear])

  useEffect(() => {
    void load()
  }, [load])

  const refreshBalanceAndExtras = useCallback(async () => {
    const uid = filterUserId || currentUserId
    if (!uid) {
      setBalance(null)
      setExtras([])
      return
    }
    const [snap, ex] = await Promise.all([
      fetchLeaveBalanceSnapshot(uid, filterYear),
      fetchLeaveExtraEntitlements(uid),
    ])
    setBalance(snap)
    setExtras(ex)
  }, [filterUserId, currentUserId, filterYear])

  useEffect(() => {
    void refreshBalanceAndExtras()
  }, [refreshBalanceAndExtras])

  useEffect(() => {
    if (!canApprove || profilesWithZeiterfassung.length <= 1) {
      setTeamBalanceRows([])
      setTeamBalancesLoading(false)
      return
    }
    let cancelled = false
    setTeamBalancesLoading(true)
    void (async () => {
      const rows = await Promise.all(
        profilesWithZeiterfassung.map(async (p) => ({
          profile: p,
          balance: await fetchLeaveBalanceSnapshot(p.id, filterYear),
        }))
      )
      if (!cancelled) {
        setTeamBalanceRows(rows)
        setTeamBalancesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canApprove, filterYear, profilesWithZeiterfassung])

  const handleCreate = async () => {
    if (!createFrom || !createTo) {
      setError('Von- und Bis-Datum sind Pflicht.')
      return
    }
    if (new Date(createTo) < new Date(createFrom)) {
      setError('Bis-Datum muss nach Von-Datum liegen.')
      return
    }
    setError(null)
    setCreateSaving(true)
    const targetUserId = filterUserId || currentUserId || profiles[0]?.id
    if (!targetUserId) {
      setError('Kein Benutzer ausgewählt.')
      setCreateSaving(false)
      return
    }
    const { error: err } = await createLeaveRequest(targetUserId, createFrom, createTo, createType, createNotes || null)
    setCreateSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setShowCreate(false)
    setCreateFrom('')
    setCreateTo('')
    setCreateNotes('')
    await load()
    await refreshBalanceAndExtras()
  }

  const handleApprove = async (id: string) => {
    setError(null)
    setApprovingId(id)
    const { error: err } = await approveLeaveRequest(id, true)
    setApprovingId(null)
    if (err) {
      setError(err.message)
      return
    }
    await load()
    await refreshBalanceAndExtras()
  }

  const handleOpenPartial = (r: LeaveRequest) => {
    setPartialId(r.id)
    setPartialFrom(r.from_date)
    setPartialTo(r.to_date)
  }

  const handleConfirmPartial = async () => {
    if (!partialId || !partialFrom || !partialTo) return
    const orig = requests.find((x) => x.id === partialId)
    if (!orig) return
    if (partialFrom < orig.from_date || partialTo > orig.to_date) {
      setError('Teilgenehmigung: Zeitraum muss innerhalb des Antrags liegen.')
      return
    }
    if (new Date(partialTo) < new Date(partialFrom)) {
      setError('Teilgenehmigung: Bis muss nach Von liegen.')
      return
    }
    setError(null)
    setApprovingId(partialId)
    const { error: err } = await approveLeaveRequest(partialId, true, null, {
      approvedFrom: partialFrom,
      approvedTo: partialTo,
    })
    setApprovingId(null)
    setPartialId(null)
    if (err) {
      setError(err.message)
      return
    }
    await load()
    await refreshBalanceAndExtras()
  }

  const handleReject = async (id: string) => {
    setError(null)
    setRejectingId(id)
    const { error: err } = await approveLeaveRequest(id, false, rejectReason || undefined)
    setRejectingId(null)
    setRejectReason('')
    if (err) {
      setError(err.message)
      return
    }
    await load()
    await refreshBalanceAndExtras()
  }

  const handleAckVj = async () => {
    setAckSaving(true)
    setError(null)
    const { error: err } = await acknowledgeLeaveVjHint(filterYear)
    setAckSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    await refreshBalanceAndExtras()
  }

  const handleAddExtra = async () => {
    const uid = filterUserId || currentUserId
    if (!uid || !isAdmin) return
    const d = parseFloat(extraDays.replace(',', '.'))
    if (isNaN(d) || d <= 0) {
      setError('Bitte gültige Tage für Zusatzurlaub eingeben.')
      return
    }
    if (!extraExpires.trim()) {
      setError('Ablaufdatum für Zusatzurlaub eingeben.')
      return
    }
    setExtraSaving(true)
    setError(null)
    const { error: err } = await insertLeaveExtraEntitlement(uid, d, extraExpires.trim(), extraTitle || 'Zusatzurlaub', false)
    setExtraSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setExtraDays('')
    setExtraExpires('')
    setExtraTitle('Zusatzurlaub')
    await refreshBalanceAndExtras()
  }

  const handleDeleteExtra = async (id: string) => {
    if (!isAdmin) return
    const { error: err } = await deleteLeaveExtraEntitlement(id)
    if (err) {
      setError(err.message)
      return
    }
    await refreshBalanceAndExtras()
  }

  const targetUserId = filterUserId || null

  const canAckVjHint = Boolean(
    currentUserId && (!filterUserId || filterUserId === currentUserId)
  )

  const displayRange = (r: LeaveRequest): string => {
    if (r.status === 'approved' && r.approved_from_date && r.approved_to_date) {
      if (r.approved_from_date !== r.from_date || r.approved_to_date !== r.to_date) {
        return `${r.approved_from_date} – ${r.approved_to_date} (Antrag: ${r.from_date} – ${r.to_date})`
      }
    }
    return `${r.from_date} – ${r.to_date}`
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Urlaubanträge</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Urlaub (Jahresanspruch), Resturlaub, Anträge und Freigaben. Suche filtert Mitarbeiterliste und Antragstabelle nach Name
          oder E-Mail.
        </p>
      </div>

      <div className="space-y-3" role="search" aria-label="Urlaubsanträge filtern">
        <div
          className={`grid gap-3 items-end ${
            profilesWithZeiterfassung.length > 1
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          {profilesWithZeiterfassung.length > 1 && (
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mitarbeiter</span>
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="w-full min-w-0 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                aria-label="Mitarbeiter filtern"
              >
                <option value="">Alle</option>
                {profilesWithZeiterfassung.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getProfileDisplayName(p)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Jahr</span>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
              className="w-full min-w-0 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
              aria-label="Jahr"
            >
              {YEAR_OPTIONS().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full min-w-0 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
              aria-label="Status"
            >
              <option value="">Alle</option>
              <option value="pending">Offen</option>
              <option value="approved">Genehmigt</option>
              <option value="rejected">Abgelehnt</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <label className="flex flex-col gap-1.5 w-full min-w-0 sm:flex-1 sm:min-w-[12rem]">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Suche</span>
            <input
              type="search"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Name oder E-Mail"
              className="w-full min-w-0 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
              aria-label="Suche nach Name oder E-Mail"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end shrink-0">
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="flex-1 min-h-[40px] sm:flex-initial px-3 py-2 rounded-lg bg-vico-primary text-white text-sm font-medium hover:bg-vico-primary-hover"
            >
              {showCreate ? 'Abbrechen' : 'Antrag stellen'}
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const tid = filterUserId || currentUserId || profiles[0]?.id
                  if (!tid) return
                  const profile = profiles.find((p) => p.id === tid)
                  const name = profile ? getProfileDisplayName(profile) : 'Unbekannt'
                  const approved = requests.filter((r) => r.status === 'approved' && r.user_id === tid)
                  const entitlement = profile?.vacation_days_per_year ?? null
                  await exportUrlaubsbescheinigungPdf(
                    name,
                    filterYear,
                    approved.map((r) => ({
                      from_date: r.from_date,
                      to_date: r.to_date,
                      leave_type: r.leave_type,
                      days_count: r.days_count,
                    })),
                    entitlement,
                    supabase
                  )
                })()
              }}
              disabled={!filterUserId && !currentUserId}
              className="flex-1 min-h-[40px] sm:flex-initial px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
              title="§ 6 Abs. 2 BUrlG – Bescheinigung bei Austritt"
            >
              Urlaubsbescheinigung (PDF)
            </button>
          </div>
        </div>
      </div>

      {canApprove && profilesWithZeiterfassung.length > 1 && (
        <section
          className="p-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 space-y-2"
          aria-labelledby="team-urlaub-heading"
        >
          <h3 id="team-urlaub-heading" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Mitarbeiter: Urlaub &amp; Resturlaub ({filterYear})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Urlaub = Jahresanspruch laut Stammdaten; Resturlaub = Übertrag Vorjahr (Stand berechnet). Gefiltert durch die Suche oben.
          </p>
          {teamBalancesLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Lade Übersicht…</p>
          ) : filteredTeamRows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {nameQueryNorm ? 'Keine Mitarbeiter für diese Suche.' : 'Keine Einträge.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[20rem]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-600">
                    <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Name</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Urlaub (Tage/Jahr)</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Resturlaub (VJ)</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Verfügbar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeamRows.map(({ profile, balance: rowBal }) => (
                    <tr
                      key={profile.id}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => setFilterUserId(profile.id)}
                          className="text-left font-medium text-slate-800 dark:text-slate-100 hover:text-vico-primary hover:underline"
                          aria-label={`${getProfileDisplayName(profile)} auswählen`}
                        >
                          {getProfileDisplayName(profile)}
                        </button>
                        {profile.email && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400 truncate max-w-[14rem]">
                            {profile.email}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {rowBal != null ? rowBal.days_total : '–'}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {rowBal != null ? rowBal.days_carried_over : '–'}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {rowBal != null ? rowBal.available_statutory.toFixed(1) : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {balance && targetUserId && (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 space-y-3 text-sm">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Saldo {filterYear}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 p-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Urlaub</p>
              <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">{balance.days_total}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Jahresanspruch (Tage / Jahr)</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 p-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Resturlaub</p>
              <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                {balance.days_carried_over}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Übertrag aus Vorjahr (Tage)</p>
            </div>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-600">
            <li>
              Genehmigt (Urlaub, Jahr): <strong className="tabular-nums">{balance.approved_urlaub_in_year}</strong> Tage
            </li>
            <li>
              Ausstehend (Urlaub, Jahr): <strong className="tabular-nums">{balance.pending_urlaub_in_year}</strong> Tage
            </li>
            <li>
              Zusatzurlaub-Posten (Summe Rest): <strong className="tabular-nums">{balance.zusatz_sum}</strong> Tage
            </li>
            <li>
              Verfügbar (gesetzlicher Topf inkl. Übertrag − genehmigt − ausstehend):{' '}
              <strong className="tabular-nums">{balance.available_statutory.toFixed(1)}</strong> Tage
            </li>
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            Verbrauchsreihenfolge bei Auszahlung: Zusatzposten (frühestes Ablaufdatum) → Rest VJ → laufendes Jahr (Planung; Buchung
            erfolgt über genehmigte Anträge).
          </p>
          {balance.days_carried_over > 0 && (
            <div className="mt-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-50 text-xs space-y-2">
              <p>
                <strong>Hinweis Resturlaub Vorjahr:</strong> Sie haben <strong>{balance.days_carried_over}</strong> übertragene
                Urlaubstage. Bitte rechtzeitig Urlaub beantragen. Fristdatum (Orientierung für dieses Jahr, kein automatischer
                Verfall in der App): <strong>{formatDeDate(balance.vj_deadline)}</strong>. Texte und Fristen extern / rechtlich
                mit Ihrem Betrieb abstimmen.
              </p>
              {canAckVjHint && (
                <button
                  type="button"
                  onClick={() => void handleAckVj()}
                  disabled={ackSaving || balance.vj_hint_acknowledged}
                  className="px-3 py-1.5 rounded bg-amber-700 text-white text-xs font-medium hover:bg-amber-800 disabled:opacity-50"
                  aria-label="Hinweis zur Kenntnis genommen"
                >
                  {balance.vj_hint_acknowledged ? 'Hinweis bestätigt' : ackSaving ? 'Speichern…' : 'Hinweis gelesen – bestätigen'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && targetUserId && (
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 space-y-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Zusatzurlaub-Posten (Admin)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mehrere Posten mit Ablaufdatum möglich. Rest manuell gepflegt; bei Bedarf anpassen oder Posten löschen.
          </p>
          {extras.length > 0 && (
            <ul className="text-sm space-y-1">
              {extras.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 justify-between border-b border-slate-100 dark:border-slate-600 py-1">
                  <span>
                    {e.title}: <strong>{e.days_remaining}</strong> Tage bis {e.expires_on}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteExtra(e.id)}
                    className="text-red-600 dark:text-red-400 text-xs hover:underline"
                    aria-label="Posten löschen"
                  >
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 items-end">
            <div className="min-w-0 sm:max-w-[8rem]">
              <label htmlFor="extra-days" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tage
              </label>
              <input
                id="extra-days"
                type="text"
                inputMode="decimal"
                value={extraDays}
                onChange={(e) => setExtraDays(e.target.value)}
                className="w-full min-w-0 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                aria-label="Zusatzurlaub Tage"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="extra-expires" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Ablauf
              </label>
              <input
                id="extra-expires"
                type="date"
                value={extraExpires}
                onChange={(e) => setExtraExpires(e.target.value)}
                className="w-full min-w-0 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                aria-label="Ablaufdatum"
              />
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <label htmlFor="extra-title" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Titel
              </label>
              <input
                id="extra-title"
                type="text"
                value={extraTitle}
                onChange={(e) => setExtraTitle(e.target.value)}
                className="w-full min-w-0 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                aria-label="Titel"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1 flex items-end">
              <button
                type="button"
                onClick={() => void handleAddExtra()}
                disabled={extraSaving}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-vico-primary text-white text-sm font-medium hover:bg-vico-primary-hover disabled:opacity-50"
              >
                Posten hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}

      {partialId && (
        <div
          className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 space-y-2"
          role="dialog"
          aria-labelledby="partial-heading"
        >
          <h3 id="partial-heading" className="font-medium text-slate-800 dark:text-slate-100">
            Teilgenehmigung
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">Genehmigter Zeitraum muss innerhalb des Antrags liegen.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-xl">
            <div className="min-w-0">
              <label htmlFor="partial-from" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Genehmigt von
              </label>
              <input
                id="partial-from"
                type="date"
                value={partialFrom}
                onChange={(e) => setPartialFrom(e.target.value)}
                className="w-full min-w-0 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                aria-label="Genehmigt von"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="partial-to" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Genehmigt bis
              </label>
              <input
                id="partial-to"
                type="date"
                value={partialTo}
                onChange={(e) => setPartialTo(e.target.value)}
                className="w-full min-w-0 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                aria-label="Genehmigt bis"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleConfirmPartial()}
              disabled={approvingId === partialId}
              className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setPartialId(null)}
              className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-500"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 space-y-3">
          <h3 className="font-medium text-slate-800 dark:text-slate-100">Neuer Urlaubsantrag</h3>
          {profilesWithZeiterfassung.length > 1 && isAdmin && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {(() => {
                const sel = profiles.find((p) => p.id === filterUserId)
                if (filterUserId && sel) return `Antrag für ${getProfileDisplayName(sel)}`
                return 'Antrag für sich selbst (oder Mitarbeiter oben auswählen)'
              })()}
            </p>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label htmlFor="urlaub-create-from" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Von
                </label>
                <input
                  id="urlaub-create-from"
                  type="date"
                  value={createFrom}
                  onChange={(e) => setCreateFrom(e.target.value)}
                  className="w-full min-w-0 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                  aria-label="Von-Datum"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="urlaub-create-to" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Bis
                </label>
                <input
                  id="urlaub-create-to"
                  type="date"
                  value={createTo}
                  onChange={(e) => setCreateTo(e.target.value)}
                  className="w-full min-w-0 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                  aria-label="Bis-Datum"
                />
              </div>
            </div>
            <div className="max-w-full sm:max-w-md">
              <label htmlFor="urlaub-create-type" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Art
              </label>
              <select
                id="urlaub-create-type"
                value={createType}
                onChange={(e) => setCreateType(e.target.value as LeaveType)}
                className="w-full min-w-0 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                aria-label="Abwesenheitsart"
              >
                {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="urlaub-create-notes" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Notiz (optional)
              </label>
              <input
                id="urlaub-create-notes"
                type="text"
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="z. B. Vertretung"
                className="w-full max-w-xl px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                aria-label="Notiz zum Antrag"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={createSaving || (profilesWithZeiterfassung.length > 1 && !filterUserId) || !currentUserId}
                className="px-4 py-2 rounded-lg bg-vico-primary text-white text-sm font-medium hover:bg-vico-primary-hover disabled:opacity-50"
              >
                {createSaving ? 'Speichern…' : 'Antrag stellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Lade…</p>
      ) : requests.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Keine Urlaubsanträge für diese Filter.</p>
      ) : filteredRequests.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Keine Anträge für die aktuelle Suche (Name/E-Mail).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-600">
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Mitarbeiter</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Zeitraum</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Art</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Tage</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Status</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700 dark:text-slate-300">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      onClick={() => setFilterUserId(r.user_id)}
                      className="text-slate-800 dark:text-slate-100 hover:text-vico-primary hover:underline text-left font-medium"
                      aria-label={`Filter ${r.user_name || r.user_email || r.user_id}`}
                    >
                      {r.user_name || r.user_email || r.user_id}
                    </button>
                  </td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300 text-xs">{displayRange(r)}</td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{LEAVE_TYPE_LABELS[r.leave_type]}</td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{r.days_count ?? '–'}</td>
                  <td className="py-2 px-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        r.status === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                          : r.status === 'rejected'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                      }`}
                    >
                      {LEAVE_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    {r.status === 'pending' && canApprove && (
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleApprove(r.id)}
                            disabled={approvingId === r.id}
                            className="px-2 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700 disabled:opacity-50"
                          >
                            Genehmigen
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPartial(r)}
                            disabled={approvingId === r.id}
                            className="px-2 py-1 rounded bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100 text-xs hover:bg-blue-200 dark:hover:bg-blue-800/60"
                          >
                            Teilweise
                          </button>
                        </div>
                        {rejectingId === r.id ? (
                          <div className="flex gap-1 flex-wrap">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Grund (optional)"
                              className="w-28 px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() => void handleReject(r.id)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                            >
                              Ablehnen
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingId(null)}
                              className="px-2 py-1 rounded bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100 text-xs hover:bg-slate-300 dark:hover:bg-slate-500"
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRejectingId(r.id)}
                            className="px-2 py-1 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 text-xs hover:bg-red-200 dark:hover:bg-red-800/50 w-fit"
                          >
                            Ablehnen
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Urlaub
