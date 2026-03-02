import { useAuth } from './AuthContext'

type AuthLoaderProps = {
  children: React.ReactNode
}

const AuthLoader = ({ children }: AuthLoaderProps) => {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5b7895' }}
      >
        <div style={{ color: 'rgba(255,255,255,0.95)', fontSize: '1.125rem' }}>Lade...</div>
      </div>
    )
  }

  return <>{children}</>
}

export default AuthLoader
