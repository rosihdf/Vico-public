import { Link } from 'react-router-dom'
import { AppButton } from './ui'

export type AuftragsdetailPageHeaderProps = {
  orderTypeLabel: string
  orderStatusLabel: string
  canReopenOrder: boolean
  onReopenClick: () => void
}

export function AuftragsdetailPageHeader({
  orderTypeLabel,
  orderStatusLabel,
  canReopenOrder,
  onReopenClick,
}: AuftragsdetailPageHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
      <Link
        to="/auftrag"
        className="text-vico-primary hover:underline dark:text-sky-400 dark:hover:text-sky-300"
        aria-label="Zurück zu Aufträgen"
      >
        ← Aufträge
      </Link>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {orderTypeLabel} · {orderStatusLabel}
        </span>
        {canReopenOrder ? (
          <AppButton
            type="button"
            variant="outline"
            className="text-sm py-1.5 px-3"
            onClick={onReopenClick}
            aria-label="Erledigten Auftrag wieder öffnen"
          >
            Auftrag wieder öffnen
          </AppButton>
        ) : null}
      </div>
    </div>
  )
}
