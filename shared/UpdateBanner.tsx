import { useState, useEffect, useCallback, useRef } from 'react'
import { isNewerVersion, isSemverComparable } from './versionUtils'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'

/** User hat für diese in `version.json` gemeldete Version geschlossen (überdauert Reload; typisch: alter JS-Cache vs. neue version.json). */
const DISMISS_STORAGE_KEY = 'vico.updateBanner.dismissedForServerVersion'

const readDismissedServerVersion = (): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null
    const s = localStorage.getItem(DISMISS_STORAGE_KEY)?.trim()
    return s || null
  } catch {
    return null
  }
}

const persistDismissedServerVersion = (serverVersion: string): void => {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, serverVersion.trim())
  } catch {
    /* ignore */
  }
}

/**
 * Nur Hosting-Realität: `version.json` (vom gleichen Origin wie die App) vs. Build.
 * Kein Abgleich mit Lizenz-API – sonst „Neu laden“ ohne neues Bundle (Portal vor CDN).
 * Rollout / Zuweisung: `MandantenReleaseRolloutRefreshBanner`, Incoming: `MandantenIncomingReleaseBanner`.
 */
const UpdateBanner = () => {
  const [updateInfo, setUpdateInfo] = useState<{
    version: string
    releaseNotes: string[]
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const lastJsonRef = useRef<{ version: string; releaseNotes: string[] }>({ version: '', releaseNotes: [] })

  const applyDerived = useCallback(() => {
    const v = lastJsonRef.current.version.trim()
    if (!v || !isSemverComparable(v)) {
      setUpdateInfo(null)
      return
    }
    if (!isNewerVersion(APP_VERSION, v)) {
      setUpdateInfo(null)
      return
    }
    if (readDismissedServerVersion() === v) {
      setUpdateInfo(null)
      return
    }
    setUpdateInfo({
      version: v,
      releaseNotes: Array.isArray(lastJsonRef.current.releaseNotes) ? lastJsonRef.current.releaseNotes : [],
    })
  }, [])

  const checkForUpdate = useCallback(async () => {
    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const res = await fetch(`${base}/version.json?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as { version?: string; releaseNotes?: string[] }
        lastJsonRef.current = {
          version: data.version ?? '',
          releaseNotes: Array.isArray(data.releaseNotes) ? data.releaseNotes : [],
        }
      }
      applyDerived()
    } catch {
      applyDerived()
    }
  }, [applyDerived])

  useEffect(() => {
    applyDerived()
  }, [applyDerived])

  useEffect(() => {
    const run = () => {
      void checkForUpdate()
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const onOnline = () => {
        window.removeEventListener('online', onOnline)
        run()
      }
      window.addEventListener('online', onOnline)
      return () => window.removeEventListener('online', onOnline)
    }
    const t = window.setTimeout(run, 3000)
    return () => window.clearTimeout(t)
  }, [checkForUpdate])

  if (!updateInfo || dismissed) return null

  return (
    <div
      className="bg-amber-500 dark:bg-amber-700 text-amber-950 dark:text-white px-4 py-2 flex items-center justify-between gap-4 text-sm"
      role="banner"
      aria-live="polite"
    >
      <span className="font-medium">
        Neues App-Build (Version {updateInfo.version}) liegt auf dem Server – bitte neu laden.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded font-medium bg-amber-900 text-white hover:bg-amber-800 dark:bg-white dark:text-amber-900 dark:hover:bg-amber-100"
          aria-label="Jetzt aktualisieren"
        >
          Aktualisieren
        </button>
        <button
          type="button"
          onClick={() => {
            persistDismissedServerVersion(updateInfo.version)
            setDismissed(true)
          }}
          className="px-2 py-1 rounded text-amber-950 dark:text-white hover:bg-amber-400/50 dark:hover:bg-amber-600/50"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner
