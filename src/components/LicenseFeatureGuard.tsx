import { Navigate, useLocation } from 'react-router-dom'
import { useLicense } from '../LicenseContext'
import { hasFeature } from '../lib/licenseService'
import { LoadingSpinner } from './LoadingSpinner'

type LicenseFeatureGuardProps = {
  /** Key aus `shared/licenseFeatures.ts` */
  feature: string
  children: React.ReactNode
}

/**
 * Leitet zur Startseite, wenn die Lizenz das Feature nicht enthält.
 * Nur innerhalb von `LicenseProvider` verwenden.
 */
const LicenseFeatureGuard = ({ feature, children }: LicenseFeatureGuardProps) => {
  const { license, isLoading } = useLicense()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <LoadingSpinner message="Lade Lizenz…" size="md" />
      </div>
    )
  }

  if (!license || !hasFeature(license, feature)) {
    return <Navigate to="/" replace state={{ from: location, featureDenied: feature }} />
  }

  return <>{children}</>
}

export default LicenseFeatureGuard
