import { useState, useEffect, type KeyboardEvent } from 'react'

type LicensePortalStaleBannerProps = {
  /** Lizenz-API zuletzt fehlgeschlagen, Anzeige aus Cache (§11.18#6). */
  visible: boolean
  /** z. B. generelles Offline – kein zusätzlicher Hinweis (Mandanten-Banner reicht). */
  suppress?: boolean
}

/**
 * §11.18#6: getrennt vom Mandanten-Degraded-Banner – nur Lizenz-/Design-Stand aus Cache.
 */
const LicensePortalStaleBanner = ({ visible, suppress }: LicensePortalStaleBannerProps) => {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!visible) setDismissed(false)
  }, [visible])

  if (suppress || !visible || dismissed) return null

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
      className="bg-slate-200/95 dark:bg-slate-800/95 text-slate-900 dark:text-slate-100 text-center py-2 px-4 text-sm font-medium border-b border-slate-300 dark:border-slate-600 flex flex-wrap items-center justify-center gap-3"
      aria-live="polite"
    >
      <span>
        Lizenz-Portal vorübergehend nicht erreichbar. Design und Limits können veraltet sein – unabhängig von der
        Mandanten-Datenbank.
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        onKeyDown={handleKeyDown}
        className="shrink-0 text-sm underline underline-offset-2 hover:text-vico-primary dark:hover:text-sky-400 focus:outline-none focus:ring-2 focus:ring-vico-primary rounded px-1"
        aria-label="Hinweis ausblenden"
      >
        Ausblenden
      </button>
    </div>
  )
}

export default LicensePortalStaleBanner
