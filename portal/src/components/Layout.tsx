import { Link, Outlet, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useTheme } from '../ThemeContext'
import type { Theme } from '../ThemeContext'

const THEME_LABELS: Record<Theme, string> = {
  light: 'Hell',
  dark: 'Dunkel',
  system: 'System',
}

type LayoutProps = {
  user: User
  onLogout: () => void
}

const navLinkClass = (active: boolean) =>
  `px-3 py-1.5 text-sm rounded-lg transition-colors ${
    active ? 'bg-white/25 font-medium' : 'hover:bg-white/15'
  }`

const Layout = ({ user, onLogout }: LayoutProps) => {
  const location = useLocation()
  const { theme, resolvedTheme, cycleTheme } = useTheme()

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <header className="bg-vico-primary text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/berichte" className="flex items-center gap-3">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h1 className="text-lg font-bold leading-tight">Vico Türen & Tore Kundenportal</h1>
                <p className="text-xs text-white/70">Wartungsberichte</p>
              </div>
            </Link>
            <nav className="flex items-center gap-1 ml-4">
              <Link
                to="/berichte"
                className={navLinkClass(location.pathname === '/berichte')}
                tabIndex={0}
              >
                Berichte
              </Link>
              <Link
                to="/meine-daten"
                className={navLinkClass(location.pathname === '/meine-daten')}
                tabIndex={0}
              >
                Meine Daten
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cycleTheme}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              aria-label={`Darstellung: ${THEME_LABELS[theme]}`}
              title={`Darstellung (${THEME_LABELS[theme]}). Klicken zum Wechseln.`}
            >
              {resolvedTheme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
            <span className="text-sm text-white/80 hidden sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 text-sm bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              aria-label="Abmelden"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      <footer className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-4">
        <Link to="/datenschutz" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
          Datenschutz
        </Link>
        <span>·</span>
        <Link to="/impressum" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
          Impressum
        </Link>
        <span>·</span>
        <span>Vico Türen & Tore</span>
      </footer>
    </div>
  )
}

export default Layout
