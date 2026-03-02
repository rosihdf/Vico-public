import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

const handleError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  rootEl.innerHTML = `
    <div style="padding: 24px; font-family: system-ui; max-width: 500px;">
      <h2 style="color: #dc2626; margin: 0 0 8px 0;">Fehler beim Start</h2>
      <p style="color: #57534e; margin: 0 0 16px 0;">${msg}</p>
      <button onclick="location.reload()" style="padding: 8px 16px; background: #1e293b; color: white; border: none; border-radius: 8px; cursor: pointer;">
        Neu laden
      </button>
    </div>
  `
  console.error(err)
}

async function init() {
  try {
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
