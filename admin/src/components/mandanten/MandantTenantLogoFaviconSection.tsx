import type { ChangeEvent } from 'react'

export type MandantTenantLogoFaviconSectionProps = {
  showStorageRemoveActions: boolean
  logoUrl: string
  faviconUrl: string
  onLogoUrlChange: (url: string) => void
  onFaviconUrlChange: (url: string) => void
  logoFilePending: File | null
  faviconFilePending: File | null
  logoPreviewObjectUrl: string | null
  faviconPreviewObjectUrl: string | null
  onLogoFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onFaviconFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemoveStoredLogo: () => void
  onRemoveStoredFavicon: () => void
}

export function MandantTenantLogoFaviconSection({
  showStorageRemoveActions,
  logoUrl,
  faviconUrl,
  onLogoUrlChange,
  onFaviconUrlChange,
  logoFilePending,
  faviconFilePending,
  logoPreviewObjectUrl,
  faviconPreviewObjectUrl,
  onLogoFileChange,
  onFaviconFileChange,
  onRemoveStoredLogo,
  onRemoveStoredFavicon,
}: MandantTenantLogoFaviconSectionProps) {
  return (
    <>
      <div>
        <span className="block text-sm font-medium text-slate-700 mb-1">Logo</span>
        <p className="text-xs text-slate-500 mb-2">
          Optional: Datei hochladen (wird als WebP ins Storage-Bucket <code className="bg-slate-100 px-1 rounded">tenant_logos</code>{' '}
          geschrieben) oder weiterhin eine öffentliche URL eintragen. Wird über die Lizenz-API als{' '}
          <code className="bg-slate-100 px-1 rounded">design.logo_url</code> ausgeliefert.
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            id="logo_file"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onLogoFileChange}
            aria-label="Logo hochladen"
          />
          <label
            htmlFor="logo_file"
            className="inline-flex px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
          >
            Hochladen (PNG/JPG …)
          </label>
          {logoFilePending ? (
            <span className="text-xs text-slate-600 truncate max-w-[12rem]" title={logoFilePending.name}>
              Auswahl: {logoFilePending.name}
            </span>
          ) : null}
          {showStorageRemoveActions ? (
            <button
              type="button"
              onClick={onRemoveStoredLogo}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Gespeichertes Storage-Logo entfernen
            </button>
          ) : null}
        </div>
        <label htmlFor="logo_url" className="block text-xs font-medium text-slate-600 mb-1">
          Oder Logo-URL (öffentlich)
        </label>
        <input
          id="logo_url"
          type="url"
          inputMode="url"
          placeholder="https://…/logo.png"
          value={logoUrl}
          onChange={(e) => onLogoUrlChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
        />
        {logoPreviewObjectUrl || logoUrl.trim() ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-slate-500">Vorschau:</span>
            <img
              src={logoPreviewObjectUrl ?? logoUrl.trim()}
              alt=""
              className="h-10 max-w-[200px] object-contain border border-slate-200 rounded bg-white p-1"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Kein Logo gesetzt (Platzhalter in Apps bis zur Konfiguration).</p>
        )}
      </div>
      <div>
        <label htmlFor="favicon_url" className="block text-sm font-medium text-slate-700 mb-1">
          Favicon-URL
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Optional: Öffentliche URL (z. B. PNG oder ICO). Wird in den Apps als{' '}
          <code className="bg-slate-100 px-1 rounded">design.favicon_url</code> ausgeliefert.
        </p>
        <input
          id="favicon_file"
          type="file"
          accept="image/*,.ico"
          className="sr-only"
          onChange={onFaviconFileChange}
          aria-label="Favicon hochladen"
        />
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <label
            htmlFor="favicon_file"
            className="inline-flex px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
          >
            Hochladen (PNG/ICO …)
          </label>
          {faviconFilePending ? (
            <span className="text-xs text-slate-600 truncate max-w-[12rem]" title={faviconFilePending.name}>
              Auswahl: {faviconFilePending.name}
            </span>
          ) : null}
          {showStorageRemoveActions ? (
            <button
              type="button"
              onClick={onRemoveStoredFavicon}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Gespeichertes Storage-Favicon entfernen
            </button>
          ) : null}
        </div>
        <input
          id="favicon_url"
          type="url"
          inputMode="url"
          placeholder="https://…/favicon.png"
          value={faviconUrl}
          onChange={(e) => onFaviconUrlChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
        />
        {faviconPreviewObjectUrl || faviconUrl.trim() ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-slate-500">Vorschau:</span>
            <img
              src={faviconPreviewObjectUrl ?? faviconUrl.trim()}
              alt=""
              className="h-8 w-8 object-contain border border-slate-200 rounded bg-white p-1"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Kein Favicon gesetzt (Standard-Favicon bleibt aktiv).</p>
        )}
      </div>
    </>
  )
}
