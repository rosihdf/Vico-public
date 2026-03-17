import { downloadWebAppChecklist } from '../lib/downloadChecklist'

const Einstellungen = () => {
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Einstellungen</h2>

      {/* Benutzeranleitung */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="anleitung-heading"
      >
        <h3 id="anleitung-heading" className="text-sm font-semibold text-slate-700 mb-3">
          Benutzeranleitung
        </h3>
        <button
          type="button"
          onClick={() => window.open('/BENUTZERANLEITUNG.md', '_blank', 'noopener,noreferrer')}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Benutzeranleitung öffnen"
        >
          Benutzeranleitung öffnen
        </button>
      </section>

      {/* Dokumentation */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="dokumentation-heading"
      >
        <h3 id="dokumentation-heading" className="text-sm font-semibold text-slate-700 mb-3">
          Dokumentation
        </h3>
        <p className="text-sm text-slate-600 mb-3">
          Projekt-Dokumentation mit Architektur, Features, Roadmap und technischen Details.
        </p>
        <a
          href="/Vico-Dokumentation.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Vico-Dokumentation als PDF öffnen"
        >
          Vico-Dokumentation (PDF)
        </a>
      </section>

      {/* Checklisten */}
      <section
        className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="checklisten-heading"
      >
        <h3 id="checklisten-heading" className="text-sm font-semibold text-slate-700 mb-3">
          Checklisten
        </h3>
        <p className="text-sm text-slate-600 mb-3">
          Web-App-Test-Checkliste als PDF erstellen und herunterladen.
        </p>
        <button
          type="button"
          onClick={downloadWebAppChecklist}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Web-App-Test-Checkliste herunterladen"
        >
          Web-App-Test-Checkliste
        </button>
      </section>
    </div>
  )
}

export default Einstellungen
