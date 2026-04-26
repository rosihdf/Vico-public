import { Link } from 'react-router-dom'

export type ImportStammdatenSectionProps = {
  visible: boolean
}

export const ImportStammdatenSection = ({ visible }: ImportStammdatenSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
      aria-labelledby="import-heading"
    >
      <h3 id="import-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
        Stammdaten importieren
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        Kunden und Objekte/BV aus CSV oder Excel importieren.
      </p>
      <Link
        to="/import"
        className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover transition-colors"
        aria-label="Zum Import"
      >
        Import öffnen
      </Link>
    </section>
  )
}
