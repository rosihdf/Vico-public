import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../Logo'
import {
  setStoredLicenseNumber,
  fetchLicenseFromApi,
  formatLicenseNumberInput,
  normalizeLicenseNumber,
} from '../lib/licensePortalApi'
import { setLicenseNumberInDb } from '../lib/licenseService'

const AktivierungsScreen = () => {
  const [licenseNumber, setLicenseNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = normalizeLicenseNumber(licenseNumber)
    if (normalized.length < 11) {
      setError('Bitte vollständige Lizenznummer eingeben (Format: VIC-XXXX-XXXX).')
      return
    }
    const formatted = formatLicenseNumberInput(licenseNumber)
    setError(null)
    setIsSubmitting(true)
    try {
      const data = await fetchLicenseFromApi(formatted)
      if (!data) {
        setError('Lizenz nicht gefunden oder Verbindungsfehler. Prüfen Sie die Nummer (Format: VIC-XXXX-XXXX).')
        return
      }
      if (!data.license?.valid) {
        setError(data.license?.expired ? 'Lizenz ist abgelaufen.' : 'Lizenz ungültig.')
        return
      }
      setStoredLicenseNumber(formatted)
      const { error: dbError } = await setLicenseNumberInDb(formatted)
      if (dbError) {
        console.warn('[Aktivierung] Lizenz in DB speichern fehlgeschlagen:', dbError)
      }
      navigate('/', { replace: true })
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLicenseNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLicenseNumber(formatLicenseNumberInput(e.target.value))
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#5b7895] dark:bg-slate-900">
      <div className="w-full max-w-sm min-w-0 p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-lg">
        <Logo variant="login" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-6 mb-2">
          Lizenz aktivieren
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Nur nötig, wenn die Lizenz weder in der Datenbank noch per Host-Zuordnung ermittelt werden konnte
          (z. B. lokaler Test). Geben Sie die Lizenznummer ein – die Trennstriche werden automatisch gesetzt.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="license-number"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
            >
              Lizenznummer
            </label>
            <input
              id="license-number"
              type="text"
              value={licenseNumber}
              onChange={handleLicenseNumberChange}
              placeholder="z.B. VICABCD1234"
              autoComplete="off"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-vico-primary focus:border-transparent"
              aria-describedby={error ? 'license-error' : undefined}
              aria-invalid={!!error}
              disabled={isSubmitting}
            />
            {error && (
              <p id="license-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 text-white font-medium rounded-lg bg-vico-primary hover:bg-vico-primary-hover focus:outline-none focus:ring-2 focus:ring-vico-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Wird aktiviert…' : 'Aktivieren'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-600 space-y-2">
          <a
            href="/impressum"
            className="block text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Impressum
          </a>
          <a
            href="/datenschutz"
            className="block text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Datenschutz
          </a>
        </div>
      </div>
    </div>
  )
}

export default AktivierungsScreen
