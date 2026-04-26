import { BetaBadge } from '../../../shared/BetaBadge'

export type GpsTrackingRevokeSettingsSectionProps = {
  visible: boolean
  gpsRevoking: boolean
  onRevokeGps: () => void | Promise<void>
}

export const GpsTrackingRevokeSettingsSection = ({
  visible,
  gpsRevoking,
  onRevokeGps,
}: GpsTrackingRevokeSettingsSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="ortung-heading"
    >
      <h3
        id="ortung-heading"
        className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex flex-wrap items-center gap-2"
      >
        <span>Zeiterfassung – Ortung (Stempeln)</span>
        <BetaBadge aria-hidden="true" />
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Sie haben die Standorterfassung bei Arbeitsbeginn/-ende aktiviert. Sie können die Einwilligung jederzeit
        widerrufen; danach wird kein Standort mehr erfasst. Anzeige und Erfassung sind derzeit{' '}
        <strong>Beta</strong> – nach Live-Gang erneut prüfen; lokal kann das Verhalten abweichen.
      </p>
      <button
        type="button"
        onClick={() => void onRevokeGps()}
        disabled={gpsRevoking}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50"
        aria-label="Ortung deaktivieren"
      >
        {gpsRevoking ? 'Wird deaktiviert…' : 'Ortung deaktivieren (Einwilligung widerrufen)'}
      </button>
    </section>
  )
}
