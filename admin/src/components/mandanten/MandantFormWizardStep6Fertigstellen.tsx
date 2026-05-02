import type { LicenseModel } from '../../lib/licensePortalService'
import { normalizeTenantMailProvider, tenantMailProviderLabelDe } from '../../lib/mailProviderUtils'

/** Felder aus dem Mandanten-Formular, die nur für die Schritt-6-Zusammenfassung gelesen werden. */
export type MandantFormWizardStep6Summary = {
  name: string
  app_name: string
  app_domain: string
  portal_domain: string
  arbeitszeitenportal_domain: string
  mail_provider: string
  mail_monthly_limit: string
  mail_from_name: string
  mail_from_email: string
  mail_reply_to: string
  supabase_url: string
  cf_preview_main_url: string
  cf_preview_portal_url: string
  cf_preview_arbeitszeit_url: string
}

export type MandantFormWizardStep6FertigstellenProps = {
  summary: MandantFormWizardStep6Summary
  wizardTenantId: string | null
  licenseModels: LicenseModel[]
  wizardLicenseModelId: string
  onWizardLicenseModelIdChange: (value: string) => void
}

export function MandantFormWizardStep6Fertigstellen({
  summary,
  wizardTenantId,
  licenseModels,
  wizardLicenseModelId,
  onWizardLicenseModelIdChange,
}: MandantFormWizardStep6FertigstellenProps) {
  const mailAbsenderLabel = (() => {
    const name = summary.mail_from_name.trim()
    const email = summary.mail_from_email.trim()
    if (name && email) return `${name} (${email})`
    if (email) return email
    if (name) return name
    return '–'
  })()

  const mailReplyLabel = summary.mail_reply_to.trim() || '–'

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Schritt 6: Fertigstellen</h3>
      <p className="text-sm text-slate-600">Welche Initial-Lizenz soll angelegt werden?</p>
      <div
        className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 space-y-2"
        role="region"
        aria-label="Zusammenfassung Mandant"
      >
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kurzüberblick</p>
        <dl className="grid grid-cols-1 gap-1.5 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">Mandant</dt>
            <dd className="font-medium break-words">{summary.name.trim() || '–'}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">App</dt>
            <dd className="font-medium break-words">{summary.app_name.trim() || '–'}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">Domains</dt>
            <dd className="font-mono text-xs break-all">
              {[summary.app_domain, summary.portal_domain, summary.arbeitszeitenportal_domain]
                .filter((d) => d?.trim())
                .join(' · ') || '–'}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">Mail · Provider</dt>
            <dd className="font-medium break-words">
              {tenantMailProviderLabelDe(normalizeTenantMailProvider(summary.mail_provider))}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">Mail · Absender</dt>
            <dd className="break-words">{mailAbsenderLabel}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">Mail · Reply-To</dt>
            <dd className="break-words">{mailReplyLabel}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">Mail · Monatslimit</dt>
            <dd className="font-medium">{Math.max(1, parseInt(summary.mail_monthly_limit, 10) || 0)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">Supabase</dt>
            <dd className="font-mono text-xs break-all">{summary.supabase_url.trim() || '–'}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 shrink-0">CF Previews</dt>
            <dd className="font-mono text-xs break-all">
              {[summary.cf_preview_main_url, summary.cf_preview_portal_url, summary.cf_preview_arbeitszeit_url]
                .filter((u) => u?.trim())
                .join(' · ') || '–'}
            </dd>
          </div>
          {wizardTenantId ? (
            <p className="text-xs text-slate-500 pt-1 border-t border-slate-100">
              Entwurf ist bereits gespeichert (technische ID: <span className="font-mono">{wizardTenantId}</span>).
            </p>
          ) : null}
        </dl>
      </div>
      <select
        id="wizard-license-model"
        value={wizardLicenseModelId}
        onChange={(e) => onWizardLicenseModelIdChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
        aria-label="Lizenzmodell für Initial-Lizenz"
      >
        {licenseModels.length === 0 ? <option value="">Kein Lizenzmodell vorhanden</option> : null}
        {licenseModels.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.tier})
          </option>
        ))}
      </select>
    </div>
  )
}
