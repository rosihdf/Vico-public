export type MandantFormWizardStep2BrandingProps = {
  appName: string
  primaryColor: string
  logoUrl: string
  faviconUrl: string
  onAppNameChange: (value: string) => void
  onPrimaryColorChange: (value: string) => void
  onLogoUrlChange: (value: string) => void
  onFaviconUrlChange: (value: string) => void
}

export function MandantFormWizardStep2Branding({
  appName,
  primaryColor,
  logoUrl,
  faviconUrl,
  onAppNameChange,
  onPrimaryColorChange,
  onLogoUrlChange,
  onFaviconUrlChange,
}: MandantFormWizardStep2BrandingProps) {
  return (
    <div className="rounded-xl border-2 border-violet-200 bg-violet-50/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Schritt 2: Branding</h3>
      <p className="text-xs text-slate-600" id="wizard-step2-hint">
        Pflicht: <strong>App-Name</strong>. Logo- und Favicon-URLs sind optional.
      </p>
      <input
        id="wizard-app-name"
        type="text"
        value={appName}
        onChange={(e) => onAppNameChange(e.target.value)}
        placeholder="App-Name"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
        aria-describedby="wizard-step2-hint"
      />
      <input
        type="color"
        value={primaryColor}
        onChange={(e) => onPrimaryColorChange(e.target.value)}
        className="w-16 h-10 rounded border border-slate-300"
      />
      <input
        type="url"
        value={logoUrl}
        onChange={(e) => onLogoUrlChange(e.target.value)}
        placeholder="Logo-URL"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
      <input
        type="url"
        value={faviconUrl}
        onChange={(e) => onFaviconUrlChange(e.target.value)}
        placeholder="Favicon-URL"
        className="w-full px-3 py-2 rounded-lg border border-slate-300"
      />
    </div>
  )
}
