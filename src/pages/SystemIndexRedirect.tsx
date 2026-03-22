import { Navigate } from 'react-router-dom'
import { useLicense } from '../LicenseContext'
import { hasFeature } from '../lib/licenseService'

/** Erste verfügbare System-Unterseite (Historie → Fehlerberichte → Ladezeiten → Start). */
const SystemIndexRedirect = () => {
  const { license } = useLicense()
  if (license && hasFeature(license, 'historie')) {
    return <Navigate to="/system/historie" replace />
  }
  if (license && hasFeature(license, 'fehlerberichte')) {
    return <Navigate to="/system/fehlerberichte" replace />
  }
  if (license && hasFeature(license, 'ladezeiten')) {
    return <Navigate to="/system/ladezeiten" replace />
  }
  return <Navigate to="/" replace />
}

export default SystemIndexRedirect
