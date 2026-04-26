import { AppButton } from './ui'

export type AuftragsdetailMonteurExistingReportsPanelProps = {
  show: boolean
  showPruefberichtButton: boolean
  pruefberichtDisabled: boolean
  pruefberichtLoading: boolean
  onViewPruefbericht: () => void
  monteurPdfPath: string | null | undefined
  monteurBerichtDisabled?: boolean
  monteurBerichtLoading?: boolean
  onViewMonteurBericht: () => void
}

export function AuftragsdetailMonteurExistingReportsPanel({
  show,
  showPruefberichtButton,
  pruefberichtDisabled,
  pruefberichtLoading,
  onViewPruefbericht,
  monteurPdfPath,
  monteurBerichtDisabled = false,
  monteurBerichtLoading = false,
  onViewMonteurBericht,
}: AuftragsdetailMonteurExistingReportsPanelProps) {
  if (!show) return null
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-900/40 p-3">
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Vorhandene Berichte ansehen</p>
      <div className="flex flex-wrap items-center gap-2">
        {showPruefberichtButton ? (
          <AppButton
            type="button"
            variant="outline"
            disabled={pruefberichtDisabled}
            onClick={onViewPruefbericht}
          >
            {pruefberichtLoading ? 'Prüfprotokoll lädt…' : 'Prüfbericht ansehen'}
          </AppButton>
        ) : null}
        {monteurPdfPath ? (
          <AppButton
            type="button"
            variant="outline"
            disabled={monteurBerichtDisabled}
            onClick={onViewMonteurBericht}
          >
            {monteurBerichtLoading ? 'Monteurbericht lädt…' : 'Monteurbericht ansehen'}
          </AppButton>
        ) : null}
      </div>
    </div>
  )
}
