import type { Dispatch, SetStateAction } from 'react'
import type { DesignConfig } from '../../LicenseContext'

export type StammdatenImpressumFormState = {
  company_name: string
  address: string
  contact: string
  represented_by: string
  register: string
  vat_id: string
  responsible: string
  contact_email: string
  dsb_email: string
}

export type ImpressumDisplayFields = {
  company_name?: string | null
  address?: string | null
  contact?: string | null
} | null | undefined

export type StammdatenImpressumSettingsSectionProps = {
  visible: boolean
  design: DesignConfig | null
  impressum: ImpressumDisplayFields
  licenseApiConfigured: boolean
  isOffline: boolean
  onOpenEdit: () => void | Promise<void>
  showEdit: boolean
  onModalBackdropRequestClose: () => void
  onCancelEdit: () => void
  stammdatenError: string | null
  stammdatenSaving: boolean
  stammdatenLoading: boolean
  stammdatenForm: StammdatenImpressumFormState
  setStammdatenForm: Dispatch<SetStateAction<StammdatenImpressumFormState>>
  onSaveStammdaten: () => void | Promise<void>
}

export const StammdatenImpressumSettingsSection = ({
  visible,
  design,
  impressum,
  licenseApiConfigured,
  isOffline,
  onOpenEdit,
  showEdit,
  onModalBackdropRequestClose,
  onCancelEdit,
  stammdatenError,
  stammdatenSaving,
  stammdatenLoading,
  stammdatenForm,
  setStammdatenForm,
  onSaveStammdaten,
}: StammdatenImpressumSettingsSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="stammdaten-heading"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 id="stammdaten-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Stammdaten / Impressum
        </h3>
        {licenseApiConfigured && (
          <button
            type="button"
            onClick={() => void onOpenEdit()}
            disabled={isOffline}
            title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
            className={`text-xs font-medium ${isOffline ? 'text-slate-400 cursor-not-allowed' : 'text-vico-primary hover:underline'}`}
            aria-label="Stammdaten bearbeiten"
          >
            Bearbeiten
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        {licenseApiConfigured
          ? 'Impressum und Datenschutz können Sie hier bearbeiten.'
          : 'Anzeige aus dem Lizenzportal.'}
      </p>
      <dl className="space-y-1 text-sm">
        {design?.app_name && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">App-Name</dt>
            <dd className="text-slate-800 dark:text-slate-100 font-medium">{design.app_name}</dd>
          </>
        )}
        {design?.logo_url ? (
          <>
            <dt className="text-slate-500 dark:text-slate-400 mt-2">Logo (Lizenz)</dt>
            <dd className="mt-1">
              <img
                src={design.logo_url}
                alt=""
                className="h-12 max-w-[220px] object-contain border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 p-1"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">{design.logo_url}</p>
            </dd>
          </>
        ) : null}
        {impressum?.company_name && (
          <>
            <dt className="text-slate-500 dark:text-slate-400 mt-2">Firma</dt>
            <dd className="text-slate-800 dark:text-slate-100">{impressum.company_name}</dd>
          </>
        )}
        {impressum?.address && (
          <>
            <dt className="text-slate-500 dark:text-slate-400 mt-2">Adresse</dt>
            <dd className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{impressum.address}</dd>
          </>
        )}
        {impressum?.contact && (
          <>
            <dt className="text-slate-500 dark:text-slate-400 mt-2">Kontakt</dt>
            <dd className="text-slate-800 dark:text-slate-100">{impressum.contact}</dd>
          </>
        )}
      </dl>

      {showEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stammdaten-modal-heading"
          onClick={onModalBackdropRequestClose}
        >
          <div
            className="max-w-lg w-full min-w-0 max-h-[min(90vh,90dvh)] overflow-auto p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="stammdaten-modal-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Stammdaten bearbeiten
            </h4>
            {stammdatenError && (
              <p className="mb-4 p-3 text-sm text-red-800 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg" role="alert">
                {stammdatenError}
              </p>
            )}
            {stammdatenLoading && (
              <p className="mb-4 p-3 text-sm text-slate-700 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg" role="status">
                Lade hinterlegte Stammdaten…
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="stammdaten-company" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Firmenname</label>
                <input
                  id="stammdaten-company"
                  type="text"
                  value={stammdatenForm.company_name}
                  onChange={(e) => setStammdatenForm((f) => ({ ...f, company_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="stammdaten-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adresse</label>
                <textarea
                  id="stammdaten-address"
                  value={stammdatenForm.address}
                  onChange={(e) => setStammdatenForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="stammdaten-contact" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kontakt</label>
                <input
                  id="stammdaten-contact"
                  type="text"
                  value={stammdatenForm.contact}
                  onChange={(e) => setStammdatenForm((f) => ({ ...f, contact: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="stammdaten-represented" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vertreten durch</label>
                <input
                  id="stammdaten-represented"
                  type="text"
                  value={stammdatenForm.represented_by}
                  onChange={(e) => setStammdatenForm((f) => ({ ...f, represented_by: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="stammdaten-register" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Handelsregister</label>
                <input
                  id="stammdaten-register"
                  type="text"
                  value={stammdatenForm.register}
                  onChange={(e) => setStammdatenForm((f) => ({ ...f, register: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="stammdaten-vat" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">USt-ID</label>
                <input
                  id="stammdaten-vat"
                  type="text"
                  value={stammdatenForm.vat_id}
                  onChange={(e) => setStammdatenForm((f) => ({ ...f, vat_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-600">
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Datenschutz</h5>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="stammdaten-verantwortlich" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Verantwortlicher</label>
                    <input
                      id="stammdaten-verantwortlich"
                      type="text"
                      value={stammdatenForm.responsible}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, responsible: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="stammdaten-dsb-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kontakt-E-Mail</label>
                    <input
                      id="stammdaten-dsb-email"
                      type="email"
                      value={stammdatenForm.contact_email}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, contact_email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="stammdaten-dsb" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">DSB-E-Mail</label>
                    <input
                      id="stammdaten-dsb"
                      type="email"
                      value={stammdatenForm.dsb_email}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, dsb_email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => void onSaveStammdaten()}
                disabled={stammdatenSaving || stammdatenLoading}
                className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50"
              >
                {stammdatenSaving ? 'Speichern…' : 'Speichern'}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={stammdatenSaving || stammdatenLoading}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
