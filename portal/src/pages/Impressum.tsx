import { Link } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import type { Theme } from '../ThemeContext'

const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

const Impressum = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const handleThemeCycle = () => {
    const idx = THEME_ORDER.indexOf(theme)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
    setTheme(next)
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 px-4 py-10">
      <article className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 sm:p-10">
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

        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Impressum</h1>

        <section className="space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Angaben gemäß § 5 TMG</h2>
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

          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Haftungsausschluss</h2>
            <p>
              Die Inhalte dieses Kundenportals wurden mit größter Sorgfalt erstellt. Für die
              Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr
              übernehmen.
            </p>
          </div>
        </section>
      </article>
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-8">
        <button
          type="button"
          onClick={handleThemeCycle}
          className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label={`Darstellung wechseln (aktuell: ${theme})`}
        >
          {resolvedTheme === 'dark' ? '☀️' : '🌙'}
        </button>
        <span>·</span>
        <Link to="/datenschutz" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
          Datenschutz
        </Link>
        <span>·</span>
        <span>Vico Türen & Tore</span>
      </div>
    </div>
  )
}

export default Impressum
