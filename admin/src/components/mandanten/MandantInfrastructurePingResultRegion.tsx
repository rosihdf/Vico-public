import type { InfrastructurePingResponse } from '../../lib/licensePortalService'
import { MandantInfrastructurePingResultPanel } from './MandantInfrastructurePingResultPanel'

export type MandantInfrastructurePingResultRegionProps = {
  layout: 'wizard' | 'edit'
  loading: boolean
  result: InfrastructurePingResponse | null
  idPrefix: string
}

export function MandantInfrastructurePingResultRegion({
  layout,
  loading,
  result,
  idPrefix,
}: MandantInfrastructurePingResultRegionProps) {
  const outerClassName =
    layout === 'wizard'
      ? 'rounded-lg border border-slate-200 bg-white/90 p-3'
      : 'rounded-md border border-slate-200 bg-white p-3'

  return (
    <div className={outerClassName} role="region" aria-label="Ergebnis Verbindungsprüfung">
      {layout === 'wizard' ? (
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Prüfergebnis</p>
      ) : null}
      <MandantInfrastructurePingResultPanel loading={loading} result={result} idPrefix={idPrefix} />
    </div>
  )
}
