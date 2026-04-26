export type MaintenanceReminderEmailSettingsBlockProps = {
  emailEnabled: boolean
  onEmailEnabledChange: (enabled: boolean) => void
  digestConsentChecked: boolean
  onDigestConsentCheckedChange: (checked: boolean) => void
  reminderEmailConsentAt: string | null | undefined
  emailFrequency: 'daily' | 'weekly'
  onEmailFrequencyChange: (frequency: 'daily' | 'weekly') => void
  error: string | null
  saving: boolean
  onSave: () => void | Promise<void>
  reminderEmailLastSentAt: string | null | undefined
}

export const MaintenanceReminderEmailSettingsBlock = ({
  emailEnabled,
  onEmailEnabledChange,
  digestConsentChecked,
  onDigestConsentCheckedChange,
  reminderEmailConsentAt,
  emailFrequency,
  onEmailFrequencyChange,
  error,
  saving,
  onSave,
  reminderEmailLastSentAt,
}: MaintenanceReminderEmailSettingsBlockProps) => (
  <div className="border-b border-slate-200 dark:border-slate-600 pb-4 mb-4">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
      E-Mail-Erinnerungen (J1)
    </h4>
    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
      Wenn aktiviert, erhalten Sie eine E-Mail mit Objekten, deren Wartung überfällig ist oder in den nächsten 30
      Tagen fällig wird – sofern Ihr Administrator die Edge Function &quot;send-maintenance-reminder-digest&quot;
      (z. B. per Cron) und Resend konfiguriert hat.
    </p>
    <label className="flex items-start gap-3 cursor-pointer mb-3">
      <input
        type="checkbox"
        checked={emailEnabled}
        onChange={(e) => onEmailEnabledChange(e.target.checked)}
        className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
      />
      <span className="text-sm text-slate-800 dark:text-slate-100">
        E-Mail-Benachrichtigung zu fälligen Wartungen
      </span>
    </label>
    {emailEnabled && !reminderEmailConsentAt ? (
      <label className="flex items-start gap-3 cursor-pointer mb-3">
        <input
          type="checkbox"
          checked={digestConsentChecked}
          onChange={(e) => onDigestConsentCheckedChange(e.target.checked)}
          className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
        />
        <span className="text-sm text-slate-700 dark:text-slate-200">
          Ich willige ein, dass mir Vico zum genannten Zweck Erinnerungs-E-Mails an meine hinterlegte Adresse
          sendet (betriebliche Verarbeitung; Widerruf durch Deaktivieren der Option).
        </span>
      </label>
    ) : null}
    {emailEnabled && reminderEmailConsentAt ? (
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Einwilligung erteilt am{' '}
        {new Date(reminderEmailConsentAt).toLocaleString('de-DE')}. Widerruf: Option
        deaktivieren und speichern.
      </p>
    ) : null}
    <div className="mb-3">
      <label htmlFor="maint-email-freq" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
        Häufigkeit (nach Versand wird bis zum nächsten Zyklus gewartet)
      </label>
      <select
        id="maint-email-freq"
        value={emailFrequency}
        onChange={(e) => onEmailFrequencyChange(e.target.value === 'daily' ? 'daily' : 'weekly')}
        className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
      >
        <option value="weekly">Höchstens einmal pro Woche</option>
        <option value="daily">Höchstens einmal pro Tag</option>
      </select>
    </div>
    {error ? (
      <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
        {error}
      </p>
    ) : null}
    <button
      type="button"
      onClick={() => void onSave()}
      disabled={saving}
      className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
    >
      {saving ? 'Speichern…' : 'E-Mail-Einstellungen speichern'}
    </button>
    {reminderEmailLastSentAt ? (
      <p className="mt-2 text-xs text-slate-500">
        Zuletzt gesendet:{' '}
        {new Date(reminderEmailLastSentAt).toLocaleString('de-DE')}
      </p>
    ) : null}
  </div>
)
