import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import SyncStatusIndicator from './SyncStatus'
import Logo from './Logo'
import UpdateBanner from './UpdateBanner'
import { useSync } from './SyncContext'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import { hasFeature } from './lib/licenseService'

const Layout = () => {
  const { syncStatus, pendingCount } = useSync()
  const { isAuthenticated, logout, userRole } = useAuth()
  const { license, storageUsageMb } = useLicense()
  const { isEnabled } = useComponentSettings()
  const showArbeitszeit =
    license &&
    hasFeature(license, 'arbeitszeiterfassung') &&
    isEnabled('arbeitszeiterfassung') &&
    userRole !== 'leser' &&
    userRole !== 'kunde'
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

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

  const menuLinks = [
    ...(isEnabled('dashboard') ? [{ to: '/', label: 'Dashboard' }] : []),
    ...(isEnabled('kunden') ? [{ to: '/kunden', label: 'Kunden' }] : []),
    ...(isEnabled('suche') ? [{ to: '/suche', label: 'Suche' }] : []),
    ...(isEnabled('auftrag') ? [{ to: '/auftrag', label: 'Auftrag' }] : []),
    ...(userRole === 'admin' && isEnabled('benutzerverwaltung') ? [{ to: '/benutzerverwaltung', label: 'Benutzerverwaltung' }] : []),
    ...(userRole === 'admin' ? [{ to: '/historie', label: 'Historie' }] : []),
    ...(userRole === 'admin' ? [{ to: '/fehlerberichte', label: 'Fehlerberichte' }] : []),
    ...(userRole === 'admin' ? [{ to: '/ladezeiten', label: 'Ladezeiten' }] : []),
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:dark:bg-slate-800 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
      >
        Zum Inhalt springen
      </a>
      <UpdateBanner />
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
      {isOffline && (
        <div
          role="status"
          className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium"
          aria-live="polite"
        >
          Offline – Änderungen werden lokal gespeichert und beim nächsten Sync hochgeladen.
        </div>
      )}
      <header className="relative bg-vico-background shadow-md sticky top-0 z-30 flex items-center justify-between gap-2 px-4 h-14 overflow-visible">
        <button
          type="button"
          onClick={handleMenuToggle}
          onKeyDown={handleKeyDown}
          className="flex-shrink-0 p-2 -ml-2 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Menü öffnen"
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

      {/* Hamburger Overlay */}
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

      {/* Hamburger Menu Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-800 shadow-xl z-50 transform transition-transform duration-200 ease-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMenuOpen}
        aria-label="Seitenmenü"
      >
        <div className="flex flex-col pt-16 px-2">
          {menuLinks.map((item) => {
            const { to, label, external } = item as { to: string; label: string; external?: boolean }
            const className = `px-4 py-3 rounded-lg font-medium transition-colors ${
              external ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100' : location.pathname === to
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
              <Link key={to} to={to} onClick={handleMenuClose} className={className}>
                {label}
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
        <Outlet />
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
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors min-w-0 min-h-[44px] ${
                isActive ? 'text-vico-primary' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-xl shrink-0" aria-hidden>
                {icon}
              </span>
              <span className="text-xs font-medium truncate w-full text-center px-0.5">{label}</span>
            </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default Layout
