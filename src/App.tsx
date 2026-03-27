import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { prefetchAllChunks } from './lib/prefetchChunks'
import { ToastProvider } from './ToastContext'
import { ThemeProvider } from './ThemeContext'
import { SyncProvider } from './SyncContext'
import { ComponentSettingsProvider } from './ComponentSettingsContext'
import { LicenseProvider } from './LicenseContext'
import { AuthProvider } from './AuthContext'
import AuthLoader from './AuthLoader'
import ThemePreferenceSync from './components/ThemePreferenceSync'
import Layout from './Layout'
import ProtectedRoute from './ProtectedRoute'
import ComponentGuard from './ComponentGuard'
import LicenseFeatureGuard from './components/LicenseFeatureGuard'
import LicenseGate from './components/LicenseGate'
import { LoadingSpinner } from './components/LoadingSpinner'

const Startseite = lazy(() => import('./Startseite'))
const Kunden = lazy(() => import('./Kunden'))
const BVRedirect = lazy(() => import('./BVRedirect'))
const ObjectRedirect = lazy(() => import('./ObjectRedirect'))
const Wartungsprotokolle = lazy(() => import('./Wartungsprotokolle'))
const Suche = lazy(() => import('./Suche'))
const Info = lazy(() => import('./Info'))
const Einstellungen = lazy(() => import('./Einstellungen'))
const Benutzerverwaltung = lazy(() => import('./Benutzerverwaltung'))
const Historie = lazy(() => import('./Historie'))
const Fehlerberichte = lazy(() => import('./Fehlerberichte'))
const Ladezeiten = lazy(() => import('./pages/Ladezeiten'))
const System = lazy(() => import('./pages/System'))
const SystemIndexRedirect = lazy(() => import('./pages/SystemIndexRedirect'))
const OffeneMaengel = lazy(() => import('./pages/OffeneMaengel'))
const Scan = lazy(() => import('./Scan'))
const AuftragAnlegen = lazy(() => import('./AuftragAnlegen'))
const Auftragsdetail = lazy(() => import('./Auftragsdetail'))
const AuftragAusQr = lazy(() => import('./pages/AuftragAusQr'))
const ObjektBearbeiten = lazy(() => import('./pages/ObjektBearbeiten'))
const Login = lazy(() => import('./Login'))
const ResetPassword = lazy(() => import('./ResetPassword'))
const Profil = lazy(() => import('./Profil'))
const Arbeitszeit = lazy(() => import('./Arbeitszeit'))
const Import = lazy(() => import('./Import'))
const Wartungsstatistik = lazy(() => import('./pages/Wartungsstatistik'))
const BuchhaltungExport = lazy(() => import('./pages/BuchhaltungExport'))
const AktivierungsScreen = lazy(() => import('./pages/AktivierungsScreen'))
const Impressum = lazy(() => import('./pages/Impressum'))
const Datenschutz = lazy(() => import('./pages/Datenschutz'))

const PageFallback = () => (
  <LoadingSpinner message="Lade…" size="lg" className="p-8 min-h-[200px]" />
)

