import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { reportError } from './lib/errorReportService'

const initTheme = () => {
  const stored = localStorage.getItem('vico-theme')
  const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = stored === 'dark' ? 'dark' : stored === 'light' ? 'light' : prefersDark ? 'dark' : 'light'
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)
}
initTheme()

const getSourceFromPath = (path: string | null): 'main_app' | 'zeiterfassung' => {
  if (path?.includes('/arbeitszeit')) return 'zeiterfassung'
  return 'main_app'
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

if (typeof window !== 'undefined') {
  window.onerror = (message, source, _lineno, _colno, error) => {
    const msg = error?.message ?? String(message)
    const stack = error?.stack ?? null
    const path = typeof source === 'string' ? source : window.location.pathname + window.location.search
    const pagePath = window.location.pathname + window.location.search
    reportError({ message: msg, stack, path, source: getSourceFromPath(pagePath) })
  }
  window.onunhandledrejection = (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : null
    const path = window.location.pathname + window.location.search
    reportError({ message, stack, path, source: getSourceFromPath(path) })
  }
}

const handleError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : null
  const path = typeof window !== 'undefined' ? window.location.pathname + window.location.search : null
  reportError({ message: msg, stack, path, source: getSourceFromPath(path) })
  if (rootEl) {
    rootEl.innerHTML = `
    <div style="padding: 24px; font-family: system-ui; max-width: 500px;">
      <h2 style="color: #dc2626; margin: 0 0 8px 0;">Fehler beim Start</h2>
      <p style="color: #57534e; margin: 0 0 16px 0;">${msg.replace(/</g, '&lt;')}</p>
      <button onclick="location.reload()" style="padding: 8px 16px; background: #1e293b; color: white; border: none; border-radius: 8px; cursor: pointer;">
        Neu laden
      </button>
    </div>
  `
  }
  console.error(err)
}

async function init() {
  try {
    // Supabase früh aufwecken (Free-Tier pausiert nach Inaktivität) – parallel zum Laden
    const { warmUpConnection } = await import('./supabase')
    warmUpConnection()

    const [{ default: ErrorBoundary }, { default: App }] = await Promise.all([
      import('./ErrorBoundary'),
      import('./App'),
    ])
    const el = document.getElementById('root')
    if (!el) throw new Error('Root element not found')
    ReactDOM.createRoot(el).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
  } catch (err) {
    handleError(err)
  }
}

init()
