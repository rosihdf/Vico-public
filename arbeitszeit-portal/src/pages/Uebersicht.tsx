import { Link } from 'react-router-dom'

const Uebersicht = () => {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Übersicht</h2>
      <p className="text-slate-600 mb-6">
        Willkommen im Arbeitszeitenportal. Hier können Sie Zeiteinträge einsehen, bearbeiten und Stammdaten verwalten.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/alle-zeiten"
          className="block p-4 bg-white border border-slate-200 rounded-lg hover:border-vico-primary hover:bg-slate-50 transition-colors"
        >
          <h3 className="font-medium text-slate-800">Alle Zeiten</h3>
          <p className="text-sm text-slate-500 mt-1">
            Zeiteinträge aller Mitarbeiter einsehen und bearbeiten
          </p>
        </Link>
        <Link
          to="/log"
          className="block p-4 bg-white border border-slate-200 rounded-lg hover:border-vico-primary hover:bg-slate-50 transition-colors"
        >
          <h3 className="font-medium text-slate-800">Log</h3>
          <p className="text-sm text-slate-500 mt-1">
            Änderungsprotokoll der Zeiteinträge
          </p>
        </Link>
        <Link
          to="/stammdaten"
          className="block p-4 bg-white border border-slate-200 rounded-lg hover:border-vico-primary hover:bg-slate-50 transition-colors sm:col-span-2"
        >
          <h3 className="font-medium text-slate-800">Stammdaten AZK</h3>
          <p className="text-sm text-slate-500 mt-1">
            Soll-Arbeitszeiten pro Mitarbeiter verwalten
          </p>
        </Link>
      </div>
    </div>
  )
}

export default Uebersicht
