import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SyncProvider } from './SyncContext'
import { ComponentSettingsProvider } from './ComponentSettingsContext'
import { AuthProvider } from './AuthContext'
import AuthLoader from './AuthLoader'
import Layout from './Layout'
import ProtectedRoute from './ProtectedRoute'
import ComponentGuard from './ComponentGuard'

const Startseite = lazy(() => import('./Startseite'))
const Kunden = lazy(() => import('./Kunden'))
const BVs = lazy(() => import('./BVs'))
const Objekte = lazy(() => import('./Objekte'))
const Wartungsprotokolle = lazy(() => import('./Wartungsprotokolle'))
const Suche = lazy(() => import('./Suche'))
const Einstellungen = lazy(() => import('./Einstellungen'))
const Benutzerverwaltung = lazy(() => import('./Benutzerverwaltung'))
const Scan = lazy(() => import('./Scan'))
const AuftragAnlegen = lazy(() => import('./AuftragAnlegen'))
const Login = lazy(() => import('./Login'))
const ResetPassword = lazy(() => import('./ResetPassword'))
const Profil = lazy(() => import('./Profil'))

const PageFallback = () => (
  <div className="p-8 flex justify-center items-center min-h-[200px]">
    <span className="text-slate-600">Lade…</span>
  </div>
)

const App = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#5b7895' }}>
    <AuthProvider>
      <AuthLoader>
        <SyncProvider>
          <ComponentSettingsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="dashboard"><Startseite /></ComponentGuard></Suspense>} />
                <Route path="kunden" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><Kunden /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden/:customerId/bvs" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><BVs /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden/:customerId/bvs/:bvId/objekte" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><Objekte /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden/:customerId/bvs/:bvId/objekte/:objectId/wartung" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="wartungsprotokolle"><ProtectedRoute><Wartungsprotokolle /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="suche" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="suche"><ProtectedRoute><Suche /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="einstellungen" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="einstellungen"><Einstellungen /></ComponentGuard></Suspense>} />
                <Route path="benutzerverwaltung" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="benutzerverwaltung"><ProtectedRoute><Benutzerverwaltung /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="scan" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="scan"><Scan /></ComponentGuard></Suspense>} />
                <Route path="auftrag" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="auftrag"><ProtectedRoute><AuftragAnlegen /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="login" element={<Suspense fallback={<PageFallback />}><Login /></Suspense>} />
                <Route path="reset-password" element={<Suspense fallback={<PageFallback />}><ResetPassword /></Suspense>} />
                <Route path="profil" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="profil"><Profil /></ComponentGuard></Suspense>} />
              </Route>
            </Routes>
        </BrowserRouter>
          </ComponentSettingsProvider>
        </SyncProvider>
      </AuthLoader>
    </AuthProvider>
    </div>
  )
}

export default App
