import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  rollbackTenantChannelRelease,
  fetchTenantReleaseAssignments,
  fetchAppReleasesMetaByIds,
  RELEASE_CHANNEL_LABELS,
  type ReleaseChannel,
} from '../lib/mandantenReleaseService'
import type { Tenant } from '../lib/tenantService'
import { supabase } from '../lib/supabase'
import { CHANNEL_EXECUTION_ORDER, ROLLOUT_PREVIEW_PAGE_SIZE } from '../constants/rolloutAssistant'
import RolloutLiveProtocol from './RolloutLiveProtocol'
import type { RolloutLogLine } from '../lib/rolloutLiveLog'

type ReleaseRollbackBulkPanelProps = {
  channels: ReleaseChannel[]
  effectiveTenants: Tenant[]
}

const sortedChannels = (selected: ReleaseChannel[]): ReleaseChannel[] =>
  CHANNEL_EXECUTION_ORDER.filter((c) => selected.includes(c))

type PreviewRow = {
  key: string
  tenantId: string
  tenantName: string
  channel: ReleaseChannel
  activeLabel: string
  previousLabel: string
  canRollback: boolean
}

type PreviewRowRaw = {
  key: string
  tenantId: string
  tenantName: string
  channel: ReleaseChannel
  activeId: string | null
  prevId: string | null
}

