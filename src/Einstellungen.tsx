import { useState, useEffect, useCallback } from 'react'
import type { ChangeEvent } from 'react'
import { useSync } from './SyncContext'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import {
  getCachedLicenseResponse,
  getStoredLicenseNumber,
  updateImpressum,
  isLicenseApiConfigured,
  fetchLicenseFromApi,
  setCachedLicenseResponse,
} from './lib/licensePortalApi'
import {
  fetchMyProfile,
  revokeGpsConsent,
  setStandortabfrageConsent,
  revokeStandortabfrageConsent,
  updateMaintenanceReminderEmailSettings,
} from './lib/userService'
import { hasFeature } from './lib/licenseService'
import {
  getStandortabfrageTeamleiterAllowed,
  setStandortabfrageTeamleiterAllowed,
} from './lib/locationService'
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from './lib/pushService'
import type { Profile } from './lib/userService'
import { useDashboardLayout } from './hooks/useDashboardLayout'
import {
  createBriefbogenPreviewUrl,
  fetchBriefbogenStoragePath,
  fetchBriefbogenPdfTextLayout,
  saveBriefbogenPdfTextLayout,
  removeBriefbogenPdfMargins,
  uploadBriefbogenFile,
  removeBriefbogen,
  type BriefbogenDinMarginsMm,
} from './lib/briefbogenService'
import { invalidateBriefbogenPdfAssetsCache } from './lib/briefbogenPdfCache'
import { DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM } from '../shared/pdfBriefbogenLayout'
import { isOnline } from '../shared/networkUtils'
import {
  getMandantPingEnabled,
  setMandantPingEnabled,
  MANDANT_PING_PREFERENCE_EVENT,
} from '../shared/mandantReachabilityPing'
import { getEtikettPresetId, setEtikettPresetId, type EtikettPresetId } from './lib/etikettPreset'
import {
  fetchMonteurReportSettingsFull,
  type PruefprotokollAddressMode,
  updateMonteurReportSettings,
  updateMonteurReportWartungChecklisteSettings,
  updateMonteurReportPortalPdfShareSettings,
  fetchMonteurReportOrgDigestSettings,
  updateMonteurReportOrgDigestSettings,
  type MonteurReportCustomerDeliveryMode,
  type WartungChecklisteModus,
} from './lib/dataService'
import { COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL } from './lib/componentSettingsService'
import { ImportStammdatenSection } from './components/settings/ImportStammdatenSection'
import { SyncSettingsSection } from './components/settings/SyncSettingsSection'
import { DoorFieldCatalogSettingsSection } from './components/settings/DoorFieldCatalogSettingsSection'
import { DashboardLayoutSettingsSection } from './components/settings/DashboardLayoutSettingsSection'
import { MandantPingSettingsBlock } from './components/settings/MandantPingSettingsBlock'
import { EtikettPresetSettingsBlock } from './components/settings/EtikettPresetSettingsBlock'
import { MaintenanceReminderEmailSettingsBlock } from './components/settings/MaintenanceReminderEmailSettingsBlock'
import { MaintenanceDigestAdminSettingsBlock } from './components/settings/MaintenanceDigestAdminSettingsBlock'
import { ComponentTogglesSettingsSection } from './components/settings/ComponentTogglesSettingsSection'
import { GpsTrackingRevokeSettingsSection } from './components/settings/GpsTrackingRevokeSettingsSection'
import { StandortabfrageConsentSettingsSection } from './components/settings/StandortabfrageConsentSettingsSection'
import { StandortabfrageTeamleiterAdminSettingsSection } from './components/settings/StandortabfrageTeamleiterAdminSettingsSection'
import { BriefbogenPdfSettingsSection } from './components/settings/BriefbogenPdfSettingsSection'
import { StammdatenImpressumSettingsSection } from './components/settings/StammdatenImpressumSettingsSection'
import { MonteurReportPortalChecklistSettingsSection } from './components/settings/MonteurReportPortalChecklistSettingsSection'

