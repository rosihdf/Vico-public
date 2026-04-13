import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import ReleaseDeployPanel from '../components/ReleaseDeployPanel'
import ReleaseRollbackBulkPanel from '../components/ReleaseRollbackBulkPanel'
import RolloutChecklistModal from '../components/RolloutChecklistModal'
import RolloutTenantScope, {
  getEffectiveTenantsForRollout,
  type RolloutScopeMode,
} from '../components/RolloutTenantScope'
import RolloutUpdateRunBlock from '../components/RolloutUpdateRunBlock'
import type { DeployOutcomeOk } from '../hooks/useReleaseDeployTrigger'
import {
  fetchAppReleases,
  fetchIncomingTenantIdsForRelease,
  fetchReleaseAuditLog,
  RELEASE_CHANNEL_LABELS,
  RELEASE_TYPE_LABELS,
  type AppReleaseRecord,
  type ReleaseChannel,
} from '../lib/mandantenReleaseService'
import { fetchTenants, type Tenant } from '../lib/tenantService'
import { CHANNEL_EXECUTION_ORDER } from '../constants/rolloutAssistant'

type RolloutMode = 'update' | 'rollback'

const ALL_CHANNELS: ReleaseChannel[] = ['main', 'kundenportal', 'arbeitszeit_portal']

type IncomingStripProps = {
  release: AppReleaseRecord | null
}

