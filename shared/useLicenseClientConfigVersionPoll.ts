import { useEffect, useRef } from 'react'

/** Gleicher Takt wie Haupt-App `LicenseContext` – Admin-Push ohne vollen Reload */
const LICENSE_CLIENT_CONFIG_POLL_MS = 90_000

export type LicenseClientConfigPollArgs = {
  enabled: boolean
  fetchVersion: () => Promise<number | null>
  onVersionChanged: () => void | Promise<void>
}

/**
 * Vergleicht `license.client_config_version` mit dem letzten Stand und ruft `onVersionChanged`,
 * wenn das Lizenzportal die Version erhöht hat (Button „Jetzt signalisieren“).
 */
export const useLicenseClientConfigVersionPoll = ({
  enabled,
  fetchVersion,
  onVersionChanged,
}: LicenseClientConfigPollArgs): void => {
  const lastRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const tick = async () => {
      const next = await fetchVersion()
      if (cancelled || next === null) return
      const prev = lastRef.current
      if (prev !== null && next !== prev) {
        await onVersionChanged()
      }
      lastRef.current = next
    }

    const bootstrap = async () => {
      const v = await fetchVersion()
      if (!cancelled && v !== null) lastRef.current = v
    }

    void bootstrap()

    const id = window.setInterval(() => void tick(), LICENSE_CLIENT_CONFIG_POLL_MS)
    const kickoff = window.setTimeout(() => void tick(), 5_000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(id)
      window.clearTimeout(kickoff)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, fetchVersion, onVersionChanged])
}
