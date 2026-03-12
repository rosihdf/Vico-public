import { useState, useEffect } from 'react'
import { useNavigate, useParams, useMatch } from 'react-router-dom'
import {
  fetchLicenseModel,
  createLicenseModel,
  updateLicenseModel,
  type LicenseModelInsert,
} from '../lib/licensePortalService'

const TIER_OPTIONS = ['free', 'professional', 'enterprise'] as const
const CHECK_INTERVAL_OPTIONS = ['on_start', 'daily', 'weekly'] as const
const FEATURE_KEYS = ['kundenportal', 'historie', 'arbeitszeiterfassung'] as const

const DEFAULT_FORM: LicenseModelInsert & { sort_order: number } = {
  name: '',
  tier: 'professional',
  max_users: null,
  max_customers: null,
  check_interval: 'daily',
  features: { kundenportal: false, historie: false, arbeitszeiterfassung: false },
  sort_order: 0,
}

const ensureFeatures = (f: Record<string, boolean> | undefined): Record<string, boolean> => {
  const base: Record<string, boolean> = {}
  for (const k of FEATURE_KEYS) {
    base[k] = f?.[k] ?? false
  }
  return base
}

const LizenzmodellForm = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNewRoute = useMatch('/lizenzmodelle/neu')
  const isNew = isNewRoute !== null || id === 'neu'
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)

  useEffect(() => {
    if (isNew) return
    const load = async () => {
      if (!id) return
      setIsLoading(true)
      setError(null)
      try {
        const m = await fetchLicenseModel(id)
        if (m) {
          setForm({
            name: m.name,
            tier: m.tier,
            max_users: m.max_users,
            max_customers: m.max_customers,
            check_interval: m.check_interval ?? 'daily',
            features: ensureFeatures(m.features),
            sort_order: m.sort_order ?? 0,
          })
        } else {
          setError('Lizenzmodell nicht gefunden.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id, isNew])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Name ist erforderlich.')
      return
    }
    setError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      const payload: LicenseModelInsert = {
        name: form.name.trim(),
        tier: form.tier,
        max_users: form.max_users,
        max_customers: form.max_customers,
        check_interval: form.check_interval,
        features: form.features,
        sort_order: form.sort_order,
      }
      if (isNew) {
        const result = await createLicenseModel(payload)
        if ('error' in result) {
          setError(result.error)
          return
        }
        setSuccessMessage('Lizenzmodell angelegt.')
        navigate(`/lizenzmodelle/${result.id}`, { replace: true })
      } else if (id) {
        const result = await updateLicenseModel(id, payload)
        if (result.ok) {
          setSuccessMessage('Lizenzmodell gespeichert.')
        } else {
          setError(result.error ?? 'Speichern fehlgeschlagen')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Lade Lizenzmodell…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        {isNew ? 'Neues Lizenzmodell' : 'Lizenzmodell bearbeiten'}
      </h2>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800" role="alert">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800" role="status">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
            Name *
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="z.B. Professional"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tier</label>
            <select
              value={form.tier}
              onChange={(e) =>
                setForm((f) => ({ ...f, tier: e.target.value as (typeof TIER_OPTIONS)[number] }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sortierung</label>
            <input
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) =>
                setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max. Benutzer</label>
            <input
              type="number"
              min={0}
              value={form.max_users ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_users: e.target.value === '' ? null : parseInt(e.target.value, 10),
                }))
              }
              placeholder="∞"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max. Kunden</label>
            <input
              type="number"
              min={0}
              value={form.max_customers ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_customers: e.target.value === '' ? null : parseInt(e.target.value, 10),
                }))
              }
              placeholder="∞"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prüfintervall</label>
          <select
            value={form.check_interval}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                check_interval: e.target.value as (typeof CHECK_INTERVAL_OPTIONS)[number],
              }))
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          >
            {CHECK_INTERVAL_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === 'on_start' ? 'Bei jedem Start' : t === 'daily' ? 'Täglich' : 'Wöchentlich'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-sm font-medium text-slate-700 mb-2">Features</span>
          <div className="flex flex-wrap gap-4">
            {FEATURE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.features?.[key] ?? false}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      features: { ...(f.features ?? {}), [key]: e.target.checked },
                    }))
                  }
                  className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                <span className="text-sm text-slate-700 capitalize">{key}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50"
          >
            {isSaving ? 'Speichern…' : 'Speichern'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/lizenzmodelle')}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}

export default LizenzmodellForm
