import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Switch } from 'react-native'
import { useSync } from '../contexts/SyncContext'
import { useAuth } from '../contexts/AuthContext'
import { useComponentSettings } from '../contexts/ComponentSettingsContext'

const APP_VERSION = '1.0.0'

const SYNC_LABELS: Record<'offline' | 'ready' | 'synced', string> = {
  offline: '🔴 Offline',
  ready: '🟢 Ready',
  synced: '🔵 Sync',
}

const EinstellungenScreen = () => {
  const { syncStatus, syncNow, pendingCount } = useSync()
  const { userRole } = useAuth()
  const { settingsList, updateSetting, refresh } = useComponentSettings()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSyncNow = async () => {
    setIsSyncing(true)
    await syncNow()
    setIsSyncing(false)
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Einstellungen</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{APP_VERSION}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Rolle</Text>
          <Text style={styles.value}>{userRole === 'admin' ? 'Admin' : userRole === 'leser' ? 'Leser' : 'Mitarbeiter'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{SYNC_LABELS[syncStatus]}</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Ausstehend</Text>
            <Text style={styles.value}>{pendingCount}</Text>
          </View>
        )}
        <Pressable
          style={[styles.button, isSyncing && styles.buttonDisabled]}
          onPress={handleSyncNow}
          disabled={isSyncing || syncStatus === 'offline'}
          accessible
          accessibilityLabel="Jetzt synchronisieren"
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Jetzt synchronisieren</Text>
          )}
        </Pressable>
      </View>

      {userRole === 'admin' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Komponenten</Text>
          <Text style={styles.sectionDesc}>
            Bereiche der App aktivieren oder deaktivieren (Web + Mobile).
          </Text>
          {settingsList.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.label}>{item.label}</Text>
              <Switch
                value={item.enabled}
                onValueChange={(value) => updateSetting(item.component_key, value)}
                trackColor={{ false: '#cbd5e1', true: '#059669' }}
                thumbColor="#fff"
                accessibilityLabel={`${item.label} ${item.enabled ? 'deaktivieren' : 'aktivieren'}`}
              />
            </View>
          ))}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => refresh()}
            accessible
            accessibilityLabel="Einstellungen neu laden"
          >
            <Text style={styles.secondaryButtonText}>Neu laden</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5b7895',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  label: {
    fontSize: 14,
    color: '#64748b',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionDesc: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  secondaryButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
})

export default EinstellungenScreen
