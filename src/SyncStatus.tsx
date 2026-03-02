import type { SyncStatus } from './types'

type SyncStatusProps = {
  status: SyncStatus
  pendingCount?: number
}

const STATUS_COLORS: Record<SyncStatus, string> = {
  offline: '#ef4444',
  ready: '#22c55e',
  synced: '#2563eb',
}

const STATUS_LABELS: Record<SyncStatus, string> = {
  offline: 'Offline',
  ready: 'Ready',
  synced: 'Sync',
}

const SyncStatusIndicator = ({ status, pendingCount = 0 }: SyncStatusProps) => {
  const displayLabel =
    status === 'ready' && pendingCount > 0
      ? `${STATUS_LABELS[status]} (${pendingCount})`
      : STATUS_LABELS[status]

  return (
    <div
      role="status"
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 min-w-[4.5rem] text-white text-sm font-medium shadow-md"
      style={{ backgroundColor: STATUS_COLORS[status] }}
      aria-label={`Sync-Status: ${displayLabel}`}
      tabIndex={0}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
        aria-hidden
      />
      <span className="truncate">{displayLabel}</span>
    </div>
  )
}

export default SyncStatusIndicator