const ReleaseRollbackBulkPanel = ({ channels, effectiveTenants }: ReleaseRollbackBulkPanelProps) => {
  const [actorId, setActorId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [logLines, setLogLines] = useState<RolloutLogLine[]>([])
  const [runDone, setRunDone] = useState(false)
  const [cancelRequested, setCancelRequested] = useState(false)
  const abortRef = useRef(false)

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewPage, setPreviewPage] = useState(0)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setActorId(data.user?.id ?? null))
  }, [])

  const chOrdered = useMemo(() => sortedChannels(channels), [channels])

  useEffect(() => {
    setLogLines([])
    setRunDone(false)
    setCancelRequested(false)
    abortRef.current = false
    setPreviewRows([])
    setPreviewPage(0)
    setPreviewError(null)
  }, [channels.join(','), effectiveTenants.map((t) => t.id).join(',')])

  const loadPreview = useCallback(async () => {
    if (chOrdered.length === 0 || effectiveTenants.length === 0) {
      setPreviewRows([])
      return
    }
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const allIds = new Set<string>()
      const raw: PreviewRowRaw[] = []

      for (const t of effectiveTenants) {
        const asg = await fetchTenantReleaseAssignments(t.id)
        for (const ch of chOrdered) {
          const row = asg.find((a) => a.channel === ch)
          const activeId = row?.active_release_id ?? null
          const prevId = row?.previous_release_id ?? null
          if (activeId) allIds.add(activeId)
          if (prevId) allIds.add(prevId)
          raw.push({
            key: `${ch}:${t.id}`,
            tenantId: t.id,
            tenantName: t.name,
            channel: ch,
            activeId,
            prevId,
          })
        }
      }

      const meta = await fetchAppReleasesMetaByIds([...allIds])
      const labelFor = (id: string | null) => {
        if (!id) return '—'
        const m = meta.get(id)
        if (!m?.version_semver) return id.slice(0, 8) + '…'
        return m.title ? `${m.version_semver} (${m.title})` : m.version_semver
      }

      const built: PreviewRow[] = raw.map((r) => ({
        key: r.key,
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        channel: r.channel,
        activeLabel: labelFor(r.activeId),
        previousLabel: labelFor(r.prevId),
        canRollback: Boolean(r.prevId),
      }))
      setPreviewRows(built)
      setPreviewPage(0)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Vorschau fehlgeschlagen')
      setPreviewRows([])
    } finally {
      setPreviewLoading(false)
    }
  }, [chOrdered, effectiveTenants])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  const previewPageCount = Math.max(1, Math.ceil(previewRows.length / ROLLOUT_PREVIEW_PAGE_SIZE))
  const previewSlice = useMemo(() => {
    const start = previewPage * ROLLOUT_PREVIEW_PAGE_SIZE
    return previewRows.slice(start, start + ROLLOUT_PREVIEW_PAGE_SIZE)
  }, [previewRows, previewPage])

  const buildFullLogPlan = useCallback((): RolloutLogLine[] => {
    const lines: RolloutLogLine[] = []
    for (const ch of chOrdered) {
      for (const t of effectiveTenants) {
        lines.push({
          key: `${ch}:${t.id}`,
          operation: 'rollback',
          channel: ch,
          tenantId: t.id,
          tenantName: t.name,
          status: 'queued',
        })
      }
    }
    return lines
  }, [chOrdered, effectiveTenants])

  const updateLine = useCallback((key: string, patch: Partial<Pick<RolloutLogLine, 'status' | 'detail'>>) => {
    setLogLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }, [])

  const runExecute = useCallback(
    async (linesToRun: RolloutLogLine[]) => {
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

          updateLine(row.key, { status: 'running', detail: undefined })
          const res = await rollbackTenantChannelRelease(row.tenantId, row.channel, actorId)
          if ('error' in res) {
            if (res.error === 'Kein vorheriger Release gespeichert.') {
              updateLine(row.key, { status: 'skipped', detail: 'Kein vorheriger Release' })
            } else {
              updateLine(row.key, { status: 'error', detail: res.error })
            }
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
      } finally {
        setBusy(false)
        abortRef.current = false
      }
    },
    [actorId, updateLine]
  )

  const cannotRun = effectiveTenants.length === 0

  const handleExecute = async () => {
    if (chOrdered.length === 0 || cannotRun) return

    const lines = buildFullLogPlan()
    const ok = window.confirm(
      `Rollback für ${effectiveTenants.length} Mandant(en) und ${chOrdered.length} Kanal/Kanäle ausführen?`
    )
    if (!ok) return

    await runExecute(lines)
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
    const ok = window.confirm(`${failed.length} fehlgeschlagene Schritte erneut versuchen?`)
    if (!ok) return
    await runExecute(fresh)
  }

  const progressTotal = logLines.length
  const progressDone = logLines.filter((l) =>
    ['ok', 'skipped', 'error', 'cancelled'].includes(l.status)
  ).length

  if (chOrdered.length === 0) {
    return <p className="text-sm text-slate-500">Mindestens einen Kanal oben auswählen.</p>
  }

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4"
      aria-labelledby="rollback-bulk-heading"
    >
      <div>
        <h2 id="rollback-bulk-heading" className="text-base font-semibold text-slate-800">
          Rollback (Mehrkanal)
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Kanäle in Reihenfolge: {chOrdered.map((c) => RELEASE_CHANNEL_LABELS[c]).join(' → ')}. Nur LP-Zuweisung und{' '}
          <code className="text-[11px] bg-slate-100 px-1 rounded">client_config_version</code> – kein automatischer
          Git-Revert auf Cloudflare. Wenn das CDN bereits ein neueres Bundle ausliefert, kann die API ältere
          Release-Metadaten melden als der Browser lädt.
        </p>
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">Vorschau (D5)</p>
          <button
            type="button"
            onClick={() => void loadPreview()}
            disabled={previewLoading || effectiveTenants.length === 0}
            className="text-xs font-medium text-vico-primary hover:underline disabled:opacity-50"
          >
            Aktualisieren
          </button>
        </div>
        {previewLoading ? (
          <p className="text-xs text-slate-500">Lade Zuweisungen…</p>
        ) : previewError ? (
          <p className="text-xs text-red-700">{previewError}</p>
        ) : previewRows.length === 0 ? (
          <p className="text-xs text-slate-500">Keine Zeilen (Mandanten wählen).</p>
        ) : (
          <>
            <div className="overflow-x-auto border border-slate-200 rounded-md bg-white text-xs">
              <table className="min-w-full text-left">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Mandant</th>
                    <th className="px-2 py-1.5 font-medium">Kanal</th>
                    <th className="px-2 py-1.5 font-medium">Aktuell</th>
                    <th className="px-2 py-1.5 font-medium">Rollback auf</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewSlice.map((r) => (
                    <tr key={r.key} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-slate-800">{r.tenantName}</td>
                      <td className="px-2 py-1.5">{RELEASE_CHANNEL_LABELS[r.channel]}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px]">{r.activeLabel}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px]">{r.previousLabel}</td>
                      <td className="px-2 py-1.5">
                        {r.canRollback ? (
                          <span className="text-emerald-700">Rollback möglich</span>
                        ) : (
                          <span className="text-amber-700">Kein Vorversion</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewRows.length > ROLLOUT_PREVIEW_PAGE_SIZE ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <button
                  type="button"
                  disabled={previewPage <= 0}
                  onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                  className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40"
                >
                  Zurück
                </button>
                <span>
                  Seite {previewPage + 1} / {previewPageCount}
                </span>
                <button
                  type="button"
                  disabled={previewPage >= previewPageCount - 1}
                  onClick={() => setPreviewPage((p) => Math.min(previewPageCount - 1, p + 1))}
                  className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40"
                >
                  Weiter
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleExecute()}
        disabled={busy || cannotRun}
        className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50"
      >
        {busy ? 'Rollback läuft…' : 'Rollback ausführen'}
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

export default ReleaseRollbackBulkPanel
