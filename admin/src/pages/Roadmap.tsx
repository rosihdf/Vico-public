import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  createRoadmapItem,
  fetchRoadmapItems,
  updateRoadmapItem,
  type RoadmapItem,
  type RoadmapStatus,
  type RoadmapScope,
  type RoadmapChannel,
} from '../lib/roadmapService'

const STATUS_OPTIONS: Array<{ value: RoadmapStatus; label: string }> = [
  { value: 'idea', label: 'Idee' },
  { value: 'planned', label: 'Geplant' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'blocked', label: 'Blockiert' },
  { value: 'done', label: 'Erledigt' },
]

const SCOPE_OPTIONS: Array<{ value: RoadmapScope; label: string }> = [
  { value: 'global', label: 'Global' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'tenant', label: 'Mandant' },
]

const CHANNEL_OPTIONS: Array<{ value: RoadmapChannel; label: string }> = [
  { value: 'all', label: 'Alle Apps' },
  { value: 'main', label: 'Haupt-App' },
  { value: 'kundenportal', label: 'Kundenportal' },
  { value: 'arbeitszeit_portal', label: 'Arbeitszeitportal' },
]

type TenantOpt = { id: string; name: string }

const Roadmap = () => {
  const [tenantFilter, setTenantFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<RoadmapStatus | 'all'>('all')
  const [tenants, setTenants] = useState<TenantOpt[]>([])
  const [rows, setRows] = useState<RoadmapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createWpId, setCreateWpId] = useState('')
  const [createStatus, setCreateStatus] = useState<RoadmapStatus>('planned')
  const [createScope, setCreateScope] = useState<RoadmapScope>('global')
  const [createChannel, setCreateChannel] = useState<RoadmapChannel>('all')
  const [createTenantId, setCreateTenantId] = useState<string>('all')

  const loadTenants = useCallback(async () => {
    const { data, error: err } = await supabase.from('tenants').select('id, name').order('name')
    if (!err && data) {
      setTenants(data.map((t) => ({ id: t.id as string, name: String(t.name) })))
    }
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { rows: list, error: err } = await fetchRoadmapItems(
      tenantFilter === 'all' ? 'all' : tenantFilter,
      statusFilter
    )
    if (err) setError(err)
    setRows(list)
    setLoading(false)
  }, [tenantFilter, statusFilter])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const handleCreate = async () => {
    const title = createTitle.trim()
    if (!title) {
      setError('Titel ist erforderlich.')
      return
    }
    setError(null)
    const r = await createRoadmapItem({
      tenant_id: createScope === 'tenant' && createTenantId !== 'all' ? createTenantId : null,
      title,
      wp_id: createWpId.trim() || null,
      status: createStatus,
      priority: null,
      target_channel: createChannel,
      scope: createScope,
      beta_feedback_id: null,
      public_note: null,
      internal_note: null,
    })
    if (!r.ok) {
      setError(r.error ?? 'Anlegen fehlgeschlagen')
      return
    }
    setCreateTitle('')
    setCreateWpId('')
    setCreateStatus('planned')
    setCreateScope('global')
    setCreateChannel('all')
    setCreateTenantId('all')
    setCreateOpen(false)
    await loadRows()
  }

  const handleFieldChange = async (
    row: RoadmapItem,
    field: 'status' | 'priority' | 'scope' | 'target_channel' | 'internal_note',
    value: string
  ) => {
    setSavingId(row.id)
    const payload: Record<string, unknown> = {}
    if (field === 'status') payload.status = value as RoadmapStatus
    if (field === 'priority') payload.priority = value ? value : null
    if (field === 'scope') payload.scope = value as RoadmapScope
    if (field === 'target_channel') payload.target_channel = value as RoadmapChannel
    if (field === 'internal_note') payload.internal_note = value.trim() ? value.trim() : null
    const r = await updateRoadmapItem(row.id, payload)
    setSavingId(null)
    if (!r.ok) {
      setError(r.error ?? 'Speichern fehlgeschlagen')
      return
    }
    setRows((prev) =>
      prev.map((x) =>
        x.id === row.id ? { ...x, ...payload, updated_at: new Date().toISOString() } as RoadmapItem : x
      )
    )
  }

  return (
    <div className="max-w-6xl mx-auto w-full">
      <h1 className="text-xl font-bold text-slate-900 mb-2">Roadmap-Board</h1>
      <p className="text-sm text-slate-600 mb-6">
        Pflege von offenen Arbeitspaketen parallel zum Beta-Feedback direkt im Lizenzportal.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          aria-label="Mandant filtern"
        >
          <option value="all">Alle Mandanten</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RoadmapStatus | 'all')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          aria-label="Status filtern"
        >
          <option value="all">Alle Stati</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="px-3 py-2 text-sm rounded-lg bg-vico-primary text-white hover:opacity-90"
        >
          {createOpen ? 'Abbrechen' : 'Roadmap-Eintrag anlegen'}
        </button>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
        >
          Aktualisieren
        </button>
      </div>

      {createOpen ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <input
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Titel, z. B. WP-J7-01 Follow-up Prozess"
            aria-label="Roadmap Titel"
          />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              value={createWpId}
              onChange={(e) => setCreateWpId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="WP-ID"
              aria-label="WP-ID"
            />
            <select
              value={createStatus}
              onChange={(e) => setCreateStatus(e.target.value as RoadmapStatus)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              aria-label="Status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={createScope}
              onChange={(e) => setCreateScope(e.target.value as RoadmapScope)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              aria-label="Scope"
            >
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={createChannel}
              onChange={(e) => setCreateChannel(e.target.value as RoadmapChannel)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              aria-label="Zielkanal"
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {createScope === 'tenant' ? (
            <select
              value={createTenantId}
              onChange={(e) => setCreateTenantId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              aria-label="Mandant"
            >
              <option value="all">Mandant wählen</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="px-3 py-2 text-sm rounded-lg bg-vico-primary text-white hover:opacity-90"
          >
            Speichern
          </button>
        </div>
      ) : null}

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
        <div className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-2 items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    {row.wp_id ? `${row.wp_id} · ` : ''}
                    {row.tenants?.name ?? 'Global/Pilot'} · {new Date(row.created_at).toLocaleString('de-DE')}
                  </p>
                  <p className="font-medium text-slate-900 mt-1">{row.title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={row.status}
                    disabled={savingId === row.id}
                    onChange={(e) => void handleFieldChange(row, 'status', e.target.value)}
                    className="text-sm rounded-lg border border-slate-300 px-2 py-1"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.priority ?? ''}
                    disabled={savingId === row.id}
                    onChange={(e) => void handleFieldChange(row, 'priority', e.target.value)}
                    className="text-sm rounded-lg border border-slate-300 px-2 py-1"
                  >
                    <option value="">Prio —</option>
                    <option value="p0">P0</option>
                    <option value="p1">P1</option>
                    <option value="p2">P2</option>
                    <option value="p3">P3</option>
                  </select>
                  <select
                    value={row.scope}
                    disabled={savingId === row.id}
                    onChange={(e) => void handleFieldChange(row, 'scope', e.target.value)}
                    className="text-sm rounded-lg border border-slate-300 px-2 py-1"
                  >
                    {SCOPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.target_channel}
                    disabled={savingId === row.id}
                    onChange={(e) => void handleFieldChange(row, 'target_channel', e.target.value)}
                    className="text-sm rounded-lg border border-slate-300 px-2 py-1"
                  >
                    {CHANNEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="block text-xs font-medium text-slate-600 mt-3" htmlFor={`ri-note-${row.id}`}>
                Interne Notiz
              </label>
              <textarea
                key={`${row.id}-${row.updated_at}`}
                id={`ri-note-${row.id}`}
                rows={2}
                defaultValue={row.internal_note ?? ''}
                disabled={savingId === row.id}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v === (row.internal_note ?? '').trim()) return
                  void handleFieldChange(row, 'internal_note', e.target.value)
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

export default Roadmap

