import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { getSupabaseErrorMessage } from '../supabaseErrors'
import MfaEnroll from './MfaEnroll'

type MfaFactor = {
  id: string
  friendly_name?: string
  factor_type: string
  status: string
}

const MfaSettings = () => {
  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showEnroll, setShowEnroll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUnenrolling, setIsUnenrolling] = useState<string | null>(null)

  const loadFactors = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    setIsLoading(false)
    if (listError) {
      setError(getSupabaseErrorMessage(listError))
      return
    }
    const all: MfaFactor[] = [...(data?.totp ?? []), ...(data?.phone ?? [])]
    setFactors(all)
  }, [])

  useEffect(() => {
    loadFactors()
  }, [loadFactors])

  const handleUnenroll = async (factorId: string) => {
    if (!confirm('2FA wirklich deaktivieren? Sie können es jederzeit wieder aktivieren.')) return
    setIsUnenrolling(factorId)
    setError(null)
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
    setIsUnenrolling(null)
    if (unenrollError) {
      setError(getSupabaseErrorMessage(unenrollError))
      return
    }
    await loadFactors()
  }

  const handleEnrolled = () => {
    setShowEnroll(false)
    loadFactors()
  }

  if (isLoading) {
    return (
      <div className="p-4 text-slate-500 dark:text-slate-400 text-sm">
        Lade 2FA-Einstellungen…
      </div>
    )
  }

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Zwei-Faktor-Authentifizierung</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {factors.length > 0 ? 'Aktiviert' : 'Nicht aktiviert'}
          </p>
        </div>
        {factors.length === 0 && !showEnroll && (
          <button
            type="button"
            onClick={() => setShowEnroll(true)}
            className="text-sm text-vico-primary hover:underline font-medium"
            aria-label="2FA aktivieren"
          >
            2FA aktivieren
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {showEnroll && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
          <MfaEnroll
            onEnrolled={handleEnrolled}
            onCancelled={() => setShowEnroll(false)}
          />
        </div>
      )}

      {factors.length > 0 && !showEnroll && (
        <ul className="mt-3 space-y-2">
          {factors.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-slate-700 dark:text-slate-300">
                {f.friendly_name || f.factor_type} ({f.status})
              </span>
              <button
                type="button"
                onClick={() => handleUnenroll(f.id)}
                disabled={isUnenrolling === f.id}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 text-xs"
                aria-label={`2FA-Faktor ${f.friendly_name} entfernen`}
              >
                {isUnenrolling === f.id ? 'Entfernen…' : 'Entfernen'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MfaSettings
