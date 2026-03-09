import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './ThemeContext'
import App from './App'
import './index.css'

const initTheme = () => {
  const stored = localStorage.getItem('vico-portal-theme')
  const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = stored === 'dark' ? 'dark' : stored === 'light' ? 'light' : stored === 'system' ? (prefersDark ? 'dark' : 'light') : 'light'
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)
}
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
)
