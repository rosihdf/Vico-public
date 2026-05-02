import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { getSupabaseErrorMessage } from '../supabaseErrors'
import { isOnline } from '../../shared/networkUtils'
import MfaEnroll from './MfaEnroll'
import ConfirmDialog from './ConfirmDialog'

type MfaFactor = {
  id: string
  friendly_name?: string
  factor_type: string
  status: string
}

export type MfaSettingsProps = {
  /** Name für den Eintrag in der Authenticator-App */
  enrollFriendlyName?: string
}

const MfaSettings = ({ enrollFriendlyName = 'ArioVan' }: MfaSettingsProps) => {
  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showEnroll, setShowEnroll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUnenrolling, setIsUnenrolling] = useState<string | null>(null)
  const [unenrollFactorId, setUnenrollFactorId] = useState<string | null>(null)

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
    void loadFactors()
  }, [loadFactors])

  const handleConfirmUnenroll = async () => {
    const factorId = unenrollFactorId
    if (!factorId) return
    setUnenrollFactorId(null)
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
    void loadFactors()
  }

  const online = isOnline()

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
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Zwei-Faktor-Authentifizierung (2FA)</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Optional – standardmäßig <strong className="font-medium text-slate-600 dark:text-slate-300">aus</strong>. Mit TOTP-App
            (z. B. Google/Microsoft Authenticator) schützen Sie Ihr Konto zusätzlich zum Passwort.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Status: {factors.length > 0 ? 'aktiviert' : 'nicht aktiviert'}
          </p>
        </div>
        {factors.length === 0 && !showEnroll && (
          <button
            type="button"
            onClick={() => {
              if (!online) {
                setError('2FA einrichten ist nur mit Internetverbindung möglich.')
                return
              }
              setError(null)
              setShowEnroll(true)
            }}
            disabled={!online}
            className="text-sm text-vico-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            aria-label="2FA aktivieren"
          >
            2FA aktivieren
          </button>
        )}
      </div>

      {!online ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-2 py-1.5">
          Ohne Internetverbindung können Sie 2FA nicht einrichten oder entfernen.
        </p>
      ) : null}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {showEnroll && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
          <MfaEnroll
            friendlyName={enrollFriendlyName}
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
                onClick={() => {
                  if (!online) {
                    setError('2FA entfernen ist nur mit Internetverbindung möglich.')
                    return
                  }
                  setError(null)
                  setUnenrollFactorId(f.id)
                }}
                disabled={isUnenrolling === f.id || !online}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 text-xs"
                aria-label={`2FA-Faktor ${f.friendly_name ?? f.factor_type} entfernen`}
              >
                {isUnenrolling === f.id ? 'Entfernen…' : 'Entfernen'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={unenrollFactorId !== null}
        title="2FA deaktivieren"
        message="Authenticator für dieses Konto wirklich entfernen? Sie können 2FA jederzeit wieder aktivieren."
        confirmLabel="Entfernen"
        variant="danger"
        onConfirm={() => void handleConfirmUnenroll()}
        onCancel={() => setUnenrollFactorId(null)}
      />
    </div>
  )
}

export default MfaSettings
