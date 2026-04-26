import { AppButton, AppInput } from './ui'
import type { OrderCompletionExtraV1 } from '../types/orderCompletionExtra'

export type AuftragsdetailMonteurMaterialBlockProps = {
  materialLines: OrderCompletionExtraV1['material_lines']
  onAddRow: () => void
  onMaterialChange: (index: number, field: 'anzahl' | 'artikel', value: string) => void
}

export function AuftragsdetailMonteurMaterialBlock({
  materialLines,
  onAddRow,
  onMaterialChange,
}: AuftragsdetailMonteurMaterialBlockProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Material (pro Zeile)</span>
        <AppButton type="button" variant="outline" size="sm" onClick={onAddRow}>
          + Zeile
        </AppButton>
      </div>
      <ul className="space-y-2 min-w-0">
        {materialLines.map((row, i) => (
          <li
            key={i}
            className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2 w-full min-w-0"
          >
            <AppInput
              type="text"
              inputMode="decimal"
              value={row.anzahl}
              onChange={(e) => onMaterialChange(i, 'anzahl', e.target.value)}
              placeholder="Anzahl"
              className="w-full sm:w-24 sm:shrink-0 text-sm min-w-0"
              aria-label={`Material Anzahl ${i + 1}`}
            />
            <AppInput
              type="text"
              value={row.artikel}
              onChange={(e) => onMaterialChange(i, 'artikel', e.target.value)}
              placeholder="Artikel / Bezeichnung"
              className="w-full min-w-0 flex-1 text-sm"
              aria-label={`Material Artikel ${i + 1}`}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
