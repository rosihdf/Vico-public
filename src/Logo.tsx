import { Link } from 'react-router-dom'

const LOGO_SRC = '/logo_vico.png'

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
  const img = (
    <img
      src={LOGO_SRC}
      alt="Vico Türen & Tore"
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
