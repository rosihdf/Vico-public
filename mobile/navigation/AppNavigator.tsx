import React from 'react'
import { View, StyleSheet, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createDrawerNavigator } from '@react-navigation/drawer'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'

import Logo from '../components/Logo'
import SyncStatusIndicator from '../components/SyncStatusIndicator'
import { useSync } from '../contexts/SyncContext'

import StartseiteScreen from '../screens/StartseiteScreen'
import KundenScreen from '../screens/KundenScreen'
import BVsScreen from '../screens/BVsScreen'
import ObjekteScreen from '../screens/ObjekteScreen'
import WartungsprotokolleScreen from '../screens/WartungsprotokolleScreen'
import SucheScreen from '../screens/SucheScreen'
import AuftragAnlegenScreen from '../screens/AuftragAnlegenScreen'
import ScanScreen from '../screens/ScanScreen'
import ProfilScreen from '../screens/ProfilScreen'
import EinstellungenScreen from '../screens/EinstellungenScreen'
import BenutzerverwaltungScreen from '../screens/BenutzerverwaltungScreen'

import DrawerContent from './DrawerContent'
import { useAuth } from '../contexts/AuthContext'
import { useComponentSettings } from '../contexts/ComponentSettingsContext'

export type StartStackParamList = {
  Startseite: undefined
  Kunden: undefined
}

export type KundenStackParamList = {
  KundenListe: undefined
  BVs: { customerId: string }
  Objekte: { customerId: string; bvId: string }
  Wartung: { customerId: string; bvId: string; objectId: string }
}

export type RootTabParamList = {
  Start: undefined
  Kunden: undefined
  Auftrag: { orderId?: string } | undefined
  Suche: undefined
  Scan: undefined
  Profil: undefined
}

export type RootDrawerParamList = {
  Main: { screen?: string } | undefined
  Einstellungen: undefined
  Benutzerverwaltung: undefined
}

const StartStack = createNativeStackNavigator<StartStackParamList>()
const KundenStack = createNativeStackNavigator<KundenStackParamList>()
const Tab = createBottomTabNavigator<RootTabParamList>()
const Drawer = createDrawerNavigator<RootDrawerParamList>()

const StartStackNavigator = () => (
  <StartStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <StartStack.Screen name="Startseite" component={StartseiteScreen} />
    <StartStack.Screen name="Kunden" component={KundenScreen} />
  </StartStack.Navigator>
)

const KundenStackNavigator = () => (
  <KundenStack.Navigator screenOptions={{ headerShown: false }}>
    <KundenStack.Screen name="KundenListe" component={KundenScreen} />
    <KundenStack.Screen name="BVs" component={BVsScreen} />
    <KundenStack.Screen name="Objekte" component={ObjekteScreen} />
    <KundenStack.Screen name="Wartung" component={WartungsprotokolleScreen} />
  </KundenStack.Navigator>
)

const TAB_SCREENS = [
  { name: 'Start' as const, key: 'dashboard', component: StartStackNavigator, icon: 'home-outline' },
  { name: 'Kunden' as const, key: 'kunden', component: KundenStackNavigator, icon: 'people-outline' },
  { name: 'Auftrag' as const, key: 'auftrag', component: AuftragAnlegenScreen, icon: 'document-text-outline' },
  { name: 'Suche' as const, key: 'suche', component: SucheScreen, icon: 'search-outline' },
  { name: 'Scan' as const, key: 'scan', component: ScanScreen, icon: 'qr-code-outline' },
  { name: 'Profil' as const, key: 'profil', component: null, icon: 'person-outline' },
]

const TabNavigator = () => {
  const { logout } = useAuth()
  const { isEnabled } = useComponentSettings()
  const insets = useSafeAreaInsets()

  const enabledTabs = TAB_SCREENS.filter((t) => isEnabled(t.key))
  const tabsToShow = enabledTabs.length > 0 ? enabledTabs : [TAB_SCREENS[0]]

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      {tabsToShow.map((tab) =>
        tab.name === 'Profil' ? (
          <Tab.Screen
            key={tab.name}
            name="Profil"
            options={{
              title: 'Profil',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={tab.icon as keyof typeof Ionicons.glyphMap} size={size} color={color} />
              ),
            }}
          >
            {() => <ProfilScreen onLogout={logout} />}
          </Tab.Screen>
        ) : (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={tab.component}
            options={{
              title: tab.name,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={tab.icon as keyof typeof Ionicons.glyphMap} size={size} color={color} />
              ),
            }}
          />
        )
      )}
    </Tab.Navigator>
  )
}

const DrawerNavigator = () => {
  const { logout } = useAuth()
  const { syncStatus, pendingCount, syncNow } = useSync()

  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} logout={logout} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: '#5b7895' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        headerLeft: () => (
          <Pressable
            onPress={() => navigation.toggleDrawer()}
            style={({ pressed }) => [
              headerStyles.menuButton,
              pressed && headerStyles.menuButtonPressed,
            ]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            android_ripple={null}
            accessible
            accessibilityLabel="Menü öffnen"
            accessibilityRole="button"
          >
            <View pointerEvents="none" style={headerStyles.menuIcon}>
              <Ionicons name="menu" size={28} color="#fff" />
            </View>
          </Pressable>
        ),
        headerRight: () => (
          <View style={headerStyles.right}>
            <SyncStatusIndicator
              status={syncStatus}
              pendingCount={pendingCount}
              onPress={syncStatus !== 'offline' ? syncNow : undefined}
            />
          </View>
        ),
        drawerType: 'front',
        drawerStyle: { width: 280 },
      })}
    >
      <Drawer.Screen
        name="Main"
        component={TabNavigator}
        options={{
          headerTitle: () => <Logo variant="header" />,
          drawerLabel: () => null,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="Einstellungen"
        component={EinstellungenScreen}
        options={{ title: 'Einstellungen' }}
      />
      <Drawer.Screen
        name="Benutzerverwaltung"
        component={BenutzerverwaltungScreen}
        options={{ title: 'Benutzerverwaltung' }}
      />
    </Drawer.Navigator>
  )
}

const headerStyles = StyleSheet.create({
  menuButton: {
    marginLeft: 16,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonPressed: {
    opacity: 0.7,
  },
  menuIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  right: {
    marginRight: 16,
  },
})

export default DrawerNavigator
