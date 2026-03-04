import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSync } from '../contexts/SyncContext'

const OfflineBanner = () => {
  const { syncStatus } = useSync()
  if (syncStatus !== 'offline') return null

  return (
    <View
      style={styles.banner}
      accessible
      accessibilityRole="alert"
      accessibilityLabel="Offline. Änderungen werden lokal gespeichert und beim nächsten Sync hochgeladen."
    >
      <Text style={styles.text}>
        Offline – Änderungen werden lokal gespeichert und beim nächsten Sync hochgeladen.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
})

export default OfflineBanner
