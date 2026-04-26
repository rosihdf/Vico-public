export type MandantFormWizardStep1BasisdatenProps = {
  name: string
  appDomain: string
  portalDomain: string
  arbeitszeitenportalDomain: string
  onNameChange: (value: string) => void
  onAppDomainChange: (value: string) => void
  onPortalDomainChange: (value: string) => void
  onArbeitszeitenportalDomainChange: (value: string) => void
}

export function MandantFormWizardStep1Basisdaten({
  name,
  appDomain,
  portalDomain,
  arbeitszeitenportalDomain,
  onNameChange,
  onAppDomainChange,
  onPortalDomainChange,
  onArbeitszeitenportalDomainChange,
}: MandantFormWizardStep1BasisdatenProps) {
  return (
    <div className="rounded-xl border-2 border-sky-200 bg-sky-50/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Schritt 1: Basisdaten</h3>
      <p className="text-xs text-slate-600" id="wizard-step1-hint">
        Pflicht: <strong>Mandantenname</strong>. Domains sind optional und können später ergänzt werden.
      </p>
      <input
        id="wizard-name"
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Mandantenname *"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
        required
        aria-describedby="wizard-step1-hint"
      />
      <input
        type="text"
        value={appDomain}
        onChange={(e) => onAppDomainChange(e.target.value)}
        placeholder="App-Domain"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
      <input
        type="text"
        value={portalDomain}
        onChange={(e) => onPortalDomainChange(e.target.value)}
        placeholder="Kundenportal-Domain"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
      <input
        type="text"
        value={arbeitszeitenportalDomain}
        onChange={(e) => onArbeitszeitenportalDomainChange(e.target.value)}
        placeholder="Arbeitszeitportal-Domain"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
    </div>
  )
}
