import { useCallback } from 'react'
import type { MandantenReleasesApiPayload } from './mandantenReleaseApi'
import { getActiveReleaseRequiringHardReload } from './mandantenReleaseApi'
import { executeMandantenReleaseReload } from './mandantenReleaseReloadBridge'

type MandantenReleaseHardReloadGateProps = {
  releases: MandantenReleasesApiPayload | null | undefined
}

/**
 * §11.20#7 / WP-REL-02: Vollflächiger Zwang zum Neu-Laden, wenn der aktive Mandanten-Release `forceHardReload` setzt.
 */
const MandantenReleaseHardReloadGate = ({ releases }: MandantenReleaseHardReloadGateProps) => {
  const entry = getActiveReleaseRequiringHardReload(releases ?? null)
  const handleReload = useCallback(() => {
    void executeMandantenReleaseReload()
  }, [])

  if (!entry) return null

  const headline = entry.title?.trim() || `Version ${entry.version}`
  const relType =
    entry.releaseType === 'major' ? 'Major-Release' : entry.releaseType === 'feature' ? 'Funktions-Update' : 'Update'

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mandanten-hard-reload-title"
      aria-describedby="mandanten-hard-reload-desc"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl dark:border-amber-900/50 dark:bg-slate-800">
        <h2
          id="mandanten-hard-reload-title"
          className="text-lg font-bold text-slate-900 dark:text-slate-50"
        >
          App-Update erforderlich
        </h2>
        <p id="mandanten-hard-reload-desc" className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          Für diese App wurde ein <strong>{relType}</strong> freigegeben, das ein vollständiges Neu-Laden erfordert:{' '}
          <span className="font-medium">{headline}</span>. Bitte laden Sie jetzt neu, um Daten und Oberfläche
          konsistent zu halten.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={handleReload}
            className="w-full rounded-lg bg-vico-primary px-4 py-3 text-center text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800 sm:w-auto"
            aria-label="App jetzt neu laden"
          >
            Jetzt neu laden
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Ohne Neuladen kann die Anwendung fehlerhaft arbeiten. Diese Meldung verschwindet nach dem Laden der neuen
          Version.
        </p>
      </div>
    </div>
  )
}

export default MandantenReleaseHardReloadGate
