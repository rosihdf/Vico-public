import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SyncProvider } from './contexts/SyncContext'
import { ComponentSettingsProvider } from './contexts/ComponentSettingsContext'
import { OrderNotificationProvider } from './contexts/OrderNotificationProvider'
import LoginScreen from './screens/LoginScreen'
import ResetPasswordScreen from './screens/ResetPasswordScreen'
import DrawerNavigator from './navigation/AppNavigator'

const AppContent = () => {
  const { isAuthenticated, pendingPasswordReset, clearPendingPasswordReset } = useAuth()

  if (pendingPasswordReset && isAuthenticated) {
    return (
      <ResetPasswordScreen onComplete={clearPendingPasswordReset} />
    )
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen onLoginSuccess={() => {}} />
    )
  }

  return (
    <NavigationContainer>
      <OrderNotificationProvider>
        <DrawerNavigator />
      </OrderNotificationProvider>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <AuthProvider>
            <SyncProvider>
              <ComponentSettingsProvider>
                <AppContent />
              </ComponentSettingsProvider>
              <StatusBar style="light" />
            </SyncProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#5b7895',
  },
})
