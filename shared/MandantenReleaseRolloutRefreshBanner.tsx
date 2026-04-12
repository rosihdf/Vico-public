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
 * Layout wie PwaUpdatePrompt: unten rechts, „Aktualisieren“ / „Später“.
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
    setVisible(false)
    await executeMandantenReleaseReload()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[68] mx-auto max-w-md rounded-xl border border-teal-200 bg-white p-4 shadow-lg dark:border-teal-700 dark:bg-teal-950/95 sm:left-auto sm:mr-4 sm:ml-auto"
    >
      <p className="text-sm font-medium text-teal-950 dark:text-teal-50">App-Version</p>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
        Die zugewiesene Version wurde im Lizenzportal geändert. Bitte aktualisieren, damit Anzeige und Daten passen.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 dark:bg-teal-600 dark:hover:bg-teal-500 dark:focus:ring-offset-teal-950"
          aria-label="Jetzt aktualisieren und Seite neu laden"
          onClick={() => void handleReload()}
        >
          Aktualisieren
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-teal-900/50 dark:focus:ring-offset-teal-950"
          aria-label="Später aktualisieren"
          onClick={handleDismiss}
        >
          Später
        </button>
      </div>
    </div>
  )
}

export default MandantenReleaseRolloutRefreshBanner
