import { useEffect, useState } from 'react'
import type { MandantenReleasesApiPayload } from './mandantenReleaseApi'
import { executeMandantenReleaseReload } from './mandantenReleaseReloadBridge'

const storageKeyForChannel = (channel: MandantenReleasesApiPayload['channel']): string =>
  `vico-mr-release-assign:${channel}`

type MandantenReleaseRolloutRefreshBannerProps = {
  releases: MandantenReleasesApiPayload | null | undefined
}

/**
 * Hinweis, wenn sich die Release-Zuweisung für den Kanal im Lizenzportal geändert hat (Go-Live / Rollback).
 * Erster Besuch: aktuellen Zeitstempel still in localStorage übernehmen (kein falscher Alarm).
 */
const MandantenReleaseRolloutRefreshBanner = ({ releases }: MandantenReleaseRolloutRefreshBannerProps) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const ts = releases?.releaseAssignmentUpdatedAt
    const ch = releases?.channel
    if (!ch || ts == null || ts === '') {
      setVisible(false)
      return
    }
    const key = storageKeyForChannel(ch)
    let stored: string | null
    try {
      stored = localStorage.getItem(key)
    } catch {
      setVisible(false)
      return
    }
    if (stored === null) {
      try {
        localStorage.setItem(key, ts)
      } catch {
        /* ignore */
      }
      setVisible(false)
      return
    }
    setVisible(stored !== ts)
  }, [releases?.releaseAssignmentUpdatedAt, releases?.channel])

  const ts = releases?.releaseAssignmentUpdatedAt
  const ch = releases?.channel
  if (!visible || !ts?.trim() || !ch) return null

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKeyForChannel(ch), ts)
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  const handleReload = async () => {
    try {
      localStorage.setItem(storageKeyForChannel(ch), ts)
    } catch {
      /* ignore */
    }
    await executeMandantenReleaseReload()
  }

  return (
    <div
      role="status"
      className="bg-teal-100 dark:bg-teal-950/50 text-teal-950 dark:text-teal-100 text-center py-2 px-4 text-sm border-b border-teal-200 dark:border-teal-800"
      aria-live="polite"
    >
      <span className="font-semibold">App-Version:</span>{' '}
      <span>
        Die zugewiesene Version wurde im Lizenzportal geändert. Seite neu laden, damit Anzeige und Daten zur Zuweisung
        passen.
      </span>
      <span className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="rounded-md bg-teal-800 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 dark:bg-teal-600 dark:hover:bg-teal-500 dark:focus:ring-offset-teal-950"
          aria-label="Seite neu laden nach geänderter App-Version"
          onClick={() => void handleReload()}
        >
          Neu laden
        </button>
        <button
          type="button"
          className="rounded-md border border-teal-700/40 bg-white/80 px-3 py-1 text-xs font-semibold text-teal-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 dark:border-teal-400/30 dark:bg-teal-900/40 dark:text-teal-50 dark:hover:bg-teal-900/70 dark:focus:ring-offset-teal-950"
          aria-label="Hinweis zur App-Version schließen ohne neu zu laden"
          onClick={handleDismiss}
        >
          Verstanden
        </button>
      </span>
    </div>
  )
}

export default MandantenReleaseRolloutRefreshBanner
