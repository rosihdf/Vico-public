import type { Dispatch, SetStateAction } from 'react'

export type KundenWartungsstatusFilter = 'all' | 'overdue' | 'due_soon' | 'ok' | 'none'

export type KundenFilterPanelProps = {
  filterPlz: string
  setFilterPlz: Dispatch<SetStateAction<string>>
  filterWartungsstatus: KundenWartungsstatusFilter
  setFilterWartungsstatus: Dispatch<SetStateAction<KundenWartungsstatusFilter>>
  filterBvMin: string
  setFilterBvMin: Dispatch<SetStateAction<string>>
  filterBvMax: string
  setFilterBvMax: Dispatch<SetStateAction<string>>
  hasActiveFilters: boolean
  onResetFilters: () => void
}

export const KundenFilterPanel = ({
  filterPlz,
  setFilterPlz,
  filterWartungsstatus,
  setFilterWartungsstatus,
  filterBvMin,
  setFilterBvMin,
  filterBvMax,
  setFilterBvMax,
  hasActiveFilters,
  onResetFilters,
}: KundenFilterPanelProps) => (
  <div className="mb-4 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50">
    <div className="flex flex-wrap gap-4 items-end">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">PLZ</span>
        <input
          type="text"
          placeholder="z.B. 10115"
          value={filterPlz}
          onChange={(e) => setFilterPlz(e.target.value)}
          className="w-28 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
          aria-label="PLZ filtern"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Wartungsstatus</span>
        <select
          value={filterWartungsstatus}
          onChange={(e) => setFilterWartungsstatus(e.target.value as KundenWartungsstatusFilter)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vico-primary bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-w-[140px]"
          aria-label="Wartungsstatus filtern"
        >
          <option value="all">Alle</option>
          <option value="overdue">Überfällig</option>
          <option value="due_soon">Demnächst fällig</option>
          <option value="ok">In Ordnung</option>
          <option value="none">Keine Wartung</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">BV-Anzahl</span>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={filterBvMin}
            onChange={(e) => setFilterBvMin(e.target.value)}
            className="w-20 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            aria-label="Mindestanzahl BVs"
          />
          <span className="text-slate-500">–</span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            value={filterBvMax}
            onChange={(e) => setFilterBvMax(e.target.value)}
            className="w-20 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            aria-label="Maximalanzahl BVs"
          />
        </div>
      </label>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline"
          aria-label="Filter zurücksetzen"
        >
          Filter zurücksetzen
        </button>
      )}
    </div>
  </div>
)