const RolloutIncomingStrip = ({ release }: IncomingStripProps) => {
  const [pilotCount, setPilotCount] = useState<number | null>(null)
  const releaseId = release?.id ?? null

  useEffect(() => {
    if (!releaseId) {
      setPilotCount(null)
      return
    }
    let cancelled = false
    void fetchIncomingTenantIdsForRelease(releaseId)
      .then((ids) => {
        if (!cancelled) setPilotCount(ids.length)
      })
      .catch(() => {
        if (!cancelled) setPilotCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [releaseId])

  if (!release) {
    return <p className="text-xs text-slate-500">Kein Release gewählt.</p>
  }

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-700 space-y-1">
      <p className="font-medium text-slate-800">
        {RELEASE_CHANNEL_LABELS[release.channel]} · {release.version_semver}
        {release.title ? ` – ${release.title}` : ''}
      </p>
      <p>
        Incoming:{' '}
        {release.incoming_enabled
          ? `aktiv · Piloten in Liste: ${pilotCount === null ? '…' : pilotCount} · Testmandanten zusätzlich laut API`
          : 'aus'}
      </p>
      <p>
        Hard-Reload: {release.force_hard_reload ? 'ja' : 'nein'} · Typ: {RELEASE_TYPE_LABELS[release.release_type]}
      </p>
      <Link
        to={`/app-releases/${release.id}`}
        className="text-vico-primary font-medium hover:underline inline-block"
      >
        Release bearbeiten (Incoming / Piloten)
      </Link>
    </div>
  )
}

const ReleaseRollout = () => {
  const [mode, setMode] = useState<RolloutMode>('update')
  const [channelPick, setChannelPick] = useState<Record<ReleaseChannel, boolean>>({
    main: true,
    kundenportal: false,
    arbeitszeit_portal: false,
  })
  const [d4Choice, setD4Choice] = useState<'none' | 'deploy_ok' | 'skip_build'>('none')
  const [auditPeekRows, setAuditPeekRows] = useState<Record<string, unknown>[]>([])
  const [auditPeekLoading, setAuditPeekLoading] = useState(false)

  const [rows, setRows] = useState<AppReleaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [releaseIdByChannel, setReleaseIdByChannel] = useState<Partial<Record<ReleaseChannel, string>>>({})
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [githubActionsUrlByCh, setGithubActionsUrlByCh] = useState<Partial<Record<ReleaseChannel, string>>>({})

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(true)
  const [tenantsError, setTenantsError] = useState<string | null>(null)
  const [scopeMode, setScopeMode] = useState<RolloutScopeMode>('all')
  const [picked, setPicked] = useState<Set<string>>(() => new Set())

  const selectedChannels = useMemo(
    () => ALL_CHANNELS.filter((c) => channelPick[c]),
    [channelPick]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchAppReleases())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setReleaseIdByChannel((prev) => {
      const next: Partial<Record<ReleaseChannel, string>> = { ...prev }
      for (const ch of selectedChannels) {
        if (!next[ch]) {
          const pub = rows.find((r) => r.status === 'published' && r.channel === ch)
          next[ch] = pub?.id ?? ''
        }
      }
      for (const k of Object.keys(next) as ReleaseChannel[]) {
        if (!selectedChannels.includes(k)) delete next[k]
      }
      return next
    })
  }, [selectedChannels, rows])

  useEffect(() => {
    setTenantsLoading(true)
    setTenantsError(null)
    void fetchTenants()
      .then(setTenants)
      .catch((e) => {
        setTenantsError(e instanceof Error ? e.message : 'Mandanten konnten nicht geladen werden.')
        setTenants([])
      })
      .finally(() => setTenantsLoading(false))
  }, [])

  useEffect(() => {
    setPicked(new Set())
  }, [mode])

  const selectedChannelsKey = useMemo(() => selectedChannels.join(','), [selectedChannels])

  useEffect(() => {
    setD4Choice('none')
    setGithubActionsUrlByCh({})
  }, [selectedChannelsKey, mode])

  const effectiveTenants = useMemo(
    () => getEffectiveTenantsForRollout(tenants, scopeMode, picked),
    [tenants, scopeMode, picked]
  )

  const handleTogglePick = (tenantId: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(tenantId)) next.delete(tenantId)
      else next.add(tenantId)
      return next
    })
  }

  const handlePickAll = () => {
    setPicked(new Set(tenants.map((t) => t.id)))
  }

  const handlePickNone = () => {
    setPicked(new Set())
  }

  const handleToggleChannel = (ch: ReleaseChannel) => {
    setChannelPick((p) => ({ ...p, [ch]: !p[ch] }))
  }

  const handleReleaseChange = (ch: ReleaseChannel, id: string) => {
    setReleaseIdByChannel((p) => ({ ...p, [ch]: id }))
  }

  const loadAuditPeek = useCallback(async () => {
    setAuditPeekLoading(true)
    try {
      const data = await fetchReleaseAuditLog(10)
      setAuditPeekRows(data as Record<string, unknown>[])
    } catch {
      setAuditPeekRows([])
    } finally {
      setAuditPeekLoading(false)
    }
  }, [])

  const handleDeploySuccess = (ch: ReleaseChannel) => (outcome: DeployOutcomeOk) => {
    setGithubActionsUrlByCh((p) => ({ ...p, [ch]: outcome.github_actions_url }))
  }

  const deployAcknowledged = d4Choice !== 'none'

  const releaseForChannel = useCallback(
    (ch: ReleaseChannel) => {
      const id = releaseIdByChannel[ch]
      if (!id) return null
      return rows.find((r) => r.id === id) ?? null
    },
    [releaseIdByChannel, rows]
  )

  const firstChannelForChecklist = useMemo(
    () => CHANNEL_EXECUTION_ORDER.find((c) => selectedChannels.includes(c)) ?? null,
    [selectedChannels]
  )

  const checklistRelease = useMemo(() => {
    if (!firstChannelForChecklist) return null
    return releaseForChannel(firstChannelForChecklist)
  }, [firstChannelForChecklist, releaseForChannel])

  const checklistGithubUrl =
    firstChannelForChecklist != null ? githubActionsUrlByCh[firstChannelForChecklist] ?? null : null

  const refreshAuditPeekAfterRun = useCallback(() => {
    void loadAuditPeek()
  }, [loadAuditPeek])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div
        className="lg:hidden rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-sm px-3 py-2"
        role="status"
      >
        <strong className="font-medium">Hinweis:</strong> Für Rollouts und Deploys wird ein{' '}
        <strong>Desktop-Browser</strong> empfohlen.
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Update-Assistent</h1>
          <p className="text-sm text-slate-500 mt-1">
            Mehrkanal-Update oder Rollback, Mandanten-Umfang, Live-Protokoll und Release-Audit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/release-audit"
            className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            Release-Audit
          </Link>
          <Link
            to="/app-releases"
            className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            Alle App-Releases
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <p className="text-sm font-medium text-slate-800">1. Modus</p>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="sr-only">Modus</legend>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="rollout-mode"
              checked={mode === 'update'}
              onChange={() => setMode('update')}
              className="rounded-full border-slate-300"
            />
            Update zuweisen (Go-Live)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="rollout-mode"
              checked={mode === 'rollback'}
              onChange={() => setMode('rollback')}
              className="rounded-full border-slate-300"
            />
            Rollback (auf gespeicherte Vorversion pro Mandant/Kanal)
          </label>
        </fieldset>

        <p className="text-sm font-medium text-slate-800 pt-2 border-t border-slate-100">2. Kanäle</p>
        <div className="flex flex-wrap gap-4">
          {ALL_CHANNELS.map((ch) => (
            <label key={ch} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={channelPick[ch]}
                onChange={() => handleToggleChannel(ch)}
                className="rounded border-slate-300"
              />
              {RELEASE_CHANNEL_LABELS[ch]}
            </label>
          ))}
        </div>
        {selectedChannels.length === 0 ? (
          <p className="text-xs text-red-700">Mindestens einen Kanal auswählen.</p>
        ) : null}
      </div>

      {selectedChannels.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm font-medium text-slate-800">3. Mandanten</p>
          <RolloutTenantScope
            tenants={tenants}
            loading={tenantsLoading}
            loadError={tenantsError}
            scopeMode={scopeMode}
            onScopeModeChange={setScopeMode}
            picked={picked}
            onTogglePick={handleTogglePick}
            onPickAll={handlePickAll}
            onPickNone={handlePickNone}
          />
        </div>
      ) : null}

      <details
        className="rounded-lg border border-slate-200 bg-white shadow-sm"
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) void loadAuditPeek()
        }}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-800">
          Letzte Audit-Einträge (Kurzliste)
        </summary>
        <div className="px-4 pb-3 border-t border-slate-100">
          {auditPeekLoading ? (
            <p className="text-xs text-slate-500 py-2">Lade…</p>
          ) : (
            <ul className="text-xs font-mono space-y-1 max-h-40 overflow-y-auto py-2">
              {auditPeekRows.map((r, i) => (
                <li key={String(r.id ?? i)} className="text-slate-600">
                  {String(r.created_at ?? '')} · {String(r.action ?? '')}
                </li>
              ))}
            </ul>
          )}
          <Link to="/release-audit" className="text-vico-primary text-xs font-medium hover:underline">
            Vollständiges Audit öffnen
          </Link>
        </div>
      </details>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3" role="alert">
          {error}
        </div>
      ) : null}

      {mode === 'rollback' && selectedChannels.length > 0 ? (
        <ReleaseRollbackBulkPanel channels={selectedChannels} effectiveTenants={effectiveTenants} />
      ) : null}

      {mode === 'update' && selectedChannels.length > 0 ? (
        <>
          {loading ? (
            <p className="text-sm text-slate-500">Lade Releases…</p>
          ) : (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                <p className="text-sm font-medium text-slate-800">Incoming (Lesen, nur Update)</p>
                <p className="text-xs text-slate-500">
                  Pro Kanal: gewähltes Release und Incoming-Status. Pflege der Piloten im Release-Editor.
                </p>
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                  {selectedChannels.map((ch) => (
                    <RolloutIncomingStrip key={ch} release={releaseForChannel(ch)} />
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                <p className="text-sm font-medium text-slate-800">Release je Kanal</p>
                {selectedChannels.map((ch) => {
                  const channelRows = rows.filter((r) => r.channel === ch)
                  const selId = releaseIdByChannel[ch] ?? ''
                  return (
                    <div key={ch}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {RELEASE_CHANNEL_LABELS[ch]}
                      </label>
                      <select
                        value={selId}
                        onChange={(e) => handleReleaseChange(ch, e.target.value)}
                        className="w-full max-w-xl px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      >
                        {channelRows.length === 0 ? (
                          <option value="">Keine Releases</option>
                        ) : null}
                        {channelRows.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.version_semver}
                            {r.status === 'draft' ? ' (Entwurf)' : ''}
                            {r.title ? ` – ${r.title}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>

              {selectedChannels.some((ch) => {
                const r = releaseForChannel(ch)
                return r && r.status !== 'published'
              }) ? (
                <div
                  className="rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-sm px-4 py-3"
                  role="status"
                >
                  <p className="font-medium">Mindestens ein gewählter Release ist noch ein Entwurf.</p>
                  <p className="text-xs mt-1 text-amber-900/90">
                    Bitte im Editor <strong>freigeben</strong>, damit Go-Live möglich ist.
                  </p>
                </div>
              ) : null}

              {selectedChannels.every((ch) => {
                const r = releaseForChannel(ch)
                return r?.status === 'published'
              }) ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setChecklistOpen(true)}
                      className="inline-flex items-center px-4 py-2 rounded-lg border border-vico-primary text-vico-primary text-sm font-medium hover:bg-vico-primary/5 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    >
                      Rollout-Checkliste
                    </button>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                    <p className="text-sm font-medium text-slate-800">Deploy-Bestätigung (D4)</p>
                    <p className="text-xs text-slate-500">
                      Eine Option muss gewählt sein, bevor Go-Live möglich ist.
                    </p>
                    <fieldset className="space-y-2">
                      <legend className="sr-only">Deploy-Status</legend>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="d4-deploy"
                          checked={d4Choice === 'deploy_ok'}
                          onChange={() => setD4Choice('deploy_ok')}
                          className="mt-1"
                        />
                        <span>
                          Production-Deploy <strong>geprüft</strong> / erfolgreich (z. B. GitHub Actions).
                          {selectedChannels.map((ch) =>
                            githubActionsUrlByCh[ch] ? (
                              <a
                                key={ch}
                                href={githubActionsUrlByCh[ch]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-vico-primary text-xs mt-1 hover:underline"
                              >
                                Workflow {RELEASE_CHANNEL_LABELS[ch]} öffnen
                              </a>
                            ) : null
                          )}
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="d4-deploy"
                          checked={d4Choice === 'skip_build'}
                          onChange={() => setD4Choice('skip_build')}
                          className="mt-1"
                        />
                        <span>
                          <strong>Bewusst ohne</strong> neuen CDN-Build – nur Lizenzportal-Zuweisung; Risiko verstanden.
                        </span>
                      </label>
                    </fieldset>
                  </div>

                  {selectedChannels.map((ch) => {
                    const r = releaseForChannel(ch)
                    if (!r || r.status !== 'published') return null
                    return (
                      <div key={ch} className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700">{RELEASE_CHANNEL_LABELS[ch]}</p>
                        <ReleaseDeployPanel
                          releaseId={r.id}
                          channel={ch}
                          onDeploySuccess={handleDeploySuccess(ch)}
                        />
                      </div>
                    )
                  })}

                  <RolloutUpdateRunBlock
                    selectedChannels={selectedChannels}
                    releaseIdByChannel={releaseIdByChannel}
                    allReleases={rows}
                    effectiveTenants={effectiveTenants}
                    scopeMode={scopeMode}
                    fullTenantListLength={tenants.length}
                    deployAcknowledged={deployAcknowledged}
                    onRunFinished={refreshAuditPeekAfterRun}
                  />

                  <p className="text-xs text-slate-500">
                    Mandanten-Apps: Hinweis <strong>Aktualisieren / Später</strong> bzw. Hard-Reload je Release – siehe{' '}
                    <span className="font-mono text-[11px]">docs/Concept-Mandanten-Updates-und-Rollout-UX.md</span>.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}

      <RolloutChecklistModal
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        release={checklistRelease}
        githubActionsUrl={checklistGithubUrl}
      />
    </div>
  )
}

export default ReleaseRollout
