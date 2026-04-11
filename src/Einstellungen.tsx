import { useState, useEffect, useCallback } from 'react'
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
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
import type { SyncStatus } from './types'
import type { Profile } from './lib/userService'
import { BetaBadge } from '../shared/BetaBadge'
import { useDashboardLayout } from './hooks/useDashboardLayout'
import {
  DASHBOARD_WIDGET_OPTIONS,
  getResolvedWidgetOrder,
  isDashboardWidgetVisible,
} from './lib/dashboardLayoutPreferences'
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
import {
  DEFAULT_BRIEFBOGEN_DIN_MARGINS_MM,
  DEFAULT_BRIEFBOGEN_FOLLOW_PAGE_TOP_MM,
} from '../shared/pdfBriefbogenLayout'
import { isOnline } from '../shared/networkUtils'
import {
  getMandantPingEnabled,
  setMandantPingEnabled,
  MANDANT_PING_INTERVAL_MS,
  MANDANT_PING_PREFERENCE_EVENT,
} from '../shared/mandantReachabilityPing'
import {
  getEtikettPresetId,
  setEtikettPresetId,
  ETIKETT_PRESET_OPTIONS,
  type EtikettPresetId,
} from './lib/etikettPreset'
import { isEtikettendruckerAvailable } from './lib/etikettendrucker'
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
import { fetchDoorFieldCatalog, updateDoorFieldCatalog } from './lib/doorFieldCatalog'
import { COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL } from './lib/componentSettingsService'

const SYNC_LABELS: Record<SyncStatus, string> = {
  offline: '🔴 Offline',
  ready: '🟢 Bereit',
  synced: '🔵 Synchronisiert',
}

const DIGEST_TIMEZONE_OPTIONS = [
  'Europe/Berlin',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/Amsterdam',
  'UTC',
] as const

