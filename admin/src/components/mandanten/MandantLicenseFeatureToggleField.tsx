import { MandantFeatureToggleList, type MandantFeatureToggleListProps } from './MandantFeatureToggleList'

export type MandantLicenseFeatureToggleFieldProps = MandantFeatureToggleListProps

export function MandantLicenseFeatureToggleField(props: MandantLicenseFeatureToggleFieldProps) {
  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 mb-2">Features</span>
      <MandantFeatureToggleList {...props} />
    </div>
  )
}
