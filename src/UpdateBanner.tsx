import { useState, useEffect, useCallback } from 'react'
import { isNewerVersion } from './lib/versionUtils'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'

const UpdateBanner = () => {
  const [updateInfo, setUpdateInfo] = useState<{
    version: string
    releaseNotes: string[]
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const checkForUpdate = useCallback(async () => {
    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const res = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { version?: string; releaseNotes?: string[] }
      const latest = data.version ?? ''
      const notes = Array.isArray(data.releaseNotes) ? data.releaseNotes : []
      if (latest && isNewerVersion(APP_VERSION, latest)) {
        setUpdateInfo({ version: latest, releaseNotes: notes })
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!navigator.onLine) return
    const t = setTimeout(checkForUpdate, 3000)
    return () => clearTimeout(t)
  }, [checkForUpdate])

  if (!updateInfo || dismissed) return null

  return (
    <div
      className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-4 text-sm"
      role="banner"
      aria-live="polite"
    >
      <span className="font-medium">
        Neue Version {updateInfo.version} verfügbar – bitte neu laden.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded font-medium bg-amber-900 text-white hover:bg-amber-800"
          aria-label="Jetzt aktualisieren"
        >
          Aktualisieren
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-2 py-1 rounded hover:bg-amber-400/50"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner
