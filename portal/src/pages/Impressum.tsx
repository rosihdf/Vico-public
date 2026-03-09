import { Link } from 'react-router-dom'

const Impressum = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-10">
      <article className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 p-6 sm:p-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-vico-primary hover:underline mb-6"
          aria-label="Zurück zum Portal"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück
        </Link>

        <h1 className="text-2xl font-bold text-slate-800 mb-6">Impressum</h1>

        <section className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Angaben gemäß § 5 TMG</h2>
            <p>
              Vico Türen &amp; Tore GmbH<br />
              Malmsheimer Straße 57–59<br />
              71263 Weil der Stadt
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Vertreten durch</h2>
            <p>Felix Ocker</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Kontakt</h2>
            <p>
              E-Mail: info@vico-tueren.de<br />
              Telefon: 0151-577 31 675<br />
              Website: www.vico-tueren.de
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Registereintrag</h2>
            <p>
              Handelsregister: Amtsgericht Stuttgart<br />
              Registernummer: HRB 797898
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Haftungsausschluss</h2>
            <p>
              Die Inhalte dieses Kundenportals wurden mit größter Sorgfalt erstellt. Für die
              Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr
              übernehmen.
            </p>
          </div>
        </section>
      </article>
    </div>
  )
}

export default Impressum
