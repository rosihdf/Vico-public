import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './ToastContext'
import { ThemeProvider } from './ThemeContext'
import { SyncProvider } from './SyncContext'
import { ComponentSettingsProvider } from './ComponentSettingsContext'
import { LicenseProvider } from './LicenseContext'
import { AuthProvider } from './AuthContext'
import AuthLoader from './AuthLoader'
import Layout from './Layout'
import ProtectedRoute from './ProtectedRoute'
import ComponentGuard from './ComponentGuard'
import { LoadingSpinner } from './components/LoadingSpinner'

const Startseite = lazy(() => import('./Startseite'))
const Kunden = lazy(() => import('./Kunden'))
const BVRedirect = lazy(() => import('./BVRedirect'))
const ObjectRedirect = lazy(() => import('./ObjectRedirect'))
const Wartungsprotokolle = lazy(() => import('./Wartungsprotokolle'))
const Suche = lazy(() => import('./Suche'))
const Einstellungen = lazy(() => import('./Einstellungen'))
const Benutzerverwaltung = lazy(() => import('./Benutzerverwaltung'))
const Historie = lazy(() => import('./Historie'))
const Scan = lazy(() => import('./Scan'))
const AuftragAnlegen = lazy(() => import('./AuftragAnlegen'))
const Login = lazy(() => import('./Login'))
const ResetPassword = lazy(() => import('./ResetPassword'))
const Profil = lazy(() => import('./Profil'))

const PageFallback = () => (
  <LoadingSpinner message="Lade…" size="lg" className="p-8 min-h-[200px]" />
)

const App = () => {
  return (
    <div className="min-h-screen bg-[#5b7895] dark:bg-slate-900 transition-colors">
    <ToastProvider>
    <ThemeProvider>
    <AuthProvider>
      <AuthLoader>
        <LicenseProvider>
        <SyncProvider>
          <ComponentSettingsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="dashboard"><ProtectedRoute><Startseite /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><Kunden /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden/:customerId/bvs" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><BVRedirect /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden/:customerId/bvs/:bvId/objekte" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><ObjectRedirect /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden/:customerId/bvs/:bvId/objekte/:objectId/wartung" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="wartungsprotokolle"><ProtectedRoute><Wartungsprotokolle /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="suche" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="suche"><ProtectedRoute><Suche /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="einstellungen" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="einstellungen"><ProtectedRoute><Einstellungen /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="benutzerverwaltung" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="benutzerverwaltung"><ProtectedRoute><Benutzerverwaltung /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="historie" element={<Suspense fallback={<PageFallback />}><ProtectedRoute><Historie /></ProtectedRoute></Suspense>} />
                <Route path="scan" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="scan"><ProtectedRoute><Scan /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="auftrag" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="auftrag"><ProtectedRoute><AuftragAnlegen /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="login" element={<Suspense fallback={<PageFallback />}><Login /></Suspense>} />
                <Route path="reset-password" element={<Suspense fallback={<PageFallback />}><ResetPassword /></Suspense>} />
                <Route path="profil" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="profil"><ProtectedRoute><Profil /></ProtectedRoute></ComponentGuard></Suspense>} />
              </Route>
            </Routes>
        </BrowserRouter>
          </ComponentSettingsProvider>
        </SyncProvider>
        </LicenseProvider>
      </AuthLoader>
    </AuthProvider>
    </ThemeProvider>
    </ToastProvider>
    </div>
  )
}

export default App
