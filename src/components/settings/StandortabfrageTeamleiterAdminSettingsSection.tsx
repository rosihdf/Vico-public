import { BetaBadge } from '../../../shared/BetaBadge'

export type StandortabfrageTeamleiterAdminSettingsSectionProps = {
  visible: boolean
  isOffline: boolean
  teamleiterLoading: boolean
  teamleiterAllowed: boolean
  teamleiterSaving: boolean
  onTeamleiterAllowedChange: (checked: boolean) => void | Promise<void>
}

export const StandortabfrageTeamleiterAdminSettingsSection = ({
  visible,
  isOffline,
  teamleiterLoading,
  teamleiterAllowed,
  teamleiterSaving,
  onTeamleiterAllowedChange,
}: StandortabfrageTeamleiterAdminSettingsSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="standortabfrage-heading"
    >
      <h3
        id="standortabfrage-heading"
        className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex flex-wrap items-center gap-2"
      >
        <span>Standortabfrage (Admin)</span>
        <BetaBadge aria-hidden="true" />
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Mitarbeiter können ihren aktuellen Standort an Admin/Teamleiter senden. Hier legen Sie fest, ob auch Teamleiter
        die Standorte ihrer Teammitglieder abfragen dürfen oder nur Sie als Admin. Lizenz-Feature{' '}
        <strong>standortabfrage</strong> nur bewusst aktivieren; siehe Doku §3a (Beta / rechtliche Prüfung).
      </p>
      {teamleiterLoading ? (
        <p className="text-sm text-slate-500">Lade Einstellung…</p>
      ) : (
        <label className={`flex items-center gap-3 ${isOffline ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={teamleiterAllowed}
            disabled={teamleiterSaving || isOffline}
            onChange={(e) => void onTeamleiterAllowedChange(e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
            aria-label="Teamleiter dürfen Standort abfragen"
            title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Teamleiter dürfen Standort abfragen
          </span>
        </label>
      )}
    </section>
  )
}
