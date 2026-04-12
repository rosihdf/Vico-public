import { RELEASE_CHANNEL_LABELS } from '../lib/mandantenReleaseService'
import {
  type RolloutLogLine,
  ROLLOUT_STATUS_LABEL_DE,
  buildRolloutCsv,
  buildRolloutTsv,
  countRolloutOutcomes,
} from '../lib/rolloutLiveLog'

type RolloutLiveProtocolProps = {
  lines: RolloutLogLine[]
  busy: boolean
  runDone: boolean
  progressDone: number
  progressTotal: number
  cancelRequested: boolean
  onCancel: () => void
  onRetryFailed?: () => void
}

const statusClass = (s: RolloutLogLine['status']) => {
  if (s === 'ok') return 'text-emerald-700'
  if (s === 'error') return 'text-red-700'
  if (s === 'skipped') return 'text-amber-700'
  if (s === 'running') return 'text-vico-primary'
  if (s === 'cancelled') return 'text-slate-500'
  return 'text-slate-400'
}

const RolloutLiveProtocol = ({
  lines,
  busy,
  runDone,
  progressDone,
  progressTotal,
  cancelRequested,
  onCancel,
  onRetryFailed,
}: RolloutLiveProtocolProps) => {
  if (lines.length === 0) return null

  const { ok, skipped, error, cancelled } = countRolloutOutcomes(lines)

  const handleCopyTsv = async () => {
    try {
      await navigator.clipboard.writeText(buildRolloutTsv(lines))
    } catch {
      /* ignore */
    }
  }

  const handleDownloadCsv = () => {
    const blob = new Blob([buildRolloutCsv(lines)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rollout-protokoll-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const showRetry = runDone && error > 0 && onRetryFailed

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">
          Live-Protokoll · Fortschritt {progressDone} / {progressTotal}
          {runDone ? (
            <span className="ml-2 text-slate-500 font-normal">
              (Erfolg {ok}, übersprungen {skipped}, Fehler {error}
              {cancelled > 0 ? `, abgebrochen ${cancelled}` : ''})
            </span>
          ) : null}
        </p>
        {busy ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-red-700 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
          >
            Abbrechen
          </button>
        ) : null}
      </div>
      {cancelRequested && !busy ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5" role="status">
          Lauf gestoppt: keine weiteren API-Aufrufe. Bereits erfolgreiche Schritte bleiben; Rest wurde ausgelassen
          (teilweise ausgeführt).
        </p>
      ) : null}
      <ul
        className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg text-xs font-mono divide-y divide-slate-100"
        aria-live="polite"
        aria-busy={busy}
      >
        {lines.map((r) => (
          <li
            key={r.key}
            className={`px-2 py-1.5 flex flex-wrap gap-x-2 gap-y-0.5 ${r.status === 'running' ? 'bg-vico-primary/5' : ''}`}
          >
            <span className="text-slate-500">{RELEASE_CHANNEL_LABELS[r.channel]}</span>
            <span className="text-slate-800 min-w-0 truncate flex-1">{r.tenantName}</span>
            <span className="text-slate-500">{r.operation === 'assign' ? 'Zuweisung' : 'Rollback'}</span>
            <span className={statusClass(r.status)}>{ROLLOUT_STATUS_LABEL_DE[r.status]}</span>
            {r.detail ? <span className="w-full text-slate-500">{r.detail}</span> : null}
          </li>
        ))}
      </ul>
      {runDone ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopyTsv()}
            className="text-sm text-vico-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-vico-primary rounded"
          >
            In Zwischenablage (TSV)
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="text-sm text-vico-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-vico-primary rounded"
          >
            CSV herunterladen
          </button>
          {showRetry ? (
            <button
              type="button"
              onClick={onRetryFailed}
              className="text-sm font-medium text-amber-900 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-600 rounded"
            >
              Nur fehlgeschlagene wiederholen
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default RolloutLiveProtocol
