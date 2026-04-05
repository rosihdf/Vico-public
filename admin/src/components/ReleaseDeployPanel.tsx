import { Link } from 'react-router-dom'
import { useReleaseDeployTrigger, type DeployOutcomeOk } from '../hooks/useReleaseDeployTrigger'
import { RELEASE_CHANNEL_LABELS, type ReleaseChannel } from '../lib/mandantenReleaseService'

type ReleaseDeployPanelProps = {
  releaseId: string | null
  channel: ReleaseChannel
  /** z. B. Speichern im Editor – Deploy-Button deaktivieren */
  disabled?: boolean
  /** Kurzer Titel unterhalb der Hauptüberschrift (nur Editor) */
  showEditorHint?: boolean
  onDeploySuccess?: (outcome: DeployOutcomeOk) => void
}

const ReleaseDeployPanel = ({
  releaseId,
  channel,
  disabled = false,
  showEditorHint = false,
  onDeploySuccess,
}: ReleaseDeployPanelProps) => {
  const { deployBusy, deployOutcome, deployError, handleDeployClick } = useReleaseDeployTrigger(
    releaseId,
    onDeploySuccess
  )

  if (!releaseId) return null

  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-3"
      aria-labelledby="deploy-heading"
    >
      <h2 id="deploy-heading" className="font-semibold text-slate-800">
        Production-Deploy (Cloudflare Pages)
      </h2>
      {showEditorHint ? (
        <p className="text-xs text-slate-600">
          Startet in GitHub Actions den Workflow{' '}
          <span className="font-mono text-[11px]">deploy-pages-from-release.yml</span> für Kanal{' '}
          <strong>{RELEASE_CHANNEL_LABELS[channel]}</strong>: Checkout per Tag/Commit aus den CI-Metadaten (oder
          Konvention <span className="font-mono">Kanal/Version</span>). Voraussetzung: Repository-Secrets für Vite-Env
          und CF sind gesetzt (siehe Kommentar im Workflow).
        </p>
      ) : (
        <p className="text-xs text-slate-600">
          Kanal <strong>{RELEASE_CHANNEL_LABELS[channel]}</strong> – gleicher Ablauf wie im Release-Editor.
        </p>
      )}
      {deployError ? (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2" role="alert">
          {deployError}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleDeployClick}
        disabled={deployBusy || disabled}
        className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-600"
      >
        {deployBusy ? 'Starte…' : 'Build & Deploy in GitHub starten'}
      </button>
      {deployOutcome?.type === 'ok' ? (
        <div
          className="rounded-md border border-emerald-200 bg-white p-3 space-y-2 text-slate-700"
          role="status"
        >
          <p className="text-sm text-emerald-800 font-medium">{deployOutcome.message}</p>
          <p className="text-xs">
            App: <span className="font-mono">{deployOutcome.app}</span>, Git-Ref:{' '}
            <span className="font-mono">{deployOutcome.git_ref}</span>
          </p>
          <p>
            <a
              href={deployOutcome.github_actions_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-vico-primary font-medium hover:underline"
            >
              GitHub Actions (Workflow) öffnen
            </a>
          </p>
          <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
            Nach erfolgreichem Deploy sehen Mandanten die neue Version erst, wenn der Stand über{' '}
            <strong>Incoming</strong> oder <strong>Go-Live</strong> zugewiesen ist.{' '}
            <Link to="/mandanten" className="text-vico-primary font-medium hover:underline">
              Mandanten
            </Link>
            {' · '}
            <Link to="/app-releases" className="text-vico-primary font-medium hover:underline">
              App-Releases
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default ReleaseDeployPanel