const App = () => {
  useEffect(() => {
    prefetchAllChunks()
  }, [])

  return (
    <div className="min-h-screen bg-[#5b7895] dark:bg-slate-900 transition-colors">
    <ToastProvider>
    <ThemeProvider>
    <AuthProvider>
      <ThemePreferenceSync />
      <AuthLoader>
        <BrowserRouter>
          <Routes>
            <Route path="/aktivierung" element={<Suspense fallback={<PageFallback />}><AktivierungsScreen /></Suspense>} />
            <Route path="/impressum" element={<Suspense fallback={<PageFallback />}><Impressum /></Suspense>} />
            <Route path="/datenschutz" element={<Suspense fallback={<PageFallback />}><Datenschutz /></Suspense>} />
            <Route path="/*" element={
              <LicenseGate>
                <LicenseProvider>
                <SyncProvider>
                  <ComponentSettingsProvider>
                  <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="dashboard"><ProtectedRoute><Startseite /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><Kunden /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route
                  path="objekt/:objectId/bearbeiten"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ComponentGuard componentKey="kunden">
                        <ProtectedRoute>
                          <ObjektBearbeiten />
                        </ProtectedRoute>
                      </ComponentGuard>
                    </Suspense>
                  }
                />
                <Route
                  path="wartungsstatistik"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <LicenseFeatureGuard feature="wartungsprotokolle">
                        <ComponentGuard componentKey="kunden">
                          <ProtectedRoute>
                            <Wartungsstatistik />
                          </ProtectedRoute>
                        </ComponentGuard>
                      </LicenseFeatureGuard>
                    </Suspense>
                  }
                />
                <Route path="kunden/:customerId/bvs" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><BVRedirect /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden/:customerId/bvs/:bvId/objekte" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><ObjectRedirect /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="kunden/:customerId/bvs/:bvId/objekte/:objectId/wartung" element={<Suspense fallback={<PageFallback />}><LicenseFeatureGuard feature="wartungsprotokolle"><ComponentGuard componentKey="wartungsprotokolle"><ProtectedRoute><Wartungsprotokolle /></ProtectedRoute></ComponentGuard></LicenseFeatureGuard></Suspense>} />
                <Route path="kunden/:customerId/objekte/:objectId/wartung" element={<Suspense fallback={<PageFallback />}><LicenseFeatureGuard feature="wartungsprotokolle"><ComponentGuard componentKey="wartungsprotokolle"><ProtectedRoute><Wartungsprotokolle /></ProtectedRoute></ComponentGuard></LicenseFeatureGuard></Suspense>} />
                <Route path="suche" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="suche"><ProtectedRoute><Suche /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="info" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="info"><ProtectedRoute><Info /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="einstellungen" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="einstellungen"><ProtectedRoute><Einstellungen /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="benutzerverwaltung" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="benutzerverwaltung"><ProtectedRoute><Benutzerverwaltung /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="system" element={<Suspense fallback={<PageFallback />}><ProtectedRoute><System /></ProtectedRoute></Suspense>}>
                  <Route index element={<Suspense fallback={<PageFallback />}><SystemIndexRedirect /></Suspense>} />
                  <Route path="historie" element={<Suspense fallback={<PageFallback />}><LicenseFeatureGuard feature="historie"><Historie /></LicenseFeatureGuard></Suspense>} />
                  <Route path="fehlerberichte" element={<Suspense fallback={<PageFallback />}><LicenseFeatureGuard feature="fehlerberichte"><Fehlerberichte /></LicenseFeatureGuard></Suspense>} />
                  <Route path="ladezeiten" element={<Suspense fallback={<PageFallback />}><LicenseFeatureGuard feature="ladezeiten"><Ladezeiten /></LicenseFeatureGuard></Suspense>} />
                  <Route
                    path="maengel"
                    element={
                      <Suspense fallback={<PageFallback />}>
                        <LicenseFeatureGuard feature="wartungsprotokolle">
                          <OffeneMaengel />
                        </LicenseFeatureGuard>
                      </Suspense>
                    }
                  />
                </Route>
                <Route path="historie" element={<Navigate to="/system/historie" replace />} />
                <Route path="fehlerberichte" element={<Navigate to="/system/fehlerberichte" replace />} />
                <Route path="ladezeiten" element={<Navigate to="/system/ladezeiten" replace />} />
                <Route path="scan" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="scan"><ProtectedRoute><Scan /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="auftrag" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="auftrag"><ProtectedRoute><AuftragAnlegen /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route
                  path="buchhaltung-export"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <LicenseFeatureGuard feature="buchhaltung_export">
                        <ComponentGuard componentKey="auftrag">
                          <ProtectedRoute>
                            <BuchhaltungExport />
                          </ProtectedRoute>
                        </ComponentGuard>
                      </LicenseFeatureGuard>
                    </Suspense>
                  }
                />
                <Route
                  path="auftrag/neu-aus-qr"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ComponentGuard componentKey="auftrag">
                        <ProtectedRoute>
                          <AuftragAusQr />
                        </ProtectedRoute>
                      </ComponentGuard>
                    </Suspense>
                  }
                />
                <Route path="auftrag/:orderId" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="auftrag"><ProtectedRoute><Auftragsdetail /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="login" element={<Suspense fallback={<PageFallback />}><Login /></Suspense>} />
                <Route path="reset-password" element={<Suspense fallback={<PageFallback />}><ResetPassword /></Suspense>} />
                <Route path="profil" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="profil"><ProtectedRoute><Profil /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="arbeitszeit" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="arbeitszeiterfassung"><ProtectedRoute><Arbeitszeit /></ProtectedRoute></ComponentGuard></Suspense>} />
                <Route path="import" element={<Suspense fallback={<PageFallback />}><ComponentGuard componentKey="kunden"><ProtectedRoute><Import /></ProtectedRoute></ComponentGuard></Suspense>} />
              </Route>
                  </Routes>
          </ComponentSettingsProvider>
        </SyncProvider>
                </LicenseProvider>
              </LicenseGate>
            } />
          </Routes>
        </BrowserRouter>
      </AuthLoader>
    </AuthProvider>
    </ThemeProvider>
    </ToastProvider>
    </div>
  )
}

export default App