const doorCatalogLinesToList = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

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
  const [doorCatDoor, setDoorCatDoor] = useState('')
  const [doorCatLockM, setDoorCatLockM] = useState('')
  const [doorCatLockT, setDoorCatLockT] = useState('')
  const [doorCatLoading, setDoorCatLoading] = useState(false)
  const [doorCatSaving, setDoorCatSaving] = useState(false)
  const [doorCatError, setDoorCatError] = useState<string | null>(null)
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
    await refreshBriefbogenPreview()
  }

  const handleOpenStammdatenEdit = () => {
    const imp = cachedLicense?.impressum
    const dat = cachedLicense?.datenschutz
    setStammdatenForm({
      company_name: imp?.company_name ?? '',
      address: imp?.address ?? '',
      contact: imp?.contact ?? '',
      represented_by: imp?.represented_by ?? '',
      register: imp?.register ?? '',
      vat_id: imp?.vat_id ?? '',
      responsible: dat?.responsible ?? '',
      contact_email: dat?.contact_email ?? '',
      dsb_email: dat?.dsb_email ?? '',
    })
    setStammdatenError(null)
    setShowStammdatenEdit(true)
  }

  const handleSaveStammdaten = async () => {
    if (!licenseNumber || stammdatenSaving) return
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
      setShowStammdatenEdit(false)
      await refreshLicense({ force: true })
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

  useEffect(() => {
    if (userRole !== 'admin' || !kundenModuleOn) return
    let cancelled = false
    setDoorCatLoading(true)
    void fetchDoorFieldCatalog().then((c) => {
      if (cancelled) return
      setDoorCatDoor(c.door_manufacturers.join('\n'))
      setDoorCatLockM(c.lock_manufacturers.join('\n'))
      setDoorCatLockT(c.lock_types.join('\n'))
      setDoorCatLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [userRole, kundenModuleOn])

  const handleSaveDoorFieldCatalog = async () => {
    if (userRole !== 'admin' || !kundenModuleOn || doorCatSaving) return
    if (!isOnline()) {
      setDoorCatError('Nur online speicherbar; bitte Verbindung herstellen.')
      return
    }
    setDoorCatSaving(true)
    setDoorCatError(null)
    const { error } = await updateDoorFieldCatalog({
      door_manufacturers: doorCatalogLinesToList(doorCatDoor),
      lock_manufacturers: doorCatalogLinesToList(doorCatLockM),
      lock_types: doorCatalogLinesToList(doorCatLockT),
    })
    setDoorCatSaving(false)
    if (error) {
      setDoorCatError(error.message)
      return
    }
    showToast('Auswahllisten Tür / Schließmittel gespeichert.', 'success')
  }

  return (
    <div className="p-4 max-w-xl min-w-0">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Einstellungen</h2>

      {/* Stammdaten importieren */}
      {isEnabled('kunden') && (userRole === 'admin' || userRole === 'mitarbeiter') && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="import-heading"
        >
          <h3 id="import-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Stammdaten importieren
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Kunden und Objekte/BV aus CSV oder Excel importieren.
          </p>
          <Link
            to="/import"
            className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover transition-colors"
            aria-label="Zum Import"
          >
            Import öffnen
          </Link>
        </section>
      )}

      {/* Tür / Schließmittel: Auswahllisten (Admin, Modul Kunden) */}
      {userRole === 'admin' && kundenModuleOn && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="door-field-catalog-heading"
        >
          <h3 id="door-field-catalog-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            Tür / Schließmittel (Auswahllisten)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Eine Zeile pro Eintrag. Die Listen erscheinen in den Stammdaten der Tür/Tore als Dropdown, sofern unten
            „Auswahllisten in Stammdaten aktiv“ eingeschaltet ist.
          </p>
          <label className="flex items-center justify-between gap-4 py-2 mb-3 border-b border-slate-200 dark:border-slate-600 cursor-pointer">
            <span className="text-sm text-slate-700 dark:text-slate-200">Auswahllisten in Stammdaten aktiv</span>
            <input
              type="checkbox"
              checked={isEnabled(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL)}
              disabled={updatingKey === COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL}
              onChange={async (e) => {
                setComponentError(null)
                const checked = e.target.checked
                setUpdatingKey(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL)
                const result = await updateSetting(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL, checked)
                setUpdatingKey(null)
                if (!result.ok) {
                  setComponentError(result.error ?? 'Speichern fehlgeschlagen')
                }
              }}
              className="w-5 h-5 rounded border-slate-300 dark:border-slate-500 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
              aria-label={
                isEnabled(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL)
                  ? 'Auswahllisten in Stammdaten deaktivieren'
                  : 'Auswahllisten in Stammdaten aktivieren'
              }
            />
          </label>
          {!isEnabled(COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL) ? (
            <p
              className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded-lg mb-3"
              role="status"
            >
              Deaktiviert: In Tür/Tor-Stammdaten erscheinen nur Freitextfelder (keine Dropdowns).
            </p>
          ) : null}
          {doorCatLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Lade Katalog…</p>
          ) : (
            <div className="space-y-3 mb-4">
              <div>
                <label htmlFor="door-cat-manufacturers" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Tür-Hersteller
                </label>
                <textarea
                  id="door-cat-manufacturers"
                  value={doorCatDoor}
                  onChange={(e) => setDoorCatDoor(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
                  placeholder="z. B. Mustermann GmbH"
                  aria-label="Liste Tür-Hersteller, eine Zeile pro Eintrag"
                />
              </div>
              <div>
                <label htmlFor="door-cat-lock-m" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Schließmittel Hersteller
                </label>
                <textarea
                  id="door-cat-lock-m"
                  value={doorCatLockM}
                  onChange={(e) => setDoorCatLockM(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
                  aria-label="Liste Schließmittel-Hersteller"
                />
              </div>
              <div>
                <label htmlFor="door-cat-lock-t" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Schließmittel Typ
                </label>
                <textarea
                  id="door-cat-lock-t"
                  value={doorCatLockT}
                  onChange={(e) => setDoorCatLockT(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
                  aria-label="Liste Schließmittel-Typen"
                />
              </div>
            </div>
          )}
          {doorCatError ? (
            <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
              {doorCatError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSaveDoorFieldCatalog()}
            disabled={doorCatSaving || doorCatLoading}
            className="inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {doorCatSaving ? 'Speichern…' : 'Auswahllisten speichern'}
          </button>
        </section>
      )}

      {/* Startseite / Dashboard-Widgets */}
      {user?.id && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="dashboard-layout-heading"
        >
          <h3 id="dashboard-layout-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            Startseite (Dashboard)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Legen Sie fest, welche Bereiche auf der Startseite angezeigt werden und in welcher Reihenfolge sie von oben
            nach unten erscheinen (Pfeile). Die Auswahl wird mit Ihrem Konto synchronisiert (<strong>Multi-Gerät</strong>
            ); offline wird ein lokaler Zwischenspeicher genutzt und beim nächsten Sync übertragen. Einzelne Kacheln
            erscheinen nur, wenn Lizenz und Rolle das Modul erlauben (z. B. Arbeitszeit).
          </p>
          <ul className="space-y-3" role="list">
            {getResolvedWidgetOrder(dashboardLayout).map((widgetId, index) => {
              const opt = DASHBOARD_WIDGET_OPTIONS.find((o) => o.id === widgetId)
              if (!opt) return null
              const order = getResolvedWidgetOrder(dashboardLayout)
              const atTop = index === 0
              const atBottom = index === order.length - 1
              const checked = isDashboardWidgetVisible(dashboardLayout, opt.id)
              const handleMoveUp = () => {
                moveWidgetOrder(opt.id, 'up')
              }
              const handleMoveDown = () => {
                moveWidgetOrder(opt.id, 'down')
              }
              const handleMoveKeyDown = (e: ReactKeyboardEvent, direction: 'up' | 'down') => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                if (direction === 'up' && !atTop) moveWidgetOrder(opt.id, 'up')
                if (direction === 'down' && !atBottom) moveWidgetOrder(opt.id, 'down')
              }
              return (
                <li key={opt.id} className="flex items-start gap-2">
                  <div
                    className="flex flex-col gap-0.5 shrink-0 pt-0.5"
                    role="group"
                    aria-label={`Reihenfolge: ${opt.label}`}
                  >
                    <button
                      type="button"
                      onClick={handleMoveUp}
                      onKeyDown={(e) => handleMoveKeyDown(e, 'up')}
                      disabled={atTop}
                      className="inline-flex items-center justify-center min-w-[2rem] min-h-[1.75rem] rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                      aria-label={`${opt.label} nach oben verschieben`}
                      title="Nach oben"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={handleMoveDown}
                      onKeyDown={(e) => handleMoveKeyDown(e, 'down')}
                      disabled={atBottom}
                      className="inline-flex items-center justify-center min-w-[2rem] min-h-[1.75rem] rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                      aria-label={`${opt.label} nach unten verschieben`}
                      title="Nach unten"
                    >
                      ↓
                    </button>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => updateWidgetVisible(opt.id, e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                      aria-describedby={`dashboard-widget-desc-${opt.id}`}
                    />
                    <span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                      <span id={`dashboard-widget-desc-${opt.id}`} className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {opt.description}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {showMonteurBerichtZustellung && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="monteur-zustellung-heading"
        >
          <h3
            id="monteur-zustellung-heading"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
          >
            Monteurbericht an Kunden (nach Auftrags-Abschluss)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Gilt firmenweit für den Abschluss aus dem Auftrags-Monteursbericht (Tür/Tor-QR). Die Option „Kundenportal“
            steht nur zur Verfügung, wenn das Kundenportal lizenziert ist und am jeweiligen Objekt mindestens ein
            Portal-Zugang mit Sichtbarkeit für Firma/BV existiert; sonst wird beim Abschließen eine Hinweismeldung
            angezeigt und kein Portal-Eintrag erzeugt.
          </p>
          {!monteurDeliveryLoaded ? (
            <p className="text-sm text-slate-500">Lade Einstellung…</p>
          ) : (
            <div className="space-y-3 mb-4">
              {(
                [
                  {
                    value: 'none' as const,
                    label: 'Keine automatische Zustellung',
                    hint: 'Nur PDF-Download und Speicherung; der Kunde erhält nichts automatisch.',
                  },
                  {
                    value: 'email_auto' as const,
                    label: 'Sofort per E-Mail (PDF im Anhang)',
                    hint: 'Nach „Auftrag abschließen“ wird automatisch an die unter Kunde oder BV hinterlegte Prüfbericht-Adresse gesendet (BV hat Vorrang).',
                  },
                  {
                    value: 'email_manual' as const,
                    label: 'Manuell per E-Mail (PDF im Anhang)',
                    hint: 'Nach dem Abschluss erscheint ein Button „An Kunde senden“ mit gleicher Adresslogik.',
                  },
                  ...(showMonteurPortalOption
                    ? [
                        {
                          value: 'portal_notify' as const,
                          label: 'Kundenportal + Benachrichtigung',
                          hint: 'PDF als Prüfbericht im Portal; Portal-Nutzer werden per E-Mail informiert.',
                        },
                      ]
                    : []),
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <input
                    type="radio"
                    name="monteur-delivery-mode"
                    value={opt.value}
                    checked={monteurDeliveryMode === opt.value}
                    onChange={() => setMonteurDeliveryMode(opt.value)}
                    className="mt-1 w-4 h-4 border-slate-300 text-vico-primary focus:ring-vico-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.hint}</span>
                  </span>
                </label>
              ))}
              {!showMonteurPortalOption &&
              monteurDeliveryMode === 'portal_notify' ? (
                <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
                  In der Datenbank ist „Kundenportal“ gewählt, die Lizenz enthält das Kundenportal derzeit nicht. Bitte
                  wählen Sie eine andere Option und speichern Sie.
                </p>
              ) : null}
            </div>
          )}
          {monteurDeliveryError ? (
            <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
              {monteurDeliveryError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSaveMonteurDelivery}
            disabled={monteurDeliverySaving || !monteurDeliveryLoaded}
            className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
          >
            {monteurDeliverySaving ? 'Speichern…' : 'Monteurbericht-Zustellung speichern'}
          </button>
          {showMonteurPortalOption ? (
            <div className="mt-4 border-t border-slate-200 dark:border-slate-600 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Kundenportal: PDF-Freigaben &amp; Auftrags-Fortschritt
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Unabhängig von der Zustell-Option oben steuern Sie hier PDFs (Monteurbericht vs. Prüfprotokoll) sowie
                Hinweise und eine einfache Zeitleiste zu Aufträgen an sichtbaren Türen im Kundenportal (Seite Berichte).
              </p>
              {!monteurDeliveryLoaded ? (
                <p className="text-sm text-slate-500">Lade Einstellung…</p>
              ) : (
                <>
                  <label className="flex items-start gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={portalShareMonteurPdf}
                      onChange={(e) => setPortalShareMonteurPdf(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-100">
                      Monteurbericht-PDF im Portal anzeigen
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={portalSharePruefPdf}
                      onChange={(e) => setPortalSharePruefPdf(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-100">
                      Prüfprotokoll-PDF im Portal anzeigen
                    </span>
                  </label>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-3 mb-2">
                    Auftrags-Fortschritt (Banner &amp; Zeitleiste)
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={portalTimelineShowPlanned}
                      onChange={(e) => setPortalTimelineShowPlanned(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-100">
                      Phase „geplant“ (Status offen) im Portal anzeigen
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={portalTimelineShowTermin}
                      onChange={(e) => setPortalTimelineShowTermin(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-100">
                      Geplanten Wartungstermin in der Zeitleiste anzeigen
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={portalTimelineShowInProgress}
                      onChange={(e) => setPortalTimelineShowInProgress(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-100">
                      Phase „in Bearbeitung“ / abgeschlossen in der Zeitleiste anzeigen
                    </span>
                  </label>
                  {portalPdfShareError ? (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
                      {portalPdfShareError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSavePortalPdfShare}
                    disabled={portalPdfShareSaving || !monteurDeliveryLoaded}
                    className="inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    {portalPdfShareSaving ? 'Speichern…' : 'Kundenportal speichern'}
                  </button>
                </>
              )}
            </div>
          ) : null}
          <div className="mt-4 border-t border-slate-200 dark:border-slate-600 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Prüfbericht-Checkliste
            </h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="radio"
                  name="checklist-modus"
                  checked={wartungChecklisteModus === 'detail'}
                  onChange={() => setWartungChecklisteModus('detail')}
                  className="w-4 h-4 border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                Detailmodus
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="radio"
                  name="checklist-modus"
                  checked={wartungChecklisteModus === 'compact'}
                  onChange={() => setWartungChecklisteModus('compact')}
                  className="w-4 h-4 border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                Kompaktmodus
              </label>
            </div>
            <div className="mt-3">
              <label
                htmlFor="pruefprotokoll-address-mode"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
              >
                Prüfprotokoll: Adressblöcke
              </label>
              <select
                id="pruefprotokoll-address-mode"
                value={pruefprotokollAddressMode}
                onChange={(e) => setPruefprotokollAddressMode(e.target.value as PruefprotokollAddressMode)}
                className="w-full max-w-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
              >
                <option value="both">Kunde + Objekt/BV anzeigen (Standard)</option>
                <option value="bv_only">Nur Objekt/BV anzeigen</option>
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Bei Türen direkt unter dem Kunden wird Objekt/BV automatisch ausgeblendet.
              </p>
            </div>
            <label className="mt-3 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mangelNeuerAuftragDefault}
                onChange={(e) => setMangelNeuerAuftragDefault(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              />
              <span className="text-sm text-slate-800 dark:text-slate-100">
                Nach Abschluss bei offenem Mangel standardmäßig Folgeauftrag empfehlen
              </span>
            </label>
            {wartungChecklisteError ? (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">{wartungChecklisteError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleSaveWartungChecklisteSettings}
              disabled={wartungChecklisteSaving || !monteurDeliveryLoaded}
              className="mt-3 inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {wartungChecklisteSaving ? 'Speichern…' : 'Checkliste-Einstellungen speichern'}
            </button>
          </div>
        </section>
      )}

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

          <div className="border-b border-slate-200 dark:border-slate-600 pb-4 mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              E-Mail-Erinnerungen (J1)
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Wenn aktiviert, erhalten Sie eine E-Mail mit Objekten, deren Wartung überfällig ist oder in den nächsten 30
              Tagen fällig wird – sofern Ihr Administrator die Edge Function &quot;send-maintenance-reminder-digest&quot;
              (z. B. per Cron) und Resend konfiguriert hat.
            </p>
            <label className="flex items-start gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={maintEmailEnabled}
                onChange={(e) => {
                  const on = e.target.checked
                  setMaintEmailEnabled(on)
                  if (!on) setMaintDigestConsentChecked(false)
                }}
                className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              />
              <span className="text-sm text-slate-800 dark:text-slate-100">
                E-Mail-Benachrichtigung zu fälligen Wartungen
              </span>
            </label>
            {maintEmailEnabled && !myProfile?.maintenance_reminder_email_consent_at ? (
              <label className="flex items-start gap-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={maintDigestConsentChecked}
                  onChange={(e) => setMaintDigestConsentChecked(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">
                  Ich willige ein, dass mir Vico zum genannten Zweck Erinnerungs-E-Mails an meine hinterlegte Adresse
                  sendet (betriebliche Verarbeitung; Widerruf durch Deaktivieren der Option).
                </span>
              </label>
            ) : null}
            {maintEmailEnabled && myProfile?.maintenance_reminder_email_consent_at ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Einwilligung erteilt am{' '}
                {new Date(myProfile.maintenance_reminder_email_consent_at).toLocaleString('de-DE')}. Widerruf: Option
                deaktivieren und speichern.
              </p>
            ) : null}
            <div className="mb-3">
              <label htmlFor="maint-email-freq" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Häufigkeit (nach Versand wird bis zum nächsten Zyklus gewartet)
              </label>
              <select
                id="maint-email-freq"
                value={maintEmailFrequency}
                onChange={(e) =>
                  setMaintEmailFrequency(e.target.value === 'daily' ? 'daily' : 'weekly')
                }
                className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
              >
                <option value="weekly">Höchstens einmal pro Woche</option>
                <option value="daily">Höchstens einmal pro Tag</option>
              </select>
            </div>
            {maintEmailError ? (
              <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
                {maintEmailError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleSaveMaintenanceEmail}
              disabled={maintEmailSaving}
              className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
            >
              {maintEmailSaving ? 'Speichern…' : 'E-Mail-Einstellungen speichern'}
            </button>
            {myProfile?.maintenance_reminder_email_last_sent_at ? (
              <p className="mt-2 text-xs text-slate-500">
                Zuletzt gesendet:{' '}
                {new Date(myProfile.maintenance_reminder_email_last_sent_at).toLocaleString('de-DE')}
              </p>
            ) : null}
          </div>

          {userRole === 'admin' && (
            <div className="border-b border-slate-200 dark:border-slate-600 pb-4 mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Netzwerk (Diagnose)
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Optional: regelmäßiger Erreichbarkeits-Check zum Mandanten-Supabase (HEAD auf die REST-Schnittstelle).
                Standard ist aus. Bei Aktivierung etwa alle {MANDANT_PING_INTERVAL_MS / 60_000} Minuten; nur
                in diesem Browser gespeichert. Wirkt auf den Hinweis bei instabiler Verbindung (eingeschränkter Modus).
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mandantPingEnabled}
                  onChange={handleMandantPingChange}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                  aria-label="Erreichbarkeits-Ping zum Mandanten-Server aktivieren"
                />
                <span className="text-sm text-slate-800 dark:text-slate-100">
                  Erreichbarkeits-Ping zum Server aktivieren
                </span>
              </label>
            </div>
          )}

          {userRole === 'admin' && (
            <div className="border-b border-slate-200 dark:border-slate-600 pb-4 mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Digest-Versand (Admin)
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Lokale Uhrzeit und Zeitzone für die Edge Function &quot;send-maintenance-reminder-digest&quot;. Die
                Funktion versendet nur in der konfigurierten Stunde – Cron mindestens stündlich ausführen (z. B. zur
                vollen Stunde). Öffentliche App-URL für den Link in der E-Mail (Fallback: Umgebungsvariable der
                Function).
              </p>
              <div className="grid gap-3 sm:grid-cols-2 mb-3">
                <div>
                  <label
                    htmlFor="digest-local-time"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Lokale Uhrzeit (Stunde)
                  </label>
                  <input
                    id="digest-local-time"
                    type="time"
                    value={digestLocalTime}
                    onChange={(e) => setDigestLocalTime(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="digest-tz"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Zeitzone
                  </label>
                  <select
                    id="digest-tz"
                    value={digestTimezone}
                    onChange={(e) => setDigestTimezone(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                  >
                    {DIGEST_TIMEZONE_OPTIONS.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label
                  htmlFor="digest-app-url"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Öffentliche App-URL (optional)
                </label>
                <input
                  id="digest-app-url"
                  type="url"
                  placeholder="https://app.example.com"
                  value={digestAppPublicUrl}
                  onChange={(e) => setDigestAppPublicUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm"
                />
              </div>
              {digestError ? (
                <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
                  {digestError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleSaveOrgDigestSettings}
                disabled={digestSaving || !digestSettingsLoaded}
                className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 dark:bg-slate-600 text-white hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-50"
              >
                {digestSaving ? 'Speichern…' : 'Digest-Einstellungen speichern'}
              </button>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              QR-Etikett (I2)
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Referenzmaße für den späteren Bluetooth-Druck in der nativen App. Wird lokal auf diesem Gerät gespeichert.
            </p>
            <div className="space-y-2 mb-2">
              {ETIKETT_PRESET_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <input
                    type="radio"
                    name="etikett-preset"
                    value={opt.id}
                    checked={etikettPreset === opt.id}
                    onChange={() => handleEtikettPresetChange(opt.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                    {opt.description ? (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{opt.description}</span>
                    ) : null}
                    <span className="block text-xs text-slate-400 font-mono mt-0.5">
                      {opt.widthMm}×{opt.heightMm} mm
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Native Druck-Plugin:{' '}
              {isEtikettendruckerAvailable() ? (
                <span className="text-emerald-600 dark:text-emerald-400">verfügbar</span>
              ) : (
                <span>Nicht aktiv (Web/PWA – Druck nur in der Capacitor-App mit Plugin).</span>
              )}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              <a
                href="/BENUTZERANLEITUNG.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vico-primary hover:underline font-medium"
              >
                Anleitung: QR-Code und A4-Etiketten (Abschnitt in der Benutzeranleitung)
              </a>
            </p>
          </div>
        </section>
      )}

      {/* Sync */}
      <section
        className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
        aria-labelledby="sync-heading"
      >
        <h3 id="sync-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Synchronisation
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-600 dark:text-slate-400">
            {pendingCount > 0
              ? `${pendingCount} Änderung(en) ausstehend`
              : 'Alles synchronisiert'}
          </span>
          <span className="px-2 py-0.5 rounded text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {SYNC_LABELS[syncStatus]}
          </span>
        </div>
        {lastSyncError && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">Sync-Fehler</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {lastSyncError === 'TypeError: Load failed' || lastSyncError.includes('Failed to fetch') || lastSyncError.includes('Load failed')
                ? 'Netzwerkfehler. Bitte Verbindung prüfen. Bei Supabase Free-Tier: Projekt kann nach Inaktivität pausieren (Aufwecken dauert oft 1–2 Min.).'
                : lastSyncError}
            </p>
            {(lastSyncError.includes('duplicate') || lastSyncError.includes('conflict') || lastSyncError.includes('unique') || lastSyncError.includes('violates')) && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Möglicher Konflikt: Server-Daten wurden zwischenzeitlich geändert. Nach Pull werden lokale Änderungen überschrieben (Last-Write-Wins).
              </p>
            )}
            <button
              type="button"
              onClick={clearSyncError}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Meldung schließen
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={isSyncing || isOffline}
          title={isOffline ? 'Offline – Sync erst bei Verbindung möglich' : undefined}
          className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSyncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
        </button>
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">Sync-Status testen (UI)</p>
          <div className="flex flex-wrap gap-2">
            {(['offline', 'ready', 'synced'] as SyncStatus[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSyncStatus(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  syncStatus === value
                    ? 'bg-vico-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                aria-pressed={syncStatus === value}
              >
                {SYNC_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Zeiterfassung – Ortung widerrufen */}
      {showGpsRevoke && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="ortung-heading"
        >
          <h3
            id="ortung-heading"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex flex-wrap items-center gap-2"
          >
            <span>Zeiterfassung – Ortung (Stempeln)</span>
            <BetaBadge aria-hidden="true" />
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Sie haben die Standorterfassung bei Arbeitsbeginn/-ende aktiviert. Sie können die Einwilligung jederzeit
            widerrufen; danach wird kein Standort mehr erfasst. Anzeige und Erfassung sind derzeit{' '}
            <strong>Beta</strong> – nach Live-Gang erneut prüfen; lokal kann das Verhalten abweichen.
          </p>
          <button
            type="button"
            onClick={handleRevokeGps}
            disabled={gpsRevoking}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50"
            aria-label="Ortung deaktivieren"
          >
            {gpsRevoking ? 'Wird deaktiviert…' : 'Ortung deaktivieren (Einwilligung widerrufen)'}
          </button>
        </section>
      )}

      {/* Standortabfrage – Einwilligung (Mitarbeiter/Teamleiter/Admin) */}
      {showStandortabfrageConsent && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="standortabfrage-consent-heading"
        >
          <h3
            id="standortabfrage-consent-heading"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex flex-wrap items-center gap-2"
          >
            <span>Standortabfrage – Ihre Einwilligung</span>
            <BetaBadge aria-hidden="true" />
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Wenn Sie einwilligen, können Sie Ihren aktuellen Standort an Admin bzw. Teamleiter senden. Diese können Ihren
            Standort im Arbeitszeitenportal abrufen, wenn Sie ihn gesendet haben. Die Einwilligung ist freiwillig und
            jederzeit widerrufbar. <strong>Beta</strong> – vor produktivem Einsatz siehe interne Checkliste (Doku §3a).
          </p>
          {hasStandortabfrageConsent ? (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Sie haben eingewilligt. Sie können Ihren Standort in der Zeiterfassung senden.
              </p>
              {isPushSupported() && (
                <label className={`flex items-center gap-3 mb-3 ${isOffline ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={pushEnabled ?? false}
                    disabled={pushSaving || isOffline}
                    onChange={(e) => !isOffline && handlePushToggle(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
                    aria-label="Benachrichtigungen bei Standortanfrage"
                    title={isOffline ? 'Offline – Push-Einstellung erst bei Verbindung möglich' : undefined}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    Benachrichtigungen bei Standortanfrage (Push)
                  </span>
                </label>
              )}
              <button
                type="button"
                onClick={handleRevokeStandortabfrageConsent}
                disabled={standortConsentSaving || isOffline}
                title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50"
                aria-label="Einwilligung widerrufen"
              >
                {standortConsentSaving ? 'Wird gespeichert…' : 'Einwilligung widerrufen'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStandortabfrageConsent}
              disabled={standortConsentSaving || isOffline}
              title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
              aria-label="Einwilligung erteilen"
            >
              {standortConsentSaving ? 'Wird gespeichert…' : 'Einwilligung erteilen'}
            </button>
          )}
        </section>
      )}

      {/* Standortabfrage – Teamleiter-Berechtigung (nur Admin, nur wenn Lizenz-Feature aktiv) */}
      {showStandortabfrageSettings && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="standortabfrage-heading"
        >
          <h3
            id="standortabfrage-heading"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex flex-wrap items-center gap-2"
          >
            <span>Standortabfrage (Admin)</span>
            <BetaBadge aria-hidden="true" />
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Mitarbeiter können ihren aktuellen Standort an Admin/Teamleiter senden. Hier legen Sie fest, ob auch Teamleiter
            die Standorte ihrer Teammitglieder abfragen dürfen oder nur Sie als Admin. Lizenz-Feature{' '}
            <strong>standortabfrage</strong> nur bewusst aktivieren; siehe Doku §3a (Beta / rechtliche Prüfung).
          </p>
          {standortTeamleiterLoading ? (
            <p className="text-sm text-slate-500">Lade Einstellung…</p>
          ) : (
            <label className={`flex items-center gap-3 ${isOffline ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={standortTeamleiterAllowed}
                disabled={standortTeamleiterSaving || isOffline}
                onChange={async (e) => {
                  if (isOffline) return
                  const checked = e.target.checked
                  setStandortTeamleiterSaving(true)
                  const { error } = await setStandortabfrageTeamleiterAllowed(checked)
                  setStandortTeamleiterSaving(false)
                  if (!error) setStandortTeamleiterAllowed(checked)
                }}
                className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
                aria-label="Teamleiter dürfen Standort abfragen"
                title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                Teamleiter dürfen Standort abfragen
              </span>
            </label>
          )}
        </section>
      )}

      {/* Stammdaten / Impressum (Admin, Self-Service) */}
      {userRole === 'admin' && (design || impressum) && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="stammdaten-heading"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 id="stammdaten-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Stammdaten / Impressum
            </h3>
            {isLicenseApiConfigured() && (
              <button
                type="button"
                onClick={handleOpenStammdatenEdit}
                disabled={isOffline}
                title={isOffline ? 'Offline – erst bei Verbindung möglich' : undefined}
                className={`text-xs font-medium ${isOffline ? 'text-slate-400 cursor-not-allowed' : 'text-vico-primary hover:underline'}`}
                aria-label="Stammdaten bearbeiten"
              >
                Bearbeiten
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            {isLicenseApiConfigured()
              ? 'Impressum und Datenschutz können Sie hier bearbeiten.'
              : 'Anzeige aus dem Lizenzportal.'}
          </p>
          <dl className="space-y-1 text-sm">
            {design?.app_name && (
              <>
                <dt className="text-slate-500 dark:text-slate-400">App-Name</dt>
                <dd className="text-slate-800 dark:text-slate-100 font-medium">{design.app_name}</dd>
              </>
            )}
            {design?.logo_url ? (
              <>
                <dt className="text-slate-500 dark:text-slate-400 mt-2">Logo (Lizenz)</dt>
                <dd className="mt-1">
                  <img
                    src={design.logo_url}
                    alt=""
                    className="h-12 max-w-[220px] object-contain border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 p-1"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">{design.logo_url}</p>
                </dd>
              </>
            ) : null}
            {impressum?.company_name && (
              <>
                <dt className="text-slate-500 dark:text-slate-400 mt-2">Firma</dt>
                <dd className="text-slate-800 dark:text-slate-100">{impressum.company_name}</dd>
              </>
            )}
            {impressum?.address && (
              <>
                <dt className="text-slate-500 dark:text-slate-400 mt-2">Adresse</dt>
                <dd className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{impressum.address}</dd>
              </>
            )}
            {impressum?.contact && (
              <>
                <dt className="text-slate-500 dark:text-slate-400 mt-2">Kontakt</dt>
                <dd className="text-slate-800 dark:text-slate-100">{impressum.contact}</dd>
              </>
            )}
          </dl>

          {showStammdatenEdit && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="stammdaten-modal-heading"
              onClick={() => !stammdatenSaving && setShowStammdatenEdit(false)}
            >
              <div
                className="max-w-lg w-full min-w-0 max-h-[min(90vh,90dvh)] overflow-auto p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h4 id="stammdaten-modal-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                  Stammdaten bearbeiten
                </h4>
                {stammdatenError && (
                  <p className="mb-4 p-3 text-sm text-red-800 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg" role="alert">
                    {stammdatenError}
                  </p>
                )}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="stammdaten-company" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Firmenname</label>
                    <input
                      id="stammdaten-company"
                      type="text"
                      value={stammdatenForm.company_name}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, company_name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="stammdaten-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adresse</label>
                    <textarea
                      id="stammdaten-address"
                      value={stammdatenForm.address}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, address: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="stammdaten-contact" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kontakt</label>
                    <input
                      id="stammdaten-contact"
                      type="text"
                      value={stammdatenForm.contact}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, contact: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="stammdaten-represented" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vertreten durch</label>
                    <input
                      id="stammdaten-represented"
                      type="text"
                      value={stammdatenForm.represented_by}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, represented_by: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="stammdaten-register" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Handelsregister</label>
                    <input
                      id="stammdaten-register"
                      type="text"
                      value={stammdatenForm.register}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, register: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="stammdaten-vat" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">USt-ID</label>
                    <input
                      id="stammdaten-vat"
                      type="text"
                      value={stammdatenForm.vat_id}
                      onChange={(e) => setStammdatenForm((f) => ({ ...f, vat_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-600">
                    <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Datenschutz</h5>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="stammdaten-verantwortlich" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Verantwortlicher</label>
                        <input
                          id="stammdaten-verantwortlich"
                          type="text"
                          value={stammdatenForm.responsible}
                          onChange={(e) => setStammdatenForm((f) => ({ ...f, responsible: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor="stammdaten-dsb-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kontakt-E-Mail</label>
                        <input
                          id="stammdaten-dsb-email"
                          type="email"
                          value={stammdatenForm.contact_email}
                          onChange={(e) => setStammdatenForm((f) => ({ ...f, contact_email: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor="stammdaten-dsb" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">DSB-E-Mail</label>
                        <input
                          id="stammdaten-dsb"
                          type="email"
                          value={stammdatenForm.dsb_email}
                          onChange={(e) => setStammdatenForm((f) => ({ ...f, dsb_email: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    type="button"
                    onClick={handleSaveStammdaten}
                    disabled={stammdatenSaving}
                    className="px-4 py-2 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50"
                  >
                    {stammdatenSaving ? 'Speichern…' : 'Speichern'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStammdatenEdit(false)}
                    disabled={stammdatenSaving}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* PDF-Briefbogen für Prüfberichte (Admin) */}
      {showBriefbogenSettings && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="briefbogen-heading"
        >
          <h3 id="briefbogen-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            PDF-Briefbogen (Prüfbericht)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            <strong className="text-slate-700 dark:text-slate-300">PNG, JPEG</strong> oder{' '}
            <strong className="text-slate-700 dark:text-slate-300">PDF</strong> (ideal A4).{' '}
            <strong className="text-slate-700 dark:text-slate-300">PDF mit zwei Seiten:</strong> Seite 1 = Deckblatt
            (Logo/Kopf), Seite 2 = Folgeseiten (z. B. nur Fußzeile). Einseitiges PDF oder Bild: gleiche
            Vorlage auf allen Seiten.             PDF-Text wird im Brieffeld platziert. Standard sind DIN-5008-orientierte Ränder; darunter können Sie
            die Abstände in Millimetern korrigieren (gilt für Prüfberichte, Monteur-PDF, Arbeitszeit-Exporte mit
            Briefbogen).
          </p>
          <div
            className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600"
            aria-labelledby="briefbogen-margins-heading"
          >
            <h4
              id="briefbogen-margins-heading"
              className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2"
            >
              Textposition im PDF (mm)
            </h4>
            <p id="briefbogen-margins-hint" className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Oben, unten, links, rechts vom Blattrand bis zum Textbereich. Werte 0–120; Summe der Ränder muss auf
              A4 Hoch- und Querformat einen sichtbaren Bereich lassen.
            </p>
            <label className="flex items-start gap-2 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={briefbogenFollowPageCompactTop}
                onChange={(e) => setBriefbogenFollowPageCompactTop(e.target.checked)}
                disabled={briefbogenLoading || briefbogenPdfMarginsSaving}
                className="mt-1 rounded border-slate-300 dark:border-slate-600 disabled:opacity-50"
                aria-describedby="briefbogen-follow-top-hint"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Folgeseiten ohne Briefkopf:</span>{' '}
                Ab Seite 2 den großen oberen Abstand nicht anwenden (Textrand oben{' '}
                {DEFAULT_BRIEFBOGEN_FOLLOW_PAGE_TOP_MM} mm). Aktivieren, wenn Ihre zweite Briefbogen-Seite keinen
                Kopfbereich zeigt.
              </span>
            </label>
            <p id="briefbogen-follow-top-hint" className="sr-only">
              Steuert den oberen Rand für PDF-Seiten ab der zweiten bei mehrseitigen Dokumenten mit Briefbogen.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label htmlFor="briefbogen-margin-top" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Oben
                </label>
                <input
                  id="briefbogen-margin-top"
                  type="number"
                  min={0}
                  max={120}
                  step={0.1}
                  value={briefbogenPdfMargins.top}
                  onChange={handleBriefbogenPdfMarginChange('top')}
                  disabled={briefbogenLoading || briefbogenPdfMarginsSaving}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
                  aria-describedby="briefbogen-margins-hint"
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="briefbogen-margin-bottom"
                  className="block text-xs text-slate-600 dark:text-slate-400 mb-1"
                >
                  Unten
                </label>
                <input
                  id="briefbogen-margin-bottom"
                  type="number"
                  min={0}
                  max={120}
                  step={0.1}
                  value={briefbogenPdfMargins.bottom}
                  onChange={handleBriefbogenPdfMarginChange('bottom')}
                  disabled={briefbogenLoading || briefbogenPdfMarginsSaving}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
                  aria-describedby="briefbogen-margins-hint"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="briefbogen-margin-left" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Links
                </label>
                <input
                  id="briefbogen-margin-left"
                  type="number"
                  min={0}
                  max={120}
                  step={0.1}
                  value={briefbogenPdfMargins.left}
                  onChange={handleBriefbogenPdfMarginChange('left')}
                  disabled={briefbogenLoading || briefbogenPdfMarginsSaving}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
                  aria-describedby="briefbogen-margins-hint"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="briefbogen-margin-right" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Rechts
                </label>
                <input
                  id="briefbogen-margin-right"
                  type="number"
                  min={0}
                  max={120}
                  step={0.1}
                  value={briefbogenPdfMargins.right}
                  onChange={handleBriefbogenPdfMarginChange('right')}
                  disabled={briefbogenLoading || briefbogenPdfMarginsSaving}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
                  aria-describedby="briefbogen-margins-hint"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSaveBriefbogenPdfMargins()}
                disabled={briefbogenLoading || briefbogenPdfMarginsSaving}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
                aria-label="PDF-Textfeldränder speichern"
              >
                {briefbogenPdfMarginsSaving ? 'Speichern…' : 'Ränder speichern'}
              </button>
              <button
                type="button"
                onClick={() => void handleResetBriefbogenPdfMargins()}
                disabled={briefbogenLoading || briefbogenPdfMarginsSaving}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                aria-label="PDF-Textfeldränder auf DIN-Standard zurücksetzen"
              >
                Standard wiederherstellen
              </button>
            </div>
          </div>
          {briefbogenError && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg" role="alert">
              {briefbogenError}
            </p>
          )}
          {briefbogenLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Lade Status…</p>
          ) : (
            <div className="space-y-3">
              {briefbogenPreviewUrl && briefbogenConfigured && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Vorschau (Ausschnitt)</p>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-900 max-h-48">
                    {briefbogenIsPdf ? (
                      <iframe
                        title="Vorschau Mandanten-Briefbogen PDF"
                        src={briefbogenPreviewUrl}
                        className="w-full h-48 border-0 bg-white"
                      />
                    ) : (
                      <img
                        src={briefbogenPreviewUrl}
                        alt="Aktueller PDF-Briefbogen"
                        className="w-full h-auto object-top object-contain max-h-48"
                      />
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex">
                  <span className="sr-only">Briefbogen hochladen</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf,.jpg,.jpeg,.png,.pdf"
                    onChange={(e) => void handleBriefbogenFileChange(e)}
                    disabled={briefbogenUploading}
                    className="block text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-vico-primary file:text-white hover:file:bg-vico-primary-hover disabled:opacity-50"
                    aria-label="Briefbogen hochladen (PNG, JPEG oder PDF)"
                  />
                </label>
                {briefbogenConfigured && (
                  <button
                    type="button"
                    onClick={() => void handleBriefbogenRemove()}
                    disabled={briefbogenRemoving || briefbogenUploading}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    aria-label="Briefbogen entfernen"
                  >
                    {briefbogenRemoving ? 'Entfernen…' : 'Briefbogen entfernen'}
                  </button>
                )}
              </div>
              {briefbogenUploading && (
                <p className="text-sm text-slate-500 dark:text-slate-400" role="status">
                  Wird hochgeladen…
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Komponenten aktivieren/deaktivieren (Admin) */}
      {userRole === 'admin' && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="komponenten-heading"
        >
          <h3 id="komponenten-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Komponenten
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Aktivieren oder deaktivieren Sie einzelne Bereiche der App.
          </p>
          {componentError && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">
              {componentError}
            </p>
          )}
          <div className="space-y-2">
            {settingsList
              .filter((item) => item.component_key !== COMPONENT_KEY_DOOR_STAMMDATEN_AUSWAHL)
              .map((item) => (
              <label
                key={item.id}
                className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-600 last:border-0 cursor-pointer"
              >
                <span className="text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={updatingKey === item.component_key}
                  onChange={async (e) => {
                    setComponentError(null)
                    const checked = e.target.checked
                    setUpdatingKey(item.component_key)
                    const result = await updateSetting(item.component_key, checked)
                    setUpdatingKey(null)
                    if (!result.ok) {
                      setComponentError(result.error ?? 'Speichern fehlgeschlagen')
                    }
                  }}
                  className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
                  aria-label={`${item.label} ${item.enabled ? 'deaktivieren' : 'aktivieren'}`}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setComponentError(null)
              refresh()
            }}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            aria-label="Einstellungen neu laden"
          >
            Neu laden
          </button>
        </section>
      )}
    </div>
  )
}

export default Einstellungen
