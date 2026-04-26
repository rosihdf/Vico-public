import {
  COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL,
  type ComponentSetting,
} from '../../lib/componentSettingsService'

export type ComponentTogglesSettingsSectionProps = {
  visible: boolean
  settingsList: ComponentSetting[]
  updatingKey: string | null
  setUpdatingKey: (key: string | null) => void
  componentError: string | null
  setComponentError: (message: string | null) => void
  updateSetting: (key: string, enabled: boolean) => Promise<{ ok: boolean; error?: string }>
  refresh: () => Promise<void>
}

export const ComponentTogglesSettingsSection = ({
  visible,
  settingsList,
  updatingKey,
  setUpdatingKey,
  componentError,
  setComponentError,
  updateSetting,
  refresh,
}: ComponentTogglesSettingsSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="komponenten-heading"
    >
      <h3 id="komponenten-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
        Komponenten
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Aktivieren oder deaktivieren Sie einzelne Bereiche der App.
      </p>
      {componentError && (
        <p className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">
          {componentError}
        </p>
      )}
      <div className="space-y-2">
        {settingsList
          .filter((item) => item.component_key !== COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL)
          .map((item) => (
            <label
              key={item.id}
              className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-600 last:border-0 cursor-pointer"
            >
              <span className="text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
              <input
                type="checkbox"
                checked={item.enabled}
                disabled={updatingKey === item.component_key}
                onChange={async (e) => {
                  setComponentError(null)
                  const checked = e.target.checked
                  setUpdatingKey(item.component_key)
                  const result = await updateSetting(item.component_key, checked)
                  setUpdatingKey(null)
                  if (!result.ok) {
                    setComponentError(result.error ?? 'Speichern fehlgeschlagen')
                  }
                }}
                className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
                aria-label={`${item.label} ${item.enabled ? 'deaktivieren' : 'aktivieren'}`}
              />
            </label>
          ))}
      </div>
      <button
        type="button"
        onClick={() => {
          setComponentError(null)
          void refresh()
        }}
        className="mt-3 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        aria-label="Einstellungen neu laden"
      >
        Neu laden
      </button>
    </section>
  )
}
