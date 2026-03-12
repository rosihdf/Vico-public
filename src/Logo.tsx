import { Link } from 'react-router-dom'
import { useLicenseOptional } from './LicenseContext'

const DEFAULT_LOGO = '/logo_vico.png'

type LogoProps = {
  variant?: 'header' | 'login' | 'full'
  className?: string
}

const getSizeClasses = (variant: LogoProps['variant']) => {
  switch (variant) {
    case 'full':
      return 'h-12 md:h-14 w-auto'
    case 'login':
      return 'h-14 md:h-16 w-auto'
    default:
      return 'h-9 md:h-10 w-auto'
  }
}

const Logo = ({ variant = 'header', className = '' }: LogoProps) => {
  const licenseContext = useLicenseOptional()
  const design = licenseContext?.design
  const logoUrl = design?.logo_url || DEFAULT_LOGO
  const appName = design?.app_name || 'Vico Türen & Tore'

  const img = (
    <img
      src={logoUrl}
      alt={appName}
      className={`object-contain object-center ${getSizeClasses(variant)} ${className}`}
    />
  )

  if (variant === 'login') {
    return <div className="flex justify-center mb-8">{img}</div>
  }

  return (
    <Link to="/" className="hover:opacity-90 transition-opacity">
      {img}
    </Link>
  )
}

export default Logo
