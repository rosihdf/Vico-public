import LegalPage from '../components/LegalPage'

/** Stammdaten für Impressum – bei Mandantenfähigkeit aus API; aktuell manuell pflegen */
const IMPRESSUM = {
  vat_id: null as string | null, // USt-IdNr. oder W-IdNr. – bei Vorhandensein eintragen
}

const Impressum = () => (
  <LegalPage title="Impressum">
    <section className="space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</h2>
        <p>
          Vico Türen &amp; Tore GmbH<br />
          Malmsheimer Straße 57–59<br />
          71263 Weil der Stadt
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Vertreten durch</h2>
        <p>Felix Ocker</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Kontakt</h2>
        <p>
          E-Mail: info@vico-tueren.de<br />
          Telefon: 0151-577 31 675<br />
          Website: www.vico-tueren.de
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Registereintrag</h2>
        <p>
          Handelsregister: Amtsgericht Stuttgart<br />
          Registernummer: HRB 797898
        </p>
      </div>

      {IMPRESSUM.vat_id && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Umsatzsteuer-Identifikationsnummer</h2>
          <p>USt-IdNr.: {IMPRESSUM.vat_id}</p>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Haftungsausschluss</h2>
        <p>
          Die Inhalte dieses Kundenportals wurden mit größter Sorgfalt erstellt. Für die
          Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr
          übernehmen.
        </p>
      </div>
    </section>
  </LegalPage>
)

export default Impressum
