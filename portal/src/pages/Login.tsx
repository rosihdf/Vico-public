import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestMagicLink } from '../lib/portalService'
import { supabase } from '../lib/supabase'
import { useTheme } from '../ThemeContext'
import type { Theme } from '../ThemeContext'

const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

const Login = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const handleThemeCycle = () => {
    const idx = THEME_ORDER.indexOf(theme)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
    setTheme(next)
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [showReset, setShowReset] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSending(true)
    setMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({
        type: 'success',
        text: 'Ein Link zum Zurücksetzen des Passworts wurde an Ihre E-Mail gesendet.',
      })
    }
    setIsSending(false)
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSending(true)
    setMessage(null)
    const result = await requestMagicLink(email.trim())
    if (result.success) {
      setMessage({ type: 'success', text: 'Ein Login-Link wurde an Ihre E-Mail gesendet. Bitte prüfen Sie Ihren Posteingang.' })
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Fehler beim Senden des Magic Links.' })
    }
    setIsSending(false)
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return

    setIsSending(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setMessage({ type: 'error', text: 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten.' })
    }
    setIsSending(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-vico-primary text-white mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Vico Türen & Tore Kundenportal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Zugriff auf Ihre Wartungsberichte</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {!showReset && (
          <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { setMode('magic'); setMessage(null) }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  mode === 'magic'
                    ? 'text-vico-primary border-b-2 border-vico-primary bg-vico-primary/5 dark:bg-vico-primary/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200'
                }`}
              >
                Magic Link
              </button>
              <button
                type="button"
                onClick={() => { setMode('password'); setMessage(null) }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  mode === 'password'
                    ? 'text-vico-primary border-b-2 border-vico-primary bg-vico-primary/5 dark:bg-vico-primary/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200'
                }`}
              >
                Passwort
              </button>
            </div>
          )}

          <form
            onSubmit={
              showReset
                ? handlePasswordReset
                : mode === 'magic'
                  ? handleMagicLink
                  : handlePasswordLogin
            }
            className="p-6 space-y-4"
          >
            {showReset ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link zum Zurücksetzen des Passworts.
                </p>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-Mail-Adresse
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:border-transparent"
                    required
                    autoComplete="email"
                    aria-label="E-Mail-Adresse"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-Mail-Adresse
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:border-transparent"
                    required
                    autoComplete="email"
                    aria-label="E-Mail-Adresse"
                  />
                </div>

                {mode === 'password' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Passwort
                      </label>
                      <button
                        type="button"
                        onClick={() => { setShowReset(true); setMessage(null) }}
                        className="text-xs text-vico-primary hover:underline"
                        aria-label="Passwort vergessen"
                      >
                        Passwort vergessen?
                      </button>
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ihr Passwort"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:border-transparent"
                      required
                      autoComplete="current-password"
                      aria-label="Passwort"
                    />
                  </div>
                )}
              </>
            )}

            {message && (
              <div
                className={`text-sm p-3 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}
                role="alert"
              >
                {message.text}
              </div>
            )}

            {showReset ? (
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full py-2.5 bg-vico-primary text-white font-medium rounded-lg hover:bg-vico-primary-hover disabled:opacity-50 transition-colors"
                >
                  {isSending ? 'Bitte warten…' : 'Link senden'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setMessage(null) }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300"
                >
                  Zurück zur Anmeldung
                </button>
              </div>
            ) : (
              <>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-vico-primary focus:ring-vico-primary"
                    aria-label="Datenschutzerklärung akzeptieren"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Ich habe die{' '}
                    <Link to="/datenschutz" className="text-vico-primary hover:underline" tabIndex={0}>
                      Datenschutzerklärung
                    </Link>{' '}
                    gelesen und akzeptiere sie.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSending || !privacyAccepted}
                  className="w-full py-2.5 bg-vico-primary text-white font-medium rounded-lg hover:bg-vico-primary-hover disabled:opacity-50 transition-colors"
                >
                  {isSending
                    ? 'Bitte warten…'
                    : mode === 'magic'
                      ? 'Login-Link senden'
                      : 'Anmelden'}
                </button>

                {mode === 'magic' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    Wir senden Ihnen einen einmaligen Login-Link per E-Mail.
                  </p>
                )}
              </>
            )}
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-6">
          <button
            type="button"
            onClick={handleThemeCycle}
            className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label={`Darstellung wechseln (aktuell: ${theme})`}
          >
            {resolvedTheme === 'dark' ? '☀️' : '🌙'}
          </button>
          <span>·</span>
          <Link to="/datenschutz" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
            Datenschutz
          </Link>
          <span>·</span>
          <Link to="/impressum" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" tabIndex={0}>
            Impressum
          </Link>
          <span>·</span>
          <span>Vico Türen & Tore</span>
        </div>
      </div>
    </div>
  )
}

export default Login
