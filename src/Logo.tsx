import { Link } from 'react-router-dom'
import { useLicenseOptional } from './LicenseContext'

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
  const logoUrl = design?.logo_url?.trim() || ''
  const appName = design?.app_name || 'AMRtech Türen & Tore'
  if (!logoUrl) {
    const text = (
      <span
        className={[
          'font-semibold text-slate-800 dark:text-slate-100',
          variant === 'login' ? 'text-2xl md:text-3xl' : variant === 'full' ? 'text-xl md:text-2xl' : 'text-base md:text-lg',
          className,
        ].join(' ')}
      >
        {appName}
      </span>
    )
    if (variant === 'login') {
      return <div className="flex justify-center mb-8">{text}</div>
    }
    return (
      <Link to="/" className="hover:opacity-90 transition-opacity" aria-label="Startseite öffnen">
        {text}
      </Link>
    )
  }

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
