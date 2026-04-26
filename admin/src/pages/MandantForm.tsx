import { useState, useEffect, useCallback, useMemo } from 'react'
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
  fetchTenantEmailMonthlyUsage,
  invokeInfrastructurePing,
  type InfrastructurePingResponse,
  type License,
  type LicenseUpdate,
  type LicenseModel,
  type LicenseWithModel,
  type TenantEmailMonthlyUsage,
} from '../lib/licensePortalService'
import {
  LICENSE_FEATURE_KEYS,
  LICENSE_FEATURE_LABELS,
  emptyLicenseFeatures,
  effectiveLicenseFeatures,
  explicitLicenseFeaturesMap,
} from '../../../shared/licenseFeatures'
import AppVersionRowsEditor from '../components/AppVersionRowsEditor'
import MandantReleaseAssignmentsSection from '../components/MandantReleaseAssignmentsSection'
import TenantDeploymentPanel from '../components/TenantDeploymentPanel'
import { MandantLicenseFeatureToggleField } from '../components/mandanten/MandantLicenseFeatureToggleField'
import { MandantFormSectionActionRow } from '../components/mandanten/MandantFormSectionActionRow'
import { MandantTenantLogoFaviconSection } from '../components/mandanten/MandantTenantLogoFaviconSection'
import { MandantFormWizardStep1Basisdaten } from '../components/mandanten/MandantFormWizardStep1Basisdaten'
import { MandantFormWizardStep2Branding } from '../components/mandanten/MandantFormWizardStep2Branding'
import { MandantFormWizardStep3Rechtliches } from '../components/mandanten/MandantFormWizardStep3Rechtliches'
import { MandantFormWizardStep4Mailversand } from '../components/mandanten/MandantFormWizardStep4Mailversand'
import { MandantFormWizardStep5Hosting } from '../components/mandanten/MandantFormWizardStep5Hosting'
import { MandantFormWizardStep6Fertigstellen } from '../components/mandanten/MandantFormWizardStep6Fertigstellen'
import { MandantFormEditHostingSection } from '../components/mandanten/MandantFormEditHostingSection'
import { MandantFormEditMailSection } from '../components/mandanten/MandantFormEditMailSection'
import { MandantFormEditBrandingBasicsSection } from '../components/mandanten/MandantFormEditBrandingBasicsSection'
import { MandantFormEditLegalSection } from '../components/mandanten/MandantFormEditLegalSection'
import {
  appVersionRowsFromJson,
  appVersionRowsToPayload,
  initialAppVersionRows,
  type AppVersionRowsState,
} from '../lib/appVersionFormUtils'
import {
  removeTenantFaviconFromStorage,
  removeTenantLogoFromStorage,
  uploadTenantFaviconWebP,
  uploadTenantLogoWebP,
} from '../lib/uploadTenantLogo'
import {
  TIER_OPTIONS,
  CHECK_INTERVAL_OPTIONS,
  toDatetimeLocal,
  fromDatetimeLocal,
  toYearMonth,
  DEFAULT_CREATE_FORM,
  WIZARD_TOTAL_STEPS,
  getWizardStepComplete,
  validateWizardStep,
  type WizardFormSlice,
} from '../lib/mandantFormPure'

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
  const [emailUsage, setEmailUsage] = useState<TenantEmailMonthlyUsage | null>(null)
  const [emailUsageMonth] = useState(() => toYearMonth(new Date()))

  const [form, setForm] = useState({
    name: '',
    app_domain: '',
    portal_domain: '',
    kundenportal_url: '',
    arbeitszeitenportal_domain: '',
    primary_color: '#5b7895',
    app_name: 'AMRtech',
    /** Öffentliche Logo-URL (HTTPS), z. B. CDN oder Storage – wie in der Lizenz-API unter design.logo_url */
    logo_url: '',
    /** Optional: Mandanten-Favicon (wird als design.favicon_url ausgeliefert). */
    favicon_url: '',
    impressum_company_name: '',
    impressum_address: '',
    impressum_contact: '',
    datenschutz_responsible: '',
    datenschutz_contact_email: '',
    mail_provider: 'resend',
    mail_from_name: '',
    mail_from_email: '',
    mail_reply_to: '',
    mail_monthly_limit: '3000',
    allowed_domains: '',
    /** Kurzref aus Dashboard-URL (neues Mandanten-Supabase-Projekt) */
    supabase_project_ref: '',
    /** https://<ref>.supabase.co – für Deployment-Export / VITE_SUPABASE_URL */
    supabase_url: '',
    cf_preview_main_url: '',
    cf_preview_portal_url: '',
    cf_preview_arbeitszeit_url: '',
    maintenance_mode_enabled: false,
    maintenance_mode_message: '',
    maintenance_mode_duration_min: '',
    maintenance_mode_started_at: '',
    maintenance_mode_ends_at: '',
    maintenance_mode_auto_end: false,
    maintenance_mode_apply_main_app: true,
    maintenance_mode_apply_arbeitszeit_portal: true,
    maintenance_mode_apply_customer_portal: true,
    maintenance_announcement_enabled: false,
    maintenance_announcement_message: '',
    maintenance_announcement_from: '',
    maintenance_announcement_until: '',
    is_test_mandant: false,
  })

  const [appVersionRows, setAppVersionRows] = useState<AppVersionRowsState>(initialAppVersionRows)
  /** Lokale Datei → WebP-Upload nach Speichern (L4) */
  const [logoFilePending, setLogoFilePending] = useState<File | null>(null)
  const [logoPreviewObjectUrl, setLogoPreviewObjectUrl] = useState<string | null>(null)
  const [faviconFilePending, setFaviconFilePending] = useState<File | null>(null)
  const [faviconPreviewObjectUrl, setFaviconPreviewObjectUrl] = useState<string | null>(null)
  const [maintenanceExtendMinutes, setMaintenanceExtendMinutes] = useState('30')
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardTenantId, setWizardTenantId] = useState<string | null>(null)
  const [wizardLicenseModelId, setWizardLicenseModelId] = useState('')
  /** Nur für Verbindungsprüfung (REST); wird nicht in der Datenbank gespeichert */
  const [infrastructurePingAnonKey, setInfrastructurePingAnonKey] = useState('')
  const [infrastructurePingLoading, setInfrastructurePingLoading] = useState(false)
  const [infrastructurePingResult, setInfrastructurePingResult] = useState<InfrastructurePingResponse | null>(null)

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
        if (!wizardLicenseModelId && data.length > 0) {
          setWizardLicenseModelId(data[0].id)
        }
      } catch {
        setLicenseModels([])
      }
    }
    load()
  }, [isNew, wizardLicenseModelId])

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
          setLogoFilePending(null)
          setFaviconFilePending(null)
          setForm({
            name: t.name ?? '',
            app_domain: t.app_domain ?? '',
            portal_domain: t.portal_domain ?? '',
            kundenportal_url: t.kundenportal_url ?? '',
            arbeitszeitenportal_domain: t.arbeitszeitenportal_domain ?? '',
            primary_color: t.primary_color ?? '#5b7895',
            app_name: t.app_name ?? 'AMRtech',
            logo_url: t.logo_url ?? '',
            favicon_url: t.favicon_url ?? '',
            impressum_company_name: t.impressum_company_name ?? '',
            impressum_address: t.impressum_address ?? '',
            impressum_contact: t.impressum_contact ?? '',
            datenschutz_responsible: t.datenschutz_responsible ?? '',
            datenschutz_contact_email: t.datenschutz_contact_email ?? '',
            mail_provider: t.mail_provider ?? 'resend',
            mail_from_name: t.mail_from_name ?? '',
            mail_from_email: t.mail_from_email ?? '',
            mail_reply_to: t.mail_reply_to ?? '',
            mail_monthly_limit: t.mail_monthly_limit != null ? String(t.mail_monthly_limit) : '3000',
            allowed_domains: Array.isArray(t.allowed_domains)
              ? t.allowed_domains.join('\n')
              : (t.allowed_domains ? String(t.allowed_domains) : ''),
            supabase_project_ref: t.supabase_project_ref ?? '',
            supabase_url: t.supabase_url ?? '',
            cf_preview_main_url: t.cf_preview_main_url ?? '',
            cf_preview_portal_url: t.cf_preview_portal_url ?? '',
            cf_preview_arbeitszeit_url: t.cf_preview_arbeitszeit_url ?? '',
            maintenance_mode_enabled: Boolean(t.maintenance_mode_enabled),
            maintenance_mode_message: t.maintenance_mode_message ?? '',
            maintenance_mode_duration_min:
              t.maintenance_mode_duration_min != null ? String(t.maintenance_mode_duration_min) : '',
            maintenance_mode_started_at: toDatetimeLocal(t.maintenance_mode_started_at),
            maintenance_mode_ends_at: toDatetimeLocal(t.maintenance_mode_ends_at),
            maintenance_mode_auto_end: Boolean(t.maintenance_mode_auto_end),
            maintenance_mode_apply_main_app: t.maintenance_mode_apply_main_app !== false,
            maintenance_mode_apply_arbeitszeit_portal: t.maintenance_mode_apply_arbeitszeit_portal !== false,
            maintenance_mode_apply_customer_portal: t.maintenance_mode_apply_customer_portal !== false,
            maintenance_announcement_enabled: Boolean(t.maintenance_announcement_enabled),
            maintenance_announcement_message: t.maintenance_announcement_message ?? '',
            maintenance_announcement_from: toDatetimeLocal(t.maintenance_announcement_from),
            maintenance_announcement_until: toDatetimeLocal(t.maintenance_announcement_until),
            is_test_mandant: Boolean(t.is_test_mandant),
          })
          const av = t.app_versions as Record<string, unknown> | null | undefined
          setAppVersionRows(appVersionRowsFromJson(av))
        }
        setTenantLicenses(licensesData)
        const usage = await fetchTenantEmailMonthlyUsage(id, emailUsageMonth)
        setEmailUsage(usage)
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
  }, [emailUsageMonth, id, isNew])

  useEffect(() => {
    if (!logoFilePending) {
      setLogoPreviewObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(logoFilePending)
    setLogoPreviewObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [logoFilePending])

  useEffect(() => {
    if (!faviconFilePending) {
      setFaviconPreviewObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(faviconFilePending)
    setFaviconPreviewObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [faviconFilePending])

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
          grace_period_days: lic.grace_period_days ?? 0,
          max_users: lic.max_users,
          max_customers: lic.max_customers,
          max_storage_mb: lic.max_storage_mb,
          check_interval: lic.check_interval ?? 'daily',
          features: effectiveLicenseFeatures(lic.license_models?.features, lic.features),
        })
      }
      navigate(location.pathname, { replace: true, state: undefined })
    }
  }, [locationState, tenantLicenses, isNew, id, navigate, location.pathname])

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setLogoFilePending(f)
    e.target.value = ''
  }

  const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFaviconFilePending(f)
    e.target.value = ''
  }

  const handleRemoveStoredLogo = async () => {
    if (!id) return
    setError(null)
    const rm = await removeTenantLogoFromStorage(id)
    if (rm.error) {
      setError(rm.error)
      return
    }
    setForm((prev) => ({ ...prev, logo_url: '' }))
    setLogoFilePending(null)
  }

  const handleRemoveStoredFavicon = async () => {
    if (!id) return
    setError(null)
    const rm = await removeTenantFaviconFromStorage(id)
    if (rm.error) {
      setError(rm.error)
      return
    }
    setForm((prev) => ({ ...prev, favicon_url: '' }))
    setFaviconFilePending(null)
  }

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
          kundenportal_url: form.kundenportal_url.trim() || null,
          arbeitszeitenportal_domain: form.arbeitszeitenportal_domain || null,
          allowed_domains: form.allowed_domains
            ? form.allowed_domains
                .split(/[\n,]/)
                .map((d) => d.trim().toLowerCase())
                .filter(Boolean)
            : [],
          primary_color: form.primary_color,
          app_name: form.app_name,
          logo_url: form.logo_url.trim() || null,
          favicon_url: form.favicon_url.trim() || null,
          impressum_company_name: form.impressum_company_name || null,
          impressum_address: form.impressum_address || null,
          impressum_contact: form.impressum_contact || null,
          datenschutz_responsible: form.datenschutz_responsible || null,
          datenschutz_contact_email: form.datenschutz_contact_email || null,
          mail_provider: form.mail_provider || 'resend',
          mail_from_name: form.mail_from_name.trim() || null,
          mail_from_email: form.mail_from_email.trim() || null,
          mail_reply_to: form.mail_reply_to.trim() || null,
          mail_monthly_limit: Math.max(1, parseInt(form.mail_monthly_limit, 10) || 3000),
          supabase_project_ref: form.supabase_project_ref.trim() || null,
          supabase_url: form.supabase_url.trim() || null,
          cf_preview_main_url: form.cf_preview_main_url.trim() || null,
          cf_preview_portal_url: form.cf_preview_portal_url.trim() || null,
          cf_preview_arbeitszeit_url: form.cf_preview_arbeitszeit_url.trim() || null,
          maintenance_mode_enabled: form.maintenance_mode_enabled,
          maintenance_mode_message: form.maintenance_mode_message.trim() || null,
          maintenance_mode_duration_min: form.maintenance_mode_duration_min
            ? Math.max(1, parseInt(form.maintenance_mode_duration_min, 10) || 0)
            : null,
          maintenance_mode_started_at: fromDatetimeLocal(form.maintenance_mode_started_at),
          maintenance_mode_ends_at: fromDatetimeLocal(form.maintenance_mode_ends_at),
          maintenance_mode_auto_end: form.maintenance_mode_auto_end,
          maintenance_mode_apply_main_app: form.maintenance_mode_apply_main_app,
          maintenance_mode_apply_arbeitszeit_portal: form.maintenance_mode_apply_arbeitszeit_portal,
          maintenance_mode_apply_customer_portal: form.maintenance_mode_apply_customer_portal,
          maintenance_announcement_enabled: form.maintenance_announcement_enabled,
          maintenance_announcement_message: form.maintenance_announcement_message.trim() || null,
          maintenance_announcement_from: fromDatetimeLocal(form.maintenance_announcement_from),
          maintenance_announcement_until: fromDatetimeLocal(form.maintenance_announcement_until),
          app_versions: appVersionRowsToPayload(appVersionRows) ?? {},
          is_test_mandant: form.is_test_mandant,
        })
        if ('id' in result) {
          let logoUrl = form.logo_url.trim() || null
          let faviconUrl = form.favicon_url.trim() || null
          if (logoFilePending) {
            const up = await uploadTenantLogoWebP(result.id, logoFilePending)
            if (up.error) {
              setError(up.error)
              return
            }
            if (up.publicUrl) {
              logoUrl = up.publicUrl
              const upd = await updateTenant(result.id, { logo_url: logoUrl })
              if (!upd.ok) {
                setError(upd.error ?? 'Logo-URL konnte nicht gespeichert werden.')
                return
              }
            }
          }
          if (faviconFilePending) {
            const upFav = await uploadTenantFaviconWebP(result.id, faviconFilePending)
            if (upFav.error) {
              setError(upFav.error)
              return
            }
            if (upFav.publicUrl) {
              faviconUrl = upFav.publicUrl
              const updFav = await updateTenant(result.id, { favicon_url: faviconUrl })
              if (!updFav.ok) {
                setError(updFav.error ?? 'Favicon-URL konnte nicht gespeichert werden.')
                return
              }
            }
          }
          navigate('/mandanten')
        } else {
          setError(result.error ?? 'Speichern fehlgeschlagen')
        }
      } else if (id) {
        let logoUrl = form.logo_url.trim() || null
        let faviconUrl = form.favicon_url.trim() || null
        if (logoFilePending) {
          const up = await uploadTenantLogoWebP(id, logoFilePending)
          if (up.error) {
            setError(up.error)
            return
          }
          if (up.publicUrl) logoUrl = up.publicUrl
        }
        if (faviconFilePending) {
          const upFav = await uploadTenantFaviconWebP(id, faviconFilePending)
          if (upFav.error) {
            setError(upFav.error)
            return
          }
          if (upFav.publicUrl) faviconUrl = upFav.publicUrl
        }
        const result = await updateTenant(id, {
          name: form.name,
          app_domain: form.app_domain || null,
          portal_domain: form.portal_domain || null,
          kundenportal_url: form.kundenportal_url.trim() || null,
          arbeitszeitenportal_domain: form.arbeitszeitenportal_domain || null,
          allowed_domains: form.allowed_domains
            ? form.allowed_domains
                .split(/[\n,]/)
                .map((d) => d.trim().toLowerCase())
                .filter(Boolean)
            : [],
          primary_color: form.primary_color,
          app_name: form.app_name,
          logo_url: logoUrl || null,
          favicon_url: faviconUrl || null,
          impressum_company_name: form.impressum_company_name || null,
          impressum_address: form.impressum_address || null,
          impressum_contact: form.impressum_contact || null,
          datenschutz_responsible: form.datenschutz_responsible || null,
          datenschutz_contact_email: form.datenschutz_contact_email || null,
          mail_provider: form.mail_provider || 'resend',
          mail_from_name: form.mail_from_name.trim() || null,
          mail_from_email: form.mail_from_email.trim() || null,
          mail_reply_to: form.mail_reply_to.trim() || null,
          mail_monthly_limit: Math.max(1, parseInt(form.mail_monthly_limit, 10) || 3000),
          supabase_project_ref: form.supabase_project_ref.trim() || null,
          supabase_url: form.supabase_url.trim() || null,
          cf_preview_main_url: form.cf_preview_main_url.trim() || null,
          cf_preview_portal_url: form.cf_preview_portal_url.trim() || null,
          cf_preview_arbeitszeit_url: form.cf_preview_arbeitszeit_url.trim() || null,
          maintenance_mode_enabled: form.maintenance_mode_enabled,
          maintenance_mode_message: form.maintenance_mode_message.trim() || null,
          maintenance_mode_duration_min: form.maintenance_mode_duration_min
            ? Math.max(1, parseInt(form.maintenance_mode_duration_min, 10) || 0)
            : null,
          maintenance_mode_started_at: fromDatetimeLocal(form.maintenance_mode_started_at),
          maintenance_mode_ends_at: fromDatetimeLocal(form.maintenance_mode_ends_at),
          maintenance_mode_auto_end: form.maintenance_mode_auto_end,
          maintenance_mode_apply_main_app: form.maintenance_mode_apply_main_app,
          maintenance_mode_apply_arbeitszeit_portal: form.maintenance_mode_apply_arbeitszeit_portal,
          maintenance_mode_apply_customer_portal: form.maintenance_mode_apply_customer_portal,
          maintenance_announcement_enabled: form.maintenance_announcement_enabled,
          maintenance_announcement_message: form.maintenance_announcement_message.trim() || null,
          maintenance_announcement_from: fromDatetimeLocal(form.maintenance_announcement_from),
          maintenance_announcement_until: fromDatetimeLocal(form.maintenance_announcement_until),
          app_versions: appVersionRowsToPayload(appVersionRows) ?? {},
          is_test_mandant: form.is_test_mandant,
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
      features: explicitLicenseFeaturesMap(createForm.features),
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
    const allFeatures = LICENSE_FEATURE_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>)
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

  const handleEditLicense = (lic: LicenseWithModel) => {
    setEditingLicenseId(lic.id)
    setEditForm({
      tier: lic.tier,
      valid_until: lic.valid_until,
      grace_period_days: lic.grace_period_days ?? 0,
      max_users: lic.max_users,
      max_customers: lic.max_customers,
      max_storage_mb: lic.max_storage_mb,
      check_interval: lic.check_interval ?? 'daily',
      features: effectiveLicenseFeatures(lic.license_models?.features, lic.features),
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
    const result = await updateLicense(editingLicenseId, {
      ...editForm,
      features: explicitLicenseFeaturesMap(editForm.features),
    })
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

  const maintenanceEndTs = form.maintenance_mode_ends_at ? Date.parse(form.maintenance_mode_ends_at) : NaN
  const maintenanceMinutesLeft = Number.isFinite(maintenanceEndTs)
    ? Math.floor((maintenanceEndTs - Date.now()) / 60_000)
    : null
  const showMaintenanceEndSoonHint =
    Boolean(form.maintenance_mode_enabled) &&
    Number.isFinite(maintenanceEndTs) &&
    maintenanceMinutesLeft !== null &&
    maintenanceMinutesLeft >= 0 &&
    maintenanceMinutesLeft <= 15
  const modeActive = Boolean(form.maintenance_mode_enabled)
  const announcementActive = Boolean(form.maintenance_announcement_enabled)
  const statusChipBase = 'px-2 py-0.5 rounded-full text-xs font-medium'

  const handleExtendMaintenanceWindow = () => {
    const ext = Math.max(1, parseInt(maintenanceExtendMinutes, 10) || 0)
    const base = Number.isFinite(maintenanceEndTs) ? new Date(maintenanceEndTs) : new Date()
    base.setMinutes(base.getMinutes() + ext)
    const p = (n: number) => String(n).padStart(2, '0')
    const local = `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}T${p(base.getHours())}:${p(base.getMinutes())}`
    setForm((f) => ({ ...f, maintenance_mode_ends_at: local }))
  }

  const buildTenantPayload = useCallback(() => {
    return {
      name: form.name,
      app_domain: form.app_domain || null,
      portal_domain: form.portal_domain || null,
      kundenportal_url: form.kundenportal_url.trim() || null,
      arbeitszeitenportal_domain: form.arbeitszeitenportal_domain || null,
      allowed_domains: form.allowed_domains
        ? form.allowed_domains
            .split(/[\n,]/)
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean)
        : [],
      primary_color: form.primary_color,
      app_name: form.app_name,
      logo_url: form.logo_url.trim() || null,
      favicon_url: form.favicon_url.trim() || null,
      impressum_company_name: form.impressum_company_name || null,
      impressum_address: form.impressum_address || null,
      impressum_contact: form.impressum_contact || null,
      datenschutz_responsible: form.datenschutz_responsible || null,
      datenschutz_contact_email: form.datenschutz_contact_email || null,
      mail_provider: form.mail_provider || 'resend',
      mail_from_name: form.mail_from_name.trim() || null,
      mail_from_email: form.mail_from_email.trim() || null,
      mail_reply_to: form.mail_reply_to.trim() || null,
      mail_monthly_limit: Math.max(1, parseInt(form.mail_monthly_limit, 10) || 3000),
      supabase_project_ref: form.supabase_project_ref.trim() || null,
      supabase_url: form.supabase_url.trim() || null,
      cf_preview_main_url: form.cf_preview_main_url.trim() || null,
      cf_preview_portal_url: form.cf_preview_portal_url.trim() || null,
      cf_preview_arbeitszeit_url: form.cf_preview_arbeitszeit_url.trim() || null,
      maintenance_mode_enabled: form.maintenance_mode_enabled,
      maintenance_mode_message: form.maintenance_mode_message.trim() || null,
      maintenance_mode_duration_min: form.maintenance_mode_duration_min
        ? Math.max(1, parseInt(form.maintenance_mode_duration_min, 10) || 0)
        : null,
      maintenance_mode_started_at: fromDatetimeLocal(form.maintenance_mode_started_at),
      maintenance_mode_ends_at: fromDatetimeLocal(form.maintenance_mode_ends_at),
      maintenance_mode_auto_end: form.maintenance_mode_auto_end,
      maintenance_mode_apply_main_app: form.maintenance_mode_apply_main_app,
      maintenance_mode_apply_arbeitszeit_portal: form.maintenance_mode_apply_arbeitszeit_portal,
      maintenance_mode_apply_customer_portal: form.maintenance_mode_apply_customer_portal,
      maintenance_announcement_enabled: form.maintenance_announcement_enabled,
      maintenance_announcement_message: form.maintenance_announcement_message.trim() || null,
      maintenance_announcement_from: fromDatetimeLocal(form.maintenance_announcement_from),
      maintenance_announcement_until: fromDatetimeLocal(form.maintenance_announcement_until),
      app_versions: appVersionRowsToPayload(appVersionRows) ?? {},
      is_test_mandant: form.is_test_mandant,
    }
  }, [appVersionRows, form])

  const handleInfrastructurePing = useCallback(async () => {
    setInfrastructurePingLoading(true)
    setInfrastructurePingResult(null)
    try {
      const urls = [
        { label: 'CF Preview Haupt-App', url: form.cf_preview_main_url },
        { label: 'CF Preview Kundenportal', url: form.cf_preview_portal_url },
        { label: 'CF Preview Arbeitszeitportal', url: form.cf_preview_arbeitszeit_url },
      ]
      const res = await invokeInfrastructurePing({
        supabase_url: form.supabase_url.trim() || undefined,
        supabase_anon_key: infrastructurePingAnonKey.trim() || undefined,
        urls,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setInfrastructurePingResult(res.data)
    } finally {
      setInfrastructurePingLoading(false)
    }
  }, [
    form.cf_preview_arbeitszeit_url,
    form.cf_preview_main_url,
    form.cf_preview_portal_url,
    form.supabase_url,
    infrastructurePingAnonKey,
  ])

  const saveWizardDraft = useCallback(async (): Promise<string | null> => {
    if (!form.name.trim()) {
      setError('Bitte zuerst einen Mandanten-Namen angeben.')
      return null
    }
    setIsSaving(true)
    setError(null)
    const payload = buildTenantPayload()
    try {
      if (!wizardTenantId) {
        const created = await createTenant(payload)
        if ('error' in created) {
          setError(created.error)
          return null
        }
        setWizardTenantId(created.id)
        return created.id
      }
      const updated = await updateTenant(wizardTenantId, payload)
      if (!updated.ok) {
        setError(updated.error ?? 'Speichern fehlgeschlagen')
        return null
      }
      return wizardTenantId
    } finally {
      setIsSaving(false)
    }
  }, [buildTenantPayload, form.name, wizardTenantId])

  const wizardProgress = useMemo(() => {
    const slice: WizardFormSlice = {
      name: form.name,
      app_name: form.app_name,
      primary_color: form.primary_color,
      datenschutz_contact_email: form.datenschutz_contact_email,
      mail_monthly_limit: form.mail_monthly_limit,
      mail_from_email: form.mail_from_email,
      supabase_url: form.supabase_url,
      cf_preview_main_url: form.cf_preview_main_url,
      cf_preview_portal_url: form.cf_preview_portal_url,
      cf_preview_arbeitszeit_url: form.cf_preview_arbeitszeit_url,
    }
    const steps = [1, 2, 3, 4, 5, 6] as const
    const stepComplete = steps.map((s) =>
      getWizardStepComplete(slice, s, wizardLicenseModelId, licenseModels)
    )
    return {
      completedCount: stepComplete.filter(Boolean).length,
      stepComplete,
    }
  }, [
    form.name,
    form.app_name,
    form.primary_color,
    form.datenschutz_contact_email,
    form.mail_monthly_limit,
    form.mail_from_email,
    form.supabase_url,
    form.cf_preview_main_url,
    form.cf_preview_portal_url,
    form.cf_preview_arbeitszeit_url,
    wizardLicenseModelId,
    licenseModels,
  ])

  const handleWizardNext = async () => {
    const slice: WizardFormSlice = {
      name: form.name,
      app_name: form.app_name,
      primary_color: form.primary_color,
      datenschutz_contact_email: form.datenschutz_contact_email,
      mail_monthly_limit: form.mail_monthly_limit,
      mail_from_email: form.mail_from_email,
      supabase_url: form.supabase_url,
      cf_preview_main_url: form.cf_preview_main_url,
      cf_preview_portal_url: form.cf_preview_portal_url,
      cf_preview_arbeitszeit_url: form.cf_preview_arbeitszeit_url,
    }
    const stepErr = validateWizardStep(slice, wizardStep, wizardLicenseModelId, licenseModels)
    if (stepErr) {
      setError(stepErr)
      setSuccessMessage(null)
      return
    }
    setError(null)
    const savedId = await saveWizardDraft()
    if (!savedId) return
    setSuccessMessage('Schritt gespeichert.')
    setWizardStep((prev) => Math.min(prev + 1, WIZARD_TOTAL_STEPS))
  }

  const handleWizardFinish = async () => {
    const slice: WizardFormSlice = {
      name: form.name,
      app_name: form.app_name,
      primary_color: form.primary_color,
      datenschutz_contact_email: form.datenschutz_contact_email,
      mail_monthly_limit: form.mail_monthly_limit,
      mail_from_email: form.mail_from_email,
      supabase_url: form.supabase_url,
      cf_preview_main_url: form.cf_preview_main_url,
      cf_preview_portal_url: form.cf_preview_portal_url,
      cf_preview_arbeitszeit_url: form.cf_preview_arbeitszeit_url,
    }
    for (let s = 1; s <= WIZARD_TOTAL_STEPS; s++) {
      const stepErr = validateWizardStep(slice, s, wizardLicenseModelId, licenseModels)
      if (stepErr) {
        setError(stepErr)
        setWizardStep(s)
        setSuccessMessage(null)
        return
      }
    }
    setError(null)
    const tenantId = await saveWizardDraft()
    if (!tenantId) return

    const selectedModel = licenseModels.find((m) => m.id === wizardLicenseModelId) ?? licenseModels[0]
    if (!selectedModel) {
      setError('Für den Abschluss wird mindestens ein Lizenzmodell benötigt.')
      return
    }

    const createResult = await createLicense({
      tenant_id: tenantId,
      license_number: generateLicenseNumber(),
      license_model_id: selectedModel.id,
      tier: selectedModel.tier,
      max_users: selectedModel.max_users,
      max_customers: selectedModel.max_customers,
      max_storage_mb: selectedModel.max_storage_mb,
      check_interval: selectedModel.check_interval,
      features: explicitLicenseFeaturesMap(selectedModel.features ?? {}),
    })
    if ('error' in createResult) {
      setError(createResult.error)
      return
    }
    setSuccessMessage('Mandant angelegt und Initial-Lizenz erstellt.')
    navigate('/mandanten')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Lade Mandant…</p>
      </div>
    )
  }

  if (isNew) {
    const stepTitles = [
      'Basisdaten',
      'Branding',
      'Rechtliches',
      'Mailversand',
      'Hosting',
      'Fertigstellen',
    ]
    return (
      <div className="w-full max-w-2xl min-w-0 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Neuer Mandant (Assistent)</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700" role="status" aria-live="polite">
              Fortschritt:{' '}
              <strong>
                {wizardProgress.completedCount} von {WIZARD_TOTAL_STEPS}
              </strong>{' '}
              Schritte vollständig
            </p>
            <span className="text-xs text-slate-500">
              Pflichtfelder je Schritt müssen stimmen, bevor gespeichert wird.
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={wizardProgress.completedCount}
            aria-valuemin={0}
            aria-valuemax={WIZARD_TOTAL_STEPS}
            aria-label="Assistent-Fortschritt"
          >
            <div
              className="h-full bg-vico-primary transition-[width] duration-300 ease-out"
              style={{ width: `${(wizardProgress.completedCount / WIZARD_TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {stepTitles.map((title, idx) => {
              const step = idx + 1
              const active = wizardStep === step
              const stepOk = wizardProgress.stepComplete[idx] ?? false
              return (
                <span
                  key={title}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    active
                      ? 'bg-vico-primary text-white'
                      : stepOk
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stepOk && !active ? (
                    <span className="text-emerald-700" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                  {step}. {title}
                </span>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800" role="alert">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800" role="status">
            {successMessage}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (wizardStep < WIZARD_TOTAL_STEPS) {
              void handleWizardNext()
            } else {
              void handleWizardFinish()
            }
          }}
          className="space-y-4"
        >
          {wizardStep === 1 && (
            <MandantFormWizardStep1Basisdaten
              name={form.name}
              appDomain={form.app_domain}
              portalDomain={form.portal_domain}
              arbeitszeitenportalDomain={form.arbeitszeitenportal_domain}
              onNameChange={(value) => setForm((f) => ({ ...f, name: value }))}
              onAppDomainChange={(value) => setForm((f) => ({ ...f, app_domain: value }))}
              onPortalDomainChange={(value) => setForm((f) => ({ ...f, portal_domain: value }))}
              onArbeitszeitenportalDomainChange={(value) =>
                setForm((f) => ({ ...f, arbeitszeitenportal_domain: value }))
              }
            />
          )}

          {wizardStep === 2 && (
            <MandantFormWizardStep2Branding
              appName={form.app_name}
              primaryColor={form.primary_color}
              logoUrl={form.logo_url}
              faviconUrl={form.favicon_url}
              onAppNameChange={(value) => setForm((f) => ({ ...f, app_name: value }))}
              onPrimaryColorChange={(value) => setForm((f) => ({ ...f, primary_color: value }))}
              onLogoUrlChange={(value) => setForm((f) => ({ ...f, logo_url: value }))}
              onFaviconUrlChange={(value) => setForm((f) => ({ ...f, favicon_url: value }))}
            />
          )}

          {wizardStep === 3 && (
            <MandantFormWizardStep3Rechtliches
              impressumCompanyName={form.impressum_company_name}
              impressumAddress={form.impressum_address}
              datenschutzContactEmail={form.datenschutz_contact_email}
              onImpressumCompanyNameChange={(value) =>
                setForm((f) => ({ ...f, impressum_company_name: value }))
              }
              onImpressumAddressChange={(value) => setForm((f) => ({ ...f, impressum_address: value }))}
              onDatenschutzContactEmailChange={(value) =>
                setForm((f) => ({ ...f, datenschutz_contact_email: value }))
              }
            />
          )}

          {wizardStep === 4 && (
            <MandantFormWizardStep4Mailversand
              mailProvider={form.mail_provider}
              mailMonthlyLimit={form.mail_monthly_limit}
              mailFromName={form.mail_from_name}
              mailFromEmail={form.mail_from_email}
              onMailProviderChange={(value) => setForm((f) => ({ ...f, mail_provider: value }))}
              onMailMonthlyLimitChange={(value) => setForm((f) => ({ ...f, mail_monthly_limit: value }))}
              onMailFromNameChange={(value) => setForm((f) => ({ ...f, mail_from_name: value }))}
              onMailFromEmailChange={(value) => setForm((f) => ({ ...f, mail_from_email: value }))}
            />
          )}

          {wizardStep === 5 && (
            <MandantFormWizardStep5Hosting
              supabaseProjectRef={form.supabase_project_ref}
              supabaseUrl={form.supabase_url}
              infrastructurePingAnonKey={infrastructurePingAnonKey}
              cfPreviewMainUrl={form.cf_preview_main_url}
              cfPreviewPortalUrl={form.cf_preview_portal_url}
              cfPreviewArbeitszeitUrl={form.cf_preview_arbeitszeit_url}
              onSupabaseProjectRefChange={(value) =>
                setForm((f) => ({ ...f, supabase_project_ref: value }))
              }
              onSupabaseUrlChange={(value) => setForm((f) => ({ ...f, supabase_url: value }))}
              onInfrastructurePingAnonKeyChange={(value) => setInfrastructurePingAnonKey(value)}
              onCfPreviewMainUrlChange={(value) =>
                setForm((f) => ({ ...f, cf_preview_main_url: value }))
              }
              onCfPreviewPortalUrlChange={(value) =>
                setForm((f) => ({ ...f, cf_preview_portal_url: value }))
              }
              onCfPreviewArbeitszeitUrlChange={(value) =>
                setForm((f) => ({ ...f, cf_preview_arbeitszeit_url: value }))
              }
              onInfrastructurePingClick={() => void handleInfrastructurePing()}
              infrastructurePingLoading={infrastructurePingLoading}
              infrastructurePingResult={infrastructurePingResult}
            />
          )}

          {wizardStep === 6 && (
            <MandantFormWizardStep6Fertigstellen
              summary={{
                name: form.name,
                app_name: form.app_name,
                app_domain: form.app_domain,
                portal_domain: form.portal_domain,
                arbeitszeitenportal_domain: form.arbeitszeitenportal_domain,
                mail_provider: form.mail_provider,
                mail_monthly_limit: form.mail_monthly_limit,
                mail_from_email: form.mail_from_email,
                supabase_url: form.supabase_url,
                cf_preview_main_url: form.cf_preview_main_url,
                cf_preview_portal_url: form.cf_preview_portal_url,
                cf_preview_arbeitszeit_url: form.cf_preview_arbeitszeit_url,
              }}
              wizardTenantId={wizardTenantId}
              licenseModels={licenseModels}
              wizardLicenseModelId={wizardLicenseModelId}
              onWizardLicenseModelIdChange={(value) => setWizardLicenseModelId(value)}
            />
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => navigate('/mandanten')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <div className="flex gap-2">
              {wizardStep > 1 && (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Zurück
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2.5 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50"
              >
                {isSaving ? 'Speichern…' : wizardStep < WIZARD_TOTAL_STEPS ? 'Speichern & Weiter' : 'Fertigstellen'}
              </button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl min-w-0">
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        {isNew ? 'Neuer Mandant' : 'Mandant bearbeiten'}
      </h2>
      {!isNew && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="status" aria-label="Wartungsstatus">
          <span className={`${statusChipBase} ${modeActive ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
            Wartungsmodus: {modeActive ? 'Aktiv' : 'Inaktiv'}
          </span>
          <span className={`${statusChipBase} ${announcementActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
            Ankündigung: {announcementActive ? 'Aktiv' : 'Inaktiv'}
          </span>
          {showMaintenanceEndSoonHint && (
            <span className={`${statusChipBase} bg-red-100 text-red-700`}>
              Läuft bald ab ({maintenanceMinutesLeft} Min)
            </span>
          )}
        </div>
      )}

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
            <h3 className="text-sm font-semibold text-slate-700 shrink-0">Lizenzen & Lizenzstatus</h3>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
              <button
                type="button"
                onClick={handleStartTrial}
                className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors min-h-[44px] sm:min-h-0"
              >
                Trial starten (14 Tage)
              </button>
              <button
                type="button"
                onClick={handleOpenCreateLicense}
                className="px-3 py-1.5 text-sm font-medium text-vico-primary hover:bg-vico-primary/10 rounded-lg transition-colors min-h-[44px] sm:min-h-0"
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <input
                      id="create-license-number"
                      type="text"
                      value={createForm.license_number}
                      onChange={(e) => setCreateForm((f) => ({ ...f, license_number: e.target.value }))}
                      placeholder="VIC-XXXX-XXXX"
                      required
                      className="min-w-0 w-full sm:flex-1 px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateForm((f) => ({ ...f, license_number: generateLicenseNumber() }))}
                      className="shrink-0 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm min-h-[44px] sm:min-h-0"
                    >
                      Generieren
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <MandantLicenseFeatureToggleField
                  idPrefix="create"
                  features={createForm.features}
                  onFeaturesChange={(next) => setCreateForm((f) => ({ ...f, features: next }))}
                />
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover min-h-[44px] sm:min-h-0"
                  >
                    Lizenz anlegen
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateLicense(false)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 min-h-[44px] sm:min-h-0"
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <MandantLicenseFeatureToggleField
                          idPrefix={`edit-${lic.id}`}
                          features={editForm.features ?? emptyLicenseFeatures()}
                          onFeaturesChange={(next) =>
                            setEditForm((f) => ({
                              ...f,
                              features: next,
                            }))
                          }
                        />
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
                          <button
                            type="submit"
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover min-h-[44px] sm:min-h-0"
                          >
                            Speichern
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLicenseId(null)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 min-h-[44px] sm:min-h-0"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-3 min-w-0">
                          <div className="min-w-0">
                            <p className="font-mono font-medium text-slate-800 break-all">{lic.license_number}</p>
                            <p className="text-xs text-slate-500 mt-0.5 break-words">
                              {lic.license_models?.name && (
                                <span>Modell: {lic.license_models.name} · </span>
                              )}
                              Tier: {lic.tier} · Prüfintervall: {checkIntervalLabel}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                              aria-label={expired ? 'Lizenz abgelaufen' : 'Lizenz gültig'}
                            >
                              {expired ? 'Abgelaufen' : 'Gültig'}
                            </span>
                            {lic.is_trial && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                Trial
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
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
                              {activeFeatures.length > 0
                                ? activeFeatures.map((k) => LICENSE_FEATURE_LABELS[k] ?? k).join(', ')
                                : '–'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleEditLicense(lic)}
                            className="text-sm font-medium text-vico-primary hover:underline min-h-[44px] sm:min-h-0 py-1"
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

      <form
        onSubmit={handleSubmit}
        className="space-y-4 [&>div]:rounded-xl [&>div]:border [&>div]:border-slate-200 [&>div]:bg-white [&>div]:p-4"
      >
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
          <label htmlFor="kundenportal_url" className="block text-sm font-medium text-slate-700 mb-1">
            Kundenportal-URL (vollständig)
          </label>
          <input
            id="kundenportal_url"
            type="url"
            inputMode="url"
            value={form.kundenportal_url}
            onChange={(e) => setForm((f) => ({ ...f, kundenportal_url: e.target.value }))}
            placeholder="https://portal.amrtech.de"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
          />
          <p className="mt-1 text-xs text-slate-500">
            Wird in der Lizenz-API an die Haupt-App ausgeliefert (z. B. für QR-Deep-Links ins Kundenportal).
          </p>
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
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_test_mandant}
              onChange={(e) => setForm((f) => ({ ...f, is_test_mandant: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
            />
            <span>Testmandant (Pilot / Incoming-Releases)</span>
          </label>
          <p className="mt-1 text-xs text-slate-500 pl-7">
            Kennzeichnung für Pilot-Mandanten; steuert u. a. die Zuordnung zu Incoming-Releases (siehe App-Releases).
          </p>
        </div>
        <MandantFormSectionActionRow isSaving={isSaving} onCancel={() => navigate('/mandanten')} />
        <MandantFormEditHostingSection
          supabaseProjectRef={form.supabase_project_ref}
          supabaseUrl={form.supabase_url}
          cfPreviewMainUrl={form.cf_preview_main_url}
          cfPreviewPortalUrl={form.cf_preview_portal_url}
          cfPreviewArbeitszeitUrl={form.cf_preview_arbeitszeit_url}
          infrastructurePingAnonKey={infrastructurePingAnonKey}
          onSupabaseProjectRefChange={(value) =>
            setForm((f) => ({ ...f, supabase_project_ref: value }))
          }
          onSupabaseUrlChange={(value) => setForm((f) => ({ ...f, supabase_url: value }))}
          onCfPreviewMainUrlChange={(value) =>
            setForm((f) => ({ ...f, cf_preview_main_url: value }))
          }
          onCfPreviewPortalUrlChange={(value) =>
            setForm((f) => ({ ...f, cf_preview_portal_url: value }))
          }
          onCfPreviewArbeitszeitUrlChange={(value) =>
            setForm((f) => ({ ...f, cf_preview_arbeitszeit_url: value }))
          }
          onInfrastructurePingAnonKeyChange={(value) => setInfrastructurePingAnonKey(value)}
          onInfrastructurePingClick={() => void handleInfrastructurePing()}
          infrastructurePingLoading={infrastructurePingLoading}
          infrastructurePingResult={infrastructurePingResult}
        />
        <MandantFormSectionActionRow isSaving={isSaving} onCancel={() => navigate('/mandanten')} />
        <MandantFormEditMailSection
          showEmailUsageBanner={!isNew}
          emailUsageMonth={emailUsageMonth}
          emailSentOk={emailUsage?.sent_ok ?? 0}
          emailSentFailed={emailUsage?.sent_failed ?? 0}
          mailMonthlyLimit={form.mail_monthly_limit}
          mailProvider={form.mail_provider}
          mailFromName={form.mail_from_name}
          mailFromEmail={form.mail_from_email}
          mailReplyTo={form.mail_reply_to}
          onMailProviderChange={(value) => setForm((f) => ({ ...f, mail_provider: value }))}
          onMailMonthlyLimitChange={(value) => setForm((f) => ({ ...f, mail_monthly_limit: value }))}
          onMailFromNameChange={(value) => setForm((f) => ({ ...f, mail_from_name: value }))}
          onMailFromEmailChange={(value) => setForm((f) => ({ ...f, mail_from_email: value }))}
          onMailReplyToChange={(value) => setForm((f) => ({ ...f, mail_reply_to: value }))}
        />
        <MandantFormSectionActionRow isSaving={isSaving} onCancel={() => navigate('/mandanten')} />
        <MandantFormEditBrandingBasicsSection
          primaryColor={form.primary_color}
          appName={form.app_name}
          onPrimaryColorChange={(value) => setForm((f) => ({ ...f, primary_color: value }))}
          onAppNameChange={(value) => setForm((f) => ({ ...f, app_name: value }))}
        />
        <MandantTenantLogoFaviconSection
          showStorageRemoveActions={Boolean(id && !isNew)}
          logoUrl={form.logo_url}
          faviconUrl={form.favicon_url}
          onLogoUrlChange={(logo_url) => setForm((f) => ({ ...f, logo_url }))}
          onFaviconUrlChange={(favicon_url) => setForm((f) => ({ ...f, favicon_url }))}
          logoFilePending={logoFilePending}
          faviconFilePending={faviconFilePending}
          logoPreviewObjectUrl={logoPreviewObjectUrl}
          faviconPreviewObjectUrl={faviconPreviewObjectUrl}
          onLogoFileChange={handleLogoFileChange}
          onFaviconFileChange={handleFaviconFileChange}
          onRemoveStoredLogo={handleRemoveStoredLogo}
          onRemoveStoredFavicon={handleRemoveStoredFavicon}
        />
        <MandantFormSectionActionRow isSaving={isSaving} onCancel={() => navigate('/mandanten')} />
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">App-Versionen (optional, Mandant)</h3>
          <p className="text-xs text-slate-500 mb-4">
            Überschreibt die <strong>globalen Standardwerte</strong> unter Einstellungen pro App. Leere Felder
            übernehmen weiterhin die globalen Vorgaben (Lizenz-API merged automatisch). Wird als{' '}
            <code className="bg-slate-100 px-1 rounded">appVersions</code> ausgeliefert.
          </p>
          <AppVersionRowsEditor rows={appVersionRows} setRows={setAppVersionRows} idPrefix="mandant" />
        </div>
        {!isNew && id ? (
          <div className="pt-4 border-t border-slate-200">
            <MandantReleaseAssignmentsSection tenantId={id} />
          </div>
        ) : null}
        <MandantFormSectionActionRow isSaving={isSaving} onCancel={() => navigate('/mandanten')} />
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Wartungsmodus (Mandanten-App)</h3>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.maintenance_mode_enabled}
              onChange={(e) => setForm((f) => ({ ...f, maintenance_mode_enabled: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
            />
            <span>Wartungsmodus aktiv</span>
          </label>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Hinweistext</label>
            <input
              type="text"
              value={form.maintenance_mode_message}
              onChange={(e) => setForm((f) => ({ ...f, maintenance_mode_message: e.target.value }))}
              placeholder="Wartungsarbeiten laufen derzeit."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Dauer (Minuten)</label>
              <input
                type="number"
                min={1}
                value={form.maintenance_mode_duration_min}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_mode_duration_min: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
                placeholder="60"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Startzeit</label>
              <input
                type="datetime-local"
                value={form.maintenance_mode_started_at}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_mode_started_at: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Endzeit</label>
              <input
                type="datetime-local"
                value={form.maintenance_mode_ends_at}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_mode_ends_at: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.maintenance_mode_auto_end}
              onChange={(e) => setForm((f) => ({ ...f, maintenance_mode_auto_end: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
            />
            <span>Automatisch beenden, wenn Endzeit erreicht ist</span>
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Wartungshinweis anzeigen in</p>
            <p className="text-xs text-slate-500">
              Steuert nur die Sichtbarkeit des Banners je App; die Schreibsperre in der Mandanten-App (Haupt-App)
              folgt weiter den bisherigen Regeln, sofern aktiv.
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.maintenance_mode_apply_main_app}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maintenance_mode_apply_main_app: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              />
              <span>Haupt-App (Monteur-App)</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.maintenance_mode_apply_arbeitszeit_portal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maintenance_mode_apply_arbeitszeit_portal: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              />
              <span>Arbeitszeitportal</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.maintenance_mode_apply_customer_portal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maintenance_mode_apply_customer_portal: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              />
              <span>Kundenportal</span>
            </label>
          </div>
          {showMaintenanceEndSoonHint && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                Hinweis: Die geplante Wartungszeit läuft in {maintenanceMinutesLeft} Min. ab.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={maintenanceExtendMinutes}
                  onChange={(e) => setMaintenanceExtendMinutes(e.target.value)}
                  className="w-24 px-2 py-1 rounded border border-amber-300 text-slate-800"
                  aria-label="Verlängerung in Minuten"
                />
                <span>Minuten</span>
                <button
                  type="button"
                  onClick={handleExtendMaintenanceWindow}
                  className="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
                >
                  Wartung verlängern
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Wartungsankündigung (nur Hinweis)</h3>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.maintenance_announcement_enabled}
              onChange={(e) => setForm((f) => ({ ...f, maintenance_announcement_enabled: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
            />
            <span>Ankündigung anzeigen</span>
          </label>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Ankündigungstext</label>
            <input
              type="text"
              value={form.maintenance_announcement_message}
              onChange={(e) => setForm((f) => ({ ...f, maintenance_announcement_message: e.target.value }))}
              placeholder="Geplante Wartung im angegebenen Zeitraum."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Von</label>
              <input
                type="datetime-local"
                value={form.maintenance_announcement_from}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_announcement_from: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Bis</label>
              <input
                type="datetime-local"
                value={form.maintenance_announcement_until}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_announcement_until: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary"
              />
            </div>
          </div>
        </div>
        <MandantFormSectionActionRow isSaving={isSaving} onCancel={() => navigate('/mandanten')} />
        <MandantFormEditLegalSection
          impressumCompanyName={form.impressum_company_name}
          impressumAddress={form.impressum_address}
          impressumContact={form.impressum_contact}
          datenschutzResponsible={form.datenschutz_responsible}
          datenschutzContactEmail={form.datenschutz_contact_email}
          onImpressumCompanyNameChange={(value) =>
            setForm((f) => ({ ...f, impressum_company_name: value }))
          }
          onImpressumAddressChange={(value) => setForm((f) => ({ ...f, impressum_address: value }))}
          onImpressumContactChange={(value) => setForm((f) => ({ ...f, impressum_contact: value }))}
          onDatenschutzResponsibleChange={(value) =>
            setForm((f) => ({ ...f, datenschutz_responsible: value }))
          }
          onDatenschutzContactEmailChange={(value) =>
            setForm((f) => ({ ...f, datenschutz_contact_email: value }))
          }
        />
        <MandantFormSectionActionRow isSaving={isSaving} onCancel={() => navigate('/mandanten')} />
      </form>

      {!isNew && tenantLicenses.length > 0 && (
        <div className="mt-8">
          <TenantDeploymentPanel
            licenses={tenantLicenses.map((l) => ({
              id: l.id,
              license_number: l.license_number,
              client_config_version: l.client_config_version ?? 0,
            }))}
            tenantName={form.name}
            supabaseUrl={form.supabase_url}
            appDomain={form.app_domain}
            portalDomain={form.portal_domain}
            arbeitszeitDomain={form.arbeitszeitenportal_domain}
            allowedDomainsText={form.allowed_domains}
            onClientPushComplete={id ? () => void loadLicenses(id) : undefined}
          />
        </div>
      )}
    </div>
  )
}

export default MandantForm
