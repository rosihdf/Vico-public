import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ErrorBoundary'
import { reportError } from './lib/errorReportService'
import './index.css'

if (typeof window !== 'undefined') {
  window.onerror = (message, _source, _lineno, _colno, error) => {
    const msg = error?.message ?? String(message)
    const stack = error?.stack ?? null
    const path = window.location.pathname + window.location.search
    reportError({ message: msg, stack, path, source: 'arbeitszeit_portal' })
  }
  window.onunhandledrejection = (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : null
    const path = window.location.pathname + window.location.search
    reportError({ message, stack, path, source: 'arbeitszeit_portal' })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
