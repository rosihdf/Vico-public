import { useEffect, useRef, useState } from 'react'
import { registerMandantenReleasePwaReload } from '../../shared/mandantenReleaseReloadBridge'

/**
 * Zeigt bei neuer Service-Worker-Version einen Hinweis; Aktualisierung erst nach Nutzerbestätigung
 * (vite-plugin-pwa `registerType: 'prompt'`, SW ohne sofortiges skipWaiting).
 */
const PwaUpdatePrompt = () => {
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | undefined>(undefined)
  const [needsRefresh, setNeedsRefresh] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return
        const updateSW = registerSW({
          onNeedRefresh() {
            setNeedsRefresh(true)
          },
        })
        updateSwRef.current = updateSW
        registerMandantenReleasePwaReload(async () => {
          await updateSW(true)
        })
      })
      .catch(() => {
        /* Dev ohne Build oder ohne PWA-Modul */
      })
    return () => {
      cancelled = true
      registerMandantenReleasePwaReload(null)
    }
  }, [])

  const handleReload = () => {
    setNeedsRefresh(false)
    void updateSwRef.current?.(true)
  }

  const handleDismiss = () => {
    setNeedsRefresh(false)
  }

  if (!needsRefresh) return null

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800 sm:left-auto"
    >
      <p className="text-sm text-slate-800 dark:text-slate-100">Neue App-Version verfügbar.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleReload}
          className="rounded-lg bg-vico-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          aria-label="App jetzt neu laden"
        >
          Jetzt laden
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Update später"
        >
          Später
        </button>
      </div>
    </div>
  )
}

export default PwaUpdatePrompt
