import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getSupabaseErrorMessage } from '../../../shared/supabaseErrors'
import { withTimeoutReject } from '../../../shared/authUtils'
import { useDesign } from '../DesignContext'

const LOGIN_TIMEOUT_MS = 30_000

type LoginProps = {
  onSuccess: () => void
  onError: (message: string) => void
}

const Login = ({ onSuccess, onError }: LoginProps) => {
  const { appName, logoUrl } = useDesign()
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-6 shadow-sm">
        {logoUrl ? (
          <div className="mb-4 flex justify-center">
            <img src={logoUrl} alt={appName} className="h-14 w-auto max-w-[220px] object-contain" />
          </div>
        ) : null}
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
          {appName} Arbeitszeitenportal
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Nur für Admin / Teamleiter</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              E-Mail
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-vico-primary/80 focus:border-vico-primary outline-none"
              placeholder="name@beispiel.de"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Passwort
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-vico-primary/80 focus:border-vico-primary outline-none"
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
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              Verbindung dauert… Bei inaktivem Supabase-Projekt kann das Aufwecken etwas dauern.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export default Login
