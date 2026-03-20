import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useMatch, useLocation } from 'react-router-dom'
import { fetchTenant, createTenant, updateTenant } from '../lib/tenantService'
import {
  fetchLicensesByTenant,
  createLicense,
  checkLicenseNumberExists,
  updateLicense,
  deleteLicense,
  generateLicenseNumber,
  fetchLicenseModels,
  fetchStorageSummary,
  type License,
  type LicenseUpdate,
  type LicenseModel,
  type LicenseWithModel,
} from '../lib/licensePortalService'

const TIER_OPTIONS = ['free', 'professional', 'enterprise'] as const
const CHECK_INTERVAL_OPTIONS = ['on_start', 'daily', 'weekly'] as const
const FEATURE_KEYS = ['kundenportal', 'historie', 'arbeitszeiterfassung', 'standortabfrage'] as const

const DEFAULT_CREATE_FORM: {
  license_number: string
  license_model_id: string | null
  tier: 'free' | 'professional' | 'enterprise'
  valid_until: string | null
  is_trial: boolean
  grace_period_days: number
  max_users: number | null
  max_customers: number | null
  max_storage_mb: number | null
  check_interval: 'on_start' | 'daily' | 'weekly'
  features: Record<string, boolean>
} = {
  license_number: '',
  license_model_id: null,
  tier: 'professional',
  valid_until: null,
  is_trial: false,
  grace_period_days: 0,
  max_users: null,
  max_customers: null,
  max_storage_mb: null,
  check_interval: 'daily',
  features: { kundenportal: false, historie: false, arbeitszeiterfassung: false, standortabfrage: false },
}

type LocationState = { editLicenseId?: string; openCreateLicense?: boolean } | null

