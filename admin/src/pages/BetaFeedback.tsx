import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchBetaFeedbackList,
  setBetaFeedbackArchived,
  updateBetaFeedbackAdmin,
  type BetaFeedbackListView,
  type BetaFeedbackRow,
} from '../lib/betaFeedbackService'

const CATEGORY_LABELS: Record<string, string> = {
  ui_layout: 'Darstellung / Layout',
  flow_logic: 'Ablauf / Logik',
  missing_feature: 'Funktion fehlt',
  remove_feature: 'Funktion überflüssig',
  bug: 'Bug',
  other: 'Sonstiges',
}

const APP_LABELS: Record<string, string> = {
  main: 'Haupt-App',
  kundenportal: 'Kundenportal',
  arbeitszeit_portal: 'Arbeitszeit',
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'triaging', label: 'In Prüfung' },
  { value: 'planned', label: 'Geplant' },
  { value: 'done', label: 'Umgesetzt' },
  { value: 'rejected', label: 'Abgelehnt' },
  { value: 'duplicate', label: 'Duplikat' },
] as const

const PRIORITY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'p0', label: 'P0' },
  { value: 'p1', label: 'P1' },
  { value: 'p2', label: 'P2' },
  { value: 'p3', label: 'P3' },
] as const

type TenantOpt = { id: string; name: string }

