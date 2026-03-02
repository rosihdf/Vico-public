import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer'
import { Ionicons } from '@expo/vector-icons'
import Logo from '../components/Logo'
import { useAuth } from '../contexts/AuthContext'
import { useComponentSettings } from '../contexts/ComponentSettingsContext'

type DrawerItem = {
  name: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
}

const DRAWER_ITEMS: (DrawerItem & { key: string })[] = [
  { name: 'Main', label: 'Dashboard', icon: 'home-outline', key: 'dashboard' },
  { name: 'Kunden', label: 'Kunden', icon: 'people-outline', key: 'kunden' },
  { name: 'Suche', label: 'Suche', icon: 'search-outline', key: 'suche' },
  { name: 'Auftrag', label: 'Auftrag', icon: 'document-text-outline', key: 'auftrag' },
  { name: 'Benutzerverwaltung', label: 'Benutzerverwaltung', icon: 'person-add-outline', key: 'benutzerverwaltung' },
  { name: 'Einstellungen', label: 'Einstellungen', icon: 'settings-outline', key: 'einstellungen' },
]

const DrawerContent = ({
  state,
  navigation,
  logout,
}: DrawerContentComponentProps & { logout: () => void }) => {
  const { userRole } = useAuth()
  const { isEnabled } = useComponentSettings()
  const currentRoute = state.routeNames[state.index]

  const filteredItems = DRAWER_ITEMS.filter(
    (item) =>
      (item.name !== 'Benutzerverwaltung' || userRole === 'admin') && isEnabled(item.key)
  )

  const handlePress = (item: DrawerItem & { key: string }) => {
    if (item.name === 'Main' || ['Kunden', 'Suche', 'Auftrag'].includes(item.name)) {
      const screen = item.name === 'Main' ? 'Start' : item.name
      navigation.navigate('Main', { screen })
    } else {
      navigation.navigate(item.name as 'Einstellungen' | 'Benutzerverwaltung')
    }
  }

  const mainRouteState = state.routes.find((r) => r.name === 'Main')?.state as
    | { routes: { name: string }[]; index: number }
    | undefined
  const activeTabName = mainRouteState?.routes[mainRouteState.index]?.name

  const isActive = (item: DrawerItem) => {
    if (item.name === 'Main') return activeTabName === 'Start' || !activeTabName
    if (['Kunden', 'Suche', 'Auftrag'].includes(item.name)) {
      return activeTabName === item.name
    }
    return currentRoute === item.name
  }

  return (
    <DrawerContentScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Logo variant="full" />
        <Text style={styles.subtitle}>Türen & Tore</Text>
      </View>

      {filteredItems.map((item) => (
        <Pressable
          key={item.name}
          style={({ pressed }) => [
            styles.item,
            isActive(item) && styles.itemActive,
            pressed && styles.itemPressed,
          ]}
          onPress={() => handlePress(item)}
          accessible
          accessibilityLabel={item.label}
          accessibilityRole="button"
        >
          <Ionicons
            name={item.icon}
            size={22}
            color={isActive(item) ? '#059669' : '#64748b'}
          />
          <Text
            style={[
              styles.itemText,
              isActive(item) && styles.itemTextActive,
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        onPress={logout}
        accessible
        accessibilityLabel="Ausloggen"
        accessibilityRole="button"
      >
        <Ionicons name="log-out-outline" size={22} color="#dc2626" />
        <Text style={[styles.itemText, styles.logoutText]}>Ausloggen</Text>
      </Pressable>
    </DrawerContentScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingTop: 48,
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  itemActive: {
    backgroundColor: '#f0fdf4',
  },
  itemPressed: {
    backgroundColor: '#f1f5f9',
  },
  itemText: {
    fontSize: 16,
    color: '#475569',
  },
  itemTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  logoutText: {
    color: '#dc2626',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
    marginHorizontal: 8,
  },
})

export default DrawerContent
