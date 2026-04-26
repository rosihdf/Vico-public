export type AuftragsdetailMonteurPrimaryWorktimeComputedLineProps = {
  totalMin: number
}

export function AuftragsdetailMonteurPrimaryWorktimeComputedLine({
  totalMin,
}: AuftragsdetailMonteurPrimaryWorktimeComputedLineProps) {
  return (
    <p className="text-sm text-app-muted">Berechnete Zeit: {totalMin} Min. (inkl. weitere Monteure)</p>
  )
}
