import type { InfrastructurePingResponse } from '../../lib/licensePortalService'
import { MandantInfrastructurePingResultRegion } from './MandantInfrastructurePingResultRegion'

export type MandantFormEditHostingSectionProps = {
  supabaseProjectRef: string
  supabaseUrl: string
  cfPreviewMainUrl: string
  cfPreviewPortalUrl: string
  cfPreviewArbeitszeitUrl: string
  infrastructurePingAnonKey: string
  onSupabaseProjectRefChange: (value: string) => void
  onSupabaseUrlChange: (value: string) => void
  onCfPreviewMainUrlChange: (value: string) => void
  onCfPreviewPortalUrlChange: (value: string) => void
  onCfPreviewArbeitszeitUrlChange: (value: string) => void
  onInfrastructurePingAnonKeyChange: (value: string) => void
  onInfrastructurePingClick: () => void
  infrastructurePingLoading: boolean
  infrastructurePingResult: InfrastructurePingResponse | null
}

export function MandantFormEditHostingSection({
  supabaseProjectRef,
  supabaseUrl,
  cfPreviewMainUrl,
  cfPreviewPortalUrl,
  cfPreviewArbeitszeitUrl,
  infrastructurePingAnonKey,
  onSupabaseProjectRefChange,
  onSupabaseUrlChange,
  onCfPreviewMainUrlChange,
  onCfPreviewPortalUrlChange,
  onCfPreviewArbeitszeitUrlChange,
  onInfrastructurePingAnonKeyChange,
  onInfrastructurePingClick,
  infrastructurePingLoading,
  infrastructurePingResult,
}: MandantFormEditHostingSectionProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Mandanten-Supabase (Haupt-App-Datenbank)</h3>
      <p className="text-xs text-slate-600">
        Metadaten zum <strong>neuen</strong> Supabase-Projekt des Mandanten (nicht das Lizenzportal). Werden in{' '}
        <code className="bg-white px-1 rounded border text-[11px]">tenants</code> gespeichert und für den Bereich{' '}
        <strong>Deployment / Hosting</strong> genutzt (vorgefüllte <code className="bg-white px-1 rounded border text-[11px]">VITE_SUPABASE_URL</code>
        ). Keine Secrets – nur Referenz und URL.
      </p>
      <div>
        <label htmlFor="supabase_project_ref" className="block text-sm font-medium text-slate-700 mb-1">
          Supabase-Projekt-Ref
        </label>
        <input
          id="supabase_project_ref"
          type="text"
          value={supabaseProjectRef}
          onChange={(e) => onSupabaseProjectRefChange(e.target.value)}
          placeholder="Kurzref (wie in der Dashboard-URL)"
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
          aria-describedby="supabase_project_ref_hint"
        />
        <p id="supabase_project_ref_hint" className="mt-1 text-xs text-slate-500">
          Aus der Adresszeile: <code className="bg-white px-1 rounded border">supabase.com/dashboard/project/&lt;ref&gt;</code>
        </p>
      </div>
      <div>
        <label htmlFor="supabase_url" className="block text-sm font-medium text-slate-700 mb-1">
          Supabase-URL (Mandant)
        </label>
        <input
          id="supabase_url"
          type="url"
          inputMode="url"
          value={supabaseUrl}
          onChange={(e) => onSupabaseUrlChange(e.target.value)}
          placeholder="https://xxxxxxxx.supabase.co"
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
          aria-describedby="supabase_url_hint"
        />
        <p id="supabase_url_hint" className="mt-1 text-xs text-slate-500">
          Settings → API → Project URL (ohne Slash am Ende).
        </p>
      </div>
      <div className="pt-3 mt-3 border-t border-slate-200 space-y-3">
        <p className="text-xs font-semibold text-slate-700">Cloudflare Pages (Preview-URLs)</p>
        <p className="text-xs text-slate-600" id="cf_preview_hint">
          Optional: öffentliche Preview-Links aus Workers und Pages. Werden in{' '}
          <code className="bg-white px-1 rounded border text-[11px]">tenants</code> gespeichert (keine Secrets).
        </p>
        <div>
          <label htmlFor="cf_preview_main_url" className="block text-sm font-medium text-slate-700 mb-1">
            Preview Haupt-App
          </label>
          <input
            id="cf_preview_main_url"
            type="url"
            inputMode="url"
            value={cfPreviewMainUrl}
            onChange={(e) => onCfPreviewMainUrlChange(e.target.value)}
            placeholder="https://….pages.dev"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
            aria-describedby="cf_preview_hint"
          />
        </div>
        <div>
          <label htmlFor="cf_preview_portal_url" className="block text-sm font-medium text-slate-700 mb-1">
            Preview Kundenportal
          </label>
          <input
            id="cf_preview_portal_url"
            type="url"
            inputMode="url"
            value={cfPreviewPortalUrl}
            onChange={(e) => onCfPreviewPortalUrlChange(e.target.value)}
            placeholder="https://….pages.dev"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor="cf_preview_arbeitszeit_url" className="block text-sm font-medium text-slate-700 mb-1">
            Preview Arbeitszeitportal
          </label>
          <input
            id="cf_preview_arbeitszeit_url"
            type="url"
            inputMode="url"
            value={cfPreviewArbeitszeitUrl}
            onChange={(e) => onCfPreviewArbeitszeitUrlChange(e.target.value)}
            placeholder="https://….pages.dev"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor="edit-infra-anon" className="block text-sm font-medium text-slate-700 mb-1">
            Anon-Key Mandanten-Supabase (nur Verbindungsprüfung)
          </label>
          <input
            id="edit-infra-anon"
            type="password"
            value={infrastructurePingAnonKey}
            onChange={(e) => onInfrastructurePingAnonKeyChange(e.target.value)}
            placeholder="Wird nicht gespeichert"
            autoComplete="off"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
          />
        </div>
        <button
          type="button"
          onClick={onInfrastructurePingClick}
          disabled={infrastructurePingLoading}
          className="px-4 py-2.5 rounded-lg border border-slate-400 bg-white text-slate-800 font-medium hover:bg-slate-50 disabled:opacity-50 min-h-[44px] sm:min-h-0"
          aria-busy={infrastructurePingLoading}
        >
          {infrastructurePingLoading ? 'Prüfe…' : 'Verbindungen prüfen (Supabase und Previews)'}
        </button>
        <MandantInfrastructurePingResultRegion
          layout="edit"
          loading={infrastructurePingLoading}
          result={infrastructurePingResult}
          idPrefix="edit-infra"
        />
      </div>
    </div>
  )
}
