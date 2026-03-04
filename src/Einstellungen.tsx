import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSync } from './SyncContext'
import { useAuth } from './AuthContext'
import { useComponentSettings } from './ComponentSettingsContext'
import { fetchProfileByEmail } from './lib/userService'
import type { SyncStatus } from './types'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'

const SYNC_LABELS: Record<SyncStatus, string> = {
  offline: '🔴 Offline',
  ready: '🟢 Bereit',
  synced: '🔵 Synchronisiert',
}

const Einstellungen = () => {
  const { syncStatus, setSyncStatus, syncNow, pendingCount, lastSyncError, clearSyncError } = useSync()
  const { userRole, refreshUserRole } = useAuth()
  const { settingsList, updateSetting, refresh } = useComponentSettings()
  const [isSyncing, setIsSyncing] = useState(false)
  const [componentError, setComponentError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'current'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes: string[] } | null>(null)
  const [checkEmail, setCheckEmail] = useState('')
  const [checkResult, setCheckResult] = useState<{ email: string; role: string } | null>(null)
  const [isChecking, setIsChecking] = useState(false)

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

  return (
    <div className="p-4 max-w-xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Einstellungen</h2>

      {/* App */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="app-heading"
      >
        <h3 id="app-heading" className="text-sm font-semibold text-slate-700 mb-3">
          App
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-600">Version {APP_VERSION}</span>
          <span className="text-slate-600">
            Rolle: <strong>{userRole === 'admin' ? 'Admin' : userRole === 'leser' ? 'Leser' : 'Mitarbeiter'}</strong>
          </span>
          <button
            type="button"
            onClick={() => refreshUserRole()}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            aria-label="Rolle vom Server neu laden"
          >
            Rolle neu laden
          </button>
          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={updateStatus === 'checking'}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
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
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="sync-heading"
      >
        <h3 id="sync-heading" className="text-sm font-semibold text-slate-700 mb-3">
          Synchronisation
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-600">
            {pendingCount > 0
              ? `${pendingCount} Änderung(en) ausstehend`
              : 'Alles synchronisiert'}
          </span>
          <span className="px-2 py-0.5 rounded text-sm bg-slate-100 text-slate-600">
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

      {/* Datenbank einrichten */}
      <section
        className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        aria-labelledby="datenbank-heading"
      >
        <h3 id="datenbank-heading" className="text-sm font-semibold text-slate-700 mb-3">
          Datenbank einrichten
        </h3>
        <p className="text-sm text-slate-600 mb-2">
          Fehlt eine Tabelle? Führen Sie <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">supabase-complete.sql</code> im Supabase-Dashboard (SQL Editor) aus.
        </p>
        <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1 mb-4">
          <li>Supabase-Dashboard öffnen</li>
          <li>SQL Editor auswählen</li>
          <li>Inhalt von <code className="px-1 py-0.5 rounded bg-slate-100">supabase-complete.sql</code> einfügen</li>
          <li>Run ausführen</li>
        </ol>
        <p className="text-xs text-slate-500">
          Die Datei liegt im Projektordner: <code className="px-1 py-0.5 rounded bg-slate-100">supabase-complete.sql</code>
        </p>
      </section>

      {/* Komponenten aktivieren/deaktivieren (Admin) */}
      {userRole === 'admin' && (
        <section
          className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
          aria-labelledby="komponenten-heading"
        >
          <h3 id="komponenten-heading" className="text-sm font-semibold text-slate-700 mb-3">
            Komponenten
          </h3>
          <p className="text-sm text-slate-600 mb-3">
            Aktivieren oder deaktivieren Sie einzelne Bereiche der App (Web + Mobile).
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
                className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0 cursor-pointer"
              >
                <span className="text-sm text-slate-700">{item.label}</span>
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
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
            aria-label="Einstellungen neu laden"
          >
            Neu laden
          </button>
        </section>
      )}

      {/* Benutzerverwaltung (Admin) */}
      {userRole === 'admin' && (
        <section
          className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
          aria-labelledby="benutzer-heading"
        >
          <h3 id="benutzer-heading" className="text-sm font-semibold text-slate-700 mb-3">
            Benutzerverwaltung
          </h3>
          <Link
            to="/benutzerverwaltung"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-vico-primary text-white hover:bg-vico-primary-hover border border-slate-700 transition-colors"
          >
            Benutzer verwalten →
          </Link>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Benutzer-Rolle prüfen</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={checkEmail}
                onChange={(e) => setCheckEmail(e.target.value)}
                placeholder="E-Mail eingeben"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                aria-label="E-Mail zum Prüfen"
              />
              <button
                type="button"
                onClick={handleCheckUser}
                disabled={isChecking}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {isChecking ? '…' : 'Prüfen'}
              </button>
            </div>
            {checkResult && (
              <p className="mt-2 text-sm text-slate-600">
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
