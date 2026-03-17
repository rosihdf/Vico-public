import { Outlet, Link, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

type LayoutProps = {
  user: User
  onLogout: () => Promise<void>
}

const Layout = ({ user, onLogout }: LayoutProps) => {
  const location = useLocation()
  const isMandanten = location.pathname === '/' || location.pathname.startsWith('/mandanten')
  const isGrenzen = location.pathname.startsWith('/grenzueberschreitungen')
  const isLizenzmodelle = location.pathname.startsWith('/lizenzmodelle')
  const isEinstellungen = location.pathname.startsWith('/einstellungen')
  const navClass = (active: boolean) =>
    active
      ? 'px-3 py-1.5 text-sm font-medium text-vico-primary bg-vico-primary/10 rounded-lg'
      : 'px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg'

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-slate-800">AMRtech Lizenzmodul</h1>
          <nav className="flex gap-1">
            <Link to="/" className={navClass(isMandanten)}>Mandanten</Link>
            <Link to="/lizenzmodelle" className={navClass(isLizenzmodelle)}>Lizenzmodelle</Link>
            <Link to="/grenzueberschreitungen" className={navClass(isGrenzen)}>Grenzüberschreitungen</Link>
            <Link to="/einstellungen" className={navClass(isEinstellungen)}>Einstellungen</Link>
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
