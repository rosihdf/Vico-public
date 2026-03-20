/**
 * System-Bereich: Historie, Fehlerberichte, Ladezeiten unter einem gemeinsamen Menüpunkt.
 */
import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/system/historie', label: 'Historie' },
  { to: '/system/fehlerberichte', label: 'Fehlerberichte' },
  { to: '/system/ladezeiten', label: 'Ladezeiten' },
] as const

const System = () => {
  return (
    <div className="min-h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 px-4 pt-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">System</h2>
        <nav
          className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
          aria-label="System-Bereiche"
        >
          {TABS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}

export default System
