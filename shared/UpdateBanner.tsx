import { useState, useEffect, useCallback, useRef } from 'react'
import { isNewerVersion, isSemverComparable } from './versionUtils'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'

export type UpdateBannerProps = {
  /**
   * Lizenz-API (`appVersions` für diesen Kanal): oft neuer als das gebaute `version.json`,
   * bis das Hosting nachgezogen ist — sonst kein „Neue Version“ trotz Portal-Rollout.
   */
  licenseAdvertisedVersion?: string | null
  licenseAdvertisedReleaseNotes?: string[] | null
}

type VersionCandidate = { version: string; releaseNotes: string[] }

const deriveUpdateFromCandidates = (
  appVer: string,
  candidates: VersionCandidate[]
): { version: string; releaseNotes: string[] } | null => {
  const normalized: VersionCandidate[] = []
  for (const c of candidates) {
    const v = c.version.trim()
    if (!v || !isSemverComparable(v)) continue
    normalized.push({ version: v, releaseNotes: Array.isArray(c.releaseNotes) ? c.releaseNotes : [] })
  }
  const newerThanBuild = normalized.filter((c) => isNewerVersion(appVer, c.version))
  if (newerThanBuild.length === 0) return null
  let best = newerThanBuild[0]
  for (let i = 1; i < newerThanBuild.length; i++) {
    if (isNewerVersion(best.version, newerThanBuild[i].version)) {
      best = newerThanBuild[i]
    }
  }
  return { version: best.version, releaseNotes: best.releaseNotes }
}

const UpdateBanner = ({
  licenseAdvertisedVersion = null,
  licenseAdvertisedReleaseNotes = null,
}: UpdateBannerProps) => {
  const [updateInfo, setUpdateInfo] = useState<{
    version: string
    releaseNotes: string[]
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const lastJsonRef = useRef<VersionCandidate>({ version: '', releaseNotes: [] })

  const licenseVersion = licenseAdvertisedVersion?.trim() ?? ''
  const licenseNotes = Array.isArray(licenseAdvertisedReleaseNotes) ? licenseAdvertisedReleaseNotes : []

  const applyDerived = useCallback(() => {
    const fromJson = lastJsonRef.current
    const candidates: VersionCandidate[] = []
    if (fromJson.version.trim()) {
      candidates.push({ version: fromJson.version, releaseNotes: fromJson.releaseNotes })
    }
    if (licenseVersion) {
      candidates.push({ version: licenseVersion, releaseNotes: licenseNotes })
    }
    const next = deriveUpdateFromCandidates(APP_VERSION, candidates)
    setUpdateInfo(next)
  }, [licenseVersion, licenseNotes])

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
        Neue Version {updateInfo.version} verfügbar – bitte neu laden.
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
          onClick={() => setDismissed(true)}
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
