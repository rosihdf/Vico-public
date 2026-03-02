import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import Logo from '../components/Logo'
import { useAuth } from '../contexts/AuthContext'
import { getRememberMe } from '../lib/supabase'

type LoginScreenProps = {
  onLoginSuccess: () => void
}

const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMessage, setForgotMessage] = useState<string | null>(null)
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerMessage, setRegisterMessage] = useState<string | null>(null)

  const { login, signUp, resetPasswordForEmail, loginError, isLoading } = useAuth()

  useEffect(() => {
    getRememberMe().then(setRememberMe)
  }, [])

  const handleSubmit = async () => {
    const success = await login(identifier, password, rememberMe)
    if (success) onLoginSuccess()
  }

  const handleForgotSubmit = async () => {
    if (!forgotEmail.trim()) return
    setForgotMessage(null)
    const { message } = await resetPasswordForEmail(forgotEmail.trim())
    setForgotMessage(message)
    if (message.includes('existiert')) setShowForgotPassword(false)
  }

  const handleRegister = async () => {
    setRegisterMessage(null)
    const { success, message } = await signUp(registerEmail, registerPassword)
    setRegisterMessage(message)
    if (success && message.includes('eingeloggt')) onLoginSuccess()
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Lade...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Logo variant="login" />
        </View>
        <Text style={styles.subtitle}>
          {showForgotPassword ? 'Passwort zurücksetzen' : showRegister ? 'Konto anlegen' : 'Anmelden'}
        </Text>

        {showForgotPassword ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="E-Mail"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {forgotMessage ? (
              <Text
                style={[
                  styles.message,
                  forgotMessage.includes('gesendet') || forgotMessage.includes('existiert')
                    ? styles.messageSuccess
                    : styles.messageError,
                ]}
              >
                {forgotMessage}
              </Text>
            ) : null}
            <Pressable style={styles.button} onPress={handleForgotSubmit}>
              <Text style={styles.buttonText}>Link senden</Text>
            </Pressable>
            <Pressable
              style={styles.linkButton}
              onPress={() => {
                setShowForgotPassword(false)
                setForgotMessage(null)
              }}
            >
              <Text style={styles.linkText}>← Zurück zum Login</Text>
            </Pressable>
          </View>
        ) : showRegister ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="E-Mail"
              value={registerEmail}
              onChangeText={setRegisterEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Passwort (min. 6 Zeichen)"
              value={registerPassword}
              onChangeText={setRegisterPassword}
              secureTextEntry
            />
            {registerMessage ? (
              <Text
                style={[
                  styles.message,
                  registerMessage.includes('erstellt') ? styles.messageSuccess : styles.messageError,
                ]}
              >
                {registerMessage}
              </Text>
            ) : null}
            <Pressable style={styles.button} onPress={handleRegister}>
              <Text style={styles.buttonText}>Konto anlegen</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={() => setShowRegister(false)}>
              <Text style={styles.linkText}>← Zum Login</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="E-Mail"
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              placeholder="Passwort"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            {loginError ? (
              <Text style={[styles.message, styles.messageError]}>{loginError}</Text>
            ) : null}
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={handleSubmit}
              disabled={!identifier.trim() || !password}
            >
              <Text style={styles.buttonTextPrimary}>Anmelden</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={() => setShowForgotPassword(true)}>
              <Text style={styles.linkText}>Passwort vergessen?</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={() => setShowRegister(true)}>
              <Text style={styles.linkText}>Konto anlegen</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5b7895',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5b7895',
    minHeight: 400,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  message: {
    fontSize: 14,
    padding: 8,
  },
  messageSuccess: {
    color: '#059669',
  },
  messageError: {
    color: '#dc2626',
  },
  button: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  primaryButton: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkButton: {
    padding: 12,
  },
  linkText: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
  },
})

export default LoginScreen
