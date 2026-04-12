import { useMemo } from 'react'
import type { Tenant } from '../lib/tenantService'
import { MIN_TENANTS_BULK_CONFIRM_ALL } from '../constants/rolloutAssistant'

export type RolloutScopeMode = 'all' | 'pick' | 'test'

type RolloutTenantScopeProps = {
  tenants: Tenant[]
  loading: boolean
  loadError: string | null
  scopeMode: RolloutScopeMode
  onScopeModeChange: (m: RolloutScopeMode) => void
  picked: Set<string>
  onTogglePick: (tenantId: string) => void
  onPickAll: () => void
  onPickNone: () => void
  sectionTitle?: string
}

const RolloutTenantScope = ({
  tenants,
  loading,
  loadError,
  scopeMode,
  onScopeModeChange,
  picked,
  onTogglePick,
  onPickAll,
  onPickNone,
  sectionTitle = 'Mandanten',
}: RolloutTenantScopeProps) => {
  const testTenants = useMemo(() => tenants.filter((t) => Boolean(t.is_test_mandant)), [tenants])

  const effectiveCount = useMemo(() => {
    if (scopeMode === 'all') return tenants.length
    if (scopeMode === 'test') return testTenants.length
    return picked.size
  }, [scopeMode, tenants.length, testTenants.length, picked.size])

  if (loading) {
    return <p className="text-sm text-slate-500">Lade Mandanten…</p>
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2" role="alert">
        {loadError}
      </div>
    )
  }

  if (tenants.length === 0) {
    return <p className="text-sm text-slate-500">Keine Mandanten vorhanden.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-800">{sectionTitle}</p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700 sr-only">Umfang Mandanten</legend>
        <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-700">
          <input
            type="radio"
            name="rollout-tenant-scope"
            checked={scopeMode === 'all'}
            onChange={() => onScopeModeChange('all')}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Alle Mandanten</span>
            <span className="block text-xs text-slate-500">({tenants.length})</span>
            {scopeMode === 'all' && tenants.length >= MIN_TENANTS_BULK_CONFIRM_ALL ? (
              <span className="block text-xs text-amber-800 mt-0.5">
                Ab {MIN_TENANTS_BULK_CONFIRM_ALL} Mandanten: zusätzliche Bestätigung vor dem Lauf (D6).
              </span>
            ) : null}
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-700">
          <input
            type="radio"
            name="rollout-tenant-scope"
            checked={scopeMode === 'pick'}
            onChange={() => onScopeModeChange('pick')}
            className="mt-1"
          />
          <span className="font-medium">Auswahl</span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-700">
          <input
            type="radio"
            name="rollout-tenant-scope"
            checked={scopeMode === 'test'}
            onChange={() => onScopeModeChange('test')}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Nur Testmandanten</span>
            <span className="block text-xs text-slate-500">({testTenants.length})</span>
          </span>
        </label>
      </fieldset>

      {scopeMode === 'pick' ? (
        <div className="border border-slate-200 rounded-lg p-3 max-h-56 overflow-y-auto space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={onPickAll}
              className="text-vico-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-vico-primary rounded"
            >
              Alle anhaken
            </button>
            <button
              type="button"
              onClick={onPickNone}
              className="text-slate-600 font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
            >
              Keine
            </button>
          </div>
          <ul className="space-y-1.5">
            {tenants.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={picked.has(t.id)}
                    onChange={() => onTogglePick(t.id)}
                    className="rounded border-slate-300"
                    aria-label={`Mandant ${t.name}`}
                  />
                  <span className="min-w-0 truncate">{t.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 pt-1">{picked.size} ausgewählt</p>
        </div>
      ) : null}

      {scopeMode === 'test' && testTenants.length === 0 ? (
        <p className="text-xs text-amber-800">Kein Mandant mit Test-Kennzeichnung – bitte anderen Umfang wählen.</p>
      ) : (
        <p className="text-xs text-slate-500">Im Lauf enthalten: {effectiveCount} Mandant(e).</p>
      )}
    </div>
  )
}

export const getEffectiveTenantsForRollout = (
  tenants: Tenant[],
  scopeMode: RolloutScopeMode,
  picked: Set<string>
): Tenant[] => {
  if (scopeMode === 'all') return tenants
  if (scopeMode === 'test') return tenants.filter((t) => Boolean(t.is_test_mandant))
  return tenants.filter((t) => picked.has(t.id))
}

export default RolloutTenantScope
