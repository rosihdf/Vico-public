import { ETIKETT_PRESET_OPTIONS, type EtikettPresetId } from '../../lib/etikettPreset'
import { isEtikettendruckerAvailable } from '../../lib/etikettendrucker'

export type EtikettPresetSettingsBlockProps = {
  value: EtikettPresetId
  onChange: (id: EtikettPresetId) => void
}

export const EtikettPresetSettingsBlock = ({ value, onChange }: EtikettPresetSettingsBlockProps) => (
  <div>
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
      QR-Etikett (I2)
    </h4>
    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
      Referenzmaße für den späteren Bluetooth-Druck in der nativen App. Wird lokal auf diesem Gerät gespeichert.
    </p>
    <div className="space-y-2 mb-2">
      {ETIKETT_PRESET_OPTIONS.map((opt) => (
        <label
          key={opt.id}
          className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
        >
          <input
            type="radio"
            name="etikett-preset"
            value={opt.id}
            checked={value === opt.id}
            onChange={() => onChange(opt.id)}
            className="mt-1"
          />
          <span>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
            {opt.description ? (
              <span className="block text-xs text-slate-500 dark:text-slate-400">{opt.description}</span>
            ) : null}
            <span className="block text-xs text-slate-400 font-mono mt-0.5">
              {opt.widthMm}×{opt.heightMm} mm
            </span>
          </span>
        </label>
      ))}
    </div>
    <p className="text-xs text-slate-500">
      Native Druck-Plugin:{' '}
      {isEtikettendruckerAvailable() ? (
        <span className="text-emerald-600 dark:text-emerald-400">verfügbar</span>
      ) : (
        <span>Nicht aktiv (Web/PWA – Druck nur in der Capacitor-App mit Plugin).</span>
      )}
    </p>
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
      <a
        href="/BENUTZERANLEITUNG.md"
        target="_blank"
        rel="noopener noreferrer"
        className="text-vico-primary hover:underline font-medium"
      >
        Anleitung: QR-Code und A4-Etiketten (Abschnitt in der Benutzeranleitung)
      </a>
    </p>
  </div>
)
