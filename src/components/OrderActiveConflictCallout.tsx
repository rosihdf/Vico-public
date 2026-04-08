import { Link } from 'react-router-dom'
import {
  groupActiveOrderConflictsByOrderId,
  type ActiveOrderObjectConflict,
} from '../lib/orderUtils'

type OrderActiveConflictCalloutProps = {
  conflicts: ActiveOrderObjectConflict[]
  resolveDoorLabel: (objectId: string) => string
  /** Wenn gesetzt, ersetzt den Standard-Erklärtext */
  intro?: string
}

const DEFAULT_INTRO =
  'Pro Tür/Tor ist nur ein Auftrag mit Status „Offen“ oder „In Bearbeitung“ erlaubt. Öffnen Sie den bestehenden Auftrag, um weiterzuarbeiten, ihn abzuschließen oder zu stornieren – oder wählen Sie eine andere Tür bzw. nutzen Sie die QR-Zusammenführung.'

/**
 * §11.19 / WP-ORD: Hinweis inkl. Links zu blockierenden Aufträgen (ein Link pro Auftrag).
 */
const OrderActiveConflictCallout = ({
  conflicts,
  resolveDoorLabel,
  intro = DEFAULT_INTRO,
}: OrderActiveConflictCalloutProps) => {
  if (conflicts.length === 0) return null
  const grouped = groupActiveOrderConflictsByOrderId(conflicts)

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/25 px-3 py-3 text-sm text-amber-950 dark:text-amber-100"
    >
      <p className="font-semibold text-amber-950 dark:text-amber-50 mb-1">Aktiver Auftrag für diese Tür/Tor</p>
      <p className="text-amber-900 dark:text-amber-200/95 mb-3 leading-snug">{intro}</p>
      <ul className="space-y-2" aria-label="Bestehende Aufträge öffnen">
        {grouped.map(({ orderId, objectIds }) => {
          const doorPart =
            objectIds.length === 1
              ? resolveDoorLabel(objectIds[0])
              : `${objectIds.length} ausgewählte Türen/Tore`
          return (
            <li key={orderId}>
              <Link
                to={`/auftrag/${orderId}`}
                className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2.5 rounded-lg bg-vico-primary text-white font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 text-center"
                tabIndex={0}
              >
                Zum Auftrag ({doorPart})
              </Link>
              <span className="block mt-1 text-xs text-amber-800 dark:text-amber-300/90 font-mono">
                ID {orderId.slice(0, 8)}…
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default OrderActiveConflictCallout
