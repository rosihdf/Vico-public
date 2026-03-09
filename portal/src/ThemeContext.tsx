import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'vico-portal-theme'

const getStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* ignore */
  }
  return 'light'
}

const getResolvedTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'light') return 'light'
  if (theme === 'dark') return 'dark'
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

const applyThemeToDom = (resolved: 'light' | 'dark') => {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.classList.remove('light', 'dark')
  html.classList.add(resolved)
  html.setAttribute('data-theme', resolved)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#5b7895')
  }
}

const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

const getNextTheme = (current: Theme): Theme =>
  THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    getResolvedTheme(getStoredTheme())
  )

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
    const resolved = getResolvedTheme(value)
    setResolvedTheme(resolved)
    applyThemeToDom(resolved)
  }, [])

  const cycleTheme = useCallback(() => {
    setTheme(getNextTheme(theme))
  }, [theme, setTheme])

  useEffect(() => {
    const resolved = getResolvedTheme(theme)
    setResolvedTheme(resolved)
    applyThemeToDom(resolved)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setResolvedTheme(getResolvedTheme('system'))
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
