import { useState } from 'react'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { formatLicenseDate, isLimitReached } from './lib/licenseService'
import {
  isLicenseApiConfigured,
  getStoredLicenseNumber,
  setStoredLicenseNumber,
} from './lib/licensePortalApi'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'

const Info = () => {
  const { userRole, refreshUserRole } = useAuth()
  const { license, storageUsageMb, refresh: refreshLicense } = useLicense()
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'current'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes: string[] } | null>(null)
  const [licenseNumberInput, setLicenseNumberInput] = useState(getStoredLicenseNumber() ?? '')
  const [isSavingLicense, setIsSavingLicense] = useState(false)
  const [licenseNumberMessage, setLicenseNumberMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking')
    setUpdateInfo(null)
    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const res = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        setUpdateStatus('idle')
        return
      }
      const data = (await res.json()) as { version?: string; releaseNotes?: string[] }
      const latest = data.version ?? ''
      const notes = Array.isArray(data.releaseNotes) ? data.releaseNotes : []
      setUpdateInfo({ version: latest, releaseNotes: notes })
      setUpdateStatus(latest && latest !== APP_VERSION ? 'available' : 'current')
      if (latest === APP_VERSION) setTimeout(() => setUpdateStatus('idle'), 3000)
    } catch {
      setUpdateStatus('idle')
    }
  }

  const handleSaveLicenseNumber = async () => {
    const trimmed = licenseNumberInput.trim()
    if (!trimmed) {
      setLicenseNumberMessage({ type: 'error', text: 'Bitte Lizenznummer eingeben.' })
      return
    }
    setIsSavingLicense(true)
    setLicenseNumberMessage(null)
    try {
      setStoredLicenseNumber(trimmed)
      await refreshLicense({ force: true })
      setLicenseNumberMessage({ type: 'success', text: 'Lizenznummer gespeichert. Lizenz neu geladen.' })
    } catch {
      setLicenseNumberMessage({ type: 'error', text: 'Lizenz konnte nicht geladen werden.' })
    } finally {
      setIsSavingLicense(false)
    }
  }

  const roleLabel =
    userRole === 'admin'
      ? 'Admin'
      : userRole === 'leser'
        ? 'Leser'
        : userRole === 'operator'
          ? 'Operator'
          : userRole === 'demo'
            ? 'Demo'
            : 'Mitarbeiter'

  return (
    <div className="p-4 max-w-xl">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Info</h2>

      {/* App-Version & Update */}
      <section
        className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
        aria-labelledby="app-heading"
      >
        <h3 id="app-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          App
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-600 dark:text-slate-400">Version {APP_VERSION}</span>
          <span className="text-slate-600 dark:text-slate-400">
            Rolle: <strong>{roleLabel}</strong>
          </span>
          <button
            type="button"
            onClick={() => refreshUserRole()}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            aria-label="Rolle vom Server neu laden"
          >
            Rolle neu laden
          </button>
          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={updateStatus === 'checking'}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            aria-label="Auf Updates prüfen"
          >
            {updateStatus === 'checking' ? 'Prüfe…' : 'Auf Updates prüfen'}
          </button>
          {updateStatus === 'available' && (
            <div className="mt-3 w-full p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                Eine neue Version steht zur Verfügung (Version {updateInfo?.version ?? 'neu'})
              </p>
              {updateInfo?.releaseNotes && updateInfo.releaseNotes.length > 0 && (
                <ul className="text-sm text-amber-800 dark:text-amber-300 list-disc list-inside space-y-1 mb-3">
                  {updateInfo.releaseNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover border border-slate-700"
              >
                Jetzt aktualisieren
              </button>
            </div>
          )}
          {updateStatus === 'current' && updateInfo && (
            <div className="mt-3 w-full p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Version {updateInfo.version} – ✓ Aktuell
              </p>
              {updateInfo.releaseNotes.length > 0 ? (
                <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                  {updateInfo.releaseNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Keine Release Notes vorhanden.</p>
              )}
            </div>
          )}
          {updateStatus === 'current' && !updateInfo && (
            <span className="text-sm text-green-600 dark:text-green-400">✓ Aktuell</span>
          )}
        </div>
      </section>

      {/* Lizenz (Admin) */}
      {userRole === 'admin' && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="lizenz-heading"
        >
          <h3 id="lizenz-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Lizenz
          </h3>
          <div className="mb-4">
            {!isLicenseApiConfigured() && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                Lizenz-API nicht konfiguriert. Setze in .env: <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">VITE_LICENSE_API_URL</code>
              </p>
            )}
            <label htmlFor="info-license-number" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Lizenznummer
            </label>
            <div className="flex gap-2">
              <input
                id="info-license-number"
                type="text"
                value={licenseNumberInput}
                onChange={(e) => {
                  setLicenseNumberInput(e.target.value)
                  setLicenseNumberMessage(null)
                }}
                placeholder="VIC-XXXX-XXXX"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 font-mono text-sm focus:ring-2 focus:ring-vico-primary focus:border-vico-primary"
                aria-label="Lizenznummer"
              />
              <button
                type="button"
                onClick={handleSaveLicenseNumber}
                disabled={isSavingLicense || !isLicenseApiConfigured()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover disabled:opacity-50 transition-colors"
                aria-label="Lizenznummer speichern und Lizenz laden"
              >
                {isSavingLicense ? 'Lade…' : 'Speichern'}
              </button>
            </div>
            {licenseNumberMessage && (
              <p
                className={`mt-2 text-sm ${licenseNumberMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                role="status"
              >
                {licenseNumberMessage.text}
              </p>
            )}
          </div>
          {license && (
            <>
              {license.expired && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg" role="alert">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Lizenz abgelaufen seit {formatLicenseDate(license.valid_until)}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    Einige Funktionen sind eingeschränkt. Bitte Lizenz verlängern.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-slate-500 dark:text-slate-400">Tier</div>
                <div className="text-slate-800 dark:text-slate-100 font-medium flex items-center gap-2">
                  <span className="capitalize">{license.tier}</span>
                  {license.is_trial && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      Trial
                    </span>
                  )}
                </div>
                <div className="text-slate-500 dark:text-slate-400">Gültig bis</div>
                <div className="text-slate-800 dark:text-slate-100 font-medium">{formatLicenseDate(license.valid_until)}</div>
                <div className="text-slate-500 dark:text-slate-400">Kunden</div>
                <div className={`font-medium ${isLimitReached(license.current_customers, license.max_customers) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'}`}>
                  {license.current_customers} / {license.max_customers ?? '∞'}
                </div>
                <div className="text-slate-500 dark:text-slate-400">Benutzer</div>
                <div className={`font-medium ${isLimitReached(license.current_users, license.max_users) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'}`}>
                  {license.current_users} / {license.max_users ?? '∞'}
                </div>
                {license.max_storage_mb != null && (
                  <>
                    <div className="text-slate-500 dark:text-slate-400">Speicher</div>
                    <div className={`font-medium ${storageUsageMb >= license.max_storage_mb * 0.8 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'}`}>
                      {storageUsageMb.toFixed(1)} MB / {license.max_storage_mb} MB
                    </div>
                  </>
                )}
                <div className="text-slate-500 dark:text-slate-400">Kundenportal</div>
                <div className="text-slate-800 dark:text-slate-100 font-medium">
                  {license.features?.kundenportal ? '✓ Aktiv' : '✗ Nicht enthalten'}
                </div>
                <div className="text-slate-500 dark:text-slate-400">Historie</div>
                <div className="text-slate-800 dark:text-slate-100 font-medium">
                  {license.features?.historie ? '✓ Aktiv' : '✗ Nicht enthalten'}
                </div>
                <div className="text-slate-500 dark:text-slate-400">Arbeitszeiterfassung</div>
                <div className="text-slate-800 dark:text-slate-100 font-medium">
                  {license.features?.arbeitszeiterfassung ? '✓ Aktiv' : '✗ Nicht enthalten'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => refreshLicense({ force: true })}
                className="mt-3 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                aria-label="Lizenz-Status neu laden"
              >
                Neu laden
              </button>
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default Info
