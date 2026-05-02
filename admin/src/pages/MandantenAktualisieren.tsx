import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { MandantenDbRolloutHistoryPanel } from '../components/MandantenDbRolloutHistoryPanel'
import { MandantenDbRolloutSection } from '../components/MandantenDbRolloutSection'
import { UpdateHubStatusPanel } from '../components/UpdateHubStatusPanel'
import {
  fetchMandantenDbRolloutRuns,
  fetchMandantenDbRolloutTargetCountsByRunIds,
  fetchProfilesEmailByIds,
  type MandantenDbRolloutRunRow,
  type MandantenDbRolloutTargetCounts,
} from '../lib/mandantenDbRolloutRunsService'
import {
  triggerMandantenDbRollout,
  type MandantenRolloutMode,
  type MandantenRolloutTarget,
} from '../lib/mandantenRolloutService'
import {
  findMandantenDbUpdatePackageById,
  isMandantenDbUpdatePackageAllowedForTarget,
  visibleMandantenDbUpdatePackages,
} from '../lib/mandantenDbUpdatePackages'
import {
  computeUpdateHubDbStatusLines,
  type LatestMandantenDbRolloutSummary,
} from '../lib/updateHubStatus'
import type { MandantenDbDispatchFeedback } from '../components/MandantenDbRolloutSection'

type HubTabId = 'overview' | 'maintenance' | 'app' | 'database' | 'history' | 'diagnose'

const HUB_TABS: ReadonlyArray<{ id: HubTabId; label: string }> = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'maintenance', label: 'Wartung' },
  { id: 'app', label: 'App' },
  { id: 'database', label: 'Datenbank' },
  { id: 'history', label: 'Historie' },
  { id: 'diagnose', label: 'Diagnose' },
]

const githubActionsUrlEnv = (): string =>
  (import.meta.env.VITE_GITHUB_ACTIONS_URL ?? '').trim()

const HubOverviewCard = ({
  title,
  description,
  actionLabel,
  onOpen,
}: {
  title: string
  description: string
  actionLabel: string
  onOpen: () => void
}) => (
  <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm h-full min-h-[140px]">
    <h3 className="text-sm font-semibold text-slate-800 m-0">{title}</h3>
    <p className="text-xs text-slate-600 mt-2 mb-3 flex-1 leading-relaxed">{description}</p>
    <button
      type="button"
      onClick={onOpen}
      className="mt-auto self-start rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary min-h-[40px]"
    >
      {actionLabel}
    </button>
  </article>
)

