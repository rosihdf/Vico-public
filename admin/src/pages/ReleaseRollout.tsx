import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import ReleaseDeployPanel from '../components/ReleaseDeployPanel'
import RolloutChecklistModal from '../components/RolloutChecklistModal'
import type { DeployOutcomeOk } from '../hooks/useReleaseDeployTrigger'
import {
  fetchAppReleases,
  RELEASE_CHANNEL_LABELS,
  RELEASE_TYPE_LABELS,
  type AppReleaseRecord,
} from '../lib/mandantenReleaseService'

const ReleaseRollout = () => {
  const [rows, setRows] = useState<AppReleaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [lastGithubActionsUrl, setLastGithubActionsUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchAppReleases()
      setRows(list)
      setSelectedId((cur) => {
        if (cur && list.some((r) => r.id === cur)) return cur
        const firstPub = list.find((r) => r.status === 'published')
        return firstPub?.id ?? list[0]?.id ?? ''
      })
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

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  )

  useEffect(() => {
    setLastGithubActionsUrl(null)
  }, [selectedId])

  const handleDeploySuccess = useCallback((outcome: DeployOutcomeOk) => {
    setLastGithubActionsUrl(outcome.github_actions_url)
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Rollout &amp; Deploy</h1>
          <p className="text-sm text-slate-500 mt-1">
            Freigegebenes Release wählen, Production-Deploy nach GitHub/Cloudflare anstoßen und die
            Rollout-Checkliste nutzen (Mandanten: Incoming → Go-Live).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app-releases"
            className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            Alle App-Releases
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Lade Releases…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Releases vorhanden.</p>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <label htmlFor="rollout-release-select" className="block text-sm font-medium text-slate-700">
              Release
            </label>
            <select
              id="rollout-release-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full max-w-xl px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {RELEASE_CHANNEL_LABELS[r.channel]} · {r.version_semver}
                  {r.status === 'draft' ? ' (Entwurf)' : ''}
                  {r.title ? ` – ${r.title}` : ''}
                </option>
              ))}
            </select>
            {selected ? (
              <p className="text-xs text-slate-500">
                Typ: {RELEASE_TYPE_LABELS[selected.release_type]} ·{' '}
                <Link to={`/app-releases/${selected.id}`} className="text-vico-primary font-medium hover:underline">
                  Release bearbeiten
                </Link>
              </p>
            ) : null}
          </div>

          {selected ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChecklistOpen(true)}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-vico-primary text-vico-primary text-sm font-medium hover:bg-vico-primary/5 focus:outline-none focus:ring-2 focus:ring-vico-primary"
              >
                Rollout-Assistent (Checkliste)
              </button>
            </div>
          ) : null}

          {selected && selected.status !== 'published' ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-sm px-4 py-3"
              role="status"
            >
              <p className="font-medium">Dieser Release ist noch ein Entwurf.</p>
              <p className="text-xs mt-1 text-amber-900/90">
                Bitte zuerst im Editor <strong>freigeben</strong>, dann steht der Production-Deploy zur Verfügung.
              </p>
            </div>
          ) : null}

          {selected && selected.status === 'published' ? (
            <ReleaseDeployPanel
              releaseId={selected.id}
              channel={selected.channel}
              onDeploySuccess={handleDeploySuccess}
            />
          ) : null}
        </>
      )}

      <RolloutChecklistModal
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        release={selected}
        githubActionsUrl={lastGithubActionsUrl}
      />
    </div>
  )
}

export default ReleaseRollout
