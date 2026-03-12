import { useState } from 'react'
import { supabase } from '../lib/supabase'

const translateAuthError = (msg: string): string => {
  if (msg.includes('Signup disabled')) return 'Registrierung ist deaktiviert. Bitte Admin kontaktieren.'
  if (msg.includes('Email not confirmed')) return 'E-Mail noch nicht bestätigt. Bitte Link in der E-Mail klicken.'
  if (msg.includes('Invalid login credentials')) return 'Ungültige Anmeldedaten.'
  if (msg.includes('User already registered')) return 'Diese E-Mail ist bereits registriert. Bitte anmelden.'
  if (msg.includes('Password should be at least')) return 'Passwort muss mindestens 6 Zeichen haben.'
  if (msg.includes('Unable to validate email')) return 'E-Mail-Format ungültig.'
  return msg
}

type LoginProps = {
  onSuccess: () => void
  onError: (message: string) => void
}

const Login = ({ onSuccess, onError }: LoginProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMfaChallenge, setShowMfaChallenge] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [isMfaSubmitting, setIsMfaSubmitting] = useState(false)
  const [mfaError, setMfaError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      onError('Bitte E-Mail und Passwort eingeben.')
      return
    }
    setIsSubmitting(true)
    onError('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setIsSubmitting(false)
    if (error) {
      onError(translateAuthError(error.message))
      return
    }
    if (data.user) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== aalData.nextLevel) {
        setShowMfaChallenge(true)
        setMfaError(null)
        return
      }
      onSuccess()
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = mfaCode.trim().replace(/\s/g, '')
    if (!code) {
      setMfaError('Bitte den Code aus Ihrer Authenticator-App eingeben.')
      return
    }
    setIsMfaSubmitting(true)
    setMfaError(null)
    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError || !factorsData?.totp?.length) {
      setMfaError('Kein 2FA-Faktor gefunden.')
      setIsMfaSubmitting(false)
      return
    }
    const factorId = factorsData.totp[0].id
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challengeData?.id) {
      setMfaError(challengeError?.message ?? 'Challenge fehlgeschlagen')
      setIsMfaSubmitting(false)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    })
    setIsMfaSubmitting(false)
    if (verifyError) {
      setMfaError(verifyError.message)
      return
    }
    onSuccess()
  }

  const handleMfaCancel = async () => {
    await supabase.auth.signOut()
    setShowMfaChallenge(false)
    setMfaCode('')
    setMfaError(null)
  }

  if (showMfaChallenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-sm p-6 bg-white rounded-xl shadow-md border border-slate-200 w-full">
          <h1 className="text-xl font-bold text-slate-800 mb-1">Zwei-Faktor-Authentifizierung</h1>
          <p className="text-sm text-slate-500 mb-4">Geben Sie den Code aus Ihrer Authenticator-App ein.</p>
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div>
              <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-700 mb-1">
                Authenticator-Code
              </label>
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => { setMfaCode(e.target.value); setMfaError(null); }}
                placeholder="000000"
                maxLength={8}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-center text-lg tracking-widest focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
                disabled={isMfaSubmitting}
              />
              {mfaError && (
                <p className="mt-1 text-sm text-red-600" role="alert">{mfaError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isMfaSubmitting}
                className="flex-1 py-2 px-4 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isMfaSubmitting ? 'Wird geprüft…' : 'Bestätigen'}
              </button>
              <button
                type="button"
                onClick={handleMfaCancel}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm p-6 bg-white rounded-xl shadow-md border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Vico Lizenz-Admin</h1>
        <p className="text-sm text-slate-500 mb-6">Nur für Administratoren</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
