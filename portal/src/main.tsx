import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './ThemeContext'
import { DesignProvider } from './DesignContext'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <DesignProvider>
          <App />
        </DesignProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
)
