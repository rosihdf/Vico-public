import { useState, useEffect, useSyncExternalStore, type KeyboardEvent } from 'react'
import { getMandantDegradedSnapshot, subscribeMandantDegraded } from './mandantDegradedStore'

type MandantDegradedBannerProps = {
  /** Wenn true, Banner ausblenden (z. B. wenn bereits ein Offline-Streifen gezeigt wird). */
  suppress?: boolean
}

/**
 * §11.18#5 / WP-NET-05: Mandanten-Supabase (nicht Lizenz-Portal); ausblendbar bis zur nächsten erfolgreichen Antwort.
 */
const MandantDegradedBanner = ({ suppress }: MandantDegradedBannerProps) => {
  const degraded = useSyncExternalStore(subscribeMandantDegraded, getMandantDegradedSnapshot, () => false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!degraded) setDismissed(false)
  }, [degraded])

  if (suppress || !degraded || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleDismiss()
    }
  }

  return (
    <div
      role="status"
      className="bg-orange-100 dark:bg-orange-950/50 text-orange-950 dark:text-orange-100 text-center py-2 px-4 text-sm font-medium border-b border-orange-200 dark:border-orange-800 flex flex-wrap items-center justify-center gap-3"
      aria-live="polite"
    >
      <span>
        <span className="font-semibold">Mandanten-Datenbank:</span> Verbindung instabil. Letzter Stand wird angezeigt;
        ausstehende Änderungen werden bei Erreichbarkeit synchronisiert.
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        onKeyDown={handleKeyDown}
        className="shrink-0 text-sm underline underline-offset-2 hover:text-orange-900 dark:hover:text-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-600 rounded px-1"
        aria-label="Hinweis ausblenden"
      >
        Ausblenden
      </button>
    </div>
  )
}

export default MandantDegradedBanner
