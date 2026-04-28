import { useState, useEffect, useCallback, type KeyboardEvent } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

type LayoutProps = {
  user: User
  onLogout: () => Promise<void>
}

type NavItem = {
  to: string
  label: string
  isActive: (pathname: string) => boolean
}

const Layout = ({ user, onLogout }: LayoutProps) => {
  const location = useLocation()
  const pathname = location.pathname
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems: NavItem[] = [
    { to: '/', label: 'Mandanten', isActive: (p) => p === '/' || p.startsWith('/mandanten') },
    { to: '/globale-wartung', label: 'Globale Wartung', isActive: (p) => p.startsWith('/globale-wartung') },
    {
      to: '/mandanten-aktualisieren',
      label: 'Mandanten aktualisieren',
      isActive: (p) => p.startsWith('/mandanten-aktualisieren'),
    },
    { to: '/app-releases', label: 'App-Releases', isActive: (p) => p.startsWith('/app-releases') },
    {
      to: '/release-rollout',
      label: 'Rollout & Deploy',
      isActive: (p) => p.startsWith('/release-rollout'),
    },
    {
      to: '/release-audit',
      label: 'Release-Audit',
      isActive: (p) => p.startsWith('/release-audit'),
    },
    { to: '/roadmap', label: 'Roadmap', isActive: (p) => p.startsWith('/roadmap') },
    { to: '/beta-feedback', label: 'Beta-Feedback', isActive: (p) => p.startsWith('/beta-feedback') },
    { to: '/lizenzmodelle', label: 'Lizenzmodelle', isActive: (p) => p.startsWith('/lizenzmodelle') },
    { to: '/grenzueberschreitungen', label: 'Grenzüberschreitungen', isActive: (p) => p.startsWith('/grenzueberschreitungen') },
    { to: '/einstellungen', label: 'Einstellungen', isActive: (p) => p.startsWith('/einstellungen') },
    { to: '/info', label: 'Info', isActive: (p) => p === '/info' },
  ]

  const drawerLinkClass = (active: boolean) =>
    `block w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-vico-primary/10 text-vico-primary'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
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

  const handleLogout = async () => {
    handleMenuClose()
    await onLogout()
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
      >
        Zum Inhalt springen
      </a>

      {/* Kopfzeile z-50: über Overlay (z-40) und Drawer (z-[45]) */}
      <header className="sticky top-0 z-50 bg-vico-primary shadow-md flex items-center justify-between gap-2 px-3 sm:px-4 min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]">
        <button
          type="button"
          onClick={handleMenuToggle}
          onKeyDown={handleMenuButtonKeyDown}
          className="flex-shrink-0 p-2 -ml-2 rounded-lg text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-expanded={isMenuOpen}
          aria-controls="lizenzportal-nav-drawer"
          aria-label={isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex-1 min-w-0 flex justify-center items-center px-2">
          <h1 className="text-base sm:text-lg font-bold text-white truncate">AMRtech Lizenzmodul</h1>
        </div>

        <div className="flex-shrink-0 max-w-[45%] sm:max-w-[40%] min-w-0">
          <span className="text-xs sm:text-sm text-white/85 truncate block text-right" title={user.email ?? undefined}>
            {user.email}
          </span>
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

      {/* Drawer: Inhalt beginnt unter der Bar */}
      <aside
        id="lizenzportal-nav-drawer"
        className={`fixed top-0 left-0 z-[45] h-full w-64 max-w-[85vw] flex flex-col bg-white shadow-xl transform transition-transform duration-200 ease-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMenuOpen}
        aria-label="Seitenmenü"
      >
        <div className="flex flex-col min-h-0 flex-1 pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
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
          <div className="p-2 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full px-4 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              aria-label="Abmelden"
            >
              Abmelden
            </button>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        className="flex-1 p-3 sm:p-4 overflow-auto pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        tabIndex={-1}
      >
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
