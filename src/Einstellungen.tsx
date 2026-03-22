import { useState, useEffect, useCallback } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSync } from './SyncContext'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import {
  getCachedLicenseResponse,
  getStoredLicenseNumber,
  updateImpressum,
  isLicenseApiConfigured,
} from './lib/licensePortalApi'
import { fetchMyProfile, revokeGpsConsent, setStandortabfrageConsent, revokeStandortabfrageConsent } from './lib/userService'
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
  uploadBriefbogenFile,
  removeBriefbogen,
} from './lib/briefbogenService'
import { isOnline } from '../shared/networkUtils'

const SYNC_LABELS: Record<SyncStatus, string> = {
  offline: '🔴 Offline',
  ready: '🟢 Bereit',
  synced: '🔵 Synchronisiert',
}

const Einstellungen = () => {
  const { syncStatus, isOffline, setSyncStatus, syncNow, pendingCount, lastSyncError, clearSyncError } = useSync()
  const { userRole, user } = useAuth()
  const { design, license, refresh: refreshLicense } = useLicense()
  const { settingsList, updateSetting, refresh, isEnabled } = useComponentSettings()
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
  const [briefbogenConfigured, setBriefbogenConfigured] = useState(false)
  const [briefbogenLoading, setBriefbogenLoading] = useState(false)
  const [briefbogenUploading, setBriefbogenUploading] = useState(false)
  const [briefbogenRemoving, setBriefbogenRemoving] = useState(false)
  const [briefbogenError, setBriefbogenError] = useState<string | null>(null)
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

  const refreshBriefbogenPreview = useCallback(async () => {
    if (!showBriefbogenSettings) return
    setBriefbogenLoading(true)
    setBriefbogenError(null)
    try {
      const path = await fetchBriefbogenStoragePath()
      setBriefbogenConfigured(Boolean(path))
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
    } finally {
      setBriefbogenLoading(false)
    }
  }, [showBriefbogenSettings])

  useEffect(() => {
    void refreshBriefbogenPreview()
  }, [refreshBriefbogenPreview])

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

      {/* PDF-Briefbogen für Wartungsprotokolle (Admin) */}
      {showBriefbogenSettings && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="briefbogen-heading"
        >
          <h3 id="briefbogen-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            PDF-Briefbogen (Wartungsprotokoll)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            PNG- oder JPEG-Vorlage im <strong className="text-slate-700 dark:text-slate-300">A4-Format</strong> – wird
            beim PDF-Export und beim E-Mail-Versand des Wartungsprotokolls als Hintergrund jeder Seite eingefügt. Inhalt
            des Protokolls wird darüber gezeichnet; freie Bereiche in der Vorlage sind sinnvoll zu planen.
          </p>
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
                    <img
                      src={briefbogenPreviewUrl}
                      alt="Aktueller PDF-Briefbogen"
                      className="w-full h-auto object-top object-contain max-h-48"
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex">
                  <span className="sr-only">Briefbogen-Datei auswählen</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,.jpg,.jpeg,.png"
                    onChange={(e) => void handleBriefbogenFileChange(e)}
                    disabled={briefbogenUploading}
                    className="block text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-vico-primary file:text-white hover:file:bg-vico-primary-hover disabled:opacity-50"
                    aria-label="Briefbogen hochladen (PNG oder JPEG)"
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
            {settingsList.map((item) => (
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
