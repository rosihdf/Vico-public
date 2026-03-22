import { supabase } from '../lib/supabase'

/**
 * Wird angezeigt, wenn die Mandantenlizenz das Modul „Kundenportal“ nicht enthält.
 */
const KundenportalLicenseBlocked = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-6 text-center">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">Kundenportal nicht lizenziert</h1>
        <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
          Für Ihre Lizenz ist das Modul „Kundenportal“ nicht freigeschaltet. Bitte wenden Sie sich an Ihren Ansprechpartner oder
          erweitern Sie die Lizenz im Lizenzportal.
        </p>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="px-4 py-2 rounded-lg bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-sm font-medium hover:bg-amber-300 dark:hover:bg-amber-800 transition-colors"
        >
          Abmelden
        </button>
      </div>
    </div>
  )
}

export default KundenportalLicenseBlocked
