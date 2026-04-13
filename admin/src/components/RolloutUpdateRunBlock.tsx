import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  setTenantChannelActiveRelease,
  RELEASE_CHANNEL_LABELS,
  type ReleaseChannel,
  type AppReleaseRecord,
} from '../lib/mandantenReleaseService'
import type { Tenant } from '../lib/tenantService'
import { supabase } from '../lib/supabase'
import { CHANNEL_EXECUTION_ORDER, MIN_TENANTS_BULK_CONFIRM_ALL } from '../constants/rolloutAssistant'
import RolloutLiveProtocol from './RolloutLiveProtocol'
import type { RolloutLogLine } from '../lib/rolloutLiveLog'
import type { RolloutScopeMode } from './RolloutTenantScope'

type RolloutUpdateRunBlockProps = {
  selectedChannels: ReleaseChannel[]
  releaseIdByChannel: Partial<Record<ReleaseChannel, string>>
  allReleases: AppReleaseRecord[]
  effectiveTenants: Tenant[]
  scopeMode: RolloutScopeMode
  fullTenantListLength: number
  deployAcknowledged: boolean
  onRunFinished?: () => void
}

const RolloutUpdateRunBlock = ({
  selectedChannels,
  releaseIdByChannel,
  allReleases,
  effectiveTenants,
  scopeMode,
  fullTenantListLength,
  deployAcknowledged,
  onRunFinished,
}: RolloutUpdateRunBlockProps) => {
  const [logLines, setLogLines] = useState<RolloutLogLine[]>([])
  const [busy, setBusy] = useState(false)
  const [runDone, setRunDone] = useState(false)
  const [cancelRequested, setCancelRequested] = useState(false)
  const abortRef = useRef(false)

  const chOrdered = useMemo(
    () => CHANNEL_EXECUTION_ORDER.filter((c) => selectedChannels.includes(c)),
    [selectedChannels]
  )

  const tenantKey = useMemo(() => effectiveTenants.map((t) => t.id).sort().join(','), [effectiveTenants])
  const releasePickKey = useMemo(
    () =>
      chOrdered
        .map((c) => `${c}:${releaseIdByChannel[c] ?? ''}`)
        .sort()
        .join('|'),
    [chOrdered, releaseIdByChannel]
  )
  const selectedChannelsKey = useMemo(() => selectedChannels.join(','), [selectedChannels])

  useEffect(() => {
    setLogLines([])
    setRunDone(false)
    setCancelRequested(false)
    abortRef.current = false
  }, [selectedChannelsKey, tenantKey, releasePickKey])

  const releasesValid = useMemo(() => {
    if (chOrdered.length === 0) return false
    return chOrdered.every((ch) => {
      const id = releaseIdByChannel[ch]
      if (!id) return false
      const r = allReleases.find((x) => x.id === id)
      return Boolean(r && r.status === 'published' && r.channel === ch)
    })
  }, [chOrdered, releaseIdByChannel, allReleases])

  const updateLine = useCallback((key: string, patch: Partial<Pick<RolloutLogLine, 'status' | 'detail'>>) => {
    setLogLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }, [])

  const buildPlan = useCallback((): RolloutLogLine[] => {
    const lines: RolloutLogLine[] = []
    for (const ch of chOrdered) {
      const rid = releaseIdByChannel[ch]
      if (!rid) continue
      for (const t of effectiveTenants) {
        lines.push({
          key: `${ch}:${t.id}`,
          operation: 'assign',
          channel: ch,
          tenantId: t.id,
          tenantName: t.name,
          status: 'queued',
        })
      }
    }
    return lines
  }, [chOrdered, releaseIdByChannel, effectiveTenants])

  const runExecute = useCallback(
    async (linesToRun: RolloutLogLine[], runActorId: string | null) => {
      if (linesToRun.length === 0) return
      setLogLines(linesToRun)
      setRunDone(false)
      setCancelRequested(false)
      abortRef.current = false
      setBusy(true)

      try {
        for (const row of linesToRun) {
          if (abortRef.current) {
            setLogLines((prev) =>
              prev.map((r) =>
                r.status === 'queued'
                  ? { ...r, status: 'cancelled' as const, detail: 'Abbruch (kein API-Aufruf)' }
                  : r
              )
            )
            setCancelRequested(true)
            break
          }
          if (row.status !== 'queued') continue

          const rid = releaseIdByChannel[row.channel]
          if (!rid) {
            updateLine(row.key, { status: 'error', detail: 'Kein Release für Kanal gewählt' })
            continue
          }

          updateLine(row.key, { status: 'running', detail: undefined })
          const res = await setTenantChannelActiveRelease(row.tenantId, row.channel, rid, runActorId)
          if ('error' in res) {
            updateLine(row.key, { status: 'error', detail: res.error })
          } else {
            updateLine(row.key, { status: 'ok' })
          }

          if (abortRef.current) {
            setLogLines((prev) =>
              prev.map((r) =>
                r.status === 'queued'
                  ? { ...r, status: 'cancelled' as const, detail: 'Abbruch (kein API-Aufruf)' }
                  : r
              )
            )
            setCancelRequested(true)
            break
          }
        }
        setRunDone(true)
        onRunFinished?.()
      } finally {
        setBusy(false)
        abortRef.current = false
      }
    },
    [onRunFinished, releaseIdByChannel, updateLine]
  )

  const handleGoLive = async () => {
    if (!deployAcknowledged || !releasesValid || effectiveTenants.length === 0) return

    if (scopeMode === 'all' && fullTenantListLength >= MIN_TENANTS_BULK_CONFIRM_ALL) {
      const okAll = window.confirm(
        `Sie weisen ${fullTenantListLength} Mandanten zu (Schwelle ${MIN_TENANTS_BULK_CONFIRM_ALL}). Wirklich alle?`
      )
      if (!okAll) return
    }

    const chLabels = chOrdered.map((c) => RELEASE_CHANNEL_LABELS[c]).join(', ')
    const ok = window.confirm(
      `Go-Live: Kanal(e) ${chLabels} für ${effectiveTenants.length} Mandant(en) zuweisen? Die Lizenz-API meldet danach die gewählten Versionen.`
    )
    if (!ok) return

    const plan = buildPlan()
    if (plan.length === 0) return
    const { data } = await supabase.auth.getUser()
    const aid = data.user?.id ?? null
    await runExecute(plan, aid)
  }

  const handleCancel = () => {
    abortRef.current = true
  }

  const handleRetryFailed = async () => {
    const failed = logLines.filter((l) => l.status === 'error')
    if (failed.length === 0) return
    const fresh: RolloutLogLine[] = failed.map((l) => ({
      ...l,
      status: 'queued' as const,
      detail: undefined,
    }))
    const ok = window.confirm(`${failed.length} fehlgeschlagene Zuweisungen erneut versuchen?`)
    if (!ok) return
    const { data } = await supabase.auth.getUser()
    const aid = data.user?.id ?? null
    await runExecute(fresh, aid)
  }

  const progressTotal = logLines.length
  const progressDone = logLines.filter((l) =>
    ['ok', 'skipped', 'error', 'cancelled'].includes(l.status)
  ).length

  const canClick = deployAcknowledged && releasesValid && effectiveTenants.length > 0 && !busy

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4"
      aria-labelledby="update-run-heading"
    >
      <div>
        <h2 id="update-run-heading" className="text-base font-semibold text-slate-800">
          Prüfen &amp; ausführen
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Zuweisung nacheinander pro Mandant und Kanal (Live-Protokoll). Nur LP-Zuweisung und{' '}
          <code className="text-[11px] bg-slate-100 px-1 rounded">client_config_version</code> – bei CDN/Bundle-Drift
          gilt derselbe Hinweis wie beim Rollback.
        </p>
      </div>

      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-1">
        <p>
          <span className="font-medium">Kanäle:</span> {chOrdered.map((c) => RELEASE_CHANNEL_LABELS[c]).join(' → ')}
        </p>
        <p>
          <span className="font-medium">Mandanten im Lauf:</span> {effectiveTenants.length}
        </p>
        {!releasesValid ? (
          <p className="text-amber-800">Bitte je Kanal ein <strong>freigegebenes</strong> Release wählen.</p>
        ) : null}
        {!deployAcknowledged ? (
          <p className="text-amber-800">Deploy-Bestätigung (D4) oben setzen.</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void handleGoLive()}
        disabled={!canClick || !deployAcknowledged || !releasesValid || effectiveTenants.length === 0}
        className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-vico-primary text-white text-sm font-semibold hover:bg-vico-primary-hover disabled:opacity-50 min-h-[44px] sm:min-h-0"
        title={
          !deployAcknowledged
            ? 'Zuerst Deploy-Bestätigung setzen'
            : !releasesValid
              ? 'Pro Kanal ein published Release wählen'
              : undefined
        }
      >
        {busy ? 'Zuweisung läuft…' : `Go-Live starten (${effectiveTenants.length} Mandant${effectiveTenants.length === 1 ? '' : 'en'})`}
      </button>

      <RolloutLiveProtocol
        lines={logLines}
        busy={busy}
        runDone={runDone}
        progressDone={progressDone}
        progressTotal={progressTotal || logLines.length}
        cancelRequested={cancelRequested}
        onCancel={handleCancel}
        onRetryFailed={() => void handleRetryFailed()}
      />
    </section>
  )
}

export default RolloutUpdateRunBlock
