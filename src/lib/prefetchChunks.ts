/**
 * Prefetch aller Lazy-Chunks im Hintergrund, damit die App offline vollständig nutzbar ist.
 * Läuft bei App-Start (idle), ohne dass der Nutzer alle Seiten besuchen muss.
 */
const LAZY_IMPORTS = [
  () => import('../Startseite'),
  () => import('../Kunden'),
  () => import('../pages/Wartungsstatistik'),
  () => import('../pages/WartungsprotokolleUebersicht'),
  () => import('../BVRedirect'),
  () => import('../ObjectRedirect'),
  () => import('../Wartungsprotokolle'),
  () => import('../Suche'),
  () => import('../Info'),
  () => import('../Einstellungen'),
  () => import('../Benutzerverwaltung'),
  () => import('../pages/System'),
  () => import('../pages/OffeneMaengel'),
  () => import('../Historie'),
  () => import('../Fehlerberichte'),
  () => import('../pages/Ladezeiten'),
  () => import('../Scan'),
  () => import('../AuftragAnlegen'),
  () => import('../pages/BuchhaltungExport'),
  () => import('../Auftragsdetail'),
  () => import('../Login'),
  () => import('../ResetPassword'),
  () => import('../Profil'),
  () => import('../Arbeitszeit'),
  () => import('../Import'),
  () => import('../pages/AktivierungsScreen'),
  () => import('../pages/Impressum'),
  () => import('../pages/Datenschutz'),
]

export const prefetchAllChunks = (): void => {
  const run = () => {
    LAZY_IMPORTS.forEach((fn) => {
      fn().catch(() => { /* ignoriert – Chunk evtl. noch nicht gebaut */ })
    })
  }
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 8000 })
  } else {
    setTimeout(run, 3000)
  }
}