const MandantenAktualisieren = () => {
  const visiblePackages = useMemo(() => visibleMandantenDbUpdatePackages(), [])
  const defaultPackageId = visiblePackages[0]?.id ?? ''
  const ghUrl = useMemo(() => githubActionsUrlEnv(), [])

  const [activeTab, setActiveTab] = useState<HubTabId>('overview')
  const [rolloutSending, setRolloutSending] = useState(false)
  const [rolloutTarget, setRolloutTarget] = useState<MandantenRolloutTarget>('staging')
  const [rolloutPackageId, setRolloutPackageId] = useState<string>(defaultPackageId)
  const [rolloutFeedback, setRolloutFeedback] = useState<MandantenDbDispatchFeedback | null>(null)
  /** Fingerprint nach erfolgreichem Trockenlauf: `${packageId}|${target}` */
  const [dryRunOkFingerprint, setDryRunOkFingerprint] = useState<string | null>(null)
  /** Production-Schutz: explizite Bestätigung vor Echtlauf (nur UI; kein Backend). */
  const [productionWartungAcknowledged, setProductionWartungAcknowledged] = useState(false)

  const [rolloutRuns, setRolloutRuns] = useState<MandantenDbRolloutRunRow[]>([])
  const [targetCountsByRunId, setTargetCountsByRunId] = useState<Map<string, MandantenDbRolloutTargetCounts>>(
    () => new Map()
  )
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [runsHydrated, setRunsHydrated] = useState(false)

  const [starterEmails, setStarterEmails] = useState<Map<string, string>>(new Map())

  const packageLabelForId = useCallback((packageId: string | null | undefined): string => {
    const id = packageId?.trim()
    if (!id) return '—'
    const p = findMandantenDbUpdatePackageById(id)
    return p?.label ?? id
  }, [])
  const loadRolloutRuns = useCallback(async () => {
    setRunsLoading(true)
    setRunsError(null)
    const r = await fetchMandantenDbRolloutRuns(50)
    if (r.ok) {
      setRolloutRuns(r.rows)
      const cnt = await fetchMandantenDbRolloutTargetCountsByRunIds(r.rows.map((row) => row.id))
      setTargetCountsByRunId(cnt.ok ? cnt.map : new Map())
    } else {
      setRolloutRuns([])
      setTargetCountsByRunId(new Map())
      setRunsError(r.error)
    }
    setRunsHydrated(true)
    setRunsLoading(false)
  }, [])

  useEffect(() => {
    void loadRolloutRuns()
  }, [loadRolloutRuns])

  useEffect(() => {
    const ids = rolloutRuns.map((r) => r.started_by)
    void (async () => {
      const m = await fetchProfilesEmailByIds(ids)
      setStarterEmails(m)
    })()
  }, [rolloutRuns])

  const handleRolloutTargetChange = useCallback((t: MandantenRolloutTarget) => {
    setRolloutTarget(t)
    setProductionWartungAcknowledged(false)
  }, [])

  const handleRolloutPackageIdChange = useCallback((id: string) => {
    setRolloutPackageId(id)
    setProductionWartungAcknowledged(false)
  }, [])

  const selectedPackage = findMandantenDbUpdatePackageById(rolloutPackageId)
  const isProduction = rolloutTarget === 'production'
  const isPackageAllowedForTarget = selectedPackage
    ? isMandantenDbUpdatePackageAllowedForTarget(selectedPackage, rolloutTarget)
    : false
  const canTrigger = !!selectedPackage && isPackageAllowedForTarget && !rolloutSending

  const selectionFingerprint = `${rolloutPackageId}|${rolloutTarget}`
  const dryRunMatchesSelection = dryRunOkFingerprint !== null && dryRunOkFingerprint === selectionFingerprint

  const latestRolloutSummary = useMemo((): LatestMandantenDbRolloutSummary => {
    if (!runsHydrated && runsLoading) return { kind: 'loading' }
    if (runsHydrated && runsError && rolloutRuns.length === 0) return { kind: 'fetch_error', message: runsError }
    if (runsHydrated && rolloutRuns.length === 0) return { kind: 'empty' }
    if (rolloutRuns.length > 0) return { kind: 'row', row: rolloutRuns[0] }
    return { kind: 'loading' }
  }, [runsHydrated, runsLoading, runsError, rolloutRuns])

  const statusLines = useMemo(
    () =>
      computeUpdateHubDbStatusLines({
        selectedPackage,
        rolloutTarget,
        productionWartungAcknowledged,
        dryRunMatchesSelection,
        githubActionsUrl: ghUrl,
        latestRollout: latestRolloutSummary,
        recentRollouts: rolloutRuns,
      }),
    [
      selectedPackage,
      rolloutTarget,
      productionWartungAcknowledged,
      dryRunMatchesSelection,
      ghUrl,
      latestRolloutSummary,
      rolloutRuns,
    ]
  )

  const handleRollout = async (mode: MandantenRolloutMode) => {
    const startedAt = new Date()
    const startedAtIso = startedAt.toISOString()
    const startedAtDisplay = startedAt.toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'medium',
    })

    if (!selectedPackage) {
      setRolloutFeedback({
        ok: false,
        mode,
        target: rolloutTarget,
        packageLabel: '—',
        module: '—',
        sqlFile: '—',
        startedAtIso,
        startedAtDisplay,
        error: 'Bitte zuerst ein Update-Paket auswählen.',
      })
      return
    }
    if (!isPackageAllowedForTarget) {
      setRolloutFeedback({
        ok: false,
        mode,
        target: rolloutTarget,
        packageLabel: selectedPackage.label,
        module: selectedPackage.module,
        sqlFile: selectedPackage.sqlFile,
        startedAtIso,
        startedAtDisplay,
        error: `Dieses Paket ist für ${isProduction ? 'Produktion' : 'Staging'} nicht freigegeben.`,
      })
      return
    }
    if (mode === 'apply' && isProduction && !productionWartungAcknowledged) {
      setRolloutFeedback({
        ok: false,
        mode,
        target: rolloutTarget,
        packageLabel: selectedPackage.label,
        module: selectedPackage.module,
        sqlFile: selectedPackage.sqlFile,
        startedAtIso,
        startedAtDisplay,
        error:
          'Für einen Production-Echtlauf ist die Checkbox „Wartung / Kundenkommunikation geprüft“ erforderlich.',
      })
      return
    }

    const dispatchAt = new Date()
    const dispatchAtIso = dispatchAt.toISOString()
    const dispatchAtDisplay = dispatchAt.toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'medium',
    })

    const base = {
      mode,
      target: rolloutTarget,
      packageLabel: selectedPackage.label,
      module: selectedPackage.module,
      sqlFile: selectedPackage.sqlFile,
      startedAtIso: dispatchAtIso,
      startedAtDisplay: dispatchAtDisplay,
    }

    if (mode === 'apply') {
      const scope = isProduction
        ? 'PRODUKTION (Secret MANDANTEN_DB_URLS_PRODUCTION oder Legacy MANDANTEN_DB_URLS)'
        : 'Staging (Secret MANDANTEN_DB_URLS_STAGING)'
      const wartungZeile = isProduction ? '\n\nWartung / Kundenkommunikation wurde bestätigt.' : ''
      const okConfirm = window.confirm(
        `Echtlauf starten?\n\nPaket: ${selectedPackage.label}\nModul: ${selectedPackage.module}\nZiel: ${scope}\nSQL-Datei (im Repo): ${selectedPackage.sqlFile}\n\nVorher Trockenlauf mit gleichen Einstellungen und GitHub Actions-Logs prüfen.${wartungZeile}`
      )
      if (!okConfirm) return
    }

    setRolloutSending(true)
    try {
      const r = await triggerMandantenDbRollout({
        mode,
        target: rolloutTarget,
        sql_file: selectedPackage.sqlFile,
        product_key: selectedPackage.productKey ?? null,
        module_key: selectedPackage.moduleKey,
        package_id: selectedPackage.id,
      })
      if (r.ok) {
        if (mode === 'dry_run') {
          setDryRunOkFingerprint(selectionFingerprint)
        }
        setRolloutFeedback({
          ok: true,
          ...base,
          serverMessage: r.message,
          runId: r.run_id,
          onOpenHistoryTab: () => {
            setActiveTab('history')
            void loadRolloutRuns()
          },
        })
      } else {
        setRolloutFeedback({
          ok: false,
          ...base,
          error: r.error,
        })
      }
    } catch (e) {
      setRolloutFeedback({
        ok: false,
        ...base,
        error: e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.',
      })
    } finally {
      setRolloutSending(false)
      void loadRolloutRuns()
    }
  }

  const tabNavButtonClass = (id: HubTabId) =>
    `shrink-0 rounded-lg px-3 py-2 text-sm font-medium border transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 ${
      activeTab === id
        ? 'border-vico-primary bg-vico-primary/10 text-vico-primary'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-0">
      <header className="mb-5">
        <h2 className="text-xl font-bold text-slate-800">Mandanten aktualisieren</h2>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          Zentraler Hub für Mandanten-Updates: App-Releases und Deploy, Datenbank-Rollouts sowie Hinweise zu Historie
          und Voraussetzungen. Die jeweiligen Assistenten bleiben unter den bestehenden Menüpunkten erreichbar.
        </p>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2 overflow-x-auto pb-1" aria-label="Bereiche Mandanten aktualisieren">
        {HUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            id={`hub-tab-${t.id}`}
            aria-controls={`hub-panel-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={tabNavButtonClass(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="space-y-6 pb-8">
        {activeTab === 'overview' ? (
          <div id="hub-panel-overview" role="tabpanel" aria-labelledby="hub-tab-overview" className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <HubOverviewCard
                title="App aktualisieren"
                description="Go-Live, Kanäle und Deploy anstoßen – im Rollout-Assistenten. Releases und Versionen separat pflegen."
                actionLabel="Zu App & Rollout"
                onOpen={() => setActiveTab('app')}
              />
              <HubOverviewCard
                title="Datenbank aktualisieren"
                description="GitHub-Workflow führt gewähltes SQL-Paket gegen Staging- oder Production-URL-Listen aus."
                actionLabel="Zu Datenbank"
                onOpen={() => setActiveTab('database')}
              />
              <HubOverviewCard
                title="Status / letzte Aktivitäten"
                description="Ampel zur DB-Rollout-Konfiguration, letztem Eintrag in der Portal-Historie sowie die letzte ausgelöste Anfrage in dieser Sitzung."
                actionLabel="Zur Ampel scrollen"
                onOpen={() => {
                  setActiveTab('overview')
                  window.requestAnimationFrame(() =>
                    document.getElementById('hub-db-status-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  )
                }}
              />
              <HubOverviewCard
                title="Diagnose / Voraussetzungen"
                description="Checkliste zu Workflow, Secrets und empfohlenem Ablauf – ohne automatische Live-Prüfung."
                actionLabel="Zu Diagnose"
                onOpen={() => setActiveTab('diagnose')}
              />
            </div>

            <div id="hub-db-status-anchor">
              <UpdateHubStatusPanel
                title="Rollout-Bereitschaft (Datenbank)"
                ariaLabelledById="hub-db-status-heading"
                description="Orientierung für das aktuelle Paket und Ziel. Keine Live-Verifikation gegen GitHub oder Secrets."
                lines={statusLines}
              />
            </div>

            {rolloutFeedback ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-2">
                <p className="font-semibold text-slate-800 m-0">Letzte ausgelöste DB-Anfrage</p>
                <p className="m-0">
                  {rolloutFeedback.ok ? 'Erfolgreich angestoßen' : 'Fehlgeschlagen'} ·{' '}
                  {rolloutFeedback.packageLabel} · {rolloutFeedback.target === 'production' ? 'Produktion' : 'Staging'}{' '}
                  · {rolloutFeedback.mode === 'dry_run' ? 'Trockenlauf' : 'Echtlauf'} · {rolloutFeedback.startedAtDisplay}
                </p>
                {rolloutFeedback.ok && rolloutFeedback.runId ? (
                  <p className="m-0 font-mono text-[11px] text-slate-600 break-all">Run-ID: {rolloutFeedback.runId}</p>
                ) : null}
                {rolloutFeedback.ok && rolloutFeedback.runId ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-vico-primary"
                    onClick={() => {
                      setActiveTab('history')
                      void loadRolloutRuns()
                    }}
                  >
                    Zur Historie / Details
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500 m-0">
                Noch keine Trockenlauf- oder Echtlauf-Anfrage in dieser Sitzung ausgelöst.
              </p>
            )}
          </div>
        ) : null}

        {activeTab === 'maintenance' ? (
          <div
            id="hub-panel-maintenance"
            role="tabpanel"
            aria-labelledby="hub-tab-maintenance"
            className="space-y-4 max-w-3xl"
          >
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              <h3 id="hub-maintenance-heading" className="text-sm font-semibold text-slate-800 m-0">
                Wartung im Update-Ablauf
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed m-0">
                Der Wartungsmodus der Mandanten-Apps ist sinnvoll, bevor Sie riskante Änderungen ausrollen – etwa DB-Migrationen
                oder große App-Releases in der <strong>Produktion</strong>. Nutzer sehen einen Hinweis statt normaler Nutzung,
                wenn Sie ihn aktivieren.
              </p>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-700 m-0 mb-2">Empfohlener Ablauf</p>
                <ol className="list-decimal list-inside text-xs text-slate-700 space-y-1.5 m-0 pl-0 leading-relaxed">
                  <li>Wartung vorbereiten</li>
                  <li>Mandanten informieren</li>
                  <li>App-/DB-Update ausführen</li>
                  <li>Status prüfen</li>
                  <li>Wartung beenden</li>
                </ol>
              </div>
              <div>
                <Link
                  to="/globale-wartung"
                  className="inline-flex items-center justify-center rounded-lg bg-vico-primary text-white px-4 py-2.5 text-sm font-medium hover:opacity-95 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2"
                >
                  Globale Wartung öffnen
                </Link>
              </div>
              <div className="text-[11px] text-slate-500 space-y-1.5 leading-relaxed border-t border-slate-100 pt-3">
                <p className="m-0">
                  Der Wartungsmodus wird hier für <strong>ausgewählte Mandanten</strong> gesetzt (Bulk über die bestehende Seite).
                  Wartungs<strong>ankündigungen</strong> pro Mandant bleiben im Mandantenformular. Historie/Audit zur Wartung
                  folgt später.
                </p>
              </div>
              <nav className="flex flex-wrap gap-x-3 gap-y-2 text-xs border-t border-slate-100 pt-3" aria-label="Weitere Bereiche">
                <Link to="/mailvorlagen-global" className="text-vico-primary font-medium underline hover:no-underline">
                  Mailvorlagen global
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab('diagnose')}
                  className="text-vico-primary font-medium underline hover:no-underline p-0 bg-transparent border-0 cursor-pointer text-left"
                >
                  Diagnose
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className="text-vico-primary font-medium underline hover:no-underline p-0 bg-transparent border-0 cursor-pointer text-left"
                >
                  Datenbank
                </button>
                <Link to="/release-rollout" className="text-vico-primary font-medium underline hover:no-underline">
                  Rollout &amp; Deploy
                </Link>
              </nav>
            </section>
          </div>
        ) : null}

        {activeTab === 'app' ? (
          <div id="hub-panel-app" role="tabpanel" aria-labelledby="hub-tab-app" className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 m-0">App-Releases &amp; Deploy</h3>
              <p className="text-xs text-slate-600 leading-relaxed m-0">
                <strong>App-Releases:</strong> Releases anlegen, Incoming/Piloten und Metadaten pflegen.{' '}
                <strong>Rollout &amp; Deploy:</strong> Kanäle wählen, Production-Build starten, Go-Live-Zuweisungen für
                Mandanten ausführen – mit Live-Protokoll im Assistenten.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/release-rollout"
                  className="inline-flex items-center justify-center rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-900 min-h-[44px]"
                >
                  Zu Rollout &amp; Deploy
                </Link>
                <Link
                  to="/app-releases"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-50 min-h-[44px]"
                >
                  Zu App-Releases
                </Link>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'database' ? (
          <div id="hub-panel-database" role="tabpanel" aria-labelledby="hub-tab-database" className="space-y-4">
            <UpdateHubStatusPanel
              title="Rollout-Bereitschaft (Datenbank)"
              ariaLabelledById="hub-db-status-heading-db-tab"
              lines={statusLines}
              description="Gleiche Ampel wie in der Übersicht – für Arbeit im Datenbank-Tab."
            />
            <MandantenDbRolloutSection
              visiblePackages={visiblePackages}
              rolloutTarget={rolloutTarget}
              rolloutPackageId={rolloutPackageId}
              rolloutSending={rolloutSending}
              rolloutFeedback={rolloutFeedback}
              githubActionsUrl={ghUrl}
              onRolloutTargetChange={handleRolloutTargetChange}
              onRolloutPackageIdChange={handleRolloutPackageIdChange}
              onDryRun={() => void handleRollout('dry_run')}
              onApply={() => void handleRollout('apply')}
              selectedPackage={selectedPackage}
              isProduction={isProduction}
              productionWartungAcknowledged={productionWartungAcknowledged}
              onProductionWartungAcknowledgedChange={setProductionWartungAcknowledged}
              isPackageAllowedForTarget={isPackageAllowedForTarget}
              canTrigger={canTrigger}
            />
          </div>
        ) : null}

        {activeTab === 'history' ? (
          <div id="hub-panel-history" role="tabpanel" aria-labelledby="hub-tab-history" className="space-y-4">
            <MandantenDbRolloutHistoryPanel
              runs={rolloutRuns}
              targetCountsByRunId={targetCountsByRunId}
              loading={runsLoading}
              errorMessage={runsError}
              githubActionsUrl={ghUrl}
              starterEmailByUserId={starterEmails}
              packageLabelForId={packageLabelForId}
              onRefresh={() => void loadRolloutRuns()}
            />
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 m-0">App-Releases</h3>
              <p className="text-xs text-slate-600 leading-relaxed m-0">
                Zuweisungen, Rollbacks und ausgelöste Deploys werden im Lizenzportal unter Release-Audit protokolliert.
              </p>
              <Link
                to="/release-audit"
                className="inline-flex items-center justify-center rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-900 min-h-[44px]"
              >
                Zu Release-Audit
              </Link>
            </section>
          </div>
        ) : null}

        {activeTab === 'diagnose' ? (
          <div id="hub-panel-diagnose" role="tabpanel" aria-labelledby="hub-tab-diagnose" className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 m-0">Diagnose / Voraussetzungen</h3>
              <p className="text-xs text-slate-500 m-0">
                Keine automatische Live-Prüfung gegen GitHub oder Datenbanken – nur Orientierung für Betrieb und Admin.
              </p>
              <ul className="list-disc pl-5 text-xs text-slate-700 space-y-2 leading-relaxed m-0">
                <li>
                  <strong>GitHub Workflow:</strong> Workflow „Mandanten-DB – Rollout (psql)“ muss im Repo existieren und
                  über Workflow-Dispatch aus dem Lizenzportal gestartet werden (
                  <code className="bg-slate-100 px-1 rounded text-[11px]">trigger-mandanten-db-rollout</code>
                  ).
                </li>
                <li>
                  <strong>Actions / Logs:</strong> Ergebnisse und Fehler je Lauf in GitHub Actions prüfen
                  {ghUrl && /^https?:\/\//i.test(ghUrl) ? (
                    <>
                      {' '}
                      (<a href={ghUrl} target="_blank" rel="noopener noreferrer" className="text-vico-primary underline">
                        Direktlink
                      </a>
                      ).
                    </>
                  ) : (
                    <> (optional <code className="bg-slate-100 px-1 rounded">VITE_GITHUB_ACTIONS_URL</code> setzen).</>
                  )}
                </li>
                <li>
                  <strong>SQL-Pakete:</strong> Nur kuratierte Dateien im Admin-Dropdown; technisch zusätzlich durch die
                  Edge Function whitelist abgesichert.
                </li>
                <li>
                  <strong>Staging / Production:</strong> Secrets{' '}
                  <code className="bg-slate-100 px-1 rounded">MANDANTEN_DB_URLS_STAGING</code> /{' '}
                  <code className="bg-slate-100 px-1 rounded">MANDANTEN_DB_URLS_PRODUCTION</code> (Legacy:{' '}
                  <code className="bg-slate-100 px-1 rounded">MANDANTEN_DB_URLS</code>) in GitHub.
                </li>
                <li>
                  <strong>Trockenlauf:</strong> Listet nur URLs (maskiert), kein SQL gegen die Datenbanken – dient der
                  Kontrolle der Zielmenge vor dem Echtlauf.
                </li>
                <li>
                  <strong>Echtlauf:</strong> Mit Portal-<code className="bg-slate-100 px-1 rounded">run_id</code> führt das
                  Script alle URLs aus; Fehler stoppen nur den jeweiligen Mandanten (
                  <code className="bg-slate-100 px-1 rounded">ON_ERROR_STOP=1</code> je psql). Ohne{' '}
                  <code className="bg-slate-100 px-1 rounded">run_id</code> bricht der erste Fehler die gesamte Liste ab.
                </li>
              </ul>
              <p className="text-xs text-slate-600 m-0">
                Detaildoku: <code className="text-[11px]">docs/sql/Mandanten-DB-Workflow.md</code>. Test-Checkliste (Dry-Run,
                Echtlauf, Teilerfolg): <code className="text-[11px]">docs/Mandanten-DB-Rollout-Test-Checkliste.md</code>.
              </p>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default MandantenAktualisieren
