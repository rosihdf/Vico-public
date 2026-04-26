import { Link } from 'react-router-dom'

export type AuftragsdetailOrderSummaryChild = {
  id: string
  orderTypeLabel: string
}

export type AuftragsdetailOrderSummaryCardProps = {
  customerName: string
  bvDisplay: string
  objectLabel: string
  orderDateDisplay: string
  billingStatusLabel: string
  /** Wenn gesetzt: Zeile „Verknüpfter Auftrag“ mit Link zu `/auftrag/{id}` */
  relatedParentOrderId: string | null
  description: string | null | undefined
  relatedChildren: AuftragsdetailOrderSummaryChild[]
}

export function AuftragsdetailOrderSummaryCard({
  customerName,
  bvDisplay,
  objectLabel,
  orderDateDisplay,
  billingStatusLabel,
  relatedParentOrderId,
  description,
  relatedChildren,
}: AuftragsdetailOrderSummaryCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-6 mb-6">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Auftrag</h2>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Kunde</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{customerName}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Objekt/BV</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{bvDisplay}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Tür/Tor</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{objectLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Auftragsdatum</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{orderDateDisplay}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Abrechnung</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{billingStatusLabel}</dd>
        </div>
        {relatedParentOrderId ? (
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Verknüpfter Auftrag</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">
              <Link
                to={`/auftrag/${relatedParentOrderId}`}
                className="text-vico-primary hover:underline dark:text-sky-400"
                aria-label="Verknüpften Auftrag öffnen"
              >
                Auftrag #{relatedParentOrderId.slice(0, 8)}
              </Link>
            </dd>
          </div>
        ) : null}
        {description ? (
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Beschreibung</dt>
            <dd className="text-slate-700 dark:text-slate-300">{description}</dd>
          </div>
        ) : null}
      </dl>
      {relatedChildren.length > 0 ? (
        <div className="mt-4 border-t border-slate-200 dark:border-slate-600 pt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Verknüpfte Folgeaufträge</p>
          <div className="flex flex-wrap gap-2">
            {relatedChildren.map((child) => (
              <Link
                key={child.id}
                to={`/auftrag/${child.id}`}
                className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-vico-primary hover:bg-slate-50 dark:hover:bg-slate-700/40"
                aria-label={`Folgeauftrag ${child.id.slice(0, 8)} öffnen`}
              >
                #{child.id.slice(0, 8)} · {child.orderTypeLabel}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
