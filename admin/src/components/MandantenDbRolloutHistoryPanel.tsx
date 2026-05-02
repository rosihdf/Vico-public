import { useMemo, useState } from 'react'
import {
  mandantenDbModuleDisplayNameLoose,
  mandantenDbProductDisplayNameLoose,
} from '../lib/mandantenDbUpdatePackages'
import type { MandantenDbRolloutRunRow, MandantenDbRolloutTargetCounts } from '../lib/mandantenDbRolloutRunsService'
import { MandantenDbRolloutRunDetailModal } from './MandantenDbRolloutRunDetailModal'

const formatStartedAt = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' })
}

const labelTarget = (t: string): string =>
  t === 'production' ? 'Produktion' : t === 'staging' ? 'Staging' : t

const labelMode = (m: string): string =>
  m === 'apply' ? 'Echtlauf' : m === 'dry_run' ? 'Trockenlauf' : m

const labelRunStatus = (s: string): string => {
  switch (s) {
    case 'queued':
      return 'Wartend'
    case 'running':
      return 'Läuft'
    case 'success':
      return 'Erfolg'
    case 'partial':
      return 'Teilerfolg'
    case 'error':
      return 'Fehler'
    case 'cancelled':
      return 'Abgebrochen'
    default:
      return s
  }
}

const formatTargetsSummary = (
  runId: string,
  map: ReadonlyMap<string, MandantenDbRolloutTargetCounts> | undefined
): string => {
  const c = map?.get(runId)
  if (!c) return '—'
  const total = c.success + c.error + c.skipped + c.queued + c.running
  if (total === 0) return '—'
  const tail =
    c.running + c.queued > 0 ? ` · wartend/laufend ${c.running + c.queued}` : ''
  return `Erfolg ${c.success}, Fehler ${c.error}, Übersprungen ${c.skipped}${tail}`
}

const githubHrefForRow = (row: MandantenDbRolloutRunRow, fallbackEnvUrl: string): string | null => {
  const direct = row.github_run_url?.trim()
  if (direct && /^https?:\/\//i.test(direct)) return direct
  const fb = fallbackEnvUrl.trim()
  if (fb && /^https?:\/\//i.test(fb)) return fb
  return null
}

export type MandantenDbRolloutHistoryPanelProps = {
  runs: ReadonlyArray<MandantenDbRolloutRunRow>
  /** Aggregierte Target-Zähler je Run (optional; fehlende Daten zeigen „—"). */
  targetCountsByRunId?: ReadonlyMap<string, MandantenDbRolloutTargetCounts>
  loading: boolean
  errorMessage: string | null
  githubActionsUrl: string
  starterEmailByUserId: ReadonlyMap<string, string>
  packageLabelForId: (packageId: string | null | undefined) => string
  onRefresh: () => void
}

export const MandantenDbRolloutHistoryPanel = ({
  runs,
  targetCountsByRunId,
  loading,
  errorMessage,
  githubActionsUrl,
  starterEmailByUserId,
  packageLabelForId,
  onRefresh,
}: MandantenDbRolloutHistoryPanelProps) => {
  const [detailRun, setDetailRun] = useState<MandantenDbRolloutRunRow | null>(null)

  const activeHint = useMemo(
    () =>
      runs.some((r) => r.status === 'queued' || r.status === 'running')
        ? 'Es gibt mindestens einen Rollout ohne Abschluss (wartend oder laufend). Details öffnen oder GitHub prüfen.'
        : null,
    [runs]
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <MandantenDbRolloutRunDetailModal
        open={detailRun !== null}
        onClose={() => setDetailRun(null)}
        run={detailRun}
        githubActionsFallbackUrl={githubActionsUrl}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 m-0">Mandanten-DB-Rollouts</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-vico-primary"
        >
          {loading ? 'Laden …' : 'Aktualisieren'}
        </button>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed m-0">
        Protokoll aus dem Lizenzportal inkl. GitHub-Callback je Mandanten-Ziel (maskierte DB-Hosts). Trockenlauf meldet
        Targets als übersprungen („Dry-Run: SQL wurde nicht ausgeführt.“).
      </p>
      {activeHint ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-2 m-0">{activeHint}</p>
      ) : null}
      {errorMessage ? (
        <p className="text-xs text-red-700 m-0 rounded-md border border-red-200 bg-red-50 px-2 py-2">{errorMessage}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="min-w-[1050px] w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Zeitpunkt
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Paket
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Produkt
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Modul
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Ziel
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Modus
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Status
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap min-w-[160px]">
                Targets
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Gestartet von
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                GitHub
              </th>
              <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-2 py-6 text-slate-500 text-center">
                  Einträge werden geladen …
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-2 py-6 text-slate-500 text-center">
                  Noch keine protokollierten Rollouts.
                </td>
              </tr>
            ) : (
              runs.map((row) => {
                const gh = githubHrefForRow(row, githubActionsUrl)
                const starter =
                  row.started_by && starterEmailByUserId.has(row.started_by)
                    ? starterEmailByUserId.get(row.started_by)!
                    : row.started_by
                      ? `${row.started_by.slice(0, 8)}…`
                      : '—'
                const statusCls =
                  row.status === 'error'
                    ? 'text-red-700 font-medium'
                    : row.status === 'partial'
                      ? 'text-amber-800 font-medium'
                      : row.status === 'success'
                        ? 'text-emerald-800 font-medium'
                        : row.status === 'running' || row.status === 'queued'
                          ? 'text-amber-700 font-medium'
                          : 'text-slate-700'
                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80 align-top">
                    <td className="px-2 py-2 whitespace-nowrap text-slate-800">{formatStartedAt(row.started_at)}</td>
                    <td className="px-2 py-2 text-slate-800 max-w-[160px]" title={packageLabelForId(row.package_id)}>
                      <span className="line-clamp-2">{packageLabelForId(row.package_id)}</span>
                      <span className="block font-mono text-[10px] text-slate-400 truncate">{row.sql_file}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-800">{mandantenDbProductDisplayNameLoose(row.product_key)}</td>
                    <td className="px-2 py-2 text-slate-800">{mandantenDbModuleDisplayNameLoose(row.module_key)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{labelTarget(row.target)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{labelMode(row.mode)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={statusCls}>{labelRunStatus(row.status)}</span>
                    </td>
                    <td
                      className="px-2 py-2 text-[11px] text-slate-700 align-top max-w-[220px]"
                      title={formatTargetsSummary(row.id, targetCountsByRunId)}
                    >
                      <span className="line-clamp-2 leading-snug">{formatTargetsSummary(row.id, targetCountsByRunId)}</span>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-700 max-w-[140px] break-words">{starter}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {gh ? (
                        <a
                          href={gh}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-vico-primary hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                          aria-label={`GitHub zu Rollout vom ${formatStartedAt(row.started_at)} öffnen`}
                        >
                          GitHub öffnen
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-vico-primary min-h-[36px]"
                        onClick={() => setDetailRun(row)}
                      >
                        Öffnen
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 m-0">
        Repo-Direktlink zur Actions-Übersicht optional über{' '}
        <code className="bg-slate-100 px-1 rounded text-[10px]">VITE_GITHUB_ACTIONS_URL</code>. Konkrete Job-URLs setzt der
        Workflow über das Lizenzportal-Callback.
      </p>
    </section>
  )
}