const MandantForm = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as LocationState
  const isNewRoute = useMatch('/mandanten/neu')
  const isNew = isNewRoute !== null || id === 'neu'
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [tenantLicenses, setTenantLicenses] = useState<LicenseWithModel[]>([])
  const [showCreateLicense, setShowCreateLicense] = useState(false)
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null)
  const [deletingLicenseId, setDeletingLicenseId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM)
  const [editForm, setEditForm] = useState<LicenseUpdate>({})
  const [licenseModels, setLicenseModels] = useState<LicenseModel[]>([])

  const [form, setForm] = useState({
    name: '',
    app_domain: '',
    portal_domain: '',
    arbeitszeitenportal_domain: '',
    primary_color: '#5b7895',
    app_name: 'AMRtech',
    impressum_company_name: '',
    impressum_address: '',
    impressum_contact: '',
    datenschutz_responsible: '',
    datenschutz_contact_email: '',
    allowed_domains: '',
  })

  const loadLicenses = useCallback(async (tenantId: string) => {
    try {
      const data = await fetchLicensesByTenant(tenantId)
      setTenantLicenses(data)
    } catch {
      setTenantLicenses([])
    }
  }, [])

  // Bei neuem Mandanten nur Lizenzmodelle laden (für Dropdown „Neue Lizenz“).
  useEffect(() => {
    if (!isNew) return
    const load = async () => {
      try {
        const data = await fetchLicenseModels()
        setLicenseModels(data)
      } catch {
        setLicenseModels([])
      }
    }
    load()
  }, [isNew])

  // Beim Bearbeiten: Mandant, Lizenzen und Lizenzmodelle parallel laden (eine Roundtrip-Runde).
  useEffect(() => {
    if (isNew || !id) return
    const load = async () => {
      setIsLoading(true)
      setError(null)
      const loadStart = performance.now()
      try {
        const [t, licensesData, modelsData] = await Promise.all([
          fetchTenant(id),
          fetchLicensesByTenant(id),
          fetchLicenseModels(),
        ])
        if (t) {
          setForm({
            name: t.name ?? '',
            app_domain: t.app_domain ?? '',
            portal_domain: t.portal_domain ?? '',
            arbeitszeitenportal_domain: t.arbeitszeitenportal_domain ?? '',
            primary_color: t.primary_color ?? '#5b7895',
            app_name: t.app_name ?? 'AMRtech',
            impressum_company_name: t.impressum_company_name ?? '',
            impressum_address: t.impressum_address ?? '',
            impressum_contact: t.impressum_contact ?? '',
            datenschutz_responsible: t.datenschutz_responsible ?? '',
            datenschutz_contact_email: t.datenschutz_contact_email ?? '',
            allowed_domains: Array.isArray(t.allowed_domains)
              ? t.allowed_domains.join('\n')
              : (t.allowed_domains ? String(t.allowed_domains) : ''),
          })
        }
        setTenantLicenses(licensesData)
        setLicenseModels(modelsData ?? [])
        console.info(`[Lizenzportal] MandantForm load: ${Math.round(performance.now() - loadStart)}ms`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
        setTenantLicenses([])
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id, isNew])

  useEffect(() => {
    if (isNew || !id || !locationState) return
    if (locationState.openCreateLicense) {
      setShowCreateLicense(true)
      setCreateForm((f) => ({ ...f, license_number: f.license_number || generateLicenseNumber() }))
      navigate(location.pathname, { replace: true, state: undefined })
      return
    }
    if (locationState.editLicenseId && tenantLicenses.length > 0) {
      const lic = tenantLicenses.find((l) => l.id === locationState.editLicenseId)
      if (lic) {
        setEditingLicenseId(lic.id)
        setEditForm({
          tier: lic.tier,
          valid_until: lic.valid_until,
          max_users: lic.max_users,
          max_customers: lic.max_customers,
          max_storage_mb: lic.max_storage_mb,
          check_interval: lic.check_interval ?? 'daily',
          features: lic.features ?? {},
        })
      }
      navigate(location.pathname, { replace: true, state: undefined })
    }
  }, [locationState, tenantLicenses, isNew, id, navigate, location.pathname])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      if (isNew) {
        const result = await createTenant({
          name: form.name,
          app_domain: form.app_domain || null,
          portal_domain: form.portal_domain || null,
          arbeitszeitenportal_domain: form.arbeitszeitenportal_domain || null,
          allowed_domains: form.allowed_domains
            ? form.allowed_domains
                .split(/[\n,]/)
                .map((d) => d.trim().toLowerCase())
                .filter(Boolean)
            : [],
          primary_color: form.primary_color,
          app_name: form.app_name,
          impressum_company_name: form.impressum_company_name || null,
          impressum_address: form.impressum_address || null,
          impressum_contact: form.impressum_contact || null,
          datenschutz_responsible: form.datenschutz_responsible || null,
          datenschutz_contact_email: form.datenschutz_contact_email || null,
        })
        if ('id' in result) {
          navigate('/mandanten')
        } else {
          setError(result.error ?? 'Speichern fehlgeschlagen')
        }
      } else if (id) {
        const result = await updateTenant(id, {
          name: form.name,
          app_domain: form.app_domain || null,
          portal_domain: form.portal_domain || null,
          arbeitszeitenportal_domain: form.arbeitszeitenportal_domain || null,
          allowed_domains: form.allowed_domains
            ? form.allowed_domains
                .split(/[\n,]/)
                .map((d) => d.trim().toLowerCase())
                .filter(Boolean)
            : [],
          primary_color: form.primary_color,
          app_name: form.app_name,
          impressum_company_name: form.impressum_company_name || null,
          impressum_address: form.impressum_address || null,
          impressum_contact: form.impressum_contact || null,
          datenschutz_responsible: form.datenschutz_responsible || null,
          datenschutz_contact_email: form.datenschutz_contact_email || null,
        })
        if (result.ok) {
          navigate('/mandanten')
        } else {
          setError(result.error ?? 'Speichern fehlgeschlagen')
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !createForm.license_number.trim()) {
      setError('Lizenznummer ist erforderlich.')
      return
    }
    const exists = await checkLicenseNumberExists(createForm.license_number.trim())
    if (exists) {
      setError(`Lizenznummer „${createForm.license_number.trim()}“ ist bereits vergeben.`)
      return
    }
    if (createForm.max_storage_mb != null && createForm.max_storage_mb > 0) {
      const summary = await fetchStorageSummary()
      if (createForm.max_storage_mb > summary.remaining_mb) {
        setError(
          `Nicht genügend Speicher verfügbar. Frei: ${summary.remaining_mb.toLocaleString('de-DE')} MB, angefordert: ${createForm.max_storage_mb.toLocaleString('de-DE')} MB.`
        )
        return
      }
    }
    setError(null)
    const result = await createLicense({
      tenant_id: id,
      license_number: createForm.license_number.trim(),
      license_model_id: createForm.license_model_id,
      tier: createForm.tier,
      valid_until: createForm.valid_until || null,
      is_trial: createForm.is_trial,
      grace_period_days: createForm.grace_period_days,
      max_users: createForm.max_users,
      max_customers: createForm.max_customers,
      max_storage_mb: createForm.max_storage_mb,
      check_interval: createForm.check_interval,
      features: createForm.features,
    })
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSuccessMessage(`Lizenz ${result.license_number} wurde angelegt.`)
    setShowCreateLicense(false)
    setCreateForm({ ...DEFAULT_CREATE_FORM, license_number: generateLicenseNumber() })
    loadLicenses(id)
  }

  const handleStartTrial = async () => {
    if (!id) return
    const summary = await fetchStorageSummary()
    if (500 > summary.remaining_mb) {
      setError(
        `Nicht genügend Speicher für Trial (500 MB). Frei: ${summary.remaining_mb.toLocaleString('de-DE')} MB.`
      )
      return
    }
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)
    const validUntil = trialEnd.toISOString().slice(0, 10)
    const allFeatures = FEATURE_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>)
    setError(null)
    const result = await createLicense({
      tenant_id: id,
      license_number: generateLicenseNumber(),
      tier: 'professional',
      valid_until: validUntil,
      is_trial: true,
      grace_period_days: 0,
      max_users: 10,
      max_customers: 50,
      max_storage_mb: 500,
      check_interval: 'daily',
      features: allFeatures,
    })
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSuccessMessage(`Trial-Lizenz ${result.license_number} wurde angelegt (14 Tage, alle Module).`)
    loadLicenses(id)
  }

  const handleEditLicense = (lic: License) => {
    setEditingLicenseId(lic.id)
    setEditForm({
      tier: lic.tier,
      valid_until: lic.valid_until,
      grace_period_days: lic.grace_period_days ?? 0,
      max_users: lic.max_users,
      max_customers: lic.max_customers,
      max_storage_mb: lic.max_storage_mb,
      check_interval: lic.check_interval ?? 'daily',
      features: lic.features ?? {},
    })
  }

  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLicenseId || !id) return
    if (editForm.max_storage_mb != null && editForm.max_storage_mb > 0) {
      const summary = await fetchStorageSummary()
      const editingLic = tenantLicenses.find((l) => l.id === editingLicenseId)
      const currentMax = editingLic?.max_storage_mb ?? 0
      const availableForThis = summary.remaining_mb + currentMax
      if (editForm.max_storage_mb > availableForThis) {
        setError(
          `Nicht genügend Speicher verfügbar. Frei (inkl. aktueller Lizenz): ${availableForThis.toLocaleString('de-DE')} MB, angefordert: ${editForm.max_storage_mb.toLocaleString('de-DE')} MB.`
        )
        return
      }
    }
    setError(null)
    const result = await updateLicense(editingLicenseId, editForm)
    if (result.ok) {
      setSuccessMessage('Lizenz aktualisiert.')
      setEditingLicenseId(null)
      loadLicenses(id)
      navigate('/mandanten')
    } else {
      setError(result.error ?? 'Speichern fehlgeschlagen')
    }
  }

  const handleDeleteLicense = async (lic: License) => {
    if (!confirm(`Lizenz „${lic.license_number}“ wirklich löschen?`)) return
    setDeletingLicenseId(lic.id)
    setError(null)
    const result = await deleteLicense(lic.id)
    setDeletingLicenseId(null)
    if (result.ok) {
      setSuccessMessage('Lizenz gelöscht.')
      if (editingLicenseId === lic.id) setEditingLicenseId(null)
      if (id) loadLicenses(id)
    } else {
      setError(result.error ?? 'Löschen fehlgeschlagen')
    }
  }

  const handleOpenCreateLicense = () => {
    setShowCreateLicense(true)
    setCreateForm((f) => ({ ...f, license_number: f.license_number || generateLicenseNumber() }))
  }

  const handleApplyLicenseModel = (model: LicenseModel) => {
    setCreateForm((f) => ({
      ...f,
      license_model_id: model.id,
      tier: (model.tier as 'free' | 'professional' | 'enterprise') ?? f.tier,
      max_users: model.max_users,
      max_customers: model.max_customers,
      max_storage_mb: model.max_storage_mb,
      check_interval: (model.check_interval as 'on_start' | 'daily' | 'weekly') ?? f.check_interval,
      features: { ...f.features, ...(model.features ?? {}) },
    }))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Lade Mandant…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        {isNew ? 'Neuer Mandant' : 'Mandant bearbeiten'}
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

      {!isNew && id && (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Lizenzen & Lizenzstatus</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStartTrial}
                className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
              >
                Trial starten (14 Tage)
              </button>
              <button
                type="button"
                onClick={handleOpenCreateLicense}
                className="px-3 py-1.5 text-sm font-medium text-vico-primary hover:bg-vico-primary/10 rounded-lg transition-colors"
              >
                Lizenz anlegen
              </button>
            </div>
          </div>

          {showCreateLicense && (
            <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Neue Lizenz anlegen</h4>
              {licenseModels.length > 0 && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vorlage aus Lizenzmodell</label>
                  <select
                    value={createForm.license_model_id ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      if (!val) {
                        setCreateForm((f) => ({ ...f, license_model_id: null }))
                        return
                      }
                      const model = licenseModels.find((m) => m.id === val)
                      if (model) handleApplyLicenseModel(model)
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                    aria-label="Lizenzmodell auswählen"
                  >
                    <option value="">— Kein Modell —</option>
                    {licenseModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tier})
                      </option>
                    ))}
                  </select>
                  {createForm.license_model_id && (
                    <p className="mt-1 text-xs text-slate-500">
                      Vorlage: {licenseModels.find((m) => m.id === createForm.license_model_id)?.name ?? '–'}
                    </p>
                  )}
                </div>
              )}
              <form onSubmit={handleCreateLicense} className="space-y-3">
                <div>
                  <label htmlFor="create-license-number" className="block text-sm font-medium text-slate-700 mb-1">Lizenznummer *</label>
                  <div className="flex gap-2">
                    <input
                      id="create-license-number"
                      type="text"
                      value={createForm.license_number}
                      onChange={(e) => setCreateForm((f) => ({ ...f, license_number: e.target.value }))}
                      placeholder="VIC-XXXX-XXXX"
                      required
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateForm((f) => ({ ...f, license_number: generateLicenseNumber() }))}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                    >
                      Generieren
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tier</label>
                    <select
                      value={createForm.tier}
                      onChange={(e) => setCreateForm((f) => ({ ...f, tier: e.target.value as 'free' | 'professional' | 'enterprise' }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                    >
                      {TIER_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gültig bis</label>
                    <input
                      type="date"
                      value={createForm.valid_until ?? ''}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          valid_until: e.target.value || null,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                    />
                    <label className="mt-1 inline-flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={createForm.valid_until === null}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCreateForm((f) => ({ ...f, valid_until: null }))
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                      />
                      <span>Unbegrenzt (kein Ablaufdatum)</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Schonfrist (Tage)</label>
                    <input
                      type="number"
                      min={0}
                      value={createForm.grace_period_days}
                      onChange={(e) => setCreateForm((f) => ({ ...f, grace_period_days: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                    />
                    <p className="mt-0.5 text-xs text-slate-500">Nach Ablauf: so viele Tage Nur-Lesen, danach Redirect zur Aktivierung.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max. Benutzer</label>
                    <input
                      type="number"
                      min={0}
                      value={createForm.max_users ?? ''}
                      onChange={(e) => setCreateForm((f) => ({ ...f, max_users: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                      placeholder="∞"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max. Kunden</label>
                    <input
                      type="number"
                      min={0}
                      value={createForm.max_customers ?? ''}
                      onChange={(e) => setCreateForm((f) => ({ ...f, max_customers: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                      placeholder="∞"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max. Speicher (MB)</label>
                    <input
                      type="number"
                      min={0}
                      value={createForm.max_storage_mb ?? ''}
                      onChange={(e) => setCreateForm((f) => ({ ...f, max_storage_mb: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                      placeholder="∞"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prüfintervall</label>
                  <select
                    value={createForm.check_interval}
                    onChange={(e) => setCreateForm((f) => ({ ...f, check_interval: e.target.value as 'on_start' | 'daily' | 'weekly' }))}
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
                          checked={createForm.features[key] ?? false}
                          onChange={(e) => setCreateForm((f) => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))}
                          className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                        />
                        <span className="text-sm text-slate-700 capitalize">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover"
                  >
                    Lizenz anlegen
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateLicense(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          )}

          {tenantLicenses.length === 0 && !showCreateLicense ? (
            <p className="text-sm text-slate-500 mb-2">Noch keine Lizenzen. Klicken Sie auf „Lizenz anlegen“.</p>
          ) : (
            <div className="space-y-4">
              {tenantLicenses.map((lic) => {
                const expired = lic.valid_until ? new Date(lic.valid_until) < new Date() : false
                const activeFeatures = lic.features ? Object.entries(lic.features).filter(([, v]) => v).map(([k]) => k) : []
                const checkIntervalLabel = lic.check_interval === 'on_start' ? 'Bei jedem Start' : lic.check_interval === 'daily' ? 'Täglich' : 'Wöchentlich'
                const isEditing = editingLicenseId === lic.id

                return (
                  <div
                    key={lic.id}
                    className={`p-4 rounded-xl border ${expired ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}
                  >
                    {isEditing ? (
                      <form onSubmit={handleUpdateLicense} className="space-y-3">
                        <h4 className="font-mono font-medium text-slate-800">{lic.license_number}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tier</label>
                            <select
                              value={editForm.tier}
                              onChange={(e) => setEditForm((f) => ({ ...f, tier: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                            >
                              {TIER_OPTIONS.map((t) => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Gültig bis</label>
                            <input
                              type="date"
                              value={editForm.valid_until ?? ''}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  valid_until: e.target.value || null,
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                            />
                            <label className="mt-1 inline-flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={editForm.valid_until === null}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditForm((f) => ({ ...f, valid_until: null }))
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                              />
                              <span>Unbegrenzt (kein Ablaufdatum)</span>
                            </label>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Schonfrist (Tage)</label>
                            <input
                              type="number"
                              min={0}
                              value={editForm.grace_period_days ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, grace_period_days: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max. Benutzer</label>
                            <input
                              type="number"
                              min={0}
                              value={editForm.max_users ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, max_users: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max. Kunden</label>
                            <input
                              type="number"
                              min={0}
                              value={editForm.max_customers ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, max_customers: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max. Speicher (MB)</label>
                            <input
                              type="number"
                              min={0}
                              value={editForm.max_storage_mb ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, max_storage_mb: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                            />
                          </div>
                        </div>
                        <div>
                          <span className="block text-sm font-medium text-slate-700 mb-2">Features</span>
                          <div className="flex flex-wrap gap-4">
                            {FEATURE_KEYS.map((key) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editForm.features?.[key] ?? false}
                                  onChange={(e) => setEditForm((f) => ({ ...f, features: { ...(f.features ?? {}), [key]: e.target.checked } }))}
                                  className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                                />
                                <span className="text-sm text-slate-700 capitalize">{key}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover"
                          >
                            Speichern
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLicenseId(null)}
                            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <p className="font-mono font-medium text-slate-800">{lic.license_number}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {lic.license_models?.name && (
                                <span>Modell: {lic.license_models.name} · </span>
                              )}
                              Tier: {lic.tier} · Prüfintervall: {checkIntervalLabel}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                            aria-label={expired ? 'Lizenz abgelaufen' : 'Lizenz gültig'}
                          >
                            {expired ? 'Abgelaufen' : 'Gültig'}
                          </span>
                          {lic.is_trial && (
                            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Trial
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">Gültig bis</span>
                            <p className="font-medium text-slate-800">
                              {lic.valid_until ? new Date(lic.valid_until).toLocaleDateString('de-DE') : 'Unbegrenzt'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Max. Benutzer</span>
                            <p className="font-medium text-slate-800">{lic.max_users ?? '∞'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Max. Kunden</span>
                            <p className="font-medium text-slate-800">{lic.max_customers ?? '∞'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Max. Speicher (MB)</span>
                            <p className="font-medium text-slate-800">{lic.max_storage_mb ?? '∞'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Features</span>
                            <p className="font-medium text-slate-800">
                              {activeFeatures.length > 0 ? activeFeatures.join(', ') : '–'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleEditLicense(lic)}
                            className="text-sm font-medium text-vico-primary hover:underline"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLicense(lic)}
                            disabled={deletingLicenseId === lic.id}
                            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingLicenseId === lic.id ? 'Löschen…' : 'Löschen'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
        <div>
          <label htmlFor="app_domain" className="block text-sm font-medium text-slate-700 mb-1">App-Domain</label>
          <input
            id="app_domain"
            type="text"
            value={form.app_domain}
            onChange={(e) => setForm((f) => ({ ...f, app_domain: e.target.value }))}
            placeholder="app.amrtech.de"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
        <div>
          <label htmlFor="portal_domain" className="block text-sm font-medium text-slate-700 mb-1">Kundenportal-Domain</label>
          <input
            id="portal_domain"
            type="text"
            value={form.portal_domain}
            onChange={(e) => setForm((f) => ({ ...f, portal_domain: e.target.value }))}
            placeholder="portal.amrtech.de"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
        <div>
          <label htmlFor="arbeitszeitenportal_domain" className="block text-sm font-medium text-slate-700 mb-1">Arbeitszeitenportal-Domain</label>
          <input
            id="arbeitszeitenportal_domain"
            type="text"
            value={form.arbeitszeitenportal_domain}
            onChange={(e) => setForm((f) => ({ ...f, arbeitszeitenportal_domain: e.target.value }))}
            placeholder="arbeitszeit.amrtech.de"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
        <div>
          <label htmlFor="allowed_domains" className="block text-sm font-medium text-slate-700 mb-1">
            Domain-Bindung (erlaubte Domains)
          </label>
          <textarea
            id="allowed_domains"
            value={form.allowed_domains}
            onChange={(e) => setForm((f) => ({ ...f, allowed_domains: e.target.value }))}
            placeholder={'app.firma.de\nlocalhost:5173'}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Eine Domain pro Zeile. Leer = keine Prüfung. Wildcard: <code className="bg-slate-100 px-1 rounded">*.firma.de</code>
          </p>
        </div>
        <div>
          <label htmlFor="primary_color" className="block text-sm font-medium text-slate-700 mb-1">Primärfarbe</label>
          <input
            id="primary_color"
            type="color"
            value={form.primary_color}
            onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
            className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
          />
          <span className="ml-2 text-sm text-slate-600">{form.primary_color}</span>
        </div>
        <div>
          <label htmlFor="app_name" className="block text-sm font-medium text-slate-700 mb-1">App-Name</label>
          <input
            id="app_name"
            type="text"
            value={form.app_name}
            onChange={(e) => setForm((f) => ({ ...f, app_name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
        </div>
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Impressum</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="impressum_company_name" className="block text-sm text-slate-600 mb-1">Firmenname</label>
              <input
                id="impressum_company_name"
                type="text"
                value={form.impressum_company_name}
                onChange={(e) => setForm((f) => ({ ...f, impressum_company_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
            <div>
              <label htmlFor="impressum_address" className="block text-sm text-slate-600 mb-1">Adresse</label>
              <textarea
                id="impressum_address"
                value={form.impressum_address}
                onChange={(e) => setForm((f) => ({ ...f, impressum_address: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
            <div>
              <label htmlFor="impressum_contact" className="block text-sm text-slate-600 mb-1">Kontakt</label>
              <input
                id="impressum_contact"
                type="text"
                value={form.impressum_contact}
                onChange={(e) => setForm((f) => ({ ...f, impressum_contact: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Datenschutz</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="datenschutz_responsible" className="block text-sm text-slate-600 mb-1">Verantwortlicher</label>
              <input
                id="datenschutz_responsible"
                type="text"
                value={form.datenschutz_responsible}
                onChange={(e) => setForm((f) => ({ ...f, datenschutz_responsible: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
            <div>
              <label htmlFor="datenschutz_contact_email" className="block text-sm text-slate-600 mb-1">Kontakt-E-Mail</label>
              <input
                id="datenschutz_contact_email"
                type="email"
                value={form.datenschutz_contact_email}
                onChange={(e) => setForm((f) => ({ ...f, datenschutz_contact_email: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50"
          >
            {isSaving ? 'Speichern…' : 'Speichern'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/mandanten')}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}

export default MandantForm
