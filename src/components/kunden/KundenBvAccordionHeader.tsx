import type { BV } from '../../types'

export type KundenBvAccordionHeaderProps = {
  bv: BV
  isExpanded: boolean
  onToggleExpand: () => void
  canEdit: boolean
  canDelete: boolean
  onOpenEdit: () => void
  archiveDisabled: boolean
  archiveDisabledTitle: string | undefined
  onArchiveClick: () => void
}

export function KundenBvAccordionHeader({
  bv,
  isExpanded,
  onToggleExpand,
  canEdit,
  canDelete,
  onOpenEdit,
  archiveDisabled,
  archiveDisabledTitle,
  onArchiveClick,
}: KundenBvAccordionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
        aria-expanded={isExpanded}
        aria-label={`Türen/Tore für ${bv.name} ${isExpanded ? 'einklappen' : 'ausklappen'}`}
      >
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{bv.name}</p>
          {(bv.street || bv.house_number || bv.postal_code || bv.city) && (
            <p className="text-xs text-slate-500">
              {[
                [bv.street, bv.house_number].filter(Boolean).join(' '),
                [bv.postal_code, bv.city].filter(Boolean).join(' '),
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {canEdit && (
          <button
            type="button"
            onClick={onOpenEdit}
            className="inline-flex min-h-[32px] items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/40"
            aria-label={`${bv.name} öffnen`}
          >
            Öffnen
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={archiveDisabled}
            title={archiveDisabledTitle}
            onClick={onArchiveClick}
            className="inline-flex min-h-[32px] items-center rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`${bv.name} archivieren`}
          >
            Archiv
          </button>
        )}
      </div>
    </div>
  )
}
