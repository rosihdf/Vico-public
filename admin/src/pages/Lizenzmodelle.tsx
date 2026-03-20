import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchLicenseModels,
  deleteLicenseModel,
  type LicenseModel,
} from '../lib/licensePortalService'

const FEATURE_LABELS: Record<string, string> = {
  kundenportal: 'Kundenportal',
  historie: 'Historie',
  arbeitszeiterfassung: 'Arbeitszeiterfassung',
  standortabfrage: 'Standortabfrage',
}

const checkIntervalLabel = (v: string) =>
  v === 'on_start' ? 'Bei jedem Start' : v === 'daily' ? 'Täglich' : 'Wöchentlich'

const Lizenzmodelle = () => {
  const [models, setModels] = useState<LicenseModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const loadStart = performance.now()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20_000)
      const data = await fetchLicenseModels(controller.signal)
      clearTimeout(timeoutId)
      setModels(data)
      console.info(`[Lizenzportal] Lizenzmodelle load: ${Math.round(performance.now() - loadStart)}ms`)
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

  const handleDelete = async (m: LicenseModel) => {
    if (!confirm(`Lizenzmodell „${m.name}“ wirklich löschen?`)) return
    setDeletingId(m.id)
    setError(null)
    const result = await deleteLicenseModel(m.id)
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
        <h2 className="text-xl font-bold text-slate-800">Lizenzmodelle</h2>
        <Link
          to="/lizenzmodelle/neu"
          className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover transition-colors"
          aria-label="Neues Lizenzmodell anlegen"
        >
          Neues Lizenzmodell
        </Link>
      </div>

      <p className="text-sm text-slate-600 mb-6">
        Lizenzmodelle sind Vorlagen für Lizenzen. Beim Anlegen einer Lizenz für einen Mandanten kann ein Modell ausgewählt werden, um die Standardwerte zu übernehmen.
      </p>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Lade Lizenzmodelle…</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800" role="alert">
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
      )}

      {!isLoading && models.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-600">
          Noch keine Lizenzmodelle.{' '}
          <Link to="/lizenzmodelle/neu" className="text-vico-primary hover:underline">
            Erstes anlegen
          </Link>
        </div>
      ) : !isLoading && models.length > 0 ? (
        <div className="space-y-3">
          {models.map((m) => {
            const activeFeatures = m.features
              ? Object.entries(m.features)
                  .filter(([, v]) => v)
                  .map(([k]) => FEATURE_LABELS[k] ?? k)
              : []
            return (
              <div
                key={m.id}
                className="p-4 rounded-xl border bg-white border-slate-200 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-slate-800">{m.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Tier: {m.tier} · Prüfintervall: {checkIntervalLabel(m.check_interval)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span>Max. Benutzer: {m.max_users ?? '∞'}</span>
                    <span>Max. Kunden: {m.max_customers ?? '∞'}</span>
                    <span>Max. Speicher: {m.max_storage_mb != null ? `${m.max_storage_mb} MB` : '∞'}</span>
                    {activeFeatures.length > 0 && (
                      <span>Features: {activeFeatures.join(', ')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/lizenzmodelle/${m.id}`}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Bearbeiten
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    {deletingId === m.id ? 'Löschen…' : 'Löschen'}
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

export default Lizenzmodelle
