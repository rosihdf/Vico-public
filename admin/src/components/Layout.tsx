import { Outlet } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

type LayoutProps = {
  user: User
  onLogout: () => Promise<void>
}

const Layout = ({ user, onLogout }: LayoutProps) => {
  const handleLogout = async () => {
    await onLogout()
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Vico Lizenz-Admin</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user.email}</span>
          <button
            type="button"
            onClick={handleLogout}
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
