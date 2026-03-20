import { Link } from 'react-router-dom'

/** Stammdaten – bei Mandantenfähigkeit aus Lizenz-API */
const Datenschutz = () => (
  <div className="min-h-screen bg-[#5b7895] dark:bg-slate-900 px-4 py-10">
    <article className="w-full max-w-2xl min-w-0 mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 p-6 sm:p-10">
      <Link
        to="/aktivierung"
        className="inline-flex items-center gap-1 text-sm text-vico-primary hover:underline mb-6"
        aria-label="Zurück zur Aktivierung"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zurück
      </Link>

      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Datenschutzerklärung</h1>

      <section className="space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>
          Verantwortlich für die Datenverarbeitung ist der jeweilige Mandant bzw. Anbieter der Anwendung.
          Bei Fragen wenden Sie sich bitte an den Support.
        </p>
        <p>
          Ihre Daten werden ausschließlich zur Bereitstellung der Anwendung verarbeitet und nicht an Dritte weitergegeben.
        </p>
      </section>
    </article>
  </div>
)

export default Datenschutz
