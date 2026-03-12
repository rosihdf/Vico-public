import { useState, useEffect } from 'react'
import { fetchLimitExceededLog, type LimitExceededEntry } from '../lib/licensePortalService'

const Grenzueberschreitungen = () => {
  const [entries, setEntries] = useState<LimitExceededEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      const data = await fetchLimitExceededLog()
      setEntries(data)
      setIsLoading(false)
    }
    load()
  }, [])

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
      </p>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 py-8">Keine Meldungen.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
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
