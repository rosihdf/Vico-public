import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import SyncStatusIndicator from './SyncStatus'
import Logo from './Logo'
import UpdateBanner from './UpdateBanner'
import { useSync } from './SyncContext'
import { useAuth } from './AuthContext'
import { useComponentSettings } from './ComponentSettingsContext'

const Layout = () => {
  const { syncStatus, pendingCount } = useSync()
  const { isAuthenticated, logout, userRole } = useAuth()
  const { isEnabled } = useComponentSettings()
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
    ...(isEnabled('einstellungen') ? [{ to: '/einstellungen', label: 'Einstellungen' }] : []),
  ]

  const bottomLinks = [
    ...(isEnabled('dashboard') ? [{ to: '/', label: 'Start', icon: '🏠' }] : []),
    ...(isEnabled('kunden') ? [{ to: '/kunden', label: 'Kunden', icon: '👥' }] : []),
    ...(isEnabled('auftrag') ? [{ to: '/auftrag', label: 'Auftrag', icon: '📋' }] : []),
    ...(isEnabled('suche') ? [{ to: '/suche', label: 'Suche', icon: '🔍' }] : []),
    ...(isEnabled('scan') ? [{ to: '/scan', label: 'Scan', icon: '📷' }] : []),
    ...(isAuthenticated && isEnabled('profil')
      ? [{ to: '/profil', label: 'Profil', icon: '👤' }]
      : !isAuthenticated
      ? [{ to: '/login', label: 'Login', icon: '🔐' }]
      : []),
  ]

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {isAuthenticated && <UpdateBanner />}
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
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-200 ease-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMenuOpen}
        aria-label="Seitenmenü"
      >
        <div className="flex flex-col pt-16 px-2">
          {menuLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={handleMenuClose}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                location.pathname === to
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
              aria-label="Ausloggen"
            >
              Ausloggen
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30"
        aria-label="Bottom Navigation"
      >
        <div className="flex justify-around items-center h-16">
          {bottomLinks.map(({ to, label, icon }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
            return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors min-w-0 ${
                isActive ? 'text-vico-primary' : 'text-slate-500 hover:text-slate-700'
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
