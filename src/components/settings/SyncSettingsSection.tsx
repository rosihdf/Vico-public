import type { SyncStatus } from '../../types'

const SYNC_LABELS: Record<SyncStatus, string> = {
  offline: '🔴 Offline',
  ready: '🟢 Bereit',
  synced: '🔵 Synchronisiert',
}

export type SyncSettingsSectionProps = {
  syncStatus: SyncStatus
  isOffline: boolean
  pendingCount: number
  lastSyncError: string | null
  isSyncing: boolean
  onSyncNow: () => void | Promise<void>
  onSetSyncStatus: (status: SyncStatus) => void
  onClearSyncError: () => void
}

export const SyncSettingsSection = ({
  syncStatus,
  isOffline,
  pendingCount,
  lastSyncError,
  isSyncing,
  onSyncNow,
  onSetSyncStatus,
  onClearSyncError,
}: SyncSettingsSectionProps) => (
  <section
    className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm"
    aria-labelledby="sync-heading"
  >
    <h3 id="sync-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
      Synchronisation
    </h3>
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-slate-600 dark:text-slate-400">
        {pendingCount > 0 ? `${pendingCount} Änderung(en) ausstehend` : 'Alles synchronisiert'}
      </span>
      <span className="px-2 py-0.5 rounded text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
        {SYNC_LABELS[syncStatus]}
      </span>
    </div>
    {lastSyncError && (
      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200 font-medium">Sync-Fehler</p>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
          {lastSyncError === 'TypeError: Load failed' ||
          lastSyncError.includes('Failed to fetch') ||
          lastSyncError.includes('Load failed')
            ? 'Netzwerkfehler. Bitte Verbindung prüfen. Bei Supabase Free-Tier: Projekt kann nach Inaktivität pausieren (Aufwecken dauert oft 1–2 Min.).'
            : lastSyncError}
        </p>
        {(lastSyncError.includes('duplicate') ||
          lastSyncError.includes('conflict') ||
          lastSyncError.includes('unique') ||
          lastSyncError.includes('violates')) && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            Möglicher Konflikt: Server-Daten wurden zwischenzeitlich geändert. Nach Pull werden lokale Änderungen
            überschrieben (Last-Write-Wins).
          </p>
        )}
        <button
          type="button"
          onClick={onClearSyncError}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Meldung schließen
        </button>
      </div>
    )}
    <button
      type="button"
      onClick={() => void onSyncNow()}
      disabled={isSyncing || isOffline}
      title={isOffline ? 'Offline – Sync erst bei Verbindung möglich' : undefined}
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
            onClick={() => onSetSyncStatus(value)}
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
)
