import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AddressLookupFields } from '../AddressLookupFields'
import type { CustomerFormData } from '../../types'

export type KundenCustomerFormModalProps = {
  editingId: string | null
  formData: CustomerFormData
  formError: string | null
  isSaving: boolean
  showPortalDeliveryToggles: boolean
  hasKundenportalFeature: boolean
  canOpenBenutzerverwaltung: boolean
  portalUserCountForForm: number
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  onFormChange: (field: keyof CustomerFormData, value: string | boolean) => void
  onMonteurPortalToggle: (allowPortal: boolean) => void
  onMaintenanceReportPortalToggle: (allowPortal: boolean) => void
}

export const KundenCustomerFormModal = ({
  editingId,
  formData,
  formError,
  isSaving,
  showPortalDeliveryToggles,
  hasKundenportalFeature,
  canOpenBenutzerverwaltung,
  portalUserCountForForm,
  onClose,
  onSubmit,
  onFormChange,
  onMonteurPortalToggle,
  onMaintenanceReportPortalToggle,
}: KundenCustomerFormModalProps) => (
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
      aria-labelledby="form-title"
    >
      <div className="p-4 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
        <h3 id="form-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {editingId ? 'Kunde öffnen' : 'Kunde anlegen'}
        </h3>
      </div>
      <form onSubmit={onSubmit} className="p-4 space-y-4 min-w-0">
        <div className="min-w-0">
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => onFormChange('name', e.target.value)}
            className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            required
          />
        </div>
        <AddressLookupFields
          street={formData.street}
          houseNumber={formData.house_number}
          postalCode={formData.postal_code}
          city={formData.city}
          onStreetChange={(v) => onFormChange('street', v)}
          onHouseNumberChange={(v) => onFormChange('house_number', v)}
          onPostalCodeChange={(v) => onFormChange('postal_code', v)}
          onCityChange={(v) => onFormChange('city', v)}
          streetId="street"
          houseNumberId="house_number"
          postalCodeId="postal_code"
          cityId="city"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => onFormChange('email', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Telefon
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => onFormChange('phone', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            />
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ansprechpartner</p>
          <div className="space-y-2">
            <div className="min-w-0">
              <label
                htmlFor="customer-contact-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Name
              </label>
              <input
                id="customer-contact-name"
                type="text"
                placeholder="Name"
                value={formData.contact_name}
                onChange={(e) => onFormChange('contact_name', e.target.value)}
                className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="min-w-0">
                <label
                  htmlFor="customer-contact-email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  E-Mail
                </label>
                <input
                  id="customer-contact-email"
                  type="email"
                  placeholder="E-Mail"
                  value={formData.contact_email}
                  onChange={(e) => onFormChange('contact_email', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="customer-contact-phone"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Telefon
                </label>
                <input
                  id="customer-contact-phone"
                  type="tel"
                  placeholder="Telefon"
                  value={formData.contact_phone}
                  onChange={(e) => onFormChange('contact_phone', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              Zustellweg: E-Mail direkt
            </span>
            <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-200">
              Quelle: Kunde
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p
              id="wartungs-email-kunde-label"
              className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0"
            >
              Wartungsbericht · E-Mail
            </p>
            <button
              type="button"
              role="switch"
              tabIndex={0}
              aria-checked={formData.maintenance_report_email}
              aria-labelledby="wartungs-email-kunde-label"
              onClick={() => onFormChange('maintenance_report_email', !formData.maintenance_report_email)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onFormChange('maintenance_report_email', !formData.maintenance_report_email)
                }
              }}
              className={[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-vico-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                formData.maintenance_report_email ? 'bg-vico-primary' : 'bg-slate-200 dark:bg-slate-600',
              ].join(' ')}
            >
              <span
                className={[
                  'pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition',
                  formData.maintenance_report_email ? 'translate-x-5' : 'translate-x-0.5',
                ].join(' ')}
                aria-hidden
              />
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Ist diese Option aktiv, wird der Wartungsbericht direkt an die hier hinterlegte E-Mail-Adresse zugestellt.
          </p>
          {formData.maintenance_report_email && (
            <input
              type="email"
              placeholder="Wartungsbericht E-Mail-Adresse"
              value={formData.maintenance_report_email_address}
              onChange={(e) => onFormChange('maintenance_report_email_address', e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            />
          )}
        </div>
        {showPortalDeliveryToggles && (
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Zustellweg: Portal
              </span>
              <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-200">
                Wirkung: Benachrichtigung + Abruf im Portal
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Für diesen Kunden bestehen Kundenportal-Zugänge. Die Schalter unten steuern, ob Wartungs- und Monteursberichte
              zusätzlich im Kundenportal sichtbar werden.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bei aktiver Portal-Freigabe erhalten Portal-Benutzer eine Information, dass ein neuer Bericht im Kundenportal
              verfügbar ist.
            </p>
            <div className="flex items-center justify-between gap-3">
              <p
                id="monteur-portal-kunde-label"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0"
              >
                Monteursbericht · Portal
              </p>
              <button
                type="button"
                role="switch"
                tabIndex={0}
                aria-checked={formData.monteur_report_portal}
                aria-labelledby="monteur-portal-kunde-label"
                onClick={() => onMonteurPortalToggle(!formData.monteur_report_portal)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMonteurPortalToggle(!formData.monteur_report_portal)
                  }
                }}
                className={[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vico-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                  formData.monteur_report_portal ? 'bg-vico-primary' : 'bg-slate-200 dark:bg-slate-600',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition',
                    formData.monteur_report_portal ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                  aria-hidden
                />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p
                id="wartungs-portal-kunde-label"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0"
              >
                Wartungsbericht · Portal
              </p>
              <button
                type="button"
                role="switch"
                tabIndex={0}
                aria-checked={formData.maintenance_report_portal}
                aria-labelledby="wartungs-portal-kunde-label"
                onClick={() => onMaintenanceReportPortalToggle(!formData.maintenance_report_portal)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMaintenanceReportPortalToggle(!formData.maintenance_report_portal)
                  }
                }}
                className={[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vico-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                  formData.maintenance_report_portal ? 'bg-vico-primary' : 'bg-slate-200 dark:bg-slate-600',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition',
                    formData.maintenance_report_portal ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                  aria-hidden
                />
              </button>
            </div>
          </div>
        )}
        {hasKundenportalFeature && editingId && (
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Kundenportal</p>
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Weitere Einstellungen für Kundenportal-Zugänge & Sichtbarkeit (Benutzerzuordnung und Objekt/BV) erfolgen
                zentral in der Benutzerverwaltung.
              </p>
              {canOpenBenutzerverwaltung ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Zugeordnete Portal-Benutzer: {portalUserCountForForm}
                  </p>
                  <Link
                    to="/benutzerverwaltung#portal-zugaenge"
                    className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    aria-label="Benutzerverwaltung öffnen"
                  >
                    Zur Benutzerverwaltung
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Die Administration verwaltet Kundenportal-Zugänge zentral in der Benutzerverwaltung.
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aktuelle Freigabe Kunde: Monteursbericht {formData.monteur_report_portal ? 'aktiv' : 'inaktiv'} ·
                Wartungsbericht {formData.maintenance_report_portal ? 'aktiv' : 'inaktiv'}.
              </p>
            </div>
          </div>
        )}
        {formError && (
          <div className="text-sm text-red-600 dark:text-red-400" role="alert">
            <p>{formError}</p>
            {formError.startsWith('RLS-Fehler') && (
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
            disabled={isSaving}
            className="flex-1 py-2 bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 disabled:opacity-50 border border-slate-300 dark:border-slate-600"
          >
            {isSaving ? 'Speichern...' : 'Speichern'}
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
