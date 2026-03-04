import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import type { SyncStatus } from '../lib/types'

type SyncStatusIndicatorProps = {
  status: SyncStatus
  pendingCount?: number
  onPress?: () => void
}

const STATUS_COLORS: Record<SyncStatus, string> = {
  offline: '#ef4444',
  ready: '#22c55e',
  synced: '#2563eb',
}

const STATUS_LABELS: Record<SyncStatus, string> = {
  offline: 'Offline',
  ready: 'Bereit',
  synced: 'Sync',
}

const SyncStatusIndicator = ({
  status,
  pendingCount = 0,
  onPress,
}: SyncStatusIndicatorProps) => {
  const displayLabel =
    status === 'ready' && pendingCount > 0
      ? `${STATUS_LABELS[status]} (${pendingCount})`
      : STATUS_LABELS[status]

  const isOffline = status === 'offline'
  const content = (
    <>
      <View style={styles.dot} />
      <Text style={styles.label}>{displayLabel}</Text>
    </>
  )
  const containerStyle = [
    styles.container,
    { backgroundColor: STATUS_COLORS[status] },
    isOffline && styles.offlinePulse,
  ]
  const a11yLabel = isOffline
    ? `Sync-Status: ${displayLabel}. App arbeitet offline. Änderungen werden lokal gespeichert.`
    : `Sync-Status: ${displayLabel}${onPress ? '. Tippen zum Synchronisieren' : ''}`

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={containerStyle}
        accessible
        accessibilityLabel={a11yLabel}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View style={containerStyle} accessible accessibilityLabel={a11yLabel}>
      {content}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  offlinePulse: {
    opacity: 0.95,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
})

export default SyncStatusIndicator
