import React, { Component } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Fehler beim Laden</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Text style={styles.hint}>
            Browser-Konsole (F12) für Details öffnen.
          </Text>
        </ScrollView>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5b7895',
  },
  content: {
    padding: 24,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
})
