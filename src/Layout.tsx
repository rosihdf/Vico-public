import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import SyncStatusIndicator from './SyncStatus'
import Logo from './Logo'
import UpdateBanner from '../shared/UpdateBanner'
import MandantDegradedBanner from '../shared/MandantDegradedBanner'
import MandantenIncomingReleaseBanner from '../shared/MandantenIncomingReleaseBanner'
import MandantenReleaseRolloutRefreshBanner from '../shared/MandantenReleaseRolloutRefreshBanner'
import MandantenReleaseHardReloadGate from '../shared/MandantenReleaseHardReloadGate'
import LicensePortalStaleBanner from '../shared/LicensePortalStaleBanner'
import MandantPingScheduler from './components/MandantPingScheduler'
import BetaFeedbackWidget from '../shared/BetaFeedbackWidget'
import { supabase } from './supabase'
import { getStoredLicenseNumber, isLicenseApiConfigured } from './lib/licensePortalApi'
import { useSync } from './SyncContext'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import { hasFeature } from './lib/licenseService'
import { fetchMaintenanceReminders, subscribeToDataChange } from './lib/dataService'
import { countMaintenanceRemindersNeedingAttention } from './lib/maintenanceReminderUtils'
import {
  getMaintenanceAnnouncementForSurface,
  getMaintenanceModeBannerForSurface,
  isMaintenanceModeWindowActive,
  type TenantMaintenanceApiShape,
} from '../shared/tenantMaintenanceMode'

const MAIN_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
const MAIN_RELEASE_LABEL_BUILD =
  typeof __APP_RELEASE_LABEL__ !== 'undefined' ? __APP_RELEASE_LABEL__ : ''

