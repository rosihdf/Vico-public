import { LoadingSpinner } from '../LoadingSpinner'

export type AltberichtImportProgressPanelState =
  | { kind: 'idle' }
  | {
      kind: 'running'
      percent: number
      statusLine: string
      phaseIndex: number
      phaseTotal: number
      expertLines?: string[]
    }
  | { kind: 'success'; title: string; lines?: string[] }
  | { kind: 'error'; message: string }

export type AltberichtImportProgressPanelProps = {
  viewMode: 'standard' | 'expert'
  state: AltberichtImportProgressPanelState
  onDismissError?: () => void
}

export const AltberichtImportProgressPanel = ({
  viewMode,
  state,
  onDismissError,
}: AltberichtImportProgressPanelProps) => {
  if (state.kind === 'idle') return null

  if (state.kind === 'success') {
    return (
      <div
        className="mb-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/35 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-100 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="font-semibold flex items-center gap-2">
          <span aria-hidden>✅</span>
          {state.title}
        </div>
        {state.lines?.length ? (
          <ul className="mt-2 space-y-0.5 text-emerald-900/90 dark:text-emerald-200/90 list-disc pl-5">
            {state.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div
        className="mb-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/35 px-4 py-3 text-sm text-red-950 dark:text-red-100 shadow-sm"
        role="alert"
        aria-live="assertive"
      >
        <div className="font-semibold flex items-center gap-2">
          <span aria-hidden>❌</span>
          Import abgebrochen
        </div>
        <p className="mt-1.5 break-words">{state.message}</p>
        {onDismissError ? (
          <button
            type="button"
            className="mt-2 text-xs underline text-red-900 dark:text-red-200"
            onClick={onDismissError}
          >
            Hinweis ausblenden
          </button>
        ) : null}
      </div>
    )
  }

  const pct = Math.max(0, Math.min(100, state.percent))
  const stepLabel =
    state.phaseTotal > 1
      ? `Schritt ${state.phaseIndex} von ${state.phaseTotal}`
      : 'Bitte warten'

  return (
    <div
      className="mb-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/80 px-4 py-3 shadow-sm"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={state.statusLine}
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <LoadingSpinner size="sm" message="" className="shrink-0" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{stepLabel}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-slate-700 dark:bg-sky-600 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-snug">
        {pct}%
      </div>
      <div className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-snug">
        <span className="font-medium text-slate-600 dark:text-slate-400">Status: </span>
        {state.statusLine}
      </div>
      {viewMode === 'expert' && state.expertLines?.length ? (
        <ul className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-0.5 list-disc pl-5 border-t border-slate-200 dark:border-slate-700 pt-2">
          {state.expertLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
