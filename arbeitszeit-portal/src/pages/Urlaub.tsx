import { useState, useEffect, useCallback } from 'react'
import {
  fetchLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveRequest,
  type LeaveType,
  type LeaveStatus,
} from '../lib/leaveService'
import { exportUrlaubsbescheinigungPdf } from '../lib/exportCompliance'
import { fetchProfiles, getProfileDisplayName, getMyRole, type Profile } from '../lib/userService'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? ''))
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
    load()
  }, [load])

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
    load()
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
    load()
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
    load()
  }

  const profilesWithZeiterfassung = profiles.filter((p) => p.role !== 'leser' && p.role !== 'kunde')

  const targetUserId = filterUserId || null
  const targetProfile = targetUserId ? profiles.find((p) => p.id === targetUserId) : null
  const urlaubsanspruch = targetProfile?.vacation_days_per_year ?? 0
  const approvedUrlaubDays = targetUserId
    ? requests
        .filter(
          (r) =>
            r.user_id === targetUserId &&
            r.status === 'approved' &&
            r.leave_type === 'urlaub' &&
            r.from_date >= `${filterYear}-01-01` &&
            r.from_date <= `${filterYear}-12-31`
        )
        .reduce((sum, r) => sum + (r.days_count ?? 0), 0)
    : 0
  const resturlaub = Math.max(0, urlaubsanspruch - approvedUrlaubDays)

  return (
    <div className="max-w-4xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Urlaubsanträge</h2>

      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap gap-4 text-sm">
        <span className="text-slate-600">
          Urlaubsanspruch: {targetUserId ? (urlaubsanspruch > 0 ? `${urlaubsanspruch} Tage/Jahr` : '– (nicht in Stammdaten gesetzt)') : '–'}
        </span>
        <span className="font-medium text-slate-800">
          Resturlaub {filterYear}: {targetUserId ? (urlaubsanspruch > 0 ? `${resturlaub} Tage` : '–') : '–'}
        </span>
        <span className="text-slate-500">
          {targetProfile ? `für ${getProfileDisplayName(targetProfile)}` : 'Mitarbeiter auswählen'}
        </span>
      </div>

      {error && (
        <p className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {profilesWithZeiterfassung.length > 1 && (
          <label className="text-sm text-slate-700">
            Mitarbeiter:
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="ml-2 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
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
        <label className="text-sm text-slate-700">
          Jahr:
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
            className="ml-2 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
            aria-label="Jahr"
          >
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Status:
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="ml-2 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
            aria-label="Status"
          >
            <option value="">Alle</option>
            <option value="pending">Offen</option>
            <option value="approved">Genehmigt</option>
            <option value="rejected">Abgelehnt</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 rounded bg-vico-primary text-white text-sm hover:bg-vico-primary-hover"
        >
          {showCreate ? 'Abbrechen' : 'Antrag stellen'}
        </button>
        <button
          type="button"
          onClick={() => {
            const targetId = filterUserId || currentUserId || profiles[0]?.id
            if (!targetId) return
            const profile = profiles.find((p) => p.id === targetId)
            const name = profile ? getProfileDisplayName(profile) : 'Unbekannt'
            const approved = requests.filter((r) => r.status === 'approved' && r.user_id === targetId)
            const entitlement = profile?.vacation_days_per_year ?? null
            exportUrlaubsbescheinigungPdf(
              name,
              filterYear,
              approved.map((r) => ({ from_date: r.from_date, to_date: r.to_date, leave_type: r.leave_type, days_count: r.days_count })),
              entitlement
            )
          }}
          disabled={!filterUserId && !currentUserId}
          className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
          title="§ 6 Abs. 2 BUrlG – Bescheinigung bei Austritt"
        >
          Urlaubsbescheinigung (PDF)
        </button>
      </div>

      {showCreate && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <h3 className="font-medium text-slate-800">Neuer Urlaubsantrag</h3>
          {profilesWithZeiterfassung.length > 1 && isAdmin && (
            <p className="text-sm text-slate-600">
              {filterUserId ? `Antrag für ${getProfileDisplayName(profiles.find((p) => p.id === filterUserId) ?? { email: null, first_name: null, last_name: null })}` : 'Antrag für sich selbst (oder Mitarbeiter oben auswählen)'}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm text-slate-700">
              Von:
              <input
                type="date"
                value={createFrom}
                onChange={(e) => setCreateFrom(e.target.value)}
                className="ml-2 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
                aria-label="Von-Datum"
              />
            </label>
            <label className="text-sm text-slate-700">
              Bis:
              <input
                type="date"
                value={createTo}
                onChange={(e) => setCreateTo(e.target.value)}
                className="ml-2 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
                aria-label="Bis-Datum"
              />
            </label>
            <label className="text-sm text-slate-700">
              Art:
              <select
                value={createType}
                onChange={(e) => setCreateType(e.target.value as LeaveType)}
                className="ml-2 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
                aria-label="Abwesenheitsart"
              >
                {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="text"
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="Notiz (optional)"
              className="w-48 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800"
              aria-label="Notiz"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={createSaving || (profilesWithZeiterfassung.length > 1 && !filterUserId) || !currentUserId}
              className="px-3 py-1.5 rounded bg-vico-primary text-white text-sm hover:bg-vico-primary-hover disabled:opacity-50"
            >
              {createSaving ? 'Speichern…' : 'Antrag stellen'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Lade…</p>
      ) : requests.length === 0 ? (
        <p className="text-slate-500">Keine Urlaubsanträge gefunden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 font-medium text-slate-700">Mitarbeiter</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Von</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Bis</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Art</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Tage</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Status</th>
                <th className="text-left py-2 px-2 font-medium text-slate-700">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      onClick={() => setFilterUserId(r.user_id)}
                      className="text-slate-800 hover:text-vico-primary hover:underline text-left font-medium"
                      aria-label={`Urlaubsanspruch von ${r.user_name || r.user_email || r.user_id} anzeigen`}
                    >
                      {r.user_name || r.user_email || r.user_id}
                    </button>
                  </td>
                  <td className="py-2 px-2 text-slate-600">{r.from_date}</td>
                  <td className="py-2 px-2 text-slate-600">{r.to_date}</td>
                  <td className="py-2 px-2 text-slate-600">{LEAVE_TYPE_LABELS[r.leave_type]}</td>
                  <td className="py-2 px-2 text-slate-600">{r.days_count ?? '–'}</td>
                  <td className="py-2 px-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        r.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : r.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {LEAVE_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    {r.status === 'pending' && canApprove && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(r.id)}
                          disabled={approvingId === r.id}
                          className="px-2 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700 disabled:opacity-50"
                        >
                          Genehmigen
                        </button>
                        {rejectingId === r.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Grund (optional)"
                              className="w-24 px-1 py-0.5 text-xs border border-slate-300 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => handleReject(r.id)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                            >
                              Ablehnen
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingId(null)}
                              className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs hover:bg-slate-300"
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRejectingId(r.id)}
                            className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs hover:bg-red-200"
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
