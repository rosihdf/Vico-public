import { Outlet, Link, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

type LayoutProps = {
  user: User
  onLogout: () => Promise<void>
}

const Layout = ({ user, onLogout }: LayoutProps) => {
  const location = useLocation()
  const isÜbersicht = location.pathname === '/' || location.pathname === '/uebersicht'
  const navClass = (active: boolean) =>
    active
      ? 'px-3 py-1.5 text-sm font-medium text-vico-primary bg-vico-primary/10 rounded-lg'
      : 'px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg'

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-slate-800">Arbeitszeitenportal</h1>
          <nav className="flex gap-1" aria-label="Hauptnavigation">
            <Link to="/" className={navClass(isÜbersicht)}>Übersicht</Link>
            <Link to="/alle-zeiten" className={navClass(location.pathname.startsWith('/alle-zeiten'))}>Alle Zeiten</Link>
            <Link to="/log" className={navClass(location.pathname.startsWith('/log'))}>Log</Link>
            <Link to="/stammdaten" className={navClass(location.pathname.startsWith('/stammdaten'))}>Stammdaten AZK</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user.email}</span>
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Abmelden"
          >
            Abmelden
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
