import { useState, useEffect, useCallback, useMemo, type KeyboardEvent } from 'react'
import {
  getMaintenanceAnnouncementForSurface,
  getMaintenanceModeBannerForSurface,
  type TenantMaintenanceApiShape,
} from '../../../shared/tenantMaintenanceMode'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  DEFAULT_PORTAL_ORDER_TIMELINE_SETTINGS,
  fetchPortalOrderTimeline,
  type PortalOrderTimelinePayload,
} from '../lib/portalService'
import {
  buildOrderActivityBannerFingerprint,
  shouldShowOrderActivityBanner,
} from '../lib/portalOrderTimeline'
import type { User } from '@supabase/supabase-js'
import { useTheme } from '../ThemeContext'
import { useDesign } from '../DesignContext'
import type { Theme } from '../ThemeContext'
import { saveProfileThemePreference } from '../../../shared/themePreferenceDb'
import { supabase } from '../lib/supabase'
import MandantDegradedBanner from '../../../shared/MandantDegradedBanner'
import MandantenIncomingReleaseBanner from '../../../shared/MandantenIncomingReleaseBanner'
import MandantenReleaseRolloutRefreshBanner from '../../../shared/MandantenReleaseRolloutRefreshBanner'
import MandantenReleaseHardReloadGate from '../../../shared/MandantenReleaseHardReloadGate'
import BetaFeedbackWidget from '../../../shared/BetaFeedbackWidget'

const THEME_LABELS: Record<Theme, string> = {
  light: 'Hell',
  dark: 'Dunkel',
  system: 'System',
}

type LayoutProps = {
  user: User
  onLogout: () => void
}

export type PortalLayoutOutletContext = {
  portalTimeline: PortalOrderTimelinePayload
}

const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

const PORTAL_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
const PORTAL_RELEASE_LABEL_BUILD =
  typeof __APP_RELEASE_LABEL__ !== 'undefined' ? __APP_RELEASE_LABEL__ : ''

/** WP-PORTAL-03: ausgeblendeter Stand pro Portal-Nutzer bis sich die Aktivitäts-Timeline ändert. */
const ORDER_ACTIVITY_BANNER_DISMISS_PREFIX = 'vico-portal-order-activity-banner-dismiss:'

const getNextTheme = (current: Theme): Theme =>
  THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]

const drawerLinkClass = (active: boolean) =>
  `block w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:text-slate-800 dark:hover:text-slate-100'
  }`

