export type MandantFormEditLegalSectionProps = {
  impressumCompanyName: string
  impressumAddress: string
  impressumContact: string
  datenschutzResponsible: string
  datenschutzContactEmail: string
  onImpressumCompanyNameChange: (value: string) => void
  onImpressumAddressChange: (value: string) => void
  onImpressumContactChange: (value: string) => void
  onDatenschutzResponsibleChange: (value: string) => void
  onDatenschutzContactEmailChange: (value: string) => void
}

export function MandantFormEditLegalSection({
  impressumCompanyName,
  impressumAddress,
  impressumContact,
  datenschutzResponsible,
  datenschutzContactEmail,
  onImpressumCompanyNameChange,
  onImpressumAddressChange,
  onImpressumContactChange,
  onDatenschutzResponsibleChange,
  onDatenschutzContactEmailChange,
}: MandantFormEditLegalSectionProps) {
  return (
    <>
      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Impressum</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="impressum_company_name" className="block text-sm text-slate-600 mb-1">
              Firmenname
            </label>
            <input
              id="impressum_company_name"
              type="text"
              value={impressumCompanyName}
              onChange={(e) => onImpressumCompanyNameChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div>
            <label htmlFor="impressum_address" className="block text-sm text-slate-600 mb-1">
              Adresse
            </label>
            <textarea
              id="impressum_address"
              value={impressumAddress}
              onChange={(e) => onImpressumAddressChange(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div>
            <label htmlFor="impressum_contact" className="block text-sm text-slate-600 mb-1">
              Kontakt
            </label>
            <input
              id="impressum_contact"
              type="text"
              value={impressumContact}
              onChange={(e) => onImpressumContactChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Datenschutz</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="datenschutz_responsible" className="block text-sm text-slate-600 mb-1">
              Verantwortlicher
            </label>
            <input
              id="datenschutz_responsible"
              type="text"
              value={datenschutzResponsible}
              onChange={(e) => onDatenschutzResponsibleChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div>
            <label htmlFor="datenschutz_contact_email" className="block text-sm text-slate-600 mb-1">
              Kontakt-E-Mail
            </label>
            <input
              id="datenschutz_contact_email"
              type="email"
              value={datenschutzContactEmail}
              onChange={(e) => onDatenschutzContactEmailChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
        </div>
      </div>
    </>
  )
}
