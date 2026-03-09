import { Link, Outlet } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

type LayoutProps = {
  user: User
  onLogout: () => void
}

const Layout = ({ user, onLogout }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-vico-primary text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <h1 className="text-lg font-bold leading-tight">Vico Kundenportal</h1>
              <p className="text-xs text-white/70">Wartungsberichte</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
      <footer className="flex items-center justify-center gap-2 text-xs text-slate-400 py-4">
        <Link to="/datenschutz" className="hover:text-slate-600 transition-colors" tabIndex={0}>
          Datenschutz
        </Link>
        <span>·</span>
        <Link to="/impressum" className="hover:text-slate-600 transition-colors" tabIndex={0}>
          Impressum
        </Link>
        <span>·</span>
        <span>Vico Türen & Tore</span>
      </footer>
    </div>
  )
}

export default Layout
