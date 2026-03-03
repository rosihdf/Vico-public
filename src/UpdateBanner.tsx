import { useState, useEffect } from 'react'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'

type VersionInfo = {
  version?: string
  releaseNotes?: string[]
}

export const UpdateBanner = () => {
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes: string[] } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
        const res = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as VersionInfo
        const latest = data.version ?? ''
        if (latest && latest !== APP_VERSION) {
          const notes = Array.isArray(data.releaseNotes) ? data.releaseNotes : []
          setUpdateInfo({ version: latest, releaseNotes: notes })
        }
      } catch {
        // ignore
      }
    }
    const t = setTimeout(check, 2000)
    return () => clearTimeout(t)
  }, [])

  if (!updateInfo || dismissed) return null

  return (
    <div
      className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2"
      role="alert"
      aria-live="polite"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">
          Neue Version {updateInfo.version} verfügbar
        </p>
        {updateInfo.releaseNotes.length > 0 && (
          <details className="mt-1">
            <summary className="text-xs text-amber-800 cursor-pointer hover:underline">
              Release Notes anzeigen
            </summary>
            <ul className="mt-1 text-xs text-amber-800 list-disc list-inside space-y-0.5">
              {updateInfo.releaseNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-700"
          aria-label="Jetzt aktualisieren"
        >
          Jetzt aktualisieren
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-2 py-1 rounded text-amber-700 hover:bg-amber-100 text-xs"
          aria-label="Später"
        >
          Später
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner
