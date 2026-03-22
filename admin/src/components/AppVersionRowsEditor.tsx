import {
  APP_VERSION_KEYS,
  APP_VERSION_LABELS,
  type AppVersionKey,
} from '../../../shared/appVersions'
import type { AppVersionRowsState } from '../lib/appVersionFormUtils'

export type AppVersionRowsEditorProps = {
  rows: AppVersionRowsState
  setRows: React.Dispatch<React.SetStateAction<AppVersionRowsState>>
  /** Eindeutiges Präfix für HTML-ids (z. B. mandant, global). */
  idPrefix: string
}

const AppVersionRowsEditor = ({ rows, setRows, idPrefix }: AppVersionRowsEditorProps) => {
  const handleField = (key: AppVersionKey, field: keyof AppVersionRowsState[AppVersionKey], value: string) => {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  return (
    <div className="space-y-4">
      {APP_VERSION_KEYS.map((key) => (
        <div key={key} className="p-3 rounded-lg border border-slate-200 bg-slate-50/80">
          <p className="text-sm font-medium text-slate-800 mb-2">{APP_VERSION_LABELS[key]}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-medium text-slate-600 mb-1"
                htmlFor={`${idPrefix}-av-${key}-version`}
              >
                Version (Anzeige)
              </label>
              <input
                id={`${idPrefix}-av-${key}-version`}
                type="text"
                value={rows[key].version}
                onChange={(e) => handleField(key, 'version', e.target.value)}
                placeholder="z. B. 1.4.0"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-vico-primary"
                autoComplete="off"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium text-slate-600 mb-1"
                htmlFor={`${idPrefix}-av-${key}-label`}
              >
                Label (optional)
              </label>
              <input
                id={`${idPrefix}-av-${key}-label`}
                type="text"
                value={rows[key].releaseLabel}
                onChange={(e) => handleField(key, 'releaseLabel', e.target.value)}
                placeholder="z. B. Beta"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-vico-primary"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="mt-2">
            <label
              className="block text-xs font-medium text-slate-600 mb-1"
              htmlFor={`${idPrefix}-av-${key}-notes`}
            >
              Release Notes (eine Zeile pro Punkt)
            </label>
            <textarea
              id={`${idPrefix}-av-${key}-notes`}
              value={rows[key].releaseNotesText}
              onChange={(e) => handleField(key, 'releaseNotesText', e.target.value)}
              rows={3}
              placeholder="Fix: …"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-vico-primary"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default AppVersionRowsEditor
