export type MandantFormEditBrandingBasicsSectionProps = {
  primaryColor: string
  appName: string
  onPrimaryColorChange: (value: string) => void
  onAppNameChange: (value: string) => void
}

export function MandantFormEditBrandingBasicsSection({
  primaryColor,
  appName,
  onPrimaryColorChange,
  onAppNameChange,
}: MandantFormEditBrandingBasicsSectionProps) {
  return (
    <>
      <div>
        <label htmlFor="primary_color" className="block text-sm font-medium text-slate-700 mb-1">
          Primärfarbe
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="primary_color"
            type="color"
            value={primaryColor}
            onChange={(e) => onPrimaryColorChange(e.target.value)}
            className="w-12 h-10 min-w-[3rem] rounded border border-slate-300 cursor-pointer shrink-0"
          />
          <span className="text-sm text-slate-600 font-mono break-all">{primaryColor}</span>
        </div>
      </div>
      <div>
        <label htmlFor="app_name" className="block text-sm font-medium text-slate-700 mb-1">
          App-Name
        </label>
        <input
          id="app_name"
          type="text"
          value={appName}
          onChange={(e) => onAppNameChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
        />
      </div>
    </>
  )
}
