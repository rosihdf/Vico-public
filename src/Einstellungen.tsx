import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSync } from './SyncContext'
import { useAuth } from './AuthContext'
import { useLicense } from './LicenseContext'
import { useTheme } from './ThemeContext'
import { useComponentSettings } from './ComponentSettingsContext'
import type { Theme } from './ThemeContext'
import { fetchProfileByEmail } from './lib/userService'
import { downloadWebAppChecklist } from './lib/downloadChecklist'
import { formatLicenseDate, isLimitReached } from './lib/licenseService'
import {
  isLicenseApiConfigured,
  getStoredLicenseNumber,
  setStoredLicenseNumber,
} from './lib/licensePortalApi'
import type { SyncStatus } from './types'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'

const SYNC_LABELS: Record<SyncStatus, string> = {
  offline: '🔴 Offline',
  ready: '🟢 Bereit',
  synced: '🔵 Synchronisiert',
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Hell',
  dark: 'Dunkel',
  system: 'System',
}

const Einstellungen = () => {
  const { syncStatus, setSyncStatus, syncNow, pendingCount, lastSyncError, clearSyncError } = useSync()
  const { userRole, refreshUserRole } = useAuth()
  const { license, refresh: refreshLicense } = useLicense()
  const { theme, setTheme } = useTheme()
  const { settingsList, updateSetting, refresh } = useComponentSettings()
  const [isSyncing, setIsSyncing] = useState(false)
  const [componentError, setComponentError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'current'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes: string[] } | null>(null)
  const [checkEmail, setCheckEmail] = useState('')
  const [checkResult, setCheckResult] = useState<{ email: string; role: string } | null>(null)
  const [isChecking, setIsChecking] = useState(false)
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

  const handleCheckUser = async () => {
    if (!checkEmail.trim()) return
    setCheckResult(null)
    setIsChecking(true)
    const profile = await fetchProfileByEmail(checkEmail.trim())
    setIsChecking(false)
    setCheckResult(
      profile
        ? { email: profile.email ?? '(keine E-Mail)', role: profile.role }
        : { email: checkEmail.trim(), role: '(nicht gefunden)' }
    )
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    await syncNow()
    setIsSyncing(false)
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
      await refreshLicense()
      setLicenseNumberMessage({ type: 'success', text: 'Lizenznummer gespeichert. Lizenz neu geladen.' })
    } catch {
      setLicenseNumberMessage({ type: 'error', text: 'Lizenz konnte nicht geladen werden.' })
    } finally {
      setIsSavingLicense(false)
    }
  }

  return (
    <div className="p-4 max-w-xl">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Einstellungen</h2>

      {/* Darstellung */}
      <section
        className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
        aria-labelledby="darstellung-heading"
      >
        <h3 id="darstellung-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Darstellung
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Farbschema der App anpassen.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['light', 'dark', 'system'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === t
                  ? 'bg-vico-primary text-white'
                  : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              aria-pressed={theme === t}
              aria-label={`${THEME_LABELS[t]} auswählen`}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      {/* Benutzeranleitung */}
      <section
        className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
        aria-labelledby="anleitung-heading"
      >
        <h3 id="anleitung-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Benutzeranleitung
        </h3>
        <button
          type="button"
          onClick={() => window.open('/BENUTZERANLEITUNG.md', '_blank', 'noopener,noreferrer')}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="Benutzeranleitung öffnen"
        >
          Benutzeranleitung öffnen
        </button>
      </section>

      {/* Dokumentation */}
      <section
        className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
        aria-labelledby="dokumentation-heading"
      >
        <h3 id="dokumentation-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Dokumentation
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Projekt-Dokumentation mit Architektur, Features, Roadmap und technischen Details.
        </p>
        <a
          href="/Vico-Dokumentation.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="Vico-Dokumentation als PDF öffnen"
        >
          Vico-Dokumentation (PDF)
        </a>
      </section>

      {/* Checklisten */}
      <section
        className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
        aria-labelledby="checklisten-heading"
      >
        <h3 id="checklisten-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Checklisten
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Web-App-Test-Checkliste als PDF erstellen und herunterladen.
        </p>
        <button
          type="button"
          onClick={downloadWebAppChecklist}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="Web-App-Test-Checkliste herunterladen"
        >
          Web-App-Test-Checkliste
        </button>
      </section>

      {/* App */}
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
            Rolle: <strong>{userRole === 'admin' ? 'Admin' : userRole === 'leser' ? 'Leser' : userRole === 'operator' ? 'Operator' : userRole === 'demo' ? 'Demo' : 'Mitarbeiter'}</strong>
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
            <div className="mt-3 w-full p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                Eine neue Version steht zur Verfügung (Version {updateInfo?.version ?? 'neu'})
              </p>
              {updateInfo?.releaseNotes && updateInfo.releaseNotes.length > 0 && (
                <ul className="text-sm text-amber-800 list-disc list-inside space-y-1 mb-3">
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
            <div className="mt-3 w-full p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Version {updateInfo.version} – ✓ Aktuell
              </p>
              {updateInfo.releaseNotes.length > 0 ? (
                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                  {updateInfo.releaseNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Keine Release Notes vorhanden.</p>
              )}
            </div>
          )}
          {updateStatus === 'current' && !updateInfo && (
            <span className="text-sm text-green-600">✓ Aktuell</span>
          )}
        </div>
      </section>

      {/* Sync */}
      <section
        className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
        aria-labelledby="sync-heading"
      >
        <h3 id="sync-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Synchronisation
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-600 dark:text-slate-400">
            {pendingCount > 0
              ? `${pendingCount} Änderung(en) ausstehend`
              : 'Alles synchronisiert'}
          </span>
          <span className="px-2 py-0.5 rounded text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {SYNC_LABELS[syncStatus]}
          </span>
        </div>
        {lastSyncError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">Sync-Fehler</p>
            <p className="text-sm text-red-700 mt-1">{lastSyncError}</p>
            <p className="text-xs text-red-600 mt-2">Möglicher Konflikt: Server-Daten wurden zwischenzeitlich geändert. Nach Pull werden lokale Änderungen überschrieben (Last-Write-Wins).</p>
            <button
              type="button"
              onClick={clearSyncError}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Meldung schließen
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={isSyncing || !navigator.onLine}
          className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSyncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
        </button>
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">Sync-Status testen (UI)</p>
          <div className="flex flex-wrap gap-2">
            {(['offline', 'ready', 'synced'] as SyncStatus[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSyncStatus(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  syncStatus === value
                    ? 'bg-vico-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                aria-pressed={syncStatus === value}
              >
                {SYNC_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Komponenten aktivieren/deaktivieren (Admin) */}
      {userRole === 'admin' && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="komponenten-heading"
        >
          <h3 id="komponenten-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Komponenten
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Aktivieren oder deaktivieren Sie einzelne Bereiche der App.
          </p>
          {componentError && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg" role="alert">
              {componentError}
            </p>
          )}
          <div className="space-y-2">
            {settingsList.map((item) => (
              <label
                key={item.id}
                className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-600 last:border-0 cursor-pointer"
              >
                <span className="text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={updatingKey === item.component_key}
                  onChange={async (e) => {
                    setComponentError(null)
                    const checked = e.target.checked
                    setUpdatingKey(item.component_key)
                    const result = await updateSetting(item.component_key, checked)
                    setUpdatingKey(null)
                    if (!result.ok) {
                      setComponentError(result.error ?? 'Speichern fehlgeschlagen')
                    }
                  }}
                  className="w-5 h-5 rounded border-slate-300 text-vico-primary focus:ring-vico-primary disabled:opacity-50"
                  aria-label={`${item.label} ${item.enabled ? 'deaktivieren' : 'aktivieren'}`}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setComponentError(null)
              refresh()
            }}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            aria-label="Einstellungen neu laden"
          >
            Neu laden
          </button>
        </section>
      )}

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
                Lizenz-API nicht konfiguriert. Setze in .env: <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">VITE_LICENSE_API_URL</code> (z.B. https://…supabase.co/functions/v1)
              </p>
            )}
            <label htmlFor="license-number" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Lizenznummer
            </label>
            <div className="flex gap-2">
              <input
                id="license-number"
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
                <div className="text-slate-800 dark:text-slate-100 font-medium capitalize">{license.tier}</div>

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
                onClick={refreshLicense}
                className="mt-3 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                aria-label="Lizenz-Status neu laden"
              >
                Neu laden
              </button>
            </>
          )}
        </section>
      )}

      {/* Benutzerverwaltung (Admin) */}
      {userRole === 'admin' && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="benutzer-heading"
        >
          <h3 id="benutzer-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Benutzerverwaltung
          </h3>
          <Link
            to="/benutzerverwaltung"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover border border-slate-700 transition-colors"
          >
            Benutzer verwalten →
          </Link>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-600">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Benutzer-Rolle prüfen</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={checkEmail}
                onChange={(e) => setCheckEmail(e.target.value)}
                placeholder="E-Mail eingeben"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 text-sm"
                aria-label="E-Mail zum Prüfen"
              />
              <button
                type="button"
                onClick={handleCheckUser}
                disabled={isChecking}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {isChecking ? '…' : 'Prüfen'}
              </button>
            </div>
            {checkResult && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                <strong>{checkResult.email}</strong> → {checkResult.role}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default Einstellungen
