import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { getSupabaseErrorMessage } from '../supabaseErrors'

type MfaEnrollProps = {
  onEnrolled: () => void
  onCancelled: () => void
  /** Anzeigename in der Authenticator-App (z. B. Firmen-App-Name) */
  friendlyName?: string
}

type EnrollData = {
  factorId: string
  qrCode: string
  secret: string
} | null

const MfaEnroll = ({ onEnrolled, onCancelled, friendlyName = 'Vico' }: MfaEnrollProps) => {
  const [enrollData, setEnrollData] = useState<EnrollData>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)

  const startEnroll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `${friendlyName} (2FA)`,
    })
    setIsLoading(false)
    if (enrollError) {
      setError(getSupabaseErrorMessage(enrollError))
      return
    }
    if (data?.totp) {
      setEnrollData({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      })
    }
  }, [friendlyName])

  useEffect(() => {
    startEnroll()
  }, [startEnroll])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollData || !verifyCode.trim()) return
    setError(null)
    setIsVerifying(true)

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollData.factorId,
    })
    if (challengeError || !challengeData?.id) {
      setError(getSupabaseErrorMessage(challengeError ?? new Error('Challenge fehlgeschlagen')))
      setIsVerifying(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: challengeData.id,
      code: verifyCode.trim().replace(/\s/g, ''),
    })
    setIsVerifying(false)
    if (verifyError) {
      setError(getSupabaseErrorMessage(verifyError))
      return
    }
    onEnrolled()
  }

  const qrSrc = enrollData?.qrCode?.startsWith('data:')
    ? enrollData.qrCode
    : enrollData?.qrCode
      ? `data:image/svg+xml;base64,${btoa(enrollData.qrCode)}`
      : ''

  if (isLoading) {
    return (
      <div className="p-4 text-center text-slate-600 dark:text-slate-400">
        2FA wird vorbereitet…
      </div>
    )
  }

  if (!enrollData) {
    return (
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={startEnroll}
          className="text-sm text-vico-primary hover:underline"
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Scannen Sie den QR-Code mit Ihrer Authenticator-App (z.B. Google Authenticator, Microsoft Authenticator).
      </p>
      {qrSrc && (
        <div className="flex justify-center p-4 bg-white dark:bg-slate-800 rounded-lg">
          <img
            src={qrSrc}
            alt="QR-Code für Authenticator-App"
            className="w-48 h-48"
          />
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-500">
        Oder geben Sie diesen Schlüssel manuell ein: <code className="break-all bg-slate-100 dark:bg-slate-700 px-1 rounded">{enrollData.secret}</code>
      </p>
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="mfa-enroll-code" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            Code aus der App eingeben
          </label>
          <input
            id="mfa-enroll-code"
            type="text"
            inputMode="numeric"
            value={verifyCode}
            onChange={(e) => {
              setVerifyCode(e.target.value)
              setError(null)
            }}
            placeholder="000000"
            maxLength={8}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary text-center tracking-widest"
            disabled={isVerifying}
          />
          {error && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isVerifying}
            className="px-4 py-2 rounded-lg font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50"
          >
            {isVerifying ? 'Wird geprüft…' : 'Aktivieren'}
          </button>
          <button
            type="button"
            onClick={onCancelled}
            className="px-4 py-2 rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}

export default MfaEnroll
