const DIGEST_TIMEZONE_OPTIONS = [
  'Europe/Berlin',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/Amsterdam',
  'UTC',
] as const

export type MaintenanceDigestAdminSettingsBlockProps = {
  visible: boolean
  localTime: string
  onLocalTimeChange: (value: string) => void
  timezone: string
  onTimezoneChange: (value: string) => void
  appPublicUrl: string
  onAppPublicUrlChange: (value: string) => void
  error: string | null
  saving: boolean
  settingsLoaded: boolean
  onSave: () => void | Promise<void>
}

export const MaintenanceDigestAdminSettingsBlock = ({
  visible,
  localTime,
  onLocalTimeChange,
  timezone,
  onTimezoneChange,
  appPublicUrl,
  onAppPublicUrlChange,
  error,
  saving,
  settingsLoaded,
  onSave,
}: MaintenanceDigestAdminSettingsBlockProps) => {
  if (!visible) return null

  return (
    <div className="border-b border-slate-200 dark:border-slate-600 pb-4 mb-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        Digest-Versand (Admin)
      </h4>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Lokale Uhrzeit und Zeitzone für die Edge Function &quot;send-maintenance-reminder-digest&quot;. Die
        Funktion versendet nur in der konfigurierten Stunde – Cron mindestens stündlich ausführen (z. B. zur
        vollen Stunde). Öffentliche App-URL für den Link in der E-Mail (Fallback: Umgebungsvariable der
        Function).
      </p>
      <div className="grid gap-3 sm:grid-cols-2 mb-3">
        <div>
          <label
            htmlFor="digest-local-time"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
          >
            Lokale Uhrzeit (Stunde)
          </label>
          <input
            id="digest-local-time"
            type="time"
            value={localTime}
            onChange={(e) => onLocalTimeChange(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
          />
        </div>
        <div>
          <label htmlFor="digest-tz" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Zeitzone
          </label>
          <select
            id="digest-tz"
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
          >
            {DIGEST_TIMEZONE_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-3">
        <label htmlFor="digest-app-url" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
          Öffentliche App-URL (optional)
        </label>
        <input
          id="digest-app-url"
          type="url"
          placeholder="https://app.example.com"
          value={appPublicUrl}
          onChange={(e) => onAppPublicUrlChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saving || !settingsLoaded}
        className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 dark:bg-slate-600 text-white hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-50"
      >
        {saving ? 'Speichern…' : 'Digest-Einstellungen speichern'}
      </button>
    </div>
  )
}
