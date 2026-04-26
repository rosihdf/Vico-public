import { BetaBadge } from '../../../shared/BetaBadge'

export type StandortabfrageConsentSettingsSectionProps = {
  visible: boolean
  hasConsent: boolean
  isOffline: boolean
  pushSupported: boolean
  pushEnabled: boolean | null
  pushSaving: boolean
  standortConsentSaving: boolean
  onPushToggle: (enabled: boolean) => void | Promise<void>
  onGrantConsent: () => void | Promise<void>
  onRevokeConsent: () => void | Promise<void>
}

export const StandortabfrageConsentSettingsSection = ({
  visible,
  hasConsent,
  isOffline,
  pushSupported,
  pushEnabled,
  pushSaving,
  standortConsentSaving,
  onPushToggle,
  onGrantConsent,
  onRevokeConsent,
}: StandortabfrageConsentSettingsSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="standortabfrage-consent-heading"
    >
      <h3
        id="standortabfrage-consent-heading"
        className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex flex-wrap items-center gap-2"
      >
        <span>Standortabfrage – Ihre Einwilligung</span>
        <BetaBadge aria-hidden="true" />
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Wenn Sie einwilligen, können Sie Ihren aktuellen Standort an Admin bzw. Teamleiter senden. Diese können Ihren
        Standort im Arbeitszeitenportal abrufen, wenn Sie ihn gesendet haben. Die Einwilligung ist freiwillig und
        jederzeit widerrufbar. <strong>Beta</strong> – vor produktivem Einsatz siehe interne Checkliste (Doku §3a).
      </p>
      {hasConsent ? (
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Sie haben eingewilligt. Sie können Ihren Standort in der Zeiterfassung senden.
          </p>
          {pushSupported && (
            <label className={`flex items-center gap-3 mb-3 ${isOffline ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={pushEnabled ?? false}
                disabled={pushSaving || isOffline}
                onChange={(e) => !isOffline && void onPushToggle(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
                aria-label="Benachrichtigungen bei Standortanfrage"
                title={isOffline ? 'Offline – Push-Einstellung erst bei Verbindung möglich' : undefined}
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                Benachrichtigungen bei Standortanfrage (Push)
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={() => void onRevokeConsent()}
            disabled={standortConsentSaving || isOffline}
            title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50"
            aria-label="Einwilligung widerrufen"
          >
            {standortConsentSaving ? 'Wird gespeichert…' : 'Einwilligung widerrufen'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void onGrantConsent()}
          disabled={standortConsentSaving || isOffline}
          title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
          aria-label="Einwilligung erteilen"
        >
          {standortConsentSaving ? 'Wird gespeichert…' : 'Einwilligung erteilen'}
        </button>
      )}
    </section>
  )
}
