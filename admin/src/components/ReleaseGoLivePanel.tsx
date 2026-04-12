import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  assignPublishedReleaseToTenantIds,
  RELEASE_CHANNEL_LABELS,
  type AppReleaseRecord,
} from '../lib/mandantenReleaseService'
import { fetchTenants, type Tenant } from '../lib/tenantService'
import { supabase } from '../lib/supabase'

type ScopeMode = 'all' | 'pick'

type ReleaseGoLivePanelProps = {
  release: AppReleaseRecord
}

const ReleaseGoLivePanel = ({ release }: ReleaseGoLivePanelProps) => {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all')
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [actorId, setActorId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<
    | { kind: 'ok'; updated: number; errors: { tenantId: string; error: string }[] }
    | { kind: 'err'; text: string }
    | null
  >(null)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setActorId(data.user?.id ?? null))
  }, [])

  const loadTenants = useCallback(async () => {
    setLoadingTenants(true)
    setLoadError(null)
    try {
      const list = await fetchTenants()
      setTenants(list)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Mandanten konnten nicht geladen werden.')
      setTenants([])
    } finally {
      setLoadingTenants(false)
    }
  }, [])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    setResult(null)
    setPicked(new Set())
  }, [release.id])

  const effectiveIds = useMemo(() => {
    if (scopeMode === 'all') return tenants.map((t) => t.id)
    return [...picked]
  }, [scopeMode, tenants, picked])

  const tenantNameById = useMemo(() => new Map(tenants.map((t) => [t.id, t.name])), [tenants])

  const handleTogglePick = (tenantId: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(tenantId)) next.delete(tenantId)
      else next.add(tenantId)
      return next
    })
    setResult(null)
  }

  const handlePickAll = () => {
    setPicked(new Set(tenants.map((t) => t.id)))
    setResult(null)
  }

  const handlePickNone = () => {
    setPicked(new Set())
    setResult(null)
  }

  const handleGoLive = async () => {
    setResult(null)
    if (release.status !== 'published') {
      setResult({ kind: 'err', text: 'Release ist nicht freigegeben (published).' })
      return
    }
    const ids = effectiveIds
    if (ids.length === 0) {
      setResult({ kind: 'err', text: 'Keine Mandanten ausgewählt.' })
      return
    }
    const ok = window.confirm(
      `Go-Live: Release ${release.version_semver} (${RELEASE_CHANNEL_LABELS[release.channel]}) für ${ids.length} Mandant(en) zuweisen? Die Lizenz-API meldet danach diese Version; Mandanten-Apps sollten neu laden (Hinweisbanner).`
    )
    if (!ok) return
    setBusy(true)
    try {
      const r = await assignPublishedReleaseToTenantIds(release.id, ids, actorId)
      if ('error' in r) {
        setResult({ kind: 'err', text: r.error })
        return
      }
      setResult({ kind: 'ok', updated: r.updated, errors: r.errors })
    } catch (e) {
      setResult({ kind: 'err', text: e instanceof Error ? e.message : 'Zuweisung fehlgeschlagen.' })
    } finally {
      setBusy(false)
    }
  }

  if (release.status !== 'published') {
    return null
  }

  const chLabel = RELEASE_CHANNEL_LABELS[release.channel]

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4"
      aria-labelledby="go-live-heading"
    >
      <div>
        <h2 id="go-live-heading" className="text-base font-semibold text-slate-800">
          Go-Live für Mandanten
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Weist nur den Kanal <strong>{chLabel}</strong> zu (dieses Release). Andere Kanäle bleiben unverändert.
          Nach der Zuweisung erhöht sich pro Mandant die Lizenz-<code className="text-[11px] bg-slate-100 px-1 rounded">client_config_version</code> – die Apps ziehen die Konfiguration nach.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2" role="alert">
          {loadError}
        </div>
      ) : null}

      {loadingTenants ? (
        <p className="text-sm text-slate-500">Lade Mandanten…</p>
      ) : tenants.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Mandanten vorhanden.</p>
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700 sr-only">Umfang</legend>
            <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="radio"
                name="golive-scope"
                checked={scopeMode === 'all'}
                onChange={() => {
                  setScopeMode('all')
                  setResult(null)
                }}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Alle Mandanten</span>
                <span className="block text-xs text-slate-500">({tenants.length} Stück)</span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="radio"
                name="golive-scope"
                checked={scopeMode === 'pick'}
                onChange={() => {
                  setScopeMode('pick')
                  setResult(null)
                }}
                className="mt-1"
              />
              <span className="font-medium">Nur ausgewählte Mandanten</span>
            </label>
          </fieldset>

          {scopeMode === 'pick' ? (
            <div className="border border-slate-200 rounded-lg p-3 max-h-56 overflow-y-auto space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={handlePickAll}
                  className="text-vico-primary font-medium hover:underline"
                >
                  Alle anhaken
                </button>
                <button
                  type="button"
                  onClick={handlePickNone}
                  className="text-slate-600 font-medium hover:underline"
                >
                  Keine
                </button>
              </div>
              <ul className="space-y-1.5">
                {tenants.map((t) => (
                  <li key={t.id}>
                    <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={picked.has(t.id)}
                        onChange={() => handleTogglePick(t.id)}
                        className="rounded border-slate-300"
                        aria-label={`Mandant ${t.name}`}
                      />
                      <span className="min-w-0 truncate">{t.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 pt-1">{picked.size} ausgewählt</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleGoLive()}
            disabled={busy || effectiveIds.length === 0}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-vico-primary text-white text-sm font-semibold hover:bg-vico-primary-hover disabled:opacity-50 min-h-[44px] sm:min-h-0"
          >
            {busy ? 'Weise zu…' : `Go-Live starten (${effectiveIds.length} Mandant${effectiveIds.length === 1 ? '' : 'en'})`}
          </button>

          {result?.kind === 'ok' ? (
            <div
              className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm px-3 py-2 space-y-1"
              role="status"
            >
              <p className="font-medium">Erfolgreich zugewiesen: {result.updated}</p>
              {result.errors.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-amber-900">Teilweise Fehler ({result.errors.length}):</p>
                  <ul className="text-xs font-mono mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.map((e) => {
                      const label = tenantNameById.get(e.tenantId) ?? `${e.tenantId.slice(0, 8)}…`
                      return (
                        <li key={e.tenantId}>
                          {label} — {e.error}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {result?.kind === 'err' ? (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2" role="alert">
              {result.text}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

export default ReleaseGoLivePanel
