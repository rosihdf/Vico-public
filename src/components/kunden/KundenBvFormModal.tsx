import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AddressLookupFields } from '../AddressLookupFields'
import type { BVFormData } from '../../types'

export type KundenBvFormModalProps = {
  bvEditingId: string | null
  bvFormData: BVFormData
  bvFormError: string | null
  isBvSaving: boolean
  canEditPortalConfig: boolean
  showMonteurCustomerZustellung: boolean
  showBvPortalDeliveryToggles: boolean
  hasKundenportalFeature: boolean
  inheritedCustomerMonteurPortal: boolean
  inheritedCustomerMaintenancePortal: boolean
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  onBvFormChange: (field: keyof BVFormData, value: string | boolean) => void
  onCopyFromCustomer: () => void
  onBvUsesCustomerDeliveryToggle: (likeCustomer: boolean) => void
  onBvMonteurPortalToggle: (allowPortal: boolean) => void
  onBvMaintenanceReportPortalToggle: (allowPortal: boolean) => void
}

export const KundenBvFormModal = ({
  bvEditingId,
  bvFormData,
  bvFormError,
  isBvSaving,
  canEditPortalConfig,
  showMonteurCustomerZustellung,
  showBvPortalDeliveryToggles,
  hasKundenportalFeature,
  inheritedCustomerMonteurPortal,
  inheritedCustomerMaintenancePortal,
  onClose,
  onSubmit,
  onBvFormChange,
  onCopyFromCustomer,
  onBvUsesCustomerDeliveryToggle,
  onBvMonteurPortalToggle,
  onBvMaintenanceReportPortalToggle,
}: KundenBvFormModalProps) => (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto overscroll-contain"
    style={{
      padding:
        'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))',
    }}
    onClick={onClose}
  >
    <div
      className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg min-w-0 my-auto max-h-[min(90vh,90dvh)] overflow-y-auto flex flex-col border border-slate-200 dark:border-slate-600"
      role="dialog"
      aria-modal
      onClick={(e) => e.stopPropagation()}
      aria-labelledby="bv-form-title"
    >
      <div className="p-4 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
        <h3 id="bv-form-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {bvEditingId ? 'Objekt/BV öffnen' : 'Objekt/BV anlegen'}
        </h3>
      </div>
      <form onSubmit={onSubmit} className="p-4 space-y-4 min-w-0">
        {!bvEditingId && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={bvFormData.copy_from_customer}
              onChange={(e) => {
                onBvFormChange('copy_from_customer', e.target.checked)
                if (e.target.checked) onCopyFromCustomer()
              }}
              className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Daten aus Kundenverwaltung übernehmen
            </span>
          </label>
        )}
        <div className="min-w-0">
          <label htmlFor="bv-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Name *
          </label>
          <input
            id="bv-name"
            type="text"
            value={bvFormData.name}
            onChange={(e) => onBvFormChange('name', e.target.value)}
            className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            required
          />
        </div>
        <AddressLookupFields
          street={bvFormData.street}
          houseNumber={bvFormData.house_number}
          postalCode={bvFormData.postal_code}
          city={bvFormData.city}
          onStreetChange={(v) => onBvFormChange('street', v)}
          onHouseNumberChange={(v) => onBvFormChange('house_number', v)}
          onPostalCodeChange={(v) => onBvFormChange('postal_code', v)}
          onCityChange={(v) => onBvFormChange('city', v)}
          streetId="bv-street"
          houseNumberId="bv-house_number"
          postalCodeId="bv-postal_code"
          cityId="bv-city"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="bv-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              E-Mail
            </label>
            <input
              id="bv-email"
              type="email"
              value={bvFormData.email}
              onChange={(e) => onBvFormChange('email', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="bv-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Telefon
            </label>
            <input
              id="bv-phone"
              type="tel"
              value={bvFormData.phone}
              onChange={(e) => onBvFormChange('phone', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            />
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ansprechpartner</p>
          <div className="space-y-2">
            <div className="min-w-0">
              <label
                htmlFor="bv-contact-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Name
              </label>
              <input
                id="bv-contact-name"
                type="text"
                placeholder="Name"
                value={bvFormData.contact_name}
                onChange={(e) => onBvFormChange('contact_name', e.target.value)}
                className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="min-w-0">
                <label
                  htmlFor="bv-contact-email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  E-Mail
                </label>
                <input
                  id="bv-contact-email"
                  type="email"
                  placeholder="E-Mail"
                  value={bvFormData.contact_email}
                  onChange={(e) => onBvFormChange('contact_email', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="bv-contact-phone"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Telefon
                </label>
                <input
                  id="bv-contact-phone"
                  type="tel"
                  placeholder="Telefon"
                  value={bvFormData.contact_phone}
                  onChange={(e) => onBvFormChange('contact_phone', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              Zustellweg: E-Mail direkt
            </span>
            <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-200">
              Quelle: Objekt/BV
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={bvFormData.maintenance_report_email}
              onChange={(e) => onBvFormChange('maintenance_report_email', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Wartungsbericht per E-Mail</span>
          </label>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Ist diese Option aktiv, wird der Wartungsbericht direkt an die hier hinterlegte E-Mail-Adresse zugestellt.
          </p>
          {bvFormData.maintenance_report_email && (
            <input
              type="email"
              placeholder="Wartungsbericht E-Mail-Adresse"
              value={bvFormData.maintenance_report_email_address}
              onChange={(e) => onBvFormChange('maintenance_report_email_address', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            />
          )}
        </div>
        {canEditPortalConfig && showMonteurCustomerZustellung && (
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Zustellung: {bvFormData.uses_customer_report_delivery ? 'geerbt' : 'individuell'}
              </span>
              <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-200">
                Quelle: {bvFormData.uses_customer_report_delivery ? 'Kunde' : 'Objekt/BV'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p
                id="bv-zustellung-wie-kunde-label"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0"
              >
                Zustellung wie Kundenstamm
              </p>
              <button
                type="button"
                role="switch"
                tabIndex={0}
                aria-checked={bvFormData.uses_customer_report_delivery}
                aria-labelledby="bv-zustellung-wie-kunde-label"
                onClick={() => onBvUsesCustomerDeliveryToggle(!bvFormData.uses_customer_report_delivery)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onBvUsesCustomerDeliveryToggle(!bvFormData.uses_customer_report_delivery)
                  }
                }}
                className={[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vico-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                  bvFormData.uses_customer_report_delivery ? 'bg-vico-primary' : 'bg-slate-200 dark:bg-slate-600',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition',
                    bvFormData.uses_customer_report_delivery ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                  aria-hidden
                />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aktiv: BV übernimmt die Zustell-/Portal-Einstellungen vom Kunden. Inaktiv: dieses Objekt/BV hat eigene
              Freigaben.
            </p>
            {bvFormData.uses_customer_report_delivery && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aktuell vom Kunden geerbt: Monteursbericht {inheritedCustomerMonteurPortal ? 'aktiv' : 'inaktiv'} ·
                Wartungsbericht {inheritedCustomerMaintenancePortal ? 'aktiv' : 'inaktiv'}.
              </p>
            )}
            {!bvFormData.uses_customer_report_delivery && showBvPortalDeliveryToggles && (
              <>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Eigene Portal-Freigaben für dieses Objekt/BV (Kundenportal-Zugänge sind am Kunden hinterlegt).
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bei aktiver Portal-Freigabe erhalten Portal-Benutzer eine Information, dass ein neuer Bericht im
                  Kundenportal verfügbar ist.
                </p>
                <div className="flex items-center justify-between gap-3">
                  <p
                    id="bv-monteur-portal-label"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0"
                  >
                    Monteursbericht · Portal
                  </p>
                  <button
                    type="button"
                    role="switch"
                    tabIndex={0}
                    aria-checked={bvFormData.monteur_report_portal}
                    aria-labelledby="bv-monteur-portal-label"
                    onClick={() => onBvMonteurPortalToggle(!bvFormData.monteur_report_portal)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onBvMonteurPortalToggle(!bvFormData.monteur_report_portal)
                      }
                    }}
                    className={[
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-vico-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                      bvFormData.monteur_report_portal ? 'bg-vico-primary' : 'bg-slate-200 dark:bg-slate-600',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition',
                        bvFormData.monteur_report_portal ? 'translate-x-5' : 'translate-x-0.5',
                      ].join(' ')}
                      aria-hidden
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p
                    id="bv-wartung-portal-label"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0"
                  >
                    Wartungsbericht · Portal
                  </p>
                  <button
                    type="button"
                    role="switch"
                    tabIndex={0}
                    aria-checked={bvFormData.maintenance_report_portal}
                    aria-labelledby="bv-wartung-portal-label"
                    onClick={() => onBvMaintenanceReportPortalToggle(!bvFormData.maintenance_report_portal)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onBvMaintenanceReportPortalToggle(!bvFormData.maintenance_report_portal)
                      }
                    }}
                    className={[
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-vico-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                      bvFormData.maintenance_report_portal ? 'bg-vico-primary' : 'bg-slate-200 dark:bg-slate-600',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition',
                        bvFormData.maintenance_report_portal ? 'translate-x-5' : 'translate-x-0.5',
                      ].join(' ')}
                      aria-hidden
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {!canEditPortalConfig && hasKundenportalFeature && (
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Zustellung: nur Anzeige
              </span>
              <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-200">
                Quelle: Benutzerverwaltung
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Weitere Einstellungen für Kundenportal-Zugänge & Sichtbarkeit dieses Objekt/BV werden zentral in der
              Benutzerverwaltung verwaltet.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Aktuelle Freigabe Objekt/BV: Monteursbericht {bvFormData.monteur_report_portal ? 'aktiv' : 'inaktiv'} ·
              Wartungsbericht {bvFormData.maintenance_report_portal ? 'aktiv' : 'inaktiv'}.
            </p>
          </div>
        )}
        {bvFormError && (
          <div className="text-sm text-red-600 dark:text-red-400" role="alert">
            <p>{bvFormError}</p>
            {bvFormError.startsWith('RLS-Fehler') && (
              <Link
                to="/einstellungen"
                className="mt-2 inline-block px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 text-xs font-medium"
              >
                → Zu Einstellungen (RLS-Fix)
              </Link>
            )}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={isBvSaving}
            className="flex-1 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 disabled:opacity-50 border border-slate-300 dark:border-slate-600"
          >
            {isBvSaving ? 'Speichern...' : 'Speichern'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  </div>
)
