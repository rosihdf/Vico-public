import { useState, useEffect, useCallback } from 'react'
import {
  fetchLicenseStatus,
  fetchLicenseRow,
  updateLicense,
  type LicenseStatus,
  type LicenseUpdate,
} from '../lib/licenseService'

const TIER_OPTIONS = ['free', 'professional', 'enterprise'] as const
const FEATURE_KEYS = ['kundenportal', 'historie'] as const

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

const Lizenz = () => {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [row, setRow] = useState<{ id: string; tier: string; valid_until: string | null; max_customers: number | null; max_users: number | null; features: Record<string, boolean> } | null>(null)
  const [form, setForm] = useState<LicenseUpdate>({
    tier: 'professional',
    valid_until: null,
    max_customers: null,
    max_users: null,
    features: { kundenportal: false, historie: false },
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setMessage(null)
    setLoadError(null)
    try {
      const timeoutMs = 8000
      const fetchWithTimeout = async <T,>(fn: () => Promise<T>): Promise<T> => {
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Zeitüberschreitung. Supabase-Verbindung prüfen.')), timeoutMs)
          ),
        ])
        return result
      }
      const [statusData, rowData] = await Promise.all([
        fetchWithTimeout(fetchLicenseStatus),
        fetchWithTimeout(fetchLicenseRow),
      ])
      setLoadError(null)
      setStatus(statusData)
      setRow(rowData)
      if (rowData) {
        setForm({
          tier: rowData.tier,
          valid_until: rowData.valid_until,
          max_customers: rowData.max_customers,
          max_users: rowData.max_users,
          features: rowData.features ?? {},
        })
      } else if (statusData) {
        setForm({
          tier: statusData.tier,
          valid_until: statusData.valid_until,
          max_customers: statusData.max_customers,
          max_users: statusData.max_users,
          features: statusData.features ?? {},
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Laden fehlgeschlagen.'
      setLoadError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!isLoading) return
    const safetyTimer = setTimeout(() => {
      setIsLoading(false)
      setLoadError('Laden dauert zu lange. Supabase-Verbindung und Lizenz-Tabelle prüfen.')
    }, 12000)
    return () => clearTimeout(safetyTimer)
  }, [isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!row) return
    setIsSaving(true)
    setMessage(null)
    const result = await updateLicense(row.id, form)
    setIsSaving(false)
    if (result.ok) {
      setShowSuccessDialog(true)
      load()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Speichern fehlgeschlagen.' })
    }
  }

  const handleTierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((f) => ({ ...f, tier: e.target.value }))
  }

  const handleValidUntilChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setForm((f) => ({ ...f, valid_until: v ? v : null }))
  }

  const handleUnlimitedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setForm((f) => ({
      ...f,
      valid_until: checked ? null : (f.valid_until || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    }))
  }

  const isUnlimited = form.valid_until === null

  const handleMaxCustomersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setForm((f) => ({ ...f, max_customers: v === '' ? null : parseInt(v, 10) }))
  }

  const handleMaxUsersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setForm((f) => ({ ...f, max_users: v === '' ? null : parseInt(v, 10) }))
  }

  const handleFeatureChange = (key: string, checked: boolean) => {
    setForm((f) => ({ ...f, features: { ...f.features, [key]: checked } }))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Lade Lizenzdaten…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Lizenz verwalten</h2>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800" role="alert">
          <p className="font-medium mb-1">Laden fehlgeschlagen</p>
          <p className="text-sm">{loadError}</p>
          <p className="text-sm mt-2 text-red-600">
            Prüfen Sie: Supabase-Verbindung, ob die Tabelle <code className="bg-red-100 px-1 rounded">license</code> und die RPC <code className="bg-red-100 px-1 rounded">get_license_status</code> existieren (supabase-complete.sql ausführen).
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-4 px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover transition-colors"
          >
            Erneut laden
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Lizenz verwalten</h2>

      {message && message.type === 'error' && (
        <div
          className="mb-8 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800"
          role="alert"
        >
          {message.text}
        </div>
      )}

      {showSuccessDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 id="success-dialog-title" className="text-lg font-semibold text-slate-800 mb-2">
              Lizenz erfolgreich geändert
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Die Lizenz wurde gespeichert.
            </p>
            <button
              type="button"
              onClick={() => setShowSuccessDialog(false)}
              className="w-full px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover transition-colors"
              aria-label="Dialog schließen"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {status && (
        <section className="mb-8 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Aktueller Stand</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-slate-500">Kunden</div>
            <div className="font-medium text-slate-800">
              {status.current_customers} / {status.max_customers ?? '∞'}
            </div>
            <div className="text-slate-500">Benutzer</div>
            <div className="font-medium text-slate-800">
              {status.current_users} / {status.max_users ?? '∞'}
            </div>
            <div className="text-slate-500">Gültig</div>
            <div className={`font-medium ${status.expired ? 'text-red-600' : 'text-slate-800'}`}>
              {status.expired ? 'Abgelaufen' : 'Ja'}
            </div>
          </div>
        </section>
      )}

      {!row && status && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          Keine Lizenzzeile in der Datenbank. Bitte <code className="bg-amber-100 px-1 rounded">supabase-complete.sql</code> im Supabase SQL Editor ausführen (enthält INSERT für die Standard-Lizenz).
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Lizenz bearbeiten</h3>

        <div>
          <label htmlFor="tier" className="block text-sm font-medium text-slate-700 mb-1">
            Tier
          </label>
          <select
            id="tier"
            value={form.tier}
            onChange={handleTierChange}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
          >
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Gültig bis
          </label>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isUnlimited}
              onChange={handleUnlimitedChange}
              className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              aria-label="Unbegrenzt"
            />
            <span className="text-sm text-slate-700">Unbegrenzt</span>
          </label>
          <input
            id="valid_until"
            type="date"
            value={formatDate(form.valid_until)}
            onChange={handleValidUntilChange}
            disabled={isUnlimited}
            className={`w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary focus:border-vico-primary ${isUnlimited ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
          />
        </div>

        <div>
          <label htmlFor="max_customers" className="block text-sm font-medium text-slate-700 mb-1">
            Max. Kunden (leer = unbegrenzt)
          </label>
          <input
            id="max_customers"
            type="number"
            min={0}
            value={form.max_customers ?? ''}
            onChange={handleMaxCustomersChange}
            placeholder="z.B. 50"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
          />
        </div>

        <div>
          <label htmlFor="max_users" className="block text-sm font-medium text-slate-700 mb-1">
            Max. Benutzer (leer = unbegrenzt)
          </label>
          <input
            id="max_users"
            type="number"
            min={0}
            value={form.max_users ?? ''}
            onChange={handleMaxUsersChange}
            placeholder="z.B. 10"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-slate-700 mb-2">Features</span>
          <div className="space-y-2">
            {FEATURE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.features?.[key] ?? false}
                  onChange={(e) => handleFeatureChange(key, e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                <span className="text-sm text-slate-700 capitalize">{key}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving || !row}
          className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Speichern…' : 'Speichern'}
        </button>
      </form>
    </div>
  )
}

export default Lizenz
