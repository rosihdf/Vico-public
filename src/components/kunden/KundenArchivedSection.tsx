import { isOnline } from '../../../shared/networkUtils'
import { LoadingSpinner } from '../LoadingSpinner'
import type { Customer } from '../../types'

export type KundenArchivedSectionProps = {
  visible: boolean
  isArchivedLoading: boolean
  archivedCustomers: Customer[]
  onRequestRestore: (customer: Customer) => void
}

export const KundenArchivedSection = ({
  visible,
  isArchivedLoading,
  archivedCustomers,
  onRequestRestore,
}: KundenArchivedSectionProps) => {
  if (!visible) return null

  return (
    <section
      className="mb-4 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/60"
      aria-labelledby="kunden-archiv-heading"
    >
      <h3 id="kunden-archiv-heading" className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
        Archivierte Kunden
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
        Diese Kunden sind in den normalen Listen ausgeblendet. Wiederherstellen setzt Kunde, alle Objekte/BV und
        Türen/Tore auf aktiv (nur online).
      </p>
      {isArchivedLoading ? (
        <LoadingSpinner message="Lade Archiv…" size="sm" className="py-4" />
      ) : archivedCustomers.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Keine archivierten Kunden.</p>
      ) : (
        <ul className="space-y-2">
          {archivedCustomers.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{c.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Archiviert:{' '}
                  {c.archived_at
                    ? new Date(c.archived_at).toLocaleString('de-DE', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                </p>
              </div>
              <button
                type="button"
                disabled={!isOnline()}
                onClick={() => onRequestRestore(c)}
                className="shrink-0 px-3 py-2 text-sm font-medium rounded-lg border border-emerald-600 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                aria-label={`Kunde ${c.name} wiederherstellen`}
              >
                Wiederherstellen
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
