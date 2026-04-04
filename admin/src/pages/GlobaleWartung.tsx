import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateTenant } from '../lib/tenantService'

type TenantRow = {
  id: string
  name: string
}

const fromDatetimeLocal = (value: string): string | null => {
  if (!value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const GlobaleWartung = () => {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [maintenance_mode_enabled, setMaintenanceModeEnabled] = useState(false)
  const [maintenance_mode_message, setMaintenanceModeMessage] = useState('')
  const [maintenance_mode_duration_min, setMaintenanceModeDurationMin] = useState('')
  const [maintenance_mode_started_at, setMaintenanceModeStartedAt] = useState('')
  const [maintenance_mode_ends_at, setMaintenanceModeEndsAt] = useState('')
  const [maintenance_mode_auto_end, setMaintenanceModeAutoEnd] = useState(false)
  const [maintenance_mode_apply_main_app, setApplyMain] = useState(true)
  const [maintenance_mode_apply_arbeitszeit_portal, setApplyAz] = useState(true)
  const [maintenance_mode_apply_customer_portal, setApplyKp] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const { data, error: loadErr } = await supabase
      .from('tenants')
      .select('id, name')
      .order('name')
    if (loadErr) {
      setError(loadErr.message)
      setIsLoading(false)
      return
    }
    const rows = (data ?? []) as TenantRow[]
    setTenants(rows)
    const sel: Record<string, boolean> = {}
    for (const t of rows) sel[t.id] = false
    setSelected(sel)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const handleToggleAll = (on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) next[k] = on
      return next
    })
  }

  const handleApply = async () => {
    if (selectedIds.length === 0) {
      setError('Bitte mindestens einen Mandanten auswählen.')
      return
    }
    setIsSaving(true)
    setError(null)
    setMessage(null)
    const payload = {
      maintenance_mode_enabled,
      maintenance_mode_message: maintenance_mode_message.trim() || null,
      maintenance_mode_duration_min: maintenance_mode_duration_min
        ? Math.max(1, parseInt(maintenance_mode_duration_min, 10) || 0)
        : null,
      maintenance_mode_started_at: fromDatetimeLocal(maintenance_mode_started_at),
      maintenance_mode_ends_at: fromDatetimeLocal(maintenance_mode_ends_at),
      maintenance_mode_auto_end,
      maintenance_mode_apply_main_app,
      maintenance_mode_apply_arbeitszeit_portal,
      maintenance_mode_apply_customer_portal,
    }
    let fail = 0
    for (const id of selectedIds) {
      const r = await updateTenant(id, payload)
      if (!r.ok) fail++
    }
    setIsSaving(false)
    if (fail > 0) {
      setError(`${fail} Mandant(en) konnten nicht aktualisiert werden.`)
    } else {
      setMessage(`Wartungsmodus für ${selectedIds.length} Mandant(en) gespeichert.`)
    }
  }

  if (isLoading) {
    return (
      <main id="main-content" className="max-w-3xl mx-auto p-4">
        <p className="text-sm text-slate-600">Lade Mandanten…</p>
      </main>
    )
  }

  return (
    <main id="main-content" className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h1 className="text-xl font-bold text-slate-800">Globale Wartung (Mandanten)</h1>
        <Link to="/" className="text-sm text-vico-primary hover:underline">
          ← Mandanten
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        Hier legen Sie die <strong>Wartungsmodus</strong>-Felder einmal fest und wenden sie auf
        <strong> ausgewählte Mandanten</strong> an. Pro Mandant bleiben die Werte im Mandantenformular
        editierbar; dieses Formular überschreibt nur die markierten Konten beim Speichern.
      </p>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          {message}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Ziel-Mandanten</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
            onClick={() => handleToggleAll(true)}
          >
            Alle auswählen
          </button>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
            onClick={() => handleToggleAll(false)}
          >
            Keine
          </button>
        </div>
        <ul className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
          {tenants.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <input
                id={`tw-${t.id}`}
                type="checkbox"
                checked={Boolean(selected[t.id])}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [t.id]: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor={`tw-${t.id}`} className="text-sm text-slate-800 cursor-pointer flex-1">
                {t.name}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Werte (werden auf Auswahl kopiert)</h2>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={maintenance_mode_enabled}
            onChange={(e) => setMaintenanceModeEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-vico-primary"
          />
          <span>Wartungsmodus aktiv</span>
        </label>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Hinweistext</label>
          <input
            type="text"
            value={maintenance_mode_message}
            onChange={(e) => setMaintenanceModeMessage(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            placeholder="Wartungsarbeiten …"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Dauer (Min.)</label>
            <input
              type="number"
              min={1}
              value={maintenance_mode_duration_min}
              onChange={(e) => setMaintenanceModeDurationMin(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Start</label>
            <input
              type="datetime-local"
              value={maintenance_mode_started_at}
              onChange={(e) => setMaintenanceModeStartedAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Ende</label>
            <input
              type="datetime-local"
              value={maintenance_mode_ends_at}
              onChange={(e) => setMaintenanceModeEndsAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={maintenance_mode_auto_end}
            onChange={(e) => setMaintenanceModeAutoEnd(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
          />
          <span>Automatisch beenden nach Endzeit</span>
        </label>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Hinweis anzeigen in</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={maintenance_mode_apply_main_app}
              onChange={(e) => setApplyMain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Haupt-App
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={maintenance_mode_apply_arbeitszeit_portal}
              onChange={(e) => setApplyAz(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Arbeitszeitportal
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={maintenance_mode_apply_customer_portal}
              onChange={(e) => setApplyKp(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Kundenportal
          </label>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleApply()}
          className="px-4 py-2 rounded-lg bg-vico-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Speichern…' : `Auf ${selectedIds.length} Mandant(en) anwenden`}
        </button>
      </section>
    </main>
  )
}

export default GlobaleWartung
