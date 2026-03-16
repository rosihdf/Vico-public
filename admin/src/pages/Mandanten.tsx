import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchTenants, deleteTenant, type Tenant } from '../lib/tenantService'
import { fetchLicenses, fetchLimitExceededLog, type LicenseWithTenant, type LimitExceededEntry } from '../lib/licensePortalService'
import { exportTenantData, downloadTenantExport } from '../lib/exportService'

const prefetchMandantForm = () => {
  import('./MandantForm')
}

const SupabaseConnectionHint = () => {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const projectRef = url.match(/https:\/\/([a-zA-Z0-9-]+)\.supabase\.co/)?.[1] ?? null
  return (
    <p className="text-xs mt-2 text-red-600">
      Verbunden mit: {projectRef ? `${projectRef}.supabase.co` : '(nicht konfiguriert)'}
      {projectRef && ' — Stimmt das mit dem Lizenzportal-Projekt überein?'}
    </p>
  )
}

const licensesByTenant = (licenses: LicenseWithTenant[]): Map<string, LicenseWithTenant[]> => {
  const map = new Map<string, LicenseWithTenant[]>()
  for (const lic of licenses) {
    const list = map.get(lic.tenant_id) ?? []
    list.push(lic)
    map.set(lic.tenant_id, list)
  }
  return map
}

const latestByTenant = (entries: LimitExceededEntry[]): Map<string, LimitExceededEntry[]> => {
  const byTenant = new Map<string, LimitExceededEntry[]>()
  for (const e of entries) {
    if (!e.tenant_id) continue
    const list = byTenant.get(e.tenant_id) ?? []
    const hasType = list.some((x) => x.limit_type === e.limit_type)
    if (!hasType) list.push(e)
    byTenant.set(e.tenant_id, list)
  }
  return byTenant
}

const limitTypeLabel = (t: string) => (t === 'users' ? 'Benutzer' : t === 'customers' ? 'Kunden' : t)
const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return s
  }
}

