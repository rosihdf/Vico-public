import { useAuth } from './AuthContext'
import { LoadingSpinner } from './components/LoadingSpinner'

type AuthLoaderProps = {
  children: React.ReactNode
}

const AuthLoader = ({ children }: AuthLoaderProps) => {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#5b7895] dark:bg-slate-900">
        <LoadingSpinner message="Lade…" size="lg" variant="light" />
      </div>
    )
  }

  return <>{children}</>
}

export default AuthLoader
