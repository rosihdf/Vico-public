import { useState } from 'react'

type MfaChallengeProps = {
  onSubmit: (code: string) => Promise<{ success: boolean; message?: string }>
  onCancel?: () => void
  isLoading?: boolean
}

const MfaChallenge = ({ onSubmit, onCancel, isLoading = false }: MfaChallengeProps) => {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().replace(/\s/g, '')
    if (!trimmed) {
      setError('Bitte den Code aus Ihrer Authenticator-App eingeben.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    const result = await onSubmit(trimmed)
    setIsSubmitting(false)
    if (!result.success) {
      setError(result.message ?? 'Code ungültig. Bitte erneut versuchen.')
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            Authenticator-Code
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={handleCodeChange}
            placeholder="000000"
            maxLength={8}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:border-transparent text-center text-lg tracking-widest"
            aria-describedby={error ? 'mfa-error' : undefined}
            aria-invalid={!!error}
            disabled={isSubmitting || isLoading}
          />
          {error && (
            <p id="mfa-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="flex-1 py-2.5 text-slate-800 dark:text-slate-100 font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || isLoading ? 'Wird geprüft…' : 'Bestätigen'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none focus:underline"
              aria-label="Abbrechen"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default MfaChallenge