const Einstellungen = () => {
  const { showToast } = useToast()
  const { syncStatus, isOffline, setSyncStatus, syncNow, pendingCount, lastSyncError, clearSyncError } = useSync()
  const { userRole, user } = useAuth()
  const { design, license, refresh: refreshLicense } = useLicense()
  const { settingsList, updateSetting, refresh, isEnabled } = useComponentSettings()
  const kundenModuleOn = isEnabled('kunden')
  const licenseNumber = getStoredLicenseNumber()
  const cachedLicense = licenseNumber ? getCachedLicenseResponse(licenseNumber) : null
  const impressum = cachedLicense?.impressum
  const [isSyncing, setIsSyncing] = useState(false)
  const [componentError, setComponentError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [profileLoadDone, setProfileLoadDone] = useState(false)
  const [gpsRevoking, setGpsRevoking] = useState(false)
  const [showStammdatenEdit, setShowStammdatenEdit] = useState(false)
  const [stammdatenSaving, setStammdatenSaving] = useState(false)
  const [stammdatenLoading, setStammdatenLoading] = useState(false)
  const [stammdatenError, setStammdatenError] = useState<string | null>(null)
  const [standortTeamleiterAllowed, setStandortTeamleiterAllowed] = useState(false)
  const [standortTeamleiterLoading, setStandortTeamleiterLoading] = useState(false)
  const [standortTeamleiterSaving, setStandortTeamleiterSaving] = useState(false)
  const [standortConsentSaving, setStandortConsentSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null)
  const [pushSaving, setPushSaving] = useState(false)
  const [briefbogenPreviewUrl, setBriefbogenPreviewUrl] = useState<string | null>(null)
  const [briefbogenIsPdf, setBriefbogenIsPdf] = useState(false)
  const [briefbogenConfigured, setBriefbogenConfigured] = useState(false)
  const [briefbogenLoading, setBriefbogenLoading] = useState(false)
  const [briefbogenUploading, setBriefbogenUploading] = useState(false)
  const [briefbogenRemoving, setBriefbogenRemoving] = useState(false)
  const [briefbogenError, setBriefbogenError] = useState<string | null>(null)
  const [briefbogenPdfMargins, setBriefbogenPdfMargins] = useState<BriefbogenDinMarginsMm>(() => ({
    ...DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM,
  }))
  const [briefbogenPdfMarginsSaving, setBriefbogenPdfMarginsSaving] = useState(false)
  const [briefbogenFollowPageCompactTop, setBriefbogenFollowPageCompactTop] = useState(false)
  const [maintEmailEnabled, setMaintEmailEnabled] = useState(false)
  const [maintEmailFrequency, setMaintEmailFrequency] = useState<'daily' | 'weekly'>('weekly')
  const [maintEmailSaving, setMaintEmailSaving] = useState(false)
  const [maintEmailError, setMaintEmailError] = useState<string | null>(null)
  const [maintDigestConsentChecked, setMaintDigestConsentChecked] = useState(false)
  const [digestLocalTime, setDigestLocalTime] = useState('07:00')
  const [digestTimezone, setDigestTimezone] = useState('Europe/Berlin')
  const [digestAppPublicUrl, setDigestAppPublicUrl] = useState('')
  const [digestSettingsLoaded, setDigestSettingsLoaded] = useState(false)
  const [digestSaving, setDigestSaving] = useState(false)
  const [digestError, setDigestError] = useState<string | null>(null)
  const [etikettPreset, setEtikettPresetState] = useState<EtikettPresetId>(() =>
    typeof window !== 'undefined' ? getEtikettPresetId() : 'mini_50x25'
  )
  const [monteurDeliveryMode, setMonteurDeliveryMode] =
    useState<MonteurReportCustomerDeliveryMode>('none')
  const [monteurDeliveryLoaded, setMonteurDeliveryLoaded] = useState(false)
  const [monteurDeliverySaving, setMonteurDeliverySaving] = useState(false)
  const [monteurDeliveryError, setMonteurDeliveryError] = useState<string | null>(null)
  const [wartungChecklisteModus, setWartungChecklisteModus] = useState<WartungChecklisteModus>('detail')
  const [pruefprotokollAddressMode, setPruefprotokollAddressMode] =
    useState<PruefprotokollAddressMode>('both')
  const [mangelNeuerAuftragDefault, setMangelNeuerAuftragDefault] = useState(true)
  const [wartungChecklisteSaving, setWartungChecklisteSaving] = useState(false)
  const [wartungChecklisteError, setWartungChecklisteError] = useState<string | null>(null)
  const [portalShareMonteurPdf, setPortalShareMonteurPdf] = useState(true)
  const [portalSharePruefPdf, setPortalSharePruefPdf] = useState(true)
  const [portalTimelineShowPlanned, setPortalTimelineShowPlanned] = useState(false)
  const [portalTimelineShowTermin, setPortalTimelineShowTermin] = useState(true)
  const [portalTimelineShowInProgress, setPortalTimelineShowInProgress] = useState(true)
  const [portalPdfShareSaving, setPortalPdfShareSaving] = useState(false)
  const [portalPdfShareError, setPortalPdfShareError] = useState<string | null>(null)
  const [mandantPingEnabled, setMandantPingEnabledState] = useState(() =>
    typeof window !== 'undefined' ? getMandantPingEnabled() : false
  )
  const [stammdatenForm, setStammdatenForm] = useState({
    company_name: '',
    address: '',
    contact: '',
    represented_by: '',
    register: '',
    vat_id: '',
    responsible: '',
    contact_email: '',
    dsb_email: '',
  })

  const settingsServerDashboard =
    !user?.id ? undefined : !profileLoadDone ? undefined : (myProfile?.dashboard_layout ?? null)

  const { layout: dashboardLayout, updateWidgetVisible, moveWidgetOrder } = useDashboardLayout(
    user?.id ?? null,
    settingsServerDashboard
  )

  const loadProfile = useCallback(async () => {
    if (user?.id) {
      const p = await fetchMyProfile(user.id)
      setMyProfile(p ?? null)
    } else {
      setMyProfile(null)
    }
    setProfileLoadDone(true)
  }, [user?.id])

  useEffect(() => {
    setProfileLoadDone(false)
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    if (!showStammdatenEdit) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !stammdatenSaving) setShowStammdatenEdit(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showStammdatenEdit, stammdatenSaving])

  const hasGpsConsent =
    myProfile?.gps_consent_at != null && myProfile?.gps_consent_revoked_at == null
  const showGpsRevoke =
    license && hasFeature(license, 'arbeitszeiterfassung') && user?.id && hasGpsConsent

  const showStandortabfrageSettings =
    userRole === 'admin' && license && hasFeature(license, 'standortabfrage')

  const hasStandortabfrageConsent =
    myProfile?.standortabfrage_consent_at != null && myProfile?.standortabfrage_consent_revoked_at == null
  const showStandortabfrageConsent =
    license && hasFeature(license, 'standortabfrage') && user?.id && userRole !== 'kunde'

  const showBriefbogenSettings = userRole === 'admin' && isEnabled('wartungsprotokolle')

  const showWartungExtrasSettings =
    Boolean(license && hasFeature(license, 'wartungsprotokolle')) &&
    userRole !== 'kunde' &&
    Boolean(user?.id)

  const showMonteurBerichtZustellung =
    userRole === 'admin' && Boolean(license && hasFeature(license, 'wartungsprotokolle'))
  const showMonteurPortalOption = Boolean(license && hasFeature(license, 'kundenportal'))

  useEffect(() => {
    if (!showMonteurBerichtZustellung) return
    let cancelled = false
    const load = async () => {
      const row = await fetchMonteurReportSettingsFull()
      if (cancelled) return
      setMonteurDeliveryMode(row?.customer_delivery_mode ?? 'none')
      setWartungChecklisteModus(row?.wartung_checkliste_modus ?? 'detail')
      setPruefprotokollAddressMode(row?.pruefprotokoll_address_mode ?? 'both')
      setMangelNeuerAuftragDefault(row?.mangel_neuer_auftrag_default ?? true)
      setPortalShareMonteurPdf(row?.portal_share_monteur_report_pdf ?? true)
      setPortalSharePruefPdf(row?.portal_share_pruefprotokoll_pdf ?? true)
      setPortalTimelineShowPlanned(row?.portal_timeline_show_planned ?? false)
      setPortalTimelineShowTermin(row?.portal_timeline_show_termin ?? true)
      setPortalTimelineShowInProgress(row?.portal_timeline_show_in_progress ?? true)
      setMonteurDeliveryLoaded(true)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [showMonteurBerichtZustellung])


  const refreshBriefbogenPreview = useCallback(async () => {
    if (!showBriefbogenSettings) return
    setBriefbogenLoading(true)
    setBriefbogenError(null)
    try {
      const [path, textLayout] = await Promise.all([
        fetchBriefbogenStoragePath(),
        fetchBriefbogenPdfTextLayout(),
      ])
      setBriefbogenPdfMargins(textLayout.margins)
      setBriefbogenFollowPageCompactTop(textLayout.followPageCompactTop)
      setBriefbogenConfigured(Boolean(path))
      setBriefbogenIsPdf(Boolean(path?.toLowerCase().endsWith('.pdf')))
      if (path) {
        const url = await createBriefbogenPreviewUrl()
        setBriefbogenPreviewUrl(url)
      } else {
        setBriefbogenPreviewUrl(null)
      }
    } catch {
      setBriefbogenError('Briefbogen-Status konnte nicht geladen werden.')
      setBriefbogenPreviewUrl(null)
      setBriefbogenConfigured(false)
      setBriefbogenIsPdf(false)
      setBriefbogenPdfMargins({ ...DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM })
      setBriefbogenFollowPageCompactTop(false)
    } finally {
      setBriefbogenLoading(false)
    }
  }, [showBriefbogenSettings])

  useEffect(() => {
    void refreshBriefbogenPreview()
  }, [refreshBriefbogenPreview])

  useEffect(() => {
    if (!myProfile) return
    setMaintEmailEnabled(Boolean(myProfile.maintenance_reminder_email_enabled))
    setMaintEmailFrequency(myProfile.maintenance_reminder_email_frequency === 'daily' ? 'daily' : 'weekly')
    setMaintDigestConsentChecked(Boolean(myProfile.maintenance_reminder_email_consent_at))
  }, [myProfile])

  useEffect(() => {
    if (userRole !== 'admin' || !showWartungExtrasSettings) return
    let cancelled = false
    void fetchMonteurReportOrgDigestSettings().then((row) => {
      if (cancelled || !row) {
        if (!cancelled) setDigestSettingsLoaded(true)
        return
      }
      const t = row.maintenance_digest_local_time.trim()
      setDigestLocalTime(t.length >= 5 ? t.slice(0, 5) : '07:00')
      setDigestTimezone(row.maintenance_digest_timezone || 'Europe/Berlin')
      setDigestAppPublicUrl(row.app_public_url?.trim() ?? '')
      setDigestSettingsLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [userRole, showWartungExtrasSettings])

  useEffect(() => {
    if (!showStandortabfrageSettings) return
    setStandortTeamleiterLoading(true)
    getStandortabfrageTeamleiterAllowed()
      .then(setStandortTeamleiterAllowed)
      .finally(() => setStandortTeamleiterLoading(false))
  }, [showStandortabfrageSettings])

  const handleRevokeGps = async () => {
    if (!user?.id || gpsRevoking) return
    setGpsRevoking(true)
    await revokeGpsConsent(user.id)
    setGpsRevoking(false)
    await loadProfile()
  }

  const handleStandortabfrageConsent = async () => {
    if (!user?.id || standortConsentSaving) return
    setStandortConsentSaving(true)
    await setStandortabfrageConsent(user.id)
    setStandortConsentSaving(false)
    await loadProfile()
  }

  const handlePushToggle = async (enable: boolean) => {
    if (pushSaving) return
    setPushSaving(true)
    if (enable) {
      const { error } = await subscribeToPush()
      if (!error) setPushEnabled(true)
    } else {
      await unsubscribeFromPush()
      setPushEnabled(false)
    }
    setPushSaving(false)
  }

  const handleRevokeStandortabfrageConsent = async () => {
    if (!user?.id || standortConsentSaving) return
    setStandortConsentSaving(true)
    await revokeStandortabfrageConsent(user.id)
    setStandortConsentSaving(false)
    await loadProfile()
  }

  const handleStandortTeamleiterAllowedChange = async (checked: boolean) => {
    if (isOffline) return
    setStandortTeamleiterSaving(true)
    const { error } = await setStandortabfrageTeamleiterAllowed(checked)
    setStandortTeamleiterSaving(false)
    if (!error) setStandortTeamleiterAllowed(checked)
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    await syncNow()
    setIsSyncing(false)
  }

  const handleBriefbogenFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || briefbogenUploading) return
    if (!isOnline()) {
      setBriefbogenError('Upload nur bei Internetverbindung möglich.')
      return
    }
    setBriefbogenUploading(true)
    setBriefbogenError(null)
    const res = await uploadBriefbogenFile(file)
    setBriefbogenUploading(false)
    if (!res.ok) {
      setBriefbogenError(res.error ?? 'Upload fehlgeschlagen')
      return
    }
    invalidateBriefbogenPdfAssetsCache()
    await refreshBriefbogenPreview()
  }

  const handleBriefbogenPdfMarginChange =
    (key: keyof BriefbogenDinMarginsMm) => (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.trim().replace(',', '.')
      if (raw === '') {
        setBriefbogenPdfMargins((prev) => ({ ...prev, [key]: 0 }))
        return
      }
      const n = Number(raw)
      if (!Number.isFinite(n)) return
      setBriefbogenPdfMargins((prev) => ({ ...prev, [key]: n }))
    }

  const handleSaveBriefbogenPdfMargins = async () => {
    if (briefbogenPdfMarginsSaving) return
    if (!isOnline()) {
      setBriefbogenError('Ränder speichern nur bei Internetverbindung möglich.')
      return
    }
    setBriefbogenPdfMarginsSaving(true)
    setBriefbogenError(null)
    const res = await saveBriefbogenPdfTextLayout({
      margins: briefbogenPdfMargins,
      followPageCompactTop: briefbogenFollowPageCompactTop,
    })
    setBriefbogenPdfMarginsSaving(false)
    if (!res.ok) {
      setBriefbogenError(res.error ?? 'PDF-Ränder konnten nicht gespeichert werden.')
      return
    }
    invalidateBriefbogenPdfAssetsCache()
    const t = await fetchBriefbogenPdfTextLayout()
    setBriefbogenPdfMargins(t.margins)
    setBriefbogenFollowPageCompactTop(t.followPageCompactTop)
    showToast('PDF-Textlayout gespeichert.', 'success')
  }

  const handleResetBriefbogenPdfMargins = async () => {
    if (briefbogenPdfMarginsSaving) return
    if (!isOnline()) {
      setBriefbogenError('Zurücksetzen nur bei Internetverbindung möglich.')
      return
    }
    setBriefbogenPdfMarginsSaving(true)
    setBriefbogenError(null)
    const res = await removeBriefbogenPdfMargins()
    setBriefbogenPdfMarginsSaving(false)
    if (!res.ok) {
      setBriefbogenError(res.error ?? 'Standardränder konnten nicht wiederhergestellt werden.')
      return
    }
    invalidateBriefbogenPdfAssetsCache()
    setBriefbogenPdfMargins({ ...DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM })
    setBriefbogenFollowPageCompactTop(false)
    showToast('Standardränder (DIN-orientiert) wiederhergestellt.', 'success')
  }

  const handleBriefbogenRemove = async () => {
    if (briefbogenRemoving || !briefbogenConfigured) return
    if (!isOnline()) {
      setBriefbogenError('Entfernen nur bei Internetverbindung möglich.')
      return
    }
    setBriefbogenRemoving(true)
    setBriefbogenError(null)
    const res = await removeBriefbogen()
    setBriefbogenRemoving(false)
    if (!res.ok) {
      setBriefbogenError(res.error ?? 'Entfernen fehlgeschlagen')
      return
    }
    invalidateBriefbogenPdfAssetsCache()
    await refreshBriefbogenPreview()
  }

  const setStammdatenFormFromApi = useCallback((api: { impressum?: Record<string, unknown>; datenschutz?: Record<string, unknown> } | null) => {
    const imp = api?.impressum
    const dat = api?.datenschutz
    setStammdatenForm({
      company_name: typeof imp?.company_name === 'string' ? imp.company_name : '',
      address: typeof imp?.address === 'string' ? imp.address : '',
      contact: typeof imp?.contact === 'string' ? imp.contact : '',
      represented_by: typeof imp?.represented_by === 'string' ? imp.represented_by : '',
      register: typeof imp?.register === 'string' ? imp.register : '',
      vat_id: typeof imp?.vat_id === 'string' ? imp.vat_id : '',
      responsible: typeof dat?.responsible === 'string' ? dat.responsible : '',
      contact_email: typeof dat?.contact_email === 'string' ? dat.contact_email : '',
      dsb_email: typeof dat?.dsb_email === 'string' ? dat.dsb_email : '',
    })
  }, [])

  const handleOpenStammdatenEdit = async () => {
    setStammdatenFormFromApi(cachedLicense)
    setStammdatenError(null)
    setShowStammdatenEdit(true)

    if (!licenseNumber || !isLicenseApiConfigured() || !isOnline()) return

    setStammdatenLoading(true)
    const api = await fetchLicenseFromApi(licenseNumber, 8_000)
    setStammdatenLoading(false)
    if (!api) return
    setCachedLicenseResponse(api, licenseNumber)
    setStammdatenFormFromApi(api)
  }

  const handleSaveStammdaten = async () => {
    if (stammdatenSaving) return
    if (!licenseNumber) {
      setStammdatenError('Keine Lizenznummer hinterlegt. Bitte zuerst Lizenznummer prüfen.')
      return
    }
    setStammdatenSaving(true)
    setStammdatenError(null)
    const result = await updateImpressum(licenseNumber, {
      impressum: {
        company_name: stammdatenForm.company_name || null,
        address: stammdatenForm.address || null,
        contact: stammdatenForm.contact || null,
        represented_by: stammdatenForm.represented_by || null,
        register: stammdatenForm.register || null,
        vat_id: stammdatenForm.vat_id || null,
      },
      datenschutz: {
        responsible: stammdatenForm.responsible || null,
        contact_email: stammdatenForm.contact_email || null,
        dsb_email: stammdatenForm.dsb_email || null,
      },
    })
    setStammdatenSaving(false)
    if (result.ok) {
      await refreshLicense({ force: true })
      setShowStammdatenEdit(false)
      showToast('Stammdaten wurden gespeichert.', 'success')
    } else {
      setStammdatenError(result.error ?? 'Speichern fehlgeschlagen')
    }
  }

  const handleSaveMaintenanceEmail = async () => {
    if (!user?.id || maintEmailSaving) return
    if (!isOnline()) {
      setMaintEmailError('Nur online speicherbar; bitte Verbindung herstellen.')
      return
    }
    if (maintEmailEnabled) {
      const hasConsent = Boolean(myProfile?.maintenance_reminder_email_consent_at)
      if (!hasConsent && !maintDigestConsentChecked) {
        setMaintEmailError('Bitte die Einwilligung zum E-Mail-Versand bestätigen.')
        return
      }
    }
    setMaintEmailSaving(true)
    setMaintEmailError(null)
    const needsNewConsent = maintEmailEnabled && !myProfile?.maintenance_reminder_email_consent_at
    const { error } = await updateMaintenanceReminderEmailSettings(user.id, {
      maintenance_reminder_email_enabled: maintEmailEnabled,
      maintenance_reminder_email_frequency: maintEmailFrequency,
      grant_digest_email_consent: needsNewConsent,
    })
    setMaintEmailSaving(false)
    if (error) {
      setMaintEmailError(error.message)
      return
    }
    await loadProfile()
  }

  const handleSaveOrgDigestSettings = async () => {
    if (userRole !== 'admin' || digestSaving) return
    if (!isOnline()) {
      setDigestError('Nur online speicherbar; bitte Verbindung herstellen.')
      return
    }
    setDigestSaving(true)
    setDigestError(null)
    const timeNorm =
      digestLocalTime.trim().length >= 4 ? digestLocalTime.trim().slice(0, 5) : '07:00'
    const { error } = await updateMonteurReportOrgDigestSettings({
      maintenance_digest_local_time: timeNorm,
      maintenance_digest_timezone: digestTimezone.trim() || 'Europe/Berlin',
      app_public_url: digestAppPublicUrl.trim() || null,
    })
    setDigestSaving(false)
    if (error) {
      setDigestError(error.message)
      return
    }
    showToast('Digest-Einstellungen gespeichert.', 'success')
  }

  const handleEtikettPresetChange = (id: EtikettPresetId) => {
    setEtikettPresetId(id)
    setEtikettPresetState(id)
  }

  const handleSaveMonteurDelivery = async () => {
    if (!showMonteurBerichtZustellung || monteurDeliverySaving) return
    if (!isOnline()) {
      setMonteurDeliveryError('Nur online speicherbar; bitte Verbindung herstellen.')
      return
    }
    if (monteurDeliveryMode === 'portal_notify' && !showMonteurPortalOption) {
      setMonteurDeliveryError('Kundenportal ist in der Lizenz nicht aktiv.')
      return
    }
    setMonteurDeliverySaving(true)
    setMonteurDeliveryError(null)
    const { error } = await updateMonteurReportSettings(monteurDeliveryMode)
    setMonteurDeliverySaving(false)
    if (error) {
      setMonteurDeliveryError(error.message)
      return
    }
    showToast('Zustellung Monteursbericht gespeichert.', 'success')
  }

  const handleSaveWartungChecklisteSettings = async () => {
    if (!showMonteurBerichtZustellung || wartungChecklisteSaving) return
    if (!isOnline()) {
      setWartungChecklisteError('Nur online speicherbar; bitte Verbindung herstellen.')
      return
    }
    setWartungChecklisteSaving(true)
    setWartungChecklisteError(null)
    const { error } = await updateMonteurReportWartungChecklisteSettings({
      wartung_checkliste_modus: wartungChecklisteModus,
      pruefprotokoll_address_mode: pruefprotokollAddressMode,
      mangel_neuer_auftrag_default: mangelNeuerAuftragDefault,
    })
    setWartungChecklisteSaving(false)
    if (error) {
      setWartungChecklisteError(error.message)
      return
    }
    showToast('Prüfbericht-Checkliste Einstellungen gespeichert.', 'success')
  }

  const handleSavePortalPdfShare = async () => {
    if (!showMonteurBerichtZustellung || !showMonteurPortalOption || portalPdfShareSaving) return
    if (!isOnline()) {
      setPortalPdfShareError('Nur online speicherbar; bitte Verbindung herstellen.')
      return
    }
    setPortalPdfShareSaving(true)
    setPortalPdfShareError(null)
    const { error } = await updateMonteurReportPortalPdfShareSettings({
      portal_share_monteur_report_pdf: portalShareMonteurPdf,
      portal_share_pruefprotokoll_pdf: portalSharePruefPdf,
      portal_timeline_show_planned: portalTimelineShowPlanned,
      portal_timeline_show_termin: portalTimelineShowTermin,
      portal_timeline_show_in_progress: portalTimelineShowInProgress,
    })
    setPortalPdfShareSaving(false)
    if (error) {
      setPortalPdfShareError(error.message)
      return
    }
    showToast('Kundenportal-Einstellungen gespeichert.', 'success')
  }

  const handleMandantPingChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.checked
    setMandantPingEnabled(v)
    setMandantPingEnabledState(v)
    window.dispatchEvent(new Event(MANDANT_PING_PREFERENCE_EVENT))
  }

  return (
    <div className="p-4 max-w-xl min-w-0">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Einstellungen</h2>

      <ImportStammdatenSection
        visible={isEnabled('kunden') && (userRole === 'admin' || userRole === 'mitarbeiter')}
      />

      <DoorFieldCatalogSettingsSection
        visible={userRole === 'admin' && kundenModuleOn}
        userRole={userRole}
        kundenModuleOn={kundenModuleOn}
        showToast={showToast}
        doorStammdatenListsEnabled={isEnabled(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL)}
        doorStammdatenCheckboxDisabled={updatingKey === COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL}
        onDoorStammdatenCheckboxChange={async (e) => {
          setComponentError(null)
          const checked = e.target.checked
          setUpdatingKey(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL)
          const result = await updateSetting(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL, checked)
          setUpdatingKey(null)
          if (!result.ok) {
            setComponentError(result.error ?? 'Speichern fehlgeschlagen')
          }
        }}
      />

      <DashboardLayoutSettingsSection
        visible={Boolean(user?.id)}
        dashboardLayout={dashboardLayout}
        updateWidgetVisible={updateWidgetVisible}
        moveWidgetOrder={moveWidgetOrder}
      />

      <MonteurReportPortalChecklistSettingsSection
        visible={Boolean(showMonteurBerichtZustellung)}
        showMonteurPortalOption={showMonteurPortalOption}
        monteurDeliveryLoaded={monteurDeliveryLoaded}
        monteurDeliveryMode={monteurDeliveryMode}
        setMonteurDeliveryMode={setMonteurDeliveryMode}
        monteurDeliveryError={monteurDeliveryError}
        monteurDeliverySaving={monteurDeliverySaving}
        onSaveMonteurDelivery={handleSaveMonteurDelivery}
        portalShareMonteurPdf={portalShareMonteurPdf}
        setPortalShareMonteurPdf={setPortalShareMonteurPdf}
        portalSharePruefPdf={portalSharePruefPdf}
        setPortalSharePruefPdf={setPortalSharePruefPdf}
        portalTimelineShowPlanned={portalTimelineShowPlanned}
        setPortalTimelineShowPlanned={setPortalTimelineShowPlanned}
        portalTimelineShowTermin={portalTimelineShowTermin}
        setPortalTimelineShowTermin={setPortalTimelineShowTermin}
        portalTimelineShowInProgress={portalTimelineShowInProgress}
        setPortalTimelineShowInProgress={setPortalTimelineShowInProgress}
        portalPdfShareError={portalPdfShareError}
        portalPdfShareSaving={portalPdfShareSaving}
        onSavePortalPdfShare={handleSavePortalPdfShare}
        wartungChecklisteModus={wartungChecklisteModus}
        setWartungChecklisteModus={setWartungChecklisteModus}
        pruefprotokollAddressMode={pruefprotokollAddressMode}
        setPruefprotokollAddressMode={setPruefprotokollAddressMode}
        mangelNeuerAuftragDefault={mangelNeuerAuftragDefault}
        setMangelNeuerAuftragDefault={setMangelNeuerAuftragDefault}
        wartungChecklisteError={wartungChecklisteError}
        wartungChecklisteSaving={wartungChecklisteSaving}
        onSaveWartungChecklisteSettings={handleSaveWartungChecklisteSettings}
      />

      {showWartungExtrasSettings && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="wartung-extras-heading"
        >
          <h3
            id="wartung-extras-heading"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3"
          >
            Wartung & Etikettendruck
          </h3>

          <MaintenanceReminderEmailSettingsBlock
            emailEnabled={maintEmailEnabled}
            onEmailEnabledChange={(on) => {
              setMaintEmailEnabled(on)
              if (!on) setMaintDigestConsentChecked(false)
            }}
            digestConsentChecked={maintDigestConsentChecked}
            onDigestConsentCheckedChange={setMaintDigestConsentChecked}
            reminderEmailConsentAt={myProfile?.maintenance_reminder_email_consent_at}
            emailFrequency={maintEmailFrequency}
            onEmailFrequencyChange={setMaintEmailFrequency}
            error={maintEmailError}
            saving={maintEmailSaving}
            onSave={handleSaveMaintenanceEmail}
            reminderEmailLastSentAt={myProfile?.maintenance_reminder_email_last_sent_at}
          />

          <MandantPingSettingsBlock
            visible={userRole === 'admin'}
            enabled={mandantPingEnabled}
            onChange={handleMandantPingChange}
          />

          <MaintenanceDigestAdminSettingsBlock
            visible={userRole === 'admin'}
            localTime={digestLocalTime}
            onLocalTimeChange={setDigestLocalTime}
            timezone={digestTimezone}
            onTimezoneChange={setDigestTimezone}
            appPublicUrl={digestAppPublicUrl}
            onAppPublicUrlChange={setDigestAppPublicUrl}
            error={digestError}
            saving={digestSaving}
            settingsLoaded={digestSettingsLoaded}
            onSave={handleSaveOrgDigestSettings}
          />

          <EtikettPresetSettingsBlock value={etikettPreset} onChange={handleEtikettPresetChange} />
        </section>
      )}

      <SyncSettingsSection
        syncStatus={syncStatus}
        isOffline={isOffline}
        pendingCount={pendingCount}
        lastSyncError={lastSyncError}
        isSyncing={isSyncing}
        onSyncNow={handleSyncNow}
        onSetSyncStatus={setSyncStatus}
        onClearSyncError={clearSyncError}
      />

      <GpsTrackingRevokeSettingsSection
        visible={Boolean(showGpsRevoke)}
        gpsRevoking={gpsRevoking}
        onRevokeGps={handleRevokeGps}
      />

      <StandortabfrageConsentSettingsSection
        visible={Boolean(showStandortabfrageConsent)}
        hasConsent={hasStandortabfrageConsent}
        isOffline={isOffline}
        pushSupported={isPushSupported()}
        pushEnabled={pushEnabled}
        pushSaving={pushSaving}
        standortConsentSaving={standortConsentSaving}
        onPushToggle={handlePushToggle}
        onGrantConsent={handleStandortabfrageConsent}
        onRevokeConsent={handleRevokeStandortabfrageConsent}
      />

      <StandortabfrageTeamleiterAdminSettingsSection
        visible={Boolean(showStandortabfrageSettings)}
        isOffline={isOffline}
        teamleiterLoading={standortTeamleiterLoading}
        teamleiterAllowed={standortTeamleiterAllowed}
        teamleiterSaving={standortTeamleiterSaving}
        onTeamleiterAllowedChange={handleStandortTeamleiterAllowedChange}
      />

      <StammdatenImpressumSettingsSection
        visible={Boolean(userRole === 'admin' && (design || impressum))}
        design={design}
        impressum={impressum}
        licenseApiConfigured={isLicenseApiConfigured()}
        isOffline={isOffline}
        onOpenEdit={handleOpenStammdatenEdit}
        showEdit={showStammdatenEdit}
        onModalBackdropRequestClose={() => {
          if (!stammdatenSaving && !stammdatenLoading) setShowStammdatenEdit(false)
        }}
        onCancelEdit={() => setShowStammdatenEdit(false)}
        stammdatenError={stammdatenError}
        stammdatenSaving={stammdatenSaving}
        stammdatenLoading={stammdatenLoading}
        stammdatenForm={stammdatenForm}
        setStammdatenForm={setStammdatenForm}
        onSaveStammdaten={handleSaveStammdaten}
      />

      <BriefbogenPdfSettingsSection
        visible={Boolean(showBriefbogenSettings)}
        followPageCompactTop={briefbogenFollowPageCompactTop}
        onFollowPageCompactTopChange={setBriefbogenFollowPageCompactTop}
        pdfMargins={briefbogenPdfMargins}
        onPdfMarginChange={handleBriefbogenPdfMarginChange}
        onSavePdfMargins={handleSaveBriefbogenPdfMargins}
        onResetPdfMargins={handleResetBriefbogenPdfMargins}
        error={briefbogenError}
        loading={briefbogenLoading}
        marginsSaving={briefbogenPdfMarginsSaving}
        previewUrl={briefbogenPreviewUrl}
        configured={briefbogenConfigured}
        isPdfPreview={briefbogenIsPdf}
        uploading={briefbogenUploading}
        removing={briefbogenRemoving}
        onFileChange={handleBriefbogenFileChange}
        onRemove={handleBriefbogenRemove}
      />

      <ComponentTogglesSettingsSection
        visible={userRole === 'admin'}
        settingsList={settingsList}
        updatingKey={updatingKey}
        setUpdatingKey={setUpdatingKey}
        componentError={componentError}
        setComponentError={setComponentError}
        updateSetting={updateSetting}
        refresh={refresh}
      />
    </div>
  )
}

export default Einstellungen
