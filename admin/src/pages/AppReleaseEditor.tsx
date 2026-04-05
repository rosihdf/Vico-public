import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchTenants, type Tenant } from '../lib/tenantService'
import {
  createAppRelease,
  fetchAppRelease,
  fetchIncomingTenantIdsForRelease,
  listReleaseChannels,
  publishAppRelease,
  RELEASE_CHANNEL_LABELS,
  RELEASE_TYPE_LABELS,
  updateAppRelease,
  deleteAppRelease,
  type AppReleaseStatus,
  type ReleaseChannel,
  type ReleaseType,
} from '../lib/mandantenReleaseService'
import ReleaseDeployPanel from '../components/ReleaseDeployPanel'

const emptyForm = () => ({
  channel: 'main' as ReleaseChannel,
  version_semver: '',
  release_type: 'feature' as ReleaseType,
  title: '',
  notes: '',
  module_tags_text: '',
  incoming_enabled: false,
  incoming_all_mandanten: false,
  force_hard_reload: false,
})

const AppReleaseEditor = () => {
  const { releaseId } = useParams<{ releaseId: string }>()
  const navigate = useNavigate()
  const isNew = releaseId === 'neu'

  const [form, setForm] = useState(emptyForm)
  const [incomingTenantIds, setIncomingTenantIds] = useState<Set<string>>(new Set())
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actorId, setActorId] = useState<string | null>(null)
  const [releaseStatus, setReleaseStatus] = useState<AppReleaseStatus | null>(null)
  const [ciMeta, setCiMeta] = useState<Record<string, unknown>>({})

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setActorId(data.user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    void fetchTenants().then(setTenants).catch(() => setTenants([]))
  }, [])

  const load = useCallback(async () => {
    if (!releaseId || isNew) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await fetchAppRelease(releaseId)
      if (!r) {
        setError('Release nicht gefunden')
        return
      }
      setReleaseStatus(r.status)
      setCiMeta(r.ci_metadata && typeof r.ci_metadata === 'object' ? { ...r.ci_metadata } : {})
      setForm({
        channel: r.channel,
        version_semver: r.version_semver,
        release_type: r.release_type,
        title: r.title ?? '',
        notes: r.notes ?? '',
        module_tags_text: (r.module_tags ?? []).join(', '),
        incoming_enabled: r.incoming_enabled,
        incoming_all_mandanten: r.incoming_all_mandanten,
        force_hard_reload: r.force_hard_reload,
      })
      const ids = await fetchIncomingTenantIdsForRelease(releaseId)
      setIncomingTenantIds(new Set(ids))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [releaseId, isNew])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggleTenant = (id: string) => {
    setIncomingTenantIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const tags = form.module_tags_text
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const tenantList = [...incomingTenantIds]

    try {
      if (isNew) {
        const res = await createAppRelease(
          {
            channel: form.channel,
            version_semver: form.version_semver,
            release_type: form.release_type,
            title: form.title || null,
            notes: form.notes || null,
            module_tags: tags,
            incoming_enabled: form.incoming_enabled,
            incoming_all_mandanten: form.incoming_all_mandanten,
            force_hard_reload: form.force_hard_reload,
            created_by: actorId,
          },
          form.incoming_all_mandanten ? [] : tenantList,
          actorId
        )
        if ('error' in res) {
          setError(res.error)
          return
        }
        navigate(`/app-releases/${res.id}`, { replace: true })
        return
      }
      if (!releaseId) return
      const up = await updateAppRelease(
        releaseId,
        {
          version_semver: form.version_semver,
          release_type: form.release_type,
          title: form.title || null,
          notes: form.notes || null,
          module_tags: tags,
          incoming_enabled: form.incoming_enabled,
          incoming_all_mandanten: form.incoming_all_mandanten,
          force_hard_reload: form.force_hard_reload,
        },
        form.incoming_all_mandanten ? [] : tenantList,
        actorId
      )
      if ('error' in up) {
        setError(up.error)
        return
      }
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!releaseId || isNew) return
    setSaving(true)
    setError(null)
    try {
      const res = await publishAppRelease(releaseId, actorId)
      if ('error' in res) {
        setError(res.error)
        return
      }
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!releaseId || isNew) return
    if (!window.confirm('Release wirklich löschen? Zuweisungen werden auf NULL gesetzt.')) return
    setSaving(true)
    const res = await deleteAppRelease(releaseId, actorId)
    setSaving(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    navigate('/app-releases')
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-500">Lade…</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app-releases" className="text-sm text-vico-primary hover:underline" tabIndex={0}>
          ← Alle Releases
        </Link>
      </div>
      <h1 className="text-xl font-bold text-slate-800">{isNew ? 'Neuer Release' : 'Release bearbeiten'}</h1>
      {!isNew && releaseStatus === 'published' ? (
        <>
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Freigegeben – sichtbar in der Lizenz-API und als Go-Live wählbar.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              to="/release-rollout"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
            >
              Rollout &amp; Deploy (Übersicht)
            </Link>
          </div>
          <ReleaseDeployPanel
            releaseId={releaseId ?? null}
            channel={form.channel}
            disabled={saving}
            showEditorHint
          />
        </>
      ) : null}
      {!isNew && releaseStatus === 'draft' ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-sm px-4 py-3 space-y-3"
          role="status"
        >
          <p className="font-medium">Entwurf (z.B. aus GitHub) - noch nicht für Mandanten aktiv.</p>
          <p className="text-xs text-amber-900/90">
            Nach Prüfung von Notes und Einstellungen hier „Freigeben“ – danach Incoming und Go-Live wie gewohnt.
          </p>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-amber-800 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            {saving ? 'Freigeben…' : 'Freigeben'}
          </button>
        </div>
      ) : null}
      {!isNew && Object.keys(ciMeta).length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
          <h2 className="font-semibold text-slate-800">Build- / CI-Metadaten</h2>
          <dl className="grid gap-1 text-slate-700">
            {typeof ciMeta.source === 'string' ? (
              <div className="flex flex-wrap gap-2">
                <dt className="text-slate-500 shrink-0">Quelle</dt>
                <dd>{ciMeta.source}</dd>
              </div>
            ) : null}
            {typeof ciMeta.repository === 'string' ? (
              <div className="flex flex-wrap gap-2">
                <dt className="text-slate-500 shrink-0">Repository</dt>
                <dd className="font-mono text-xs break-all">{ciMeta.repository}</dd>
              </div>
            ) : null}
            {typeof ciMeta.tag === 'string' ? (
              <div className="flex flex-wrap gap-2">
                <dt className="text-slate-500 shrink-0">Tag</dt>
                <dd className="font-mono text-xs break-all">{ciMeta.tag}</dd>
              </div>
            ) : null}
            {typeof ciMeta.html_url === 'string' ? (
              <div className="flex flex-wrap gap-2 items-baseline">
                <dt className="text-slate-500 shrink-0">GitHub</dt>
                <dd>
                  <a
                    href={ciMeta.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-vico-primary font-medium hover:underline break-all"
                  >
                    Release / Tag öffnen
                  </a>
                </dd>
              </div>
            ) : null}
            {typeof ciMeta.workflow_run_url === 'string' ? (
              <div className="flex flex-wrap gap-2 items-baseline">
                <dt className="text-slate-500 shrink-0">Workflow</dt>
                <dd>
                  <a
                    href={ciMeta.workflow_run_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-vico-primary font-medium hover:underline break-all"
                  >
                    Lauf ansehen
                  </a>
                </dd>
              </div>
            ) : null}
            {typeof ciMeta.target_commitish === 'string' ? (
              <div className="flex flex-wrap gap-2">
                <dt className="text-slate-500 shrink-0">Commit (Ref)</dt>
                <dd className="font-mono text-xs break-all">{ciMeta.target_commitish}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3" role="alert">
          {error}
        </div>
      ) : null}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Kanal</label>
          <select
            value={form.channel}
            disabled={!isNew}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as ReleaseChannel }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300"
          >
            {listReleaseChannels().map((c) => (
              <option key={c} value={c}>
                {RELEASE_CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
          {!isNew ? <p className="text-xs text-slate-500 mt-1">Kanal ist nach Anlage fix.</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Version (Semver)</label>
          <input
            type="text"
            value={form.version_semver}
            onChange={(e) => setForm((f) => ({ ...f, version_semver: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
            required
            placeholder="1.4.2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Release-Typ</label>
          <select
            value={form.release_type}
            onChange={(e) => setForm((f) => ({ ...f, release_type: e.target.value as ReleaseType }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300"
          >
            {(Object.keys(RELEASE_TYPE_LABELS) as ReleaseType[]).map((t) => (
              <option key={t} value={t}>
                {RELEASE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Titel (Release-Label)</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Release Notes (Fließtext, Zeilen = Bullet)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Modul-Tags (kommagetrennt)</label>
          <input
            type="text"
            value={form.module_tags_text}
            onChange={(e) => setForm((f) => ({ ...f, module_tags_text: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300"
            placeholder="kunden, auftraege, portal"
          />
          <p className="text-xs text-slate-500 mt-1">Erzeugt die Zeile „Betrifft: …“ in der Mandanten-API.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.incoming_enabled}
            onChange={(e) => setForm((f) => ({ ...f, incoming_enabled: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Incoming aktiv (Pilot sichtbar)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.incoming_all_mandanten}
            onChange={(e) => setForm((f) => ({ ...f, incoming_all_mandanten: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Alle Mandanten (zweiter Schritt §11.20 #3)
        </label>
        {!form.incoming_all_mandanten && form.incoming_enabled ? (
          <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-slate-600 mb-2">Pilot-Mandanten</p>
            <ul className="space-y-1">
              {tenants.map((t) => (
                <li key={t.id}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={incomingTenantIds.has(t.id)}
                      onChange={() => handleToggleTenant(t.id)}
                      className="rounded border-slate-300"
                    />
                    {t.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.force_hard_reload}
            onChange={(e) => setForm((f) => ({ ...f, force_hard_reload: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Hartes Reload erzwingen (Major / Pflicht-Refresh)
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-vico-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
          {!isNew ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              Löschen
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}

export default AppReleaseEditor
