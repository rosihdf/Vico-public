import { useState, useEffect, useCallback } from 'react'
import { useSync } from './SyncContext'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'
import { useLicense } from './LicenseContext'
import { useComponentSettings } from './ComponentSettingsContext'
import type { Theme } from './ThemeContext'
import { downloadWebAppChecklist } from './lib/downloadChecklist'
import { getCachedLicenseResponse, getStoredLicenseNumber } from './lib/licensePortalApi'
import { fetchMyProfile, revokeGpsConsent } from './lib/userService'
import { hasFeature } from './lib/licenseService'
import type { SyncStatus } from './types'
import type { Profile } from './lib/userService'

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
  const { userRole, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { design, license } = useLicense()
  const { settingsList, updateSetting, refresh } = useComponentSettings()
  const licenseNumber = getStoredLicenseNumber()
  const cachedLicense = licenseNumber ? getCachedLicenseResponse(licenseNumber) : null
  const impressum = cachedLicense?.impressum
  const [isSyncing, setIsSyncing] = useState(false)
  const [componentError, setComponentError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [gpsRevoking, setGpsRevoking] = useState(false)

  const loadProfile = useCallback(async () => {
    if (user?.id) {
      const p = await fetchMyProfile(user.id)
      setMyProfile(p ?? null)
    } else {
      setMyProfile(null)
    }
  }, [user?.id])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const hasGpsConsent =
    myProfile?.gps_consent_at != null && myProfile?.gps_consent_revoked_at == null
  const showGpsRevoke =
    license && hasFeature(license, 'arbeitszeiterfassung') && user?.id && hasGpsConsent

  const handleRevokeGps = async () => {
    if (!user?.id || gpsRevoking) return
    setGpsRevoking(true)
    await revokeGpsConsent(user.id)
    setGpsRevoking(false)
    await loadProfile()
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    await syncNow()
    setIsSyncing(false)
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

      {/* Zeiterfassung – Ortung widerrufen */}
      {showGpsRevoke && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="ortung-heading"
        >
          <h3 id="ortung-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Zeiterfassung – Ortung
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Sie haben die Standorterfassung bei Arbeitsbeginn/-ende aktiviert. Sie können die Einwilligung jederzeit
            widerrufen; danach wird kein Standort mehr erfasst.
          </p>
          <button
            type="button"
            onClick={handleRevokeGps}
            disabled={gpsRevoking}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50"
            aria-label="Ortung deaktivieren"
          >
            {gpsRevoking ? 'Wird deaktiviert…' : 'Ortung deaktivieren (Einwilligung widerrufen)'}
          </button>
        </section>
      )}

      {/* Stammdaten / Impressum (Admin, Self-Service später) */}
      {userRole === 'admin' && (design || impressum) && (
        <section
          className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
          aria-labelledby="stammdaten-heading"
        >
          <h3 id="stammdaten-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Stammdaten / Impressum
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Anzeige aus dem Lizenzportal. Bearbeiten: derzeit nur im Lizenzportal durch den Betreiber; Self-Service (Bearbeiten hier) ist geplant.
          </p>
          <dl className="space-y-1 text-sm">
            {design?.app_name && (
              <>
                <dt className="text-slate-500 dark:text-slate-400">App-Name</dt>
                <dd className="text-slate-800 dark:text-slate-100 font-medium">{design.app_name}</dd>
              </>
            )}
            {impressum?.company_name && (
              <>
                <dt className="text-slate-500 dark:text-slate-400 mt-2">Firma</dt>
                <dd className="text-slate-800 dark:text-slate-100">{impressum.company_name}</dd>
              </>
            )}
            {impressum?.address && (
              <>
                <dt className="text-slate-500 dark:text-slate-400 mt-2">Adresse</dt>
                <dd className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{impressum.address}</dd>
              </>
            )}
            {impressum?.contact && (
              <>
                <dt className="text-slate-500 dark:text-slate-400 mt-2">Kontakt</dt>
                <dd className="text-slate-800 dark:text-slate-100">{impressum.contact}</dd>
              </>
            )}
          </dl>
        </section>
      )}

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
    </div>
  )
}

export default Einstellungen
