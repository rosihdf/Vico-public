import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'
import Logo from './Logo'

const ResetPassword = () => {
  const { isAuthenticated, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasRecoveryHash, setHasRecoveryHash] = useState(false)
  const [isProcessingHash, setIsProcessingHash] = useState(true)

  useEffect(() => {
    const hash = window.location.hash || ''
    const hasRecovery = hash.includes('type=recovery') || hash.includes('access_token')
    setHasRecoveryHash(hasRecovery)
    if (!hasRecovery) {
      setIsProcessingHash(false)
      return
    }
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => {
          window.history.replaceState(null, '', window.location.pathname)
        })
        .finally(() => setIsProcessingHash(false))
    } else {
      setIsProcessingHash(false)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (newPassword.length < 6) {
      setMessage('Passwort muss mindestens 6 Zeichen haben.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('Passwörter stimmen nicht überein.')
      return
    }
    setIsSubmitting(true)
    const { success, message: msg } = await updatePassword(newPassword)
    setMessage(msg)
    setIsSubmitting(false)
    if (success) {
      navigate('/')
    }
  }

  if (!isAuthenticated && !hasRecoveryHash) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Logo variant="login" />
          <h2 className="text-xl font-bold text-slate-800 mb-6">Passwort zurücksetzen</h2>
          <p className="text-slate-600 mb-4">Bitte den Link aus der E-Mail zum Zurücksetzen verwenden.</p>
          <Link
            to="/login"
            className="block w-full py-2.5 text-center text-slate-800 font-medium rounded-lg border border-slate-300 hover:bg-slate-100"
          >
            Zum Login
          </Link>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && (hasRecoveryHash || isProcessingHash)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Logo variant="login" />
          <h2 className="text-xl font-bold text-slate-800 mb-6">Passwort zurücksetzen</h2>
          <p className="text-slate-600 mb-4">
            {isProcessingHash ? 'Link wird verarbeitet…' : 'Session konnte nicht hergestellt werden.'}
          </p>
          <Link
            to="/login"
            className="block w-full py-2.5 text-center text-slate-800 font-medium rounded-lg border border-slate-300 hover:bg-slate-100"
          >
            Zum Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo variant="login" />
        <h2 className="text-xl font-bold text-slate-800 mb-6">Neues Passwort festlegen</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">
              Neues Passwort (min. 6 Zeichen)
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
              minLength={6}
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
              Passwort bestätigen
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
              minLength={6}
              required
              disabled={isSubmitting}
            />
          </div>
          {message && (
            <p
              className={`text-sm ${message.includes('geändert') ? 'text-green-600' : 'text-red-600'}`}
              role="alert"
            >
              {message}
            </p>
          )}
          <button
            type="submit"
            className="w-full py-2.5 text-slate-800 font-medium rounded-lg border border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary"
            style={{ backgroundColor: '#ffffff' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Wird gespeichert…' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