const Mandanten = () => {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [licenses, setLicenses] = useState<LicenseWithTenant[]>([])
  const [limitExceededEntries, setLimitExceededEntries] = useState<LimitExceededEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const licensesMap = useMemo(() => licensesByTenant(licenses), [licenses])
  const statusByTenant = useMemo(() => latestByTenant(limitExceededEntries), [limitExceededEntries])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const loadStart = performance.now()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20_000)
      const [tenantsData, licensesData, logData] = await Promise.all([
        fetchTenants(controller.signal),
        fetchLicenses(controller.signal),
        fetchLimitExceededLog(controller.signal),
      ])
      clearTimeout(timeoutId)
      setTenants(tenantsData)
      setLicenses(licensesData)
      setLimitExceededEntries(logData)
      console.info(`[Lizenzportal] Mandanten load: ${Math.round(performance.now() - loadStart)}ms`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Laden fehlgeschlagen. Supabase-Verbindung prüfen.'
      setError(
        msg === 'The user aborted a request.'
          ? 'Zeitüberschreitung beim Laden. Supabase möglicherweise pausiert oder langsam. Bitte erneut versuchen.'
          : msg
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleExport = async (t: Tenant) => {
    setExportingId(t.id)
    const exportStart = performance.now()
    try {
      const data = await exportTenantData(t.id)
      downloadTenantExport(t.name, data)
      console.info(`[Lizenzportal] Export Mandant: ${Math.round(performance.now() - exportStart)}ms`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen')
    } finally {
      setExportingId(null)
    }
  }

  const handleDelete = async (t: Tenant) => {
    if (!confirm(`Mandant „${t.name}“ wirklich löschen? Alle zugehörigen Lizenzen werden ebenfalls gelöscht.`)) return
    setDeletingId(t.id)
    setError(null)
    const result = await deleteTenant(t.id)
    setDeletingId(null)
    if (result.ok) {
      load()
    } else {
      setError(result.error ?? 'Löschen fehlgeschlagen')
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-800">Mandanten</h2>
        <Link
          to="/mandanten/neu"
          className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover transition-colors"
          aria-label="Neuen Mandanten anlegen"
          onMouseEnter={prefetchMandantForm}
        >
          Neuer Mandant
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Lade Mandanten…</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800" role="alert">
          <p className="font-medium mb-1">Laden fehlgeschlagen</p>
          <p className="text-sm font-mono break-all">{error}</p>
          <p className="text-sm mt-2 text-red-600">
            Tabellen vorhanden? → Prüfen: Profil mit <code className="bg-red-100 px-1 rounded">role=admin</code> in <code className="bg-red-100 px-1 rounded">profiles</code> für Ihre User-ID.
          </p>
          <SupabaseConnectionHint />
          <button
            type="button"
            onClick={load}
            className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 hover:bg-red-200 text-red-800"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {!isLoading && tenants.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-600">
          Noch keine Mandanten. <Link to="/mandanten/neu" className="text-vico-primary hover:underline">Ersten anlegen</Link>
        </div>
      ) : !isLoading && tenants.length > 0 ? (
        <div className="space-y-3">
          {tenants.map((t) => {
            const tenantLicenses = licensesMap.get(t.id) ?? []
            const primaryLicense = tenantLicenses[0]
            const expired = primaryLicense?.valid_until ? new Date(primaryLicense.valid_until) < new Date() : false
            return (
              <div
                key={t.id}
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${primaryLicense && expired ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200'}`}
                onMouseEnter={prefetchMandantForm}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-slate-800 truncate">{t.name}</h3>
                  <p className="text-sm text-slate-500 truncate">
                    {t.app_domain || '–'} · {t.portal_domain || '–'}
                  </p>
                  {primaryLicense ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-600">{primaryLicense.license_number}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                      >
                        {expired ? 'Abgelaufen' : 'Gültig'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {primaryLicense.valid_until ? new Date(primaryLicense.valid_until).toLocaleDateString('de-DE') : 'Unbegrenzt'} · {primaryLicense.tier}
                      </span>
                      {tenantLicenses.length > 1 && (
                        <span className="text-xs text-slate-400">+{tenantLicenses.length - 1} weitere</span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-600">Keine Lizenz</p>
                  )}
                  {(() => {
                    const statusEntries = statusByTenant.get(t.id) ?? []
                    if (statusEntries.length === 0) return null
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        {statusEntries.map((e) => (
                          <span key={e.id}>
                            {limitTypeLabel(e.limit_type)}: {e.current_value}/{e.max_value} ({formatDate(e.created_at)})
                          </span>
                        ))}
                        <Link
                          to={`/grenzueberschreitungen?tenant_id=${t.id}`}
                          className="text-vico-primary hover:underline"
                        >
                          Grenzüberschreitungen anzeigen
                        </Link>
                      </div>
                    )
                  })()}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleExport(t)}
                    disabled={exportingId === t.id}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                    title="Daten exportieren (JSON, z.B. bei Kündigung)"
                    aria-label="Daten exportieren"
                  >
                    {exportingId === t.id ? 'Export…' : 'Export'}
                  </button>
                  <Link
                    to={`/mandanten/${t.id}`}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Bearbeiten
                  </Link>
                  <Link
                    to={`/mandanten/${t.id}`}
                    state={
                      tenantLicenses.length === 0
                        ? { openCreateLicense: true }
                        : { editLicenseId: primaryLicense.id }
                    }
                    className="px-3 py-1.5 text-sm font-medium text-vico-primary hover:bg-vico-primary/10 rounded-lg transition-colors"
                    aria-label={tenantLicenses.length === 0 ? 'Lizenz anlegen' : 'Lizenz bearbeiten'}
                  >
                    {tenantLicenses.length === 0 ? 'Lizenz anlegen' : 'Lizenz bearbeiten'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    disabled={deletingId === t.id}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    {deletingId === t.id ? 'Löschen…' : 'Löschen'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default Mandanten
