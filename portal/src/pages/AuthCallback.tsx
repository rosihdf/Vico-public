import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const AuthCallback = () => {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          setError('Authentifizierung fehlgeschlagen. Bitte erneut versuchen.')
          return
        }
        navigate('/berichte', { replace: true })
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        navigate('/berichte', { replace: true })
      } else {
        setError('Kein gültiger Login-Link. Bitte fordern Sie einen neuen an.')
      }
    }

    handleCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-slate-700 mb-4">{error}</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-vico-primary text-white rounded-lg hover:bg-vico-primary-hover transition-colors"
          >
            Zurück zum Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-vico-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Anmeldung wird verarbeitet…</p>
      </div>
    </div>
  )
}

export default AuthCallback