const BetaFeedback = () => {
  const [tenantFilter, setTenantFilter] = useState<string>('all')
  const [viewFilter, setViewFilter] = useState<BetaFeedbackListView>('active')
  const [tenants, setTenants] = useState<TenantOpt[]>([])
  const [rows, setRows] = useState<BetaFeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadTenants = useCallback(async () => {
    const { data, error: err } = await supabase.from('tenants').select('id, name').order('name')
    if (!err && data) {
      setTenants(data.map((t) => ({ id: t.id as string, name: String(t.name) })))
    }
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { rows: list, error: err } = await fetchBetaFeedbackList(
      tenantFilter === 'all' ? 'all' : tenantFilter,
      viewFilter
    )
    if (err) setError(err)
    setRows(list)
    setLoading(false)
  }, [tenantFilter, viewFilter])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const handleRowFieldChange = async (
    row: BetaFeedbackRow,
    field: 'status' | 'priority' | 'internal_note',
    value: string
  ) => {
    const nextStatus = field === 'status' ? value : row.status
    const nextPriority =
      field === 'priority' ? (value === '' ? null : value) : row.priority
    const nextNote = field === 'internal_note' ? value : row.internal_note ?? ''
    setSavingId(row.id)
    const r = await updateBetaFeedbackAdmin(row.id, {
      status: nextStatus,
      priority: nextPriority,
      internal_note: nextNote.trim() ? nextNote.trim() : null,
    })
    setSavingId(null)
    if (!r.ok) {
      setError(r.error ?? 'Speichern fehlgeschlagen')
      return
    }
    setRows((prev) =>
      prev.map((x) =>
        x.id === row.id
          ? {
              ...x,
              status: nextStatus,
              priority: nextPriority,
              internal_note: nextNote.trim() ? nextNote.trim() : null,
              updated_at: new Date().toISOString(),
            }
          : x
      )
    )
  }

  const handleArchiveToggle = async (row: BetaFeedbackRow, archived: boolean) => {
    setSavingId(row.id)
    const r = await setBetaFeedbackArchived(row.id, archived)
    setSavingId(null)
    if (!r.ok) {
      setError(r.error ?? 'Archivieren fehlgeschlagen')
      return
    }
    if ((viewFilter === 'active' && archived) || (viewFilter === 'archived' && !archived)) {
      setRows((prev) => prev.filter((x) => x.id !== row.id))
      return
    }
    const nowIso = new Date().toISOString()
    setRows((prev) =>
      prev.map((x) =>
        x.id === row.id
          ? {
              ...x,
              archived_at: archived ? nowIso : null,
              updated_at: nowIso,
            }
          : x
      )
    )
  }

  return (
    <div className="max-w-6xl mx-auto w-full">
      <h1 className="text-xl font-bold text-slate-900 mb-2">Beta-Feedback</h1>
      <p className="text-sm text-slate-600 mb-6">
        Meldungen aus Haupt-App, Kundenportal und Arbeitszeit-Portal (Modul „Beta-Feedback“ in der Lizenz).
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-sm font-medium text-slate-700" htmlFor="bf-tenant-filter">
          Mandant
        </label>
        <select
          id="bf-tenant-filter"
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">Alle Mandanten</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="text-sm font-medium text-slate-700" htmlFor="bf-view-filter">
          Ansicht
        </label>
        <select
          id="bf-view-filter"
          value={viewFilter}
          onChange={(e) => setViewFilter(e.target.value as BetaFeedbackListView)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="active">Aktiv</option>
          <option value="archived">Archiv</option>
          <option value="all">Alle</option>
        </select>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
        >
          Aktualisieren
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Lade…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Einträge.</p>
      ) : (
        <div className="space-y-6">
          {rows.map((row) => (
            <article
              key={row.id}
              className={`rounded-xl border p-4 shadow-sm ${
                row.archived_at ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap gap-2 items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString('de-DE')} ·{' '}
                    {row.tenants?.name ?? row.tenant_id.slice(0, 8)} ·{' '}
                    {APP_LABELS[row.source_app] ?? row.source_app}
                  </p>
                  {row.archived_at ? (
                    <p className="text-xs text-slate-500 mt-1">
                      Archiviert am {new Date(row.archived_at).toLocaleString('de-DE')}
                    </p>
                  ) : null}
                  <p className="font-mono text-sm text-slate-800 mt-1 break-all">
                    {row.route_path}
                    {row.route_query ? `?${row.route_query}` : ''}
                  </p>
                  {row.title ? (
                    <p className="font-medium text-slate-900 mt-2">{row.title}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="sr-only" htmlFor={`bf-status-${row.id}`}>
                    Status
                  </label>
                  <select
                    id={`bf-status-${row.id}`}
                    value={row.status}
                    disabled={savingId === row.id}
                    onChange={(e) => void handleRowFieldChange(row, 'status', e.target.value)}
                    className="text-sm rounded-lg border border-slate-300 px-2 py-1"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor={`bf-prio-${row.id}`}>
                    Priorität
                  </label>
                  <select
                    id={`bf-prio-${row.id}`}
                    value={row.priority ?? ''}
                    disabled={savingId === row.id}
                    onChange={(e) => void handleRowFieldChange(row, 'priority', e.target.value)}
                    className="text-sm rounded-lg border border-slate-300 px-2 py-1"
                  >
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value || 'none'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() => void handleArchiveToggle(row, !row.archived_at)}
                    className="text-sm rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {row.archived_at ? 'Aus Archiv holen' : 'Archivieren'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {CATEGORY_LABELS[row.category] ?? row.category}
                {row.severity
                  ? ` · ${row.severity === 'blocker' ? 'Blocker' : row.severity === 'annoyance' ? 'Stört' : 'Wunsch'}`
                  : ''}
                {row.app_version ? ` · Build ${row.app_version}` : ''}
                {row.release_label ? ` · ${row.release_label}` : ''}
              </p>
              <p className="text-sm text-slate-800 mt-3 whitespace-pre-wrap">{row.description}</p>
              <p className="text-xs text-slate-500 mt-2">Mandanten-Nutzer-ID: {row.mandant_user_id}</p>
              <label className="block text-xs font-medium text-slate-600 mt-3" htmlFor={`bf-note-${row.id}`}>
                Interne Notiz
              </label>
              <textarea
                key={`${row.id}-${row.updated_at}`}
                id={`bf-note-${row.id}`}
                rows={2}
                defaultValue={row.internal_note ?? ''}
                disabled={savingId === row.id}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v === (row.internal_note ?? '').trim()) return
                  void handleRowFieldChange(row, 'internal_note', e.target.value)
                }}
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 px-2 py-1"
              />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default BetaFeedback
