import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { fetchProfiles, updateProfileRole, updateProfileName, getProfileDisplayName } from '../lib/userService'
import { subscribeToProfileChanges } from '../lib/profileRealtime'
import { getSupabaseErrorMessage } from '../lib/supabaseErrors'
import type { Profile } from '../lib/userService'

const ROLE_LABELS: Record<'admin' | 'mitarbeiter' | 'leser', string> = {
  admin: 'Admin',
  mitarbeiter: 'Mitarbeiter',
  leser: 'Leser',
}

const BenutzerverwaltungScreen = () => {
  const { userRole, signUp, logout } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [roleSelectProfile, setRoleSelectProfile] = useState<Profile | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadProfiles = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchProfiles()
    setProfiles(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (userRole !== 'admin') return
    loadProfiles()
  }, [userRole, loadProfiles])

  useEffect(() => {
    if (userRole !== 'admin') return () => {}
    const unsub = subscribeToProfileChanges(loadProfiles)
    return unsub
  }, [userRole, loadProfiles])

  const isLastAdmin = (p: Profile) =>
    p.role === 'admin' && profiles.filter((x) => x.role === 'admin').length === 1

  const handleRoleChange = async (profile: Profile, newRole: 'admin' | 'mitarbeiter' | 'leser') => {
    if (newRole === profile.role) return
    if (isLastAdmin(profile)) return
    setUpdatingId(profile.id)
    const { error } = await updateProfileRole(profile.id, newRole)
    setUpdatingId(null)
    if (!error) {
      loadProfiles()
      setRoleSelectProfile(null)
    } else {
      Alert.alert('Fehler', error.message)
    }
  }

  const handleOpenCreate = () => {
    setNewEmail('')
    setNewPassword('')
    setNewFirstName('')
    setNewLastName('')
    setFormError(null)
    setFormMessage(null)
    setShowForm(true)
  }

  const handleRoleSelectPress = (profile: Profile) => {
    if (isLastAdmin(profile)) {
      Alert.alert(
        'Letzter Admin',
        'Es muss mindestens ein Admin vorhanden sein. Die Rolle kann nicht geändert werden.'
      )
      return
    }
    setRoleSelectProfile(profile)
  }

  const handleOpenEditName = (profile: Profile) => {
    setEditingProfile(profile)
    setEditFirstName(profile.first_name ?? '')
    setEditLastName(profile.last_name ?? '')
  }

  const handleCloseEditName = () => {
    setEditingProfile(null)
  }

  const handleSaveName = async () => {
    if (!editingProfile) return
    setUpdatingId(editingProfile.id)
    const { error } = await updateProfileName(
      editingProfile.id,
      editFirstName.trim() || null,
      editLastName.trim() || null
    )
    setUpdatingId(null)
    if (!error) {
      loadProfiles()
      handleCloseEditName()
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setFormError(null)
    setFormMessage(null)
  }

  const handleCreateUser = async () => {
    setFormError(null)
    setFormMessage(null)
    if (!newEmail.trim() || !newPassword.trim()) {
      setFormError('E-Mail und Passwort sind erforderlich.')
      return
    }
    if (newPassword.length < 6) {
      setFormError('Passwort muss mindestens 6 Zeichen haben.')
      return
    }
    setIsSaving(true)
    const { success, message, sessionCreated } = await signUp(
      newEmail.trim(),
      newPassword
    )
    if (success && sessionCreated && (newFirstName.trim() || newLastName.trim())) {
      const { supabase } = await import('../lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await updateProfileName(user.id, newFirstName.trim() || null, newLastName.trim() || null)
      }
    }
    setIsSaving(false)
    if (success) {
      setFormMessage('Benutzer erstellt.')
      setNewEmail('')
      setNewPassword('')
      setNewFirstName('')
      setNewLastName('')
      loadProfiles()
      handleCloseForm()
      if (sessionCreated) {
        await logout()
        Alert.alert(
          'Benutzer erstellt',
          'Bitte erneut einloggen.',
          [{ text: 'OK' }]
        )
      }
    } else {
      setFormError(getSupabaseErrorMessage({ message }))
    }
  }

  if (userRole !== 'admin') {
    return (
      <View style={styles.container}>
        <Text style={styles.forbidden}>Nur für Admins zugänglich.</Text>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Benutzerverwaltung</Text>

      <Pressable
        style={styles.addButton}
        onPress={handleOpenCreate}
        accessible
        accessibilityLabel="Neuen Benutzer anlegen"
        accessibilityRole="button"
      >
        <Text style={styles.addButtonText}>+ Neuer Benutzer</Text>
      </Pressable>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{getProfileDisplayName(item)}</Text>
              <Pressable
                onPress={() => handleOpenEditName(item)}
                style={styles.editNameBtn}
                accessible
                accessibilityLabel="Name bearbeiten"
                accessibilityRole="button"
              >
                <Text style={styles.editNameText}>bearbeiten</Text>
              </Pressable>
            </View>
            {(item.first_name || item.last_name) && item.email && (
              <Text style={styles.email}>{item.email}</Text>
            )}
            {!item.first_name && !item.last_name && (
              <Text style={styles.email}>{item.email || item.id}</Text>
            )}
            <View style={styles.row}>
              <Text style={styles.role}>{ROLE_LABELS[item.role]}</Text>
              <Pressable
                style={[
                  styles.roleSelectButton,
                  updatingId === item.id && styles.buttonDisabled,
                ]}
                onPress={() => handleRoleSelectPress(item)}
                disabled={updatingId === item.id}
                accessible
                accessibilityLabel={`Rolle von ${getProfileDisplayName(item)} ändern`}
                accessibilityRole="button"
              >
                {updatingId === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.roleSelectButtonText}>
                    {ROLE_LABELS[item.role]} ▼
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Keine Benutzer vorhanden.</Text>
        }
      />

      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={handleCloseForm}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseForm}>
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Neuer Benutzer</Text>
            <Text style={styles.label}>Vorname</Text>
            <TextInput
              style={styles.input}
              value={newFirstName}
              onChangeText={setNewFirstName}
              placeholder="Vorname"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Nachname</Text>
            <TextInput
              style={styles.input}
              value={newLastName}
              onChangeText={setNewLastName}
              placeholder="Nachname"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>E-Mail *</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="E-Mail"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Passwort (min. 6 Zeichen) *</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Passwort"
              placeholderTextColor="#94a3b8"
              secureTextEntry
            />
            {formError && (
              <Text style={styles.formError}>{formError}</Text>
            )}
            {formMessage && (
              <Text style={styles.formMessage}>{formMessage}</Text>
            )}
            <View style={styles.formButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleCloseForm}
                accessible
                accessibilityLabel="Abbrechen"
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, isSaving && styles.buttonDisabled]}
                onPress={handleCreateUser}
                disabled={isSaving}
                accessible
                accessibilityLabel="Benutzer anlegen"
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Erstellen…' : 'Erstellen'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!roleSelectProfile}
        animationType="slide"
        transparent
        onRequestClose={() => setRoleSelectProfile(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRoleSelectProfile(null)}>
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Rolle wählen</Text>
            {roleSelectProfile && (
              <>
                <Pressable
                  style={styles.roleOption}
                  onPress={() => handleRoleChange(roleSelectProfile, 'admin' as const)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Admin"
                >
                  <Text style={styles.roleOptionText}>Admin</Text>
                </Pressable>
                <Pressable
                  style={styles.roleOption}
                  onPress={() => handleRoleChange(roleSelectProfile, 'mitarbeiter' as const)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Mitarbeiter"
                >
                  <Text style={styles.roleOptionText}>Mitarbeiter</Text>
                </Pressable>
                <Pressable
                  style={styles.roleOption}
                  onPress={() => handleRoleChange(roleSelectProfile, 'leser' as const)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Leser"
                >
                  <Text style={styles.roleOptionText}>Leser</Text>
                </Pressable>
              </>
            )}
            <Pressable
              style={[styles.cancelButton, styles.roleModalCancel]}
              onPress={() => setRoleSelectProfile(null)}
              accessible
              accessibilityLabel="Abbrechen"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!editingProfile}
        animationType="slide"
        transparent
        onRequestClose={handleCloseEditName}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseEditName}>
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Name bearbeiten</Text>
            {editingProfile && (
              <Text style={styles.editEmail}>{editingProfile.email || '(keine E-Mail)'}</Text>
            )}
            <Text style={styles.label}>Vorname</Text>
            <TextInput
              style={styles.input}
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="Vorname"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Nachname</Text>
            <TextInput
              style={styles.input}
              value={editLastName}
              onChangeText={setEditLastName}
              placeholder="Nachname"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.formButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleCloseEditName}
                accessible
                accessibilityLabel="Abbrechen"
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, updatingId === editingProfile?.id && styles.buttonDisabled]}
                onPress={handleSaveName}
                disabled={updatingId === editingProfile?.id}
                accessible
                accessibilityLabel="Speichern"
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>
                  {updatingId === editingProfile?.id ? 'Speichern…' : 'Speichern'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5b7895',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#059669',
    padding: 14,
    borderRadius: 8,
    marginBottom: 24,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  editNameBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editNameText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  editEmail: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  role: {
    fontSize: 14,
    color: '#64748b',
  },
  roleSelectButton: {
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  roleSelectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  roleOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  roleOptionText: {
    fontSize: 16,
    color: '#0f172a',
  },
  roleModalCancel: {
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  },
  forbidden: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 48,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formError: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 12,
  },
  formMessage: {
    color: '#059669',
    fontSize: 14,
    marginTop: 12,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
})

export default BenutzerverwaltungScreen
