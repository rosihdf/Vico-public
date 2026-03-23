import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { getRememberMe } from './supabase'
import Logo from './Logo'
import MfaChallenge from './components/MfaChallenge'

const Login = () => {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMfaChallenge, setShowMfaChallenge] = useState(false)
  const [rememberMe, setRememberMeState] = useState(true)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMessage, setForgotMessage] = useState<string | null>(null)
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false)
  const { login, verifyMfa, logout, resetPasswordForEmail, loginError } = useAuth()
  const { showError } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const stateMessage = (location.state as { message?: string } | null)?.message

  useEffect(() => {
    setRememberMeState(getRememberMe())
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const result = await login(identifier, password, rememberMe)
      if (result.success) {
        if (result.needsMfa) {
          setShowMfaChallenge(true)
        } else {
          navigate('/')
        }
      } else if (result.message) {
        showError(result.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMfaSubmit = async (code: string) => {
    const result = await verifyMfa(code)
    if (result.success) {
      navigate('/')
    }
    return result
  }

  const handleMfaCancel = async () => {
    await logout()
    setShowMfaChallenge(false)
  }

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdentifier(e.target.value)
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
  }

  const handleForgotPassword = () => {
    setShowForgotPassword(true)
    setForgotMessage(null)
    setForgotEmail(identifier || '')
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotMessage(null)
    if (!forgotEmail.trim()) return
    setIsForgotSubmitting(true)
    const { success, message } = await resetPasswordForEmail(forgotEmail.trim())
    setForgotMessage(message)
    setIsForgotSubmitting(false)
    if (success) {
      setShowForgotPassword(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm min-w-0 p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-lg">
        <Logo variant="login" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
          {showMfaChallenge ? 'Zwei-Faktor-Authentifizierung' : showForgotPassword ? 'Passwort zurücksetzen' : 'Anmelden'}
        </h2>

        {showMfaChallenge ? (
          <MfaChallenge
            onSubmit={handleMfaSubmit}
            onCancel={handleMfaCancel}
          />
        ) : showForgotPassword ? (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-1">
                E-Mail
              </label>
              <input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="name@beispiel.de"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vico-primary"
                required
                disabled={isForgotSubmitting}
              />
            </div>
            {forgotMessage && (
              <p
                className={`text-sm ${
                  forgotMessage.includes('gesendet') ? 'text-green-600' : 'text-red-600'
                }`}
                role="alert"
              >
                {forgotMessage}
              </p>
            )}
            <button
              type="submit"
              className="w-full py-2.5 text-slate-800 font-medium rounded-lg border border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary"
              style={{ backgroundColor: '#ffffff' }}
              disabled={isForgotSubmitting}
            >
              {isForgotSubmitting ? 'Wird gesendet…' : 'Link senden'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false)
                setForgotMessage(null)
              }}
              className="w-full py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              ← Zurück zum Login
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="identifier"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
            >
              E-Mail
            </label>
            <input
              id="identifier"
              type="email"
              value={identifier}
              onChange={handleIdentifierChange}
              autoComplete="username email"
              placeholder="name@beispiel.de"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:border-transparent"
              aria-required="true"
              aria-invalid={!!loginError}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
            >
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              autoComplete="current-password"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:border-transparent"
              aria-required="true"
              aria-invalid={!!loginError}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMeState(e.target.checked)}
              className="rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
              aria-label="Eingeloggt bleiben"
            />
            <span className="text-sm text-slate-700 dark:text-slate-200">Eingeloggt bleiben</span>
          </label>

          {stateMessage && (
            <p className="text-sm text-green-600">{stateMessage}</p>
          )}
          {loginError && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 text-slate-800 dark:text-slate-100 font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Wird angemeldet…' : 'Anmelden'}
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="w-full py-2 text-sm text-slate-600 hover:text-slate-800 focus:outline-none focus:underline"
            aria-label="Passwort vergessen"
          >
            Passwort vergessen?
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-1">
            Konten werden vom Admin Ihres Mandanten angelegt. Bei Zugangsdaten wenden Sie sich bitte an den Administrator.
          </p>
        </form>
        )}
      </div>
    </div>
  )
}

export default Login
