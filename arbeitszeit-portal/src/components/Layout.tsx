import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useDesign } from '../DesignContext'

type LayoutProps = {
  user: User
  onLogout: () => void | Promise<void>
}

type NavItem = {
  to: string
  label: string
  isActive: (pathname: string) => boolean
}

const Layout = ({ user, onLogout }: LayoutProps) => {
  const location = useLocation()
  const { appName, logoUrl, features } = useDesign()
  const pathname = location.pathname
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const showStandort = features.standortabfrage === true
  const showUrlaub = features.urlaub === true

  const navItems: NavItem[] = [
    { to: '/', label: 'Übersicht', isActive: (p) => p === '/' || p === '/uebersicht' },
    { to: '/alle-zeiten', label: 'Alle Zeiten', isActive: (p) => p.startsWith('/alle-zeiten') },
    ...(showUrlaub
      ? [
          {
            to: '/urlaubantrage',
            label: 'Urlaubanträge',
            isActive: (p: string) => p.startsWith('/urlaub'),
          },
        ]
      : []),
    { to: '/log', label: 'Log', isActive: (p) => p.startsWith('/log') },
    { to: '/stammdaten', label: 'Stammdaten AZK', isActive: (p) => p.startsWith('/stammdaten') },
    ...(showStandort
      ? [{ to: '/standort', label: 'Standort', isActive: (p: string) => p.startsWith('/standort') }]
      : []),
    { to: '/info', label: 'Info', isActive: (p) => p === '/info' },
  ]

  const drawerLinkClass = (active: boolean) =>
    `block w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:text-slate-800 dark:hover:text-slate-100'
    }`

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen((open) => !open)
  }, [])

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  const handleMenuButtonKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleMenuToggle()
    }
    if (e.key === 'Escape') {
      handleMenuClose()
    }
  }, [handleMenuToggle, handleMenuClose])

  const handleLogout = () => {
    handleMenuClose()
    void onLogout()
  }

  const renderSidebarBrand = () => (
    <div className="px-3 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={appName}
            className="h-9 w-auto max-w-[140px] object-contain object-left shrink-0"
          />
        ) : null}
        <p
          className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight truncate"
          title={`${appName} Arbeitszeitenportal`}
        >
          {appName}
          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">Arbeitszeitenportal</span>
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:dark:bg-slate-800 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
      >
        Zum Inhalt springen
      </a>

      {/* Kopfzeile z-50: über Overlay (z-40) und Drawer (z-[45]), Hamburger bleibt bedienbar */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 pt-[env(safe-area-inset-top,0px)] shrink-0">
        <div className="px-3 sm:px-4 py-3 flex items-center gap-3 min-h-[3rem]">
          <button
            type="button"
            onClick={handleMenuToggle}
            onKeyDown={handleMenuButtonKeyDown}
            className="flex-shrink-0 p-2 -ml-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-vico-primary/50"
            aria-expanded={isMenuOpen}
            aria-controls="main-nav-drawer"
            aria-label={isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-8 w-auto max-w-[100px] object-contain shrink-0"
                aria-hidden
              />
            ) : null}
            <h1
              className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate min-w-0"
              title={`${appName} Arbeitszeitenportal`}
            >
              {appName} Arbeitszeitenportal
            </h1>
          </div>

          <div className="flex items-center shrink-0 max-w-[45%] sm:max-w-[40%]">
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate" title={user.email ?? undefined}>
              {user.email}
            </span>
          </div>
        </div>
      </header>

      {/* Overlay unter Kopfzeile */}
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

      {/* Drawer unter Kopfzeile: Inhalt beginnt unter der Bar */}
      <aside
        id="main-nav-drawer"
        className={`fixed top-0 left-0 z-[45] h-full w-64 max-w-[85vw] flex flex-col bg-white dark:bg-slate-800 shadow-xl transform transition-transform duration-200 ease-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMenuOpen}
        aria-label="Seitenmenü"
      >
        <div className="flex flex-col min-h-0 flex-1 pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
          {renderSidebarBrand()}
          <nav className="flex flex-col gap-1 p-2 overflow-y-auto flex-1 min-h-0" aria-label="Hauptnavigation">
            {navItems.map((item) => {
              const active = item.isActive(pathname)
              return (
                <Link key={item.to} to={item.to} className={drawerLinkClass(active)} onClick={handleMenuClose}>
                  {item.label}
                </Link>
              )
            })}
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
        className="flex-1 p-3 sm:p-4 overflow-auto pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
        tabIndex={-1}
      >
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
