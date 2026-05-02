import { useState } from 'react'
import { isNewerVersion } from './versionUtils'
import { hasAppVersionEntryContent, type AppVersionEntry } from './appVersions'
import { SemVerPortalBuildHint } from './SemVerPortalBuildHint'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'
const RELEASE_LABEL = typeof __APP_RELEASE_LABEL__ !== 'undefined' ? __APP_RELEASE_LABEL__ : ''

export type AppInfoContentProps = {
  /** Kurzbezeichnung in der Infobox, z. B. „Lizenzportal (Admin)“, „ArioVan“, „Kundenportal“ */
  appLabel: string
  /** Optional: mandantenweise gepflegte Anzeige aus dem Lizenzportal (ersetzt nicht den Build). */
  licenseAppInfo?: AppVersionEntry | null
}

/**
 * App-Version, manueller Update-Check und Release Notes (wie Haupt-App „Info“ → Abschnitt App).
 * Pro Vite-App wird `__APP_VERSION__` und `version.json` vom jeweiligen Build verwendet.
 */
const AppInfoContent = ({ appLabel, licenseAppInfo }: AppInfoContentProps) => {
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'current'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes: string[] } | null>(null)
  const [buildTime, setBuildTime] = useState<string | null>(null)

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking')
    setUpdateInfo(null)
    setBuildTime(null)
    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const res = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        setUpdateStatus('idle')
        return
      }
      const data = (await res.json()) as {
        version?: string
        releaseNotes?: string[]
        buildTime?: string
        releaseLabel?: string
      }
      const latest = data.version ?? ''
      const notes = Array.isArray(data.releaseNotes) ? data.releaseNotes : []
      setUpdateInfo({ version: latest, releaseNotes: notes })
      if (typeof data.buildTime === 'string') {
        setBuildTime(data.buildTime)
      }
      if (latest && isNewerVersion(APP_VERSION, latest)) {
        setUpdateStatus('available')
      } else {
        setUpdateStatus('current')
      }
    } catch {
      setUpdateStatus('idle')
    }
  }

  return (
    <div className="p-4 max-w-xl min-w-0 mx-auto">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Info</h2>

      <section
        className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
        aria-labelledby="app-info-heading"
      >
        <h3 id="app-info-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          App
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
          <span className="font-medium text-slate-800 dark:text-slate-200">{appLabel}</span>
        </p>
        {RELEASE_LABEL === 'Beta' && (
          <div
            className="mb-3 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-100"
            role="status"
          >
            <strong className="font-semibold">Beta-Testversion:</strong> Vom produktiven Einsatz wird abgeraten. Nur zur
            Erprobung geeignet.
          </div>
        )}
        {hasAppVersionEntryContent(licenseAppInfo) && (
          <div
            className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-700/40"
            role="region"
            aria-label="Angaben aus Lizenzportal"
          >
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Lizenzportal (Anzeige)</p>
            {licenseAppInfo?.version ? (
              <p className="text-sm text-slate-800 dark:text-slate-100">
                Version {licenseAppInfo.version}
                {licenseAppInfo.releaseLabel ? (
                  <span className="ml-1 font-medium"> {licenseAppInfo.releaseLabel}</span>
                ) : null}
              </p>
            ) : null}
            {licenseAppInfo?.releaseNotes && licenseAppInfo.releaseNotes.length > 0 ? (
              <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                {licenseAppInfo.releaseNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Hinweis: Build-Version unten; optional im Mandanten gepflegt. Automatischer Abgleich mit dem Build nur bei
              SemVer (x.y.z); sonst nur manuelle Lesbarkeit.
            </p>
          </div>
        )}
        <SemVerPortalBuildHint buildVersion={APP_VERSION} portalDisplayVersion={licenseAppInfo?.version} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-600 dark:text-slate-400">
            Version {APP_VERSION}
            {RELEASE_LABEL ? (
              <span className="ml-1 font-medium text-slate-700 dark:text-slate-200"> {RELEASE_LABEL}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => void handleCheckUpdate()}
            disabled={updateStatus === 'checking'}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            aria-label="Auf Updates prüfen"
          >
            {updateStatus === 'checking' ? 'Prüfe…' : 'Auf Updates prüfen'}
          </button>
        </div>
        {buildTime && updateInfo && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Build: {buildTime}</p>
        )}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Hinweis: „Auf Updates prüfen“ vergleicht <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 rounded">version.json</code> mit dem Build per SemVer. Abweichung zur Portal-Anzeige siehe ggf. Hinweis oben.
        </p>

        {updateStatus === 'available' && (
          <div className="mt-4 w-full p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
              Eine neue Version steht zur Verfügung (Version {updateInfo?.version ?? 'neu'})
            </p>
            {updateInfo?.releaseNotes && updateInfo.releaseNotes.length > 0 && (
              <ul className="text-sm text-amber-800 dark:text-amber-300 list-disc list-inside space-y-1 mb-3">
                {updateInfo.releaseNotes.map((note: string, i: number) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover border border-slate-700 dark:border-slate-600"
            >
              Jetzt aktualisieren
            </button>
          </div>
        )}
        {updateStatus === 'current' && updateInfo && (
          <div className="mt-4 w-full p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Version {updateInfo.version} – ✓ Aktuell
            </p>
            {updateInfo.releaseNotes.length > 0 ? (
              <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                {updateInfo.releaseNotes.map((note: string, i: number) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Keine Release Notes für diese Version.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default AppInfoContent
