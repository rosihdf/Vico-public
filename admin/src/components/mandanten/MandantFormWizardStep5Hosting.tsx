import type { InfrastructurePingResponse } from '../../lib/licensePortalService'
import { MandantInfrastructurePingResultRegion } from './MandantInfrastructurePingResultRegion'

export type MandantFormWizardStep5HostingProps = {
  supabaseProjectRef: string
  supabaseUrl: string
  infrastructurePingAnonKey: string
  cfPreviewMainUrl: string
  cfPreviewPortalUrl: string
  cfPreviewArbeitszeitUrl: string
  onSupabaseProjectRefChange: (value: string) => void
  onSupabaseUrlChange: (value: string) => void
  onInfrastructurePingAnonKeyChange: (value: string) => void
  onCfPreviewMainUrlChange: (value: string) => void
  onCfPreviewPortalUrlChange: (value: string) => void
  onCfPreviewArbeitszeitUrlChange: (value: string) => void
  onInfrastructurePingClick: () => void
  infrastructurePingLoading: boolean
  infrastructurePingResult: InfrastructurePingResponse | null
}

export function MandantFormWizardStep5Hosting({
  supabaseProjectRef,
  supabaseUrl,
  infrastructurePingAnonKey,
  cfPreviewMainUrl,
  cfPreviewPortalUrl,
  cfPreviewArbeitszeitUrl,
  onSupabaseProjectRefChange,
  onSupabaseUrlChange,
  onInfrastructurePingAnonKeyChange,
  onCfPreviewMainUrlChange,
  onCfPreviewPortalUrlChange,
  onCfPreviewArbeitszeitUrlChange,
  onInfrastructurePingClick,
  infrastructurePingLoading,
  infrastructurePingResult,
}: MandantFormWizardStep5HostingProps) {
  return (
    <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Schritt 5: Hosting (Supabase und Cloudflare)</h3>
      <p className="text-xs text-slate-600" id="wizard-step5-hint">
        Optional: Mandanten-<strong>Supabase</strong>-Projekt und <strong>CF-Pages-Preview-URLs</strong>. Der{' '}
        <strong>Anon-Key</strong> dient nur der Live-Prüfung und wird nicht gespeichert. Supabase-URL leer lassen,
        wenn das Projekt noch nicht existiert.
      </p>
      <input
        id="wizard-supabase-ref"
        type="text"
        value={supabaseProjectRef}
        onChange={(e) => onSupabaseProjectRefChange(e.target.value)}
        placeholder="Supabase-Projekt-Ref (Dashboard-URL)"
        autoComplete="off"
        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
        aria-describedby="wizard-step5-hint"
      />
      <input
        id="wizard-supabase-url"
        type="url"
        inputMode="url"
        value={supabaseUrl}
        onChange={(e) => onSupabaseUrlChange(e.target.value)}
        placeholder="https://xxxxxxxx.supabase.co"
        autoComplete="off"
        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
      />
      <div>
        <label htmlFor="wizard-infra-anon" className="block text-xs font-medium text-slate-600 mb-1">
          Anon-Key (nur Prüfung, optional)
        </label>
        <input
          id="wizard-infra-anon"
          type="password"
          value={infrastructurePingAnonKey}
          onChange={(e) => onInfrastructurePingAnonKeyChange(e.target.value)}
          placeholder="eyJ… (wird nicht gespeichert)"
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
        />
      </div>
      <input
        type="url"
        inputMode="url"
        value={cfPreviewMainUrl}
        onChange={(e) => onCfPreviewMainUrlChange(e.target.value)}
        placeholder="CF Preview Haupt-App (https://…)"
        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
      />
      <input
        type="url"
        inputMode="url"
        value={cfPreviewPortalUrl}
        onChange={(e) => onCfPreviewPortalUrlChange(e.target.value)}
        placeholder="CF Preview Kundenportal (https://…)"
        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
      />
      <input
        type="url"
        inputMode="url"
        value={cfPreviewArbeitszeitUrl}
        onChange={(e) => onCfPreviewArbeitszeitUrlChange(e.target.value)}
        placeholder="CF Preview Arbeitszeitportal (https://…)"
        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
      />
      <button
        type="button"
        onClick={onInfrastructurePingClick}
        disabled={infrastructurePingLoading}
        className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-cyan-400 bg-white text-cyan-900 font-medium hover:bg-cyan-50 disabled:opacity-50 min-h-[44px] sm:min-h-0"
        aria-busy={infrastructurePingLoading}
      >
        {infrastructurePingLoading ? 'Prüfe…' : 'Verbindungen prüfen'}
      </button>
      <MandantInfrastructurePingResultRegion
        layout="wizard"
        loading={infrastructurePingLoading}
        result={infrastructurePingResult}
        idPrefix="wizard-infra"
      />
    </div>
  )
}
