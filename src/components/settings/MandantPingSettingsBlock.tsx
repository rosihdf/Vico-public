import type { ChangeEvent } from 'react'
import { MANDANT_PING_INTERVAL_MS } from '../../../shared/mandantReachabilityPing'

export type MandantPingSettingsBlockProps = {
  visible: boolean
  enabled: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

export const MandantPingSettingsBlock = ({ visible, enabled, onChange }: MandantPingSettingsBlockProps) => {
  if (!visible) return null

  return (
    <div className="border-b border-slate-200 dark:border-slate-600 pb-4 mb-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        Netzwerk (Diagnose)
      </h4>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Optional: regelmäßiger Erreichbarkeits-Check zum Mandanten-Supabase (HEAD auf die REST-Schnittstelle).
        Standard ist aus. Bei Aktivierung etwa alle {MANDANT_PING_INTERVAL_MS / 60_000} Minuten; nur
        in diesem Browser gespeichert. Wirkt auf den Hinweis bei instabiler Verbindung (eingeschränkter Modus).
      </p>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onChange}
          className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
          aria-label="Erreichbarkeits-Ping zum Mandanten-Server aktivieren"
        />
        <span className="text-sm text-slate-800 dark:text-slate-100">
          Erreichbarkeits-Ping zum Server aktivieren
        </span>
      </label>
    </div>
  )
}
