import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import Logo from '../components/Logo'
import { useAuth } from '../contexts/AuthContext'

type ResetPasswordScreenProps = {
  onComplete: () => void
}

const ResetPasswordScreen = ({ onComplete }: ResetPasswordScreenProps) => {
  const { updatePassword, isAuthenticated } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setMessage(null)
    if (newPassword.length < 6) {
      setMessage('Passwort muss mindestens 6 Zeichen haben.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('Passwörter stimmen nicht überein.')
      return
    }
    setIsSubmitting(true)
    const { success, message: msg } = await updatePassword(newPassword)
    setMessage(msg)
    setIsSubmitting(false)
    if (success) {
      onComplete()
    }
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Logo variant="login" />
        <Text style={styles.title}>Passwort zurücksetzen</Text>
        <Text style={styles.helper}>
          Link wird verarbeitet… Falls die Weiterleitung fehlschlägt, den Link aus der E-Mail erneut öffnen.
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <Logo variant="login" />
      <Text style={styles.title}>Neues Passwort festlegen</Text>
      <Text style={styles.label}>Neues Passwort (min. 6 Zeichen)</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="••••••••"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
      />
      <Text style={styles.label}>Passwort bestätigen</Text>
      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
      />
      {message && (
        <Text
          style={[
            styles.message,
            message.includes('geändert') ? styles.messageSuccess : styles.messageError,
          ]}
          role="alert"
        >
          {message}
        </Text>
      )}
      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        accessible
        accessibilityLabel="Passwort speichern"
        accessibilityRole="button"
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Passwort speichern</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
    backgroundColor: '#5b7895',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    marginTop: 24,
  },
  helper: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  message: {
    fontSize: 14,
    marginTop: 12,
  },
  messageSuccess: {
    color: '#059669',
  },
  messageError: {
    color: '#dc2626',
  },
  button: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
})

export default ResetPasswordScreen
