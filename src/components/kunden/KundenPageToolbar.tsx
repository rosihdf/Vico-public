import type { ChangeEventHandler, MouseEventHandler } from 'react'

export type KundenPageToolbarProps = {
  canUseQrBatch: boolean
  searchQuery: string
  onSearchChange: ChangeEventHandler<HTMLInputElement>
  canEdit: boolean
  showNeuDropdown: boolean
  onNeuToggleClick: MouseEventHandler<HTMLButtonElement>
  onNeuCustomerClick: MouseEventHandler<HTMLButtonElement>
  canCreateBv: boolean
  onNeuBvClick: MouseEventHandler<HTMLButtonElement>
  neuBvDisabled: boolean
  neuBvTitle: string | undefined
  onNeuDoorClick: MouseEventHandler<HTMLButtonElement>
  neuDoorDisabled: boolean
  neuDoorTitle: string | undefined
  canDelete: boolean
  showArchivedSection: boolean
  onToggleArchived: () => void
  showFilters: boolean
  hasActiveFilters: boolean
  onToggleFilters: () => void
}

export function KundenPageToolbar({
  canUseQrBatch,
  searchQuery,
  onSearchChange,
  canEdit,
  showNeuDropdown,
  onNeuToggleClick,
  onNeuCustomerClick,
  canCreateBv,
  onNeuBvClick,
  neuBvDisabled,
  neuBvTitle,
  onNeuDoorClick,
  neuDoorDisabled,
  neuDoorTitle,
  canDelete,
  showArchivedSection,
  onToggleArchived,
  showFilters,
  hasActiveFilters,
  onToggleFilters,
}: KundenPageToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Kunden</h2>
        {canUseQrBatch && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            A4-PDF: Türen/Tore ankreuzen, Etikettgröße wählen und PDF herunterladen (Lizenz „A4-QR-Etiketten“).
          </p>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          type="search"
          placeholder="Name, Ort, Adresse, Kontakt…"
          value={searchQuery}
          onChange={onSearchChange}
          className="flex-1 sm:w-48 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
          aria-label="Kunden suchen"
        />
        {canEdit && (
          <div className="relative">
            <button
              type="button"
              onClick={onNeuToggleClick}
              className="px-4 py-2.5 min-h-[40px] bg-vico-button dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-vico-button-hover dark:hover:bg-slate-600 font-medium border border-slate-300 dark:border-slate-600 flex items-center gap-1"
              aria-expanded={showNeuDropdown}
              aria-haspopup="true"
              aria-label="Neu anlegen"
            >
              + Neu
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showNeuDropdown && (
              <div
                className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg py-1 z-40"
                role="menu"
              >
                <button
                  type="button"
                  onClick={onNeuCustomerClick}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  role="menuitem"
                >
                  Neuer Kunde
                </button>
                {canCreateBv && (
                  <button
                    type="button"
                    onClick={onNeuBvClick}
                    disabled={neuBvDisabled}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    role="menuitem"
                    title={neuBvTitle}
                  >
                    Neues Objekt/BV
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNeuDoorClick}
                  disabled={neuDoorDisabled}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  role="menuitem"
                  title={neuDoorTitle}
                >
                  Neues Tür/Tor
                </button>
              </div>
            )}
          </div>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onToggleArchived}
            className={`px-3 py-2 rounded-lg border text-sm font-medium ${
              showArchivedSection
                ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-500 text-slate-900 dark:text-slate-100'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
            }`}
            aria-expanded={showArchivedSection}
            aria-label="Archivierte Kunden ein- oder ausblenden"
          >
            Archiv
          </button>
        )}
        <button
          type="button"
          onClick={onToggleFilters}
          className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 ${
            hasActiveFilters
              ? 'bg-vico-primary/20 border-vico-primary text-slate-800 dark:text-slate-100'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
          }`}
          aria-expanded={showFilters}
          aria-label="Filter anzeigen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-vico-primary" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  )
}