const Layout = ({ user, onLogout }: LayoutProps) => {
  const location = useLocation()
  const pathname = location.pathname
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { appName, logoUrl, maintenance, mandantenReleases, features, appVersionInfo } = useDesign()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [portalTimeline, setPortalTimeline] = useState<PortalOrderTimelinePayload>(() => ({
    settings: DEFAULT_PORTAL_ORDER_TIMELINE_SETTINGS,
    orders: [],
  }))
  const [nowTs, setNowTs] = useState(() => Date.now())
  const maintenanceApi = maintenance as TenantMaintenanceApiShape | null
  const announcementText = getMaintenanceAnnouncementForSurface(maintenanceApi, nowTs, 'customer_portal')
  const maintenanceModeBanner = getMaintenanceModeBannerForSurface(maintenanceApi, nowTs, 'customer_portal')
  const orderActivityBannerWorthy = shouldShowOrderActivityBanner(
    portalTimeline.orders,
    portalTimeline.settings
  )
  const orderActivityFingerprint = useMemo(
    () => buildOrderActivityBannerFingerprint(portalTimeline.orders, portalTimeline.settings),
    [portalTimeline.orders, portalTimeline.settings]
  )
  const orderActivityDismissStorageKey = `${ORDER_ACTIVITY_BANNER_DISMISS_PREFIX}${user.id}`
  const [dismissedOrderActivityFingerprint, setDismissedOrderActivityFingerprint] = useState<string | null>(null)

  useEffect(() => {
    try {
      setDismissedOrderActivityFingerprint(window.localStorage.getItem(orderActivityDismissStorageKey))
    } catch {
      setDismissedOrderActivityFingerprint(null)
    }
  }, [orderActivityDismissStorageKey])

  const showOrderActivityBanner =
    orderActivityBannerWorthy && orderActivityFingerprint !== dismissedOrderActivityFingerprint

  const handleDismissOrderActivityBanner = useCallback(() => {
    try {
      window.localStorage.setItem(orderActivityDismissStorageKey, orderActivityFingerprint)
    } catch {
      /* ignore quota / private mode */
    }
    setDismissedOrderActivityFingerprint(orderActivityFingerprint)
  }, [orderActivityDismissStorageKey, orderActivityFingerprint])

  const handleDismissOrderActivityBannerKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleDismissOrderActivityBanner()
      }
    },
    [handleDismissOrderActivityBanner]
  )

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchPortalOrderTimeline(user.id).then((payload) => {
      if (!cancelled) setPortalTimeline(payload)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const handleCycleTheme = () => {
    const next = getNextTheme(theme)
    setTheme(next)
    void saveProfileThemePreference(supabase, user.id, next)
  }

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen((open) => !open)
  }, [])

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  const handleMenuButtonKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleMenuToggle()
      }
      if (e.key === 'Escape') {
        handleMenuClose()
      }
    },
    [handleMenuToggle, handleMenuClose]
  )

  const handleLogout = () => {
    handleMenuClose()
    onLogout()
  }

  const isBerichte = pathname === '/berichte'
  const isMeineDaten = pathname === '/meine-daten'
  const isInfo = pathname === '/info'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:dark:bg-slate-800 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
      >
        Zum Inhalt springen
      </a>

      <MandantenReleaseHardReloadGate releases={mandantenReleases} />
      <MandantenReleaseRolloutRefreshBanner releases={mandantenReleases} />

      {/* Kopfzeile z-50: über Overlay (z-40) und Drawer (z-[45]) */}
      <header className="sticky top-0 z-50 bg-vico-primary text-white shadow-md pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 min-h-[3rem]">
          <button
            type="button"
            onClick={handleMenuToggle}
            onKeyDown={handleMenuButtonKeyDown}
            className="flex-shrink-0 p-2 -ml-2 rounded-lg text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-expanded={isMenuOpen}
            aria-controls="kundenportal-nav-drawer"
            aria-label={isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to="/berichte" className="flex flex-1 min-w-0 items-center gap-2 sm:gap-3 justify-center" onClick={handleMenuClose}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={appName}
                className="h-8 sm:h-9 w-auto max-w-[120px] sm:max-w-[160px] object-contain object-left shrink-0"
              />
            ) : (
              <svg className="w-7 h-7 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
            <div className="min-w-0 text-left sm:text-center">
              <span className="text-base sm:text-lg font-bold leading-tight truncate block">{appName} Kundenportal</span>
              <span className="text-xs text-white/70 truncate block">Wartungsberichte</span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCycleTheme}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              aria-label={`Darstellung: ${THEME_LABELS[theme]}`}
              title={`Darstellung (${THEME_LABELS[theme]}). Klicken zum Wechseln.`}
            >
              {resolvedTheme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </button>
            <span className="text-xs sm:text-sm text-white/80 hidden sm:inline max-w-[140px] md:max-w-[200px] truncate" title={user.email}>
              {user.email}
            </span>
          </div>
        </div>
      </header>

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
      <MandantenIncomingReleaseBanner releases={mandantenReleases} />
      <MandantDegradedBanner />
      {showOrderActivityBanner ? (
        <div
          role="status"
          className="bg-sky-100 dark:bg-sky-900/35 text-sky-900 dark:text-sky-100 py-2.5 px-4 text-sm border-b border-sky-200 dark:border-sky-800 flex flex-wrap items-center justify-center gap-3"
          aria-live="polite"
        >
          <span className="text-center">
            <span>Es gibt Aktivität zu Aufträgen an Ihren Türen. </span>
            <Link
              to="/berichte"
              className="font-semibold underline underline-offset-2 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
              tabIndex={0}
            >
              Details unter Berichte
            </Link>
            .
          </span>
          <button
            type="button"
            onClick={handleDismissOrderActivityBanner}
            onKeyDown={handleDismissOrderActivityBannerKeyDown}
            className="shrink-0 text-sm underline underline-offset-2 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded px-1"
            aria-label="Hinweis ausblenden bis zur nächsten Aktivität"
          >
            Ausblenden
          </button>
        </div>
      ) : null}

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

      <aside
        id="kundenportal-nav-drawer"
        className={`fixed top-0 left-0 z-[45] h-full w-64 max-w-[85vw] flex flex-col bg-white dark:bg-slate-800 shadow-xl transform transition-transform duration-200 ease-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMenuOpen}
        aria-label="Seitenmenü"
      >
        <div className="flex flex-col min-h-0 flex-1 pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
          <nav className="flex flex-col gap-1 p-2 overflow-y-auto flex-1 min-h-0" aria-label="Hauptnavigation">
            <Link to="/berichte" className={drawerLinkClass(isBerichte)} onClick={handleMenuClose} tabIndex={0}>
              Berichte
            </Link>
            <Link to="/meine-daten" className={drawerLinkClass(isMeineDaten)} onClick={handleMenuClose} tabIndex={0}>
              Meine Daten
            </Link>
            <Link to="/info" className={drawerLinkClass(isInfo)} onClick={handleMenuClose} tabIndex={0}>
              Info
            </Link>
          </nav>
          <div className="p-2 border-t border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Abmelden"
            >
              Abmelden
            </button>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
        tabIndex={-1}
      >
        <Outlet context={{ portalTimeline } satisfies PortalLayoutOutletContext} />
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-400 dark:text-slate-500 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <Link to="/datenschutz" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
          Datenschutz
        </Link>
        <span>·</span>
        <Link to="/impressum" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
          Impressum
        </Link>
        <span>·</span>
        <Link to="/info" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
          Info
        </Link>
        <span>·</span>
        <span className="text-center">{appName} Türen &amp; Tore</span>
      </footer>
      {(import.meta.env.VITE_LICENSE_API_URL ?? '').trim() ? (
        <BetaFeedbackWidget
          supabase={supabase}
          licenseApiUrl={(import.meta.env.VITE_LICENSE_API_URL ?? '').trim()}
          licenseApiKey={(import.meta.env.VITE_LICENSE_API_KEY ?? '').trim() || undefined}
          licenseNumber={(import.meta.env.VITE_LICENSE_NUMBER ?? '').trim()}
          sourceApp="kundenportal"
          features={features}
          appVersion={PORTAL_APP_VERSION}
          releaseLabel={appVersionInfo?.releaseLabel?.trim() || PORTAL_RELEASE_LABEL_BUILD}
          routePath={location.pathname}
          routeQuery={location.search.startsWith('?') ? location.search.slice(1) : location.search}
        />
      ) : null}
    </div>
  )
}

export default Layout
