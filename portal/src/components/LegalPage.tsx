import { Link } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import type { Theme } from '../ThemeContext'
import { useDesign } from '../DesignContext'
import { saveProfileThemePreference } from '../../../shared/themePreferenceDb'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

const THEME_ORDER: Theme[] = ['light', 'dark', 'system']
const getNextTheme = (current: Theme): Theme =>
  THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]

type LegalPageProps = {
  title: string
  children: React.ReactNode
  backTo?: string
  backLabel?: string
}

const LegalPage = ({ title, children, backTo = '/', backLabel = 'Zurück' }: LegalPageProps) => {
  const { resolvedTheme, theme, setTheme } = useTheme()
  const { appName } = useDesign()

  const handleCycleTheme = () => {
    const next = getNextTheme(theme)
    setTheme(next)
    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const { session } = data
      if (session?.user?.id) {
        void saveProfileThemePreference(supabase, session.user.id, next)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 px-4 py-10">
      <article className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 sm:p-10">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-vico-primary hover:underline mb-6"
          aria-label="Zurück zum Portal"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel}
        </Link>

        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">{title}</h1>

        {children}
      </article>
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-8">
        <button
          type="button"
          onClick={handleCycleTheme}
          className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Darstellung wechseln"
        >
          {resolvedTheme === 'dark' ? '☀️' : '🌙'}
        </button>
        <span>·</span>
        <Link to="/datenschutz" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
          Datenschutz
        </Link>
        <span>·</span>
        <Link to="/impressum" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
          Impressum
        </Link>
        <span>·</span>
        <span>{appName} Türen & Tore</span>
      </div>
    </div>
  )
}

export default LegalPage
