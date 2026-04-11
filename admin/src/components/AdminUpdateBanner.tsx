import { useEffect, useState } from 'react'
import UpdateBanner from '../../../shared/UpdateBanner'
import { parseAppVersionsFromDb } from '../../../shared/appVersions'
import { fetchDefaultAppVersionsJson } from '../lib/portalConfigService'

type AdminUpdateBannerProps = {
  /** Nur mit angemeldetem Admin: `platform_config` ist per RLS geschützt. */
  enabled: boolean
}

/**
 * Zeigt denselben SemVer-Hinweis wie in den Mandanten-Apps: Vergleich Build vs. `version.json`
 * plus in `platform_config.default_app_versions` gepflegte **admin**-Version (Lizenz-API-Defaults).
 */
const AdminUpdateBanner = ({ enabled }: AdminUpdateBannerProps) => {
  const [licenseAdvertisedVersion, setLicenseAdvertisedVersion] = useState<string | null>(null)
  const [licenseAdvertisedReleaseNotes, setLicenseAdvertisedReleaseNotes] = useState<string[] | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLicenseAdvertisedVersion(null)
      setLicenseAdvertisedReleaseNotes(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const raw = await fetchDefaultAppVersionsJson()
        const map = parseAppVersionsFromDb(raw)
        const adminEntry = map?.admin
        if (cancelled) return
        setLicenseAdvertisedVersion(adminEntry?.version?.trim() ? adminEntry.version.trim() : null)
        setLicenseAdvertisedReleaseNotes(
          Array.isArray(adminEntry?.releaseNotes) ? adminEntry.releaseNotes : null
        )
      } catch {
        if (!cancelled) {
          setLicenseAdvertisedVersion(null)
          setLicenseAdvertisedReleaseNotes(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return (
    <UpdateBanner
      licenseAdvertisedVersion={licenseAdvertisedVersion}
      licenseAdvertisedReleaseNotes={licenseAdvertisedReleaseNotes}
    />
  )
}

export default AdminUpdateBanner
