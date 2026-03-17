import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { fetchLimitExceededLog, type LimitExceededEntry } from '../lib/licensePortalService'

const Grenzueberschreitungen = () => {
  const [searchParams] = useSearchParams()
  const filterTenantId = searchParams.get('tenant_id')
  const [entries, setEntries] = useState<LimitExceededEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filteredEntries = useMemo(() => {
    if (!filterTenantId) return entries
    return entries.filter((e) => e.tenant_id === filterTenantId)
  }, [entries, filterTenantId])

  const hasMultipleDomainsPerLicense = useMemo(() => {
    const byLicense = new Map<string, Set<string>>()
    for (const e of filteredEntries) {
      const key = e.license_id ?? e.license_number ?? e.id
      if (!byLicense.has(key)) byLicense.set(key, new Set())
      if (e.reported_from?.trim()) byLicense.get(key)!.add(e.reported_from.trim())
    }
    return [...byLicense.values()].some((s) => s.size > 1)
  }, [filteredEntries])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const loadStart = performance.now()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20_000)
      const data = await fetchLimitExceededLog(controller.signal)
      clearTimeout(timeoutId)
      setEntries(data)
      console.info(`[Lizenzportal] Grenzueberschreitungen load: ${Math.round(performance.now() - loadStart)}ms`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Laden fehlgeschlagen.'
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

  const limitTypeLabel = (t: string) => (t === 'users' ? 'Benutzer' : t === 'customers' ? 'Kunden' : t)
  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return s
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Grenzüberschreitungen</h2>
      <p className="text-sm text-slate-600 mb-4">
        Meldungen von Mandanten-Apps, wenn Benutzer- oder Kunden-Limit erreicht wurde.
        {hasMultipleDomainsPerLicense && (
          <span className="block mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm" role="alert">
            ⚠️ Mehrere unterschiedliche Domains melden für dieselbe Lizenz – mögliche Doppelnutzung.
          </span>
        )}
        {filterTenantId && (
          <span className="block mt-2">
            Gefiltert nach Mandant. <Link to="/grenzueberschreitungen" className="text-vico-primary hover:underline">Filter aufheben</Link>
          </span>
        )}
      </p>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800" role="alert">
          <p className="font-medium mb-1">Laden fehlgeschlagen</p>
          <p className="text-sm">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 hover:bg-red-200 text-red-800"
          >
            Erneut versuchen
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <p className="text-sm text-slate-500 py-8">
          {filterTenantId ? 'Keine Meldungen für diesen Mandanten.' : 'Keine Meldungen.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((e) => (
            <div
              key={e.id}
              className="p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <span className="font-medium text-slate-800">
                  {(e.tenants as { name?: string } | null)?.name ?? 'Unbekannt'}
                </span>
                <span className="text-slate-500 ml-2">
                  {limitTypeLabel(e.limit_type)}: {e.current_value} / {e.max_value}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {e.license_number && (
                  <span className="font-mono text-slate-600">{e.license_number}</span>
                )}
                {e.reported_from && (
                  <span className="text-slate-500" title="Domain der Meldung">{e.reported_from}</span>
                )}
                <span className="text-slate-500">{formatDate(e.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Grenzueberschreitungen
