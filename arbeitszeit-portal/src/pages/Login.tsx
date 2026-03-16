import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getSupabaseErrorMessage } from '../../../shared/supabaseErrors'
import { withTimeoutReject } from '../../../shared/authUtils'

const LOGIN_TIMEOUT_MS = 30_000

type LoginProps = {
  onSuccess: () => void
  onError: (message: string) => void
}

const Login = ({ onSuccess, onError }: LoginProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slowHint, setSlowHint] = useState(false)

  useEffect(() => {
    if (!isSubmitting) {
      setSlowHint(false)
      return
    }
    const timer = setTimeout(() => setSlowHint(true), 5_000)
    return () => clearTimeout(timer)
  }, [isSubmitting])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      onError('Bitte E-Mail und Passwort eingeben.')
      return
    }
    setIsSubmitting(true)
    onError('')
    try {
      const { data, error } = await withTimeoutReject(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        LOGIN_TIMEOUT_MS,
        'Verbindung zu langsam. Supabase-Projekt könnte pausiert sein. Bitte erneut versuchen.'
      )
      if (error) {
        onError(getSupabaseErrorMessage(error))
        return
      }
      if (data.user) {
        onSuccess()
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Arbeitszeitenportal</h1>
        <p className="text-sm text-slate-500 mb-6">Nur für Admin / Teamleiter</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
              E-Mail
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
              placeholder="name@beispiel.de"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1">
              Passwort
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
              aria-required="true"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg bg-vico-primary text-white font-medium hover:bg-vico-primary-hover disabled:opacity-50 transition-colors"
            aria-label="Anmelden"
          >
            {isSubmitting ? 'Anmelden…' : 'Anmelden'}
          </button>
          {slowHint && (
            <p className="text-xs text-slate-400 text-center">
              Verbindung dauert… Bei inaktivem Supabase-Projekt kann das Aufwecken etwas dauern.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export default Login
