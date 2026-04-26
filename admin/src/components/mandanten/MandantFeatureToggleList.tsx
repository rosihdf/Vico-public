import {
  LICENSE_FEATURE_DESCRIPTIONS,
  LICENSE_FEATURE_GROUPS,
  LICENSE_FEATURE_LABELS,
  applyFeatureToggleWithDependencies,
  getFeatureChildren,
  isFeatureToggleEnabled,
  type LicenseFeatureKey,
} from '../../../../shared/licenseFeatures'

export type MandantFeatureToggleListProps = {
  idPrefix: string
  features: Record<string, boolean>
  onFeaturesChange: (next: Record<string, boolean>) => void
}

export function MandantFeatureToggleList({ idPrefix, features, onFeaturesChange }: MandantFeatureToggleListProps) {
  return (
    <div className="space-y-4">
      {LICENSE_FEATURE_GROUPS.map((group) => (
        <div key={group.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <h5 className="text-sm font-semibold text-slate-800 mb-2">{group.label}</h5>
          <div className="space-y-2">
            {group.features.map((parentKey) => {
              const children = getFeatureChildren(parentKey)
              const parentInputId = `${idPrefix}-feature-${parentKey}`
              return (
                <div key={parentKey} className="space-y-1">
                  <label
                    htmlFor={parentInputId}
                    className="flex items-center gap-2 cursor-pointer"
                    title={LICENSE_FEATURE_DESCRIPTIONS[parentKey] ?? ''}
                  >
                    <input
                      id={parentInputId}
                      type="checkbox"
                      checked={features[parentKey] ?? false}
                      onChange={(e) =>
                        onFeaturesChange(
                          applyFeatureToggleWithDependencies(
                            features,
                            parentKey as LicenseFeatureKey,
                            e.target.checked,
                          ),
                        )
                      }
                      className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      {LICENSE_FEATURE_LABELS[parentKey] ?? parentKey}
                    </span>
                  </label>

                  {children.map((childKey) => {
                    const childEnabled = isFeatureToggleEnabled(features, childKey)
                    const childInputId = `${idPrefix}-feature-${childKey}`
                    return (
                      <label
                        key={childKey}
                        htmlFor={childInputId}
                        className={`ml-7 flex items-center gap-2 ${childEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                        title={LICENSE_FEATURE_DESCRIPTIONS[childKey] ?? ''}
                      >
                        <input
                          id={childInputId}
                          type="checkbox"
                          checked={features[childKey] ?? false}
                          disabled={!childEnabled}
                          onChange={(e) =>
                            onFeaturesChange(
                              applyFeatureToggleWithDependencies(
                                features,
                                childKey as LicenseFeatureKey,
                                e.target.checked,
                              ),
                            )
                          }
                          className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary disabled:opacity-60"
                        />
                        <span className="text-sm text-slate-700">
                          {LICENSE_FEATURE_LABELS[childKey] ?? childKey}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500">
        Abhängigkeiten sind gekoppelt: Elternmodul aus = Untermodule aus; Untermodul an = Elternmodul wird automatisch
        aktiviert.
      </p>
    </div>
  )
}