const Layout = () => {
  const { syncStatus, pendingCount } = useSync()
  const { isAuthenticated, logout, userRole } = useAuth()
  const { license, storageUsageMb, maintenance, licensePortalStale, mandantenReleases, appVersions } = useLicense()
  const { isEnabled } = useComponentSettings()
  const showBuchhaltungExport =
    isEnabled('auftrag') &&
    license &&
    hasFeature(license, 'buchhaltung_export') &&
    (userRole === 'admin' || userRole === 'mitarbeiter' || userRole === 'teamleiter')
  const showArbeitszeit =
    license &&
    hasFeature(license, 'arbeitszeiterfassung') &&
    isEnabled('arbeitszeiterfassung') &&
    userRole !== 'leser' &&
    userRole !== 'kunde'
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [maintenanceAttentionCount, setMaintenanceAttentionCount] = useState(0)
  const [maintenanceHasOverdue, setMaintenanceHasOverdue] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const location = useLocation()

  const refreshMaintenanceAttentionBadge = useCallback(async () => {
    if (!isAuthenticated || !isEnabled('dashboard')) {
      setMaintenanceAttentionCount(0)
      setMaintenanceHasOverdue(false)
      return
    }
    const list = await fetchMaintenanceReminders()
    const withinDays = 7
    setMaintenanceAttentionCount(countMaintenanceRemindersNeedingAttention(list, withinDays))
    setMaintenanceHasOverdue(list.some((r) => r.status === 'overdue'))
  }, [isAuthenticated, isEnabled])

  useEffect(() => {
    void refreshMaintenanceAttentionBadge()
  }, [refreshMaintenanceAttentionBadge, location.pathname])

  useEffect(() => {
    return subscribeToDataChange(() => {
      void refreshMaintenanceAttentionBadge()
    })
  }, [refreshMaintenanceAttentionBadge])

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1_000)
    return () => window.clearInterval(id)
  }, [])

  const maintenanceApi = maintenance as TenantMaintenanceApiShape | null
  const announcementText = getMaintenanceAnnouncementForSurface(maintenanceApi, nowTs, 'main_app')
  const maintenanceModeBanner = getMaintenanceModeBannerForSurface(maintenanceApi, nowTs, 'main_app')
  const blockMainContent =
    isMaintenanceModeWindowActive(maintenanceApi, nowTs) && maintenanceApi?.mode_apply_main_app !== false
  const modeEndForCard = (() => {
    const m = maintenanceApi
    if (!m?.mode_auto_end) return NaN
    const modeStart = m.mode_starts_at ? Date.parse(m.mode_starts_at) : NaN
    const modeEndFromField = m.mode_ends_at ? Date.parse(m.mode_ends_at) : NaN
    const modeEndFromDuration =
      Number.isFinite(modeStart) && (m.mode_duration_min ?? 0) > 0
        ? modeStart + (m.mode_duration_min ?? 0) * 60_000
        : NaN
    return Number.isFinite(modeEndFromField) ? modeEndFromField : modeEndFromDuration
  })()
  const remainingMinCard =
    blockMainContent && Number.isFinite(modeEndForCard)
      ? Math.ceil(Math.max(0, modeEndForCard - nowTs) / 60_000)
      : null

  const handleLogout = async () => {
    handleMenuClose()
    await logout()
    navigate('/login')
  }

  const handleMenuToggle = () => {
    setIsMenuOpen((prev) => !prev)
  }

  const handleMenuClose = () => {
    setIsMenuOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleMenuToggle()
    }
    if (e.key === 'Escape') {
      handleMenuClose()
    }
  }

  const showWartungsstatistik =
    Boolean(license && hasFeature(license, 'wartungsprotokolle'))

  const menuLinks = [
    ...(isEnabled('dashboard') ? [{ to: '/', label: 'Dashboard' }] : []),
    ...(isEnabled('kunden')
      ? [
          { to: '/kunden', label: 'Kunden' },
          ...(showWartungsstatistik ? [{ to: '/wartungsstatistik', label: 'Wartungsstatistik' }] : []),
        ]
      : []),
    ...(isEnabled('suche') ? [{ to: '/suche', label: 'Suche' }] : []),
    ...(isEnabled('auftrag') ? [{ to: '/auftrag', label: 'Auftrag' }] : []),
    ...(showBuchhaltungExport ? [{ to: '/buchhaltung-export', label: 'Buchhaltungs-Export' }] : []),
    ...(userRole === 'admin' && isEnabled('benutzerverwaltung') ? [{ to: '/benutzerverwaltung', label: 'Benutzerverwaltung' }] : []),
    ...(userRole === 'admin' ? [{ to: '/system', label: 'System', matchPrefix: true }] : []),
    ...(showArbeitszeit ? [{ to: '/arbeitszeit', label: 'Arbeitszeit' }] : []),
    ...(isEnabled('einstellungen') ? [{ to: '/einstellungen', label: 'Einstellungen' }] : []),
    ...(isEnabled('info') ? [{ to: '/info', label: 'Info' }] : []),
  ]

  const bottomLinks = [
    ...(isEnabled('dashboard') ? [{ to: '/', label: 'Start', icon: '🏠' }] : []),
    ...(isEnabled('kunden') ? [{ to: '/kunden', label: 'Kunden', icon: '👥' }] : []),
    ...(isEnabled('auftrag') ? [{ to: '/auftrag', label: 'Auftrag', icon: '📋' }] : []),
    ...(isEnabled('suche') ? [{ to: '/suche', label: 'Suche', icon: '🔍' }] : []),
    ...(isEnabled('scan') ? [{ to: '/scan', label: 'Scan', icon: '📷' }] : []),
    ...(showArbeitszeit ? [{ to: '/arbeitszeit', label: 'Zeit', icon: '⏱' }] : []),
    ...(isAuthenticated && isEnabled('profil')
      ? [{ to: '/profil', label: 'Profil', icon: '👤' }]
      : !isAuthenticated
      ? [{ to: '/login', label: 'Login', icon: '🔐' }]
      : []),
  ]

  const isOffline = syncStatus === 'offline'
  const isAuthPage = location.pathname === '/login' || location.pathname === '/reset-password'

  if (isAuthPage) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <MandantPingScheduler />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:dark:bg-slate-800 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
      >
        Zum Inhalt springen
      </a>
      <UpdateBanner />
      <MandantenReleaseHardReloadGate releases={mandantenReleases} />
      <MandantenReleaseRolloutRefreshBanner releases={mandantenReleases} />
      <MandantenIncomingReleaseBanner releases={mandantenReleases} />
      {license?.expired && userRole === 'admin' && (
        <div
          role="alert"
          className="bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200 text-center py-2 px-4 text-sm font-medium border-b border-red-200 dark:border-red-700"
          aria-live="polite"
        >
          {license.read_only
            ? 'Lizenz abgelaufen – Nur-Lesen (Schonfrist). Bitte Lizenz verlängern.'
            : 'Lizenz abgelaufen – einige Funktionen sind eingeschränkt. Bitte Lizenz verlängern.'}
        </div>
      )}
      {license?.max_storage_mb != null &&
        storageUsageMb >= license.max_storage_mb * 0.8 &&
        storageUsageMb < license.max_storage_mb && (
          <div
            role="alert"
            className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-center py-2 px-4 text-sm font-medium border-b border-amber-200 dark:border-amber-700"
            aria-live="polite"
          >
            {`Speicher zu 80% ausgelastet (${storageUsageMb.toFixed(1)} MB von ${license.max_storage_mb} MB). Bitte Speicherkontingent prüfen.`}
          </div>
        )}
      {userRole === 'demo' && (
        <div
          role="status"
          className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-center py-2 px-4 text-sm font-medium border-b border-amber-200 dark:border-amber-700"
          aria-live="polite"
        >
          Demo-Modus: Ihre Daten werden nach 24 Stunden automatisch gelöscht.
        </div>
      )}
      {announcementText ? (
        <div
          role="status"
          className="bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 text-center py-2 px-4 text-sm font-medium border-b border-blue-200 dark:border-blue-700"
          aria-live="polite"
        >
          {announcementText}
        </div>
      ) : null}
      {maintenanceModeBanner ? (
        <div
          role="alert"
          className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-center py-2 px-4 text-sm font-medium border-b border-amber-200 dark:border-amber-700"
          aria-live="polite"
        >
          {maintenanceModeBanner.message}
        </div>
      ) : null}
      {isOffline && (
        <div
          role="status"
          className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium"
          aria-live="polite"
        >
          Offline – Änderungen werden lokal gespeichert und beim nächsten Sync hochgeladen.
        </div>
      )}
      <LicensePortalStaleBanner visible={licensePortalStale} suppress={isOffline} />
      <MandantDegradedBanner suppress={isOffline} />
      <header className="relative bg-vico-background shadow-md sticky top-0 z-50 flex items-center justify-between gap-2 px-4 min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] overflow-visible">
        <button
          type="button"
          onClick={handleMenuToggle}
          onKeyDown={handleKeyDown}
          className="flex-shrink-0 p-2 -ml-2 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={isMenuOpen}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div className="flex-1 min-w-0 flex justify-center items-center pr-16">
          <Logo variant="header" />
        </div>

        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
          <SyncStatusIndicator status={syncStatus} pendingCount={pendingCount} />
        </div>
      </header>

      {/* Hamburger Overlay (unter Kopfzeile, damit Hamburger immer bedienbar bleibt) */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={handleMenuClose}
          onKeyDown={(e) => e.key === 'Escape' && handleMenuClose()}
          role="button"
          tabIndex={0}
          aria-label="Menü schließen"
        />
      )}

      {/* Hamburger Menu Drawer (z-45: unter Kopfzeile z-50, Inhalt mit Abstand unter der Bar) */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-800 shadow-xl z-[45] transform transition-transform duration-200 ease-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMenuOpen}
        aria-label="Seitenmenü"
      >
        <div className="flex h-full min-h-0 flex-col overflow-y-auto px-2 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-4">
          {menuLinks.map((item) => {
            const { to, label, external, matchPrefix } = item as { to: string; label: string; external?: boolean; matchPrefix?: boolean }
            const isActive = matchPrefix ? location.pathname.startsWith(to) : location.pathname === to
            const className = `px-4 py-3 rounded-lg font-medium transition-colors ${
              external ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100' : isActive
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100'
            }`
            if (external) {
              return (
                <a
                  key={to}
                  href={to}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleMenuClose}
                  className={className}
                >
                  {label}
                </a>
              )
            }
            return (
              <Link
                key={to}
                to={to}
                onClick={handleMenuClose}
                className={`${className} flex flex-row items-center justify-between gap-2`}
              >
                <span>{label}</span>
                {to === '/' && maintenanceAttentionCount > 0 && (
                  <span
                    className={`shrink-0 min-w-[1.35rem] h-6 px-1.5 rounded-full text-xs font-bold text-white flex items-center justify-center ${
                      maintenanceHasOverdue ? 'bg-red-600' : 'bg-amber-500'
                    }`}
                    aria-label={`${maintenanceAttentionCount} Wartungserinnerungen (überfällig oder innerhalb von 7 Tagen fällig)`}
                  >
                    {maintenanceAttentionCount > 99 ? '99+' : maintenanceAttentionCount}
                  </span>
                )}
              </Link>
            )
          })}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg font-medium"
              aria-label="Ausloggen"
            >
              Ausloggen
            </button>
          </div>
        </div>
      </aside>

      <main id="main-content" className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900" tabIndex={-1}>
        {blockMainContent ? (
          <div className="min-h-full flex items-center justify-center p-6">
            <div className="max-w-xl w-full rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 p-6 text-center">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">Wartungsmodus</h1>
              <p className="text-slate-700 dark:text-slate-200">
                {maintenance?.mode_message?.trim() ||
                  'Die Anwendung befindet sich aktuell im Wartungsmodus.'}
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {maintenance?.mode_auto_end && remainingMinCard != null ? (
                  <>
                    Voraussichtliche Restzeit:{' '}
                    <span className="font-semibold">{remainingMinCard} Minuten</span>
                  </>
                ) : (
                  <>
                    Voraussichtliche Restzeit:{' '}
                    <span className="font-semibold">offen (manuelle Beendigung)</span>
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-30 pb-[env(safe-area-inset-bottom)]"
        aria-label="Bottom Navigation"
      >
        <div className="flex justify-around items-center h-16">
          {bottomLinks.map(({ to, label, icon }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
            return (
            <Link
              key={to}
              to={to}
              className={`relative flex flex-col items-center justify-center flex-1 py-2 transition-colors min-w-0 min-h-[44px] ${
                isActive ? 'text-vico-primary' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={
                to === '/' && maintenanceAttentionCount > 0
                  ? `${label}, ${maintenanceAttentionCount} Wartungserinnerungen aktiv`
                  : undefined
              }
            >
              <span className="text-xl shrink-0 relative inline-flex" aria-hidden>
                {icon}
                {to === '/' && maintenanceAttentionCount > 0 && (
                  <span
                    className={`absolute -top-1 left-1/2 ml-2 min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full text-[0.65rem] font-bold leading-none text-white flex items-center justify-center ${
                      maintenanceHasOverdue ? 'bg-red-600' : 'bg-amber-500'
                    }`}
                  >
                    {maintenanceAttentionCount > 9 ? '9+' : maintenanceAttentionCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium truncate w-full text-center px-0.5">{label}</span>
            </Link>
            )
          })}
        </div>
      </nav>
      {isAuthenticated &&
      license &&
      hasFeature(license, 'beta_feedback') &&
      isLicenseApiConfigured() ? (
        <BetaFeedbackWidget
          supabase={supabase}
          licenseApiUrl={(import.meta.env.VITE_LICENSE_API_URL ?? '').trim()}
          licenseApiKey={(import.meta.env.VITE_LICENSE_API_KEY ?? '').trim() || undefined}
          licenseNumber={getStoredLicenseNumber()}
          sourceApp="main"
          features={license.features ?? {}}
          appVersion={MAIN_APP_VERSION}
          releaseLabel={appVersions?.main?.releaseLabel?.trim() || MAIN_RELEASE_LABEL_BUILD}
        />
      ) : null}
    </div>
  )
}

export default Layout
