import { useCallback, useEffect, useState } from 'react'
import {
  fetchMandantenDbRolloutTargets,
  type MandantenDbRolloutRunRow,
  type MandantenDbRolloutTargetRow,
} from '../lib/mandantenDbRolloutRunsService'

const formatIso = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' })
}

const labelTargetStatus = (s: string): string => {
  switch (s) {
    case 'queued':
      return 'Wartend'
    case 'running':
      return 'Läuft'
    case 'success':
      return 'Erfolg'
    case 'error':
      return 'Fehler'
    case 'skipped':
      return 'Übersprungen (Dry-Run)'
    default:
      return s
  }
}

export type MandantenDbRolloutRunDetailModalProps = {
  open: boolean
  onClose: () => void
  run: MandantenDbRolloutRunRow | null
  githubActionsFallbackUrl: string
}

export const MandantenDbRolloutRunDetailModal = ({
  open,
  onClose,
  run,
  githubActionsFallbackUrl,
}: MandantenDbRolloutRunDetailModalProps) => {
  const [targets, setTargets] = useState<MandantenDbRolloutTargetRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!run?.id) return
    setLoading(true)
    setError(null)
    const r = await fetchMandantenDbRolloutTargets(run.id)
    if (!r.ok) {
      setTargets([])
      setError(r.error)
    } else {
      setTargets(r.rows)
    }
    setLoading(false)
  }, [run?.id])

  useEffect(() => {
    if (open && run?.id) {
      void load()
    } else {
      setTargets([])
      setError(null)
    }
  }, [open, run?.id, load])

  if (!open || !run) return null

  const ghHref =
    run.github_run_url?.trim() && /^https:\/\//i.test(run.github_run_url)
      ? run.github_run_url
      : githubActionsFallbackUrl.trim() && /^https:\/\//i.test(githubActionsFallbackUrl.trim())
        ? githubActionsFallbackUrl.trim()
        : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rollout-detail-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 shrink-0">
          <div className="min-w-0">
            <h2 id="rollout-detail-title" className="text-sm font-semibold text-slate-900 m-0 truncate">
              Rollout-Detail
            </h2>
            <p className="text-[11px] text-slate-500 m-0 mt-1 font-mono break-all">{run.id}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-vico-primary"
            onClick={onClose}
          >
            Schließen
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-3 space-y-4 flex-1">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs m-0">
            <dt className="text-slate-500 m-0">Gestartet</dt>
            <dd className="m-0 font-medium">{formatIso(run.started_at)}</dd>
            <dt className="text-slate-500 m-0">Beendet</dt>
            <dd className="m-0">{formatIso(run.finished_at ?? undefined)}</dd>
            <dt className="text-slate-500 m-0">Status (Run)</dt>
            <dd className="m-0 font-medium">{run.status}</dd>
            <dt className="text-slate-500 m-0">SQL-Paket</dt>
            <dd className="m-0 font-mono break-all">{run.sql_file}</dd>
            <dt className="text-slate-500 m-0">Ziel / Modus</dt>
            <dd className="m-0">
              {run.target === 'production' ? 'Produktion' : 'Staging'} · {run.mode === 'apply' ? 'Echtlauf' : 'Trockenlauf'}
            </dd>
          </dl>

          {run.summary_json &&
          typeof run.summary_json === 'object' &&
          !Array.isArray(run.summary_json) &&
          Object.keys(run.summary_json).length > 0 ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <p className="text-[11px] font-semibold text-slate-700 m-0 mb-1">Zusammenfassung (Summary)</p>
              <pre className="text-[10px] text-slate-600 m-0 overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(run.summary_json, null, 2)}
              </pre>
            </div>
          ) : null}

          {ghHref ? (
            <p className="text-xs m-0">
              <a
                href={ghHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-vico-primary font-medium underline"
              >
                GitHub Actions öffnen
              </a>
            </p>
          ) : null}

          <div>
            <h3 className="text-xs font-semibold text-slate-800 m-0 mb-2">Targets (Mandanten-DB-Verbindungen, maskiert)</h3>
            {error ? (
              <p className="text-xs text-red-700 m-0">{error}</p>
            ) : loading ? (
              <p className="text-xs text-slate-500 m-0">Lade Targets…</p>
            ) : targets.length === 0 ? (
              <p className="text-xs text-slate-500 m-0">
                Keine Targets erfasst (älterer Lauf oder Callback noch nicht ausgeführt).
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-[960px] w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="px-2 py-2 font-semibold">#</th>
                      <th className="px-2 py-2 font-semibold">Projekt-Ref</th>
                      <th className="px-2 py-2 font-semibold">Host (maskiert)</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold">Exit</th>
                      <th className="px-2 py-2 font-semibold">Zeiten</th>
                      <th className="px-2 py-2 font-semibold min-w-[120px]">Fehler</th>
                      <th className="px-2 py-2 font-semibold min-w-[100px]">Ausgabe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50 align-top">
                        <td className="px-2 py-2 whitespace-nowrap">{t.target_index}</td>
                        <td className="px-2 py-2 font-mono text-[10px]">{t.project_ref ?? '—'}</td>
                        <td className="px-2 py-2 font-mono break-all max-w-[220px]" title={t.db_host_masked}>
                          {t.db_host_masked}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{labelTargetStatus(t.status)}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{t.psql_exit_code ?? '—'}</td>
                        <td className="px-2 py-2 text-[10px] text-slate-600">
                          <div>{formatIso(t.started_at ?? undefined)}</div>
                          <div>{formatIso(t.finished_at ?? undefined)}</div>
                        </td>
                        <td className="px-2 py-2 text-[10px] text-slate-800 max-w-[200px]">
                          {t.error_excerpt?.trim() ? (
                            <p className="m-0 text-red-950 line-clamp-4 break-words" title={t.error_excerpt}>
                              {t.error_excerpt}
                            </p>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-2 text-[10px] align-top">
                          {t.stdout_excerpt?.trim() ? (
                            <details className="group">
                              <summary className="cursor-pointer list-none text-vico-primary underline decoration-dotted underline-offset-2 hover:no-underline [&::-webkit-details-marker]:hidden focus:outline-none focus:ring-2 focus:ring-vico-primary rounded-sm">
                                Stdout (Auszug)
                              </summary>
                              <pre className="mt-2 mb-0 max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded border border-slate-100 bg-slate-50 p-2 text-slate-700">
                                {t.stdout_excerpt}
                              </pre>
                            </details>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
