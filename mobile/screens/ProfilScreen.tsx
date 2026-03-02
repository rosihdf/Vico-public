import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyProfile, updateProfileName, getProfileDisplayName } from '../lib/userService'
import { subscribeToProfileChanges } from '../lib/profileRealtime'
import { getSupabaseErrorMessage } from '../lib/supabaseErrors'
import type { Profile } from '../lib/userService'

const ROLE_LABELS: Record<'admin' | 'mitarbeiter' | 'leser', string> = {
  admin: 'Admin',
  mitarbeiter: 'Mitarbeiter',
  leser: 'Leser',
}

type ProfilScreenProps = {
  onLogout: () => void
}

const ProfilScreen = ({ onLogout }: ProfilScreenProps) => {
  const { user, userEmail, userRole } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    const data = await fetchMyProfile(user.id)
    setProfile(data)
    if (data) {
      setEditFirstName(data.first_name ?? '')
      setEditLastName(data.last_name ?? '')
    }
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      loadProfile()
    } else {
      setProfile(null)
      setIsLoading(false)
    }
  }, [user?.id, loadProfile])

  useEffect(() => {
    if (!user?.id) return () => {}
    const unsub = subscribeToProfileChanges(loadProfile)
    return unsub
  }, [user?.id, loadProfile])

  const handleOpenEdit = () => {
    if (profile) {
      setEditFirstName(profile.first_name ?? '')
      setEditLastName(profile.last_name ?? '')
      setError(null)
      setIsEditing(true)
    }
  }

  const handleCloseEdit = () => {
    setIsEditing(false)
    setError(null)
  }

  const handleSaveName = async () => {
    if (!profile) return
    setError(null)
    setIsSaving(true)
    const { error: updateError } = await updateProfileName(
      profile.id,
      editFirstName.trim() || null,
      editLastName.trim() || null
    )
    setIsSaving(false)
    if (updateError) {
      setError(getSupabaseErrorMessage(updateError))
      return
    }
    await loadProfile()
    handleCloseEdit()
  }

  if (!user) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Mein Profil</Text>
        <Text style={styles.placeholder}>Nicht angemeldet.</Text>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mein Profil</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#059669" style={styles.loader} />
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>
                  {profile ? getProfileDisplayName(profile) : userEmail ?? '–'}
                </Text>
              </View>
              {profile && (
                <Pressable
                  onPress={handleOpenEdit}
                  style={styles.editBtn}
                  accessible
                  accessibilityLabel="Name bearbeiten"
                  accessibilityRole="button"
                >
                  <Text style={styles.editBtnText}>bearbeiten</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>E-Mail</Text>
            <Text style={styles.value}>{userEmail || '–'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Rolle</Text>
            <Text style={styles.value}>
              {userRole ? ROLE_LABELS[userRole] : '–'}
            </Text>
          </View>

          <Pressable
            style={styles.logoutButton}
            onPress={onLogout}
            accessible
            accessibilityLabel="Ausloggen"
            accessibilityRole="button"
          >
            <Text style={styles.logoutButtonText}>Ausloggen</Text>
          </Pressable>
        </>
      )}

      <Modal
        visible={isEditing}
        animationType="slide"
        transparent
        onRequestClose={handleCloseEdit}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseEdit}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Name bearbeiten</Text>
            <Text style={[styles.label, styles.formLabel]}>Vorname</Text>
            <TextInput
              style={styles.input}
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="Vorname"
              placeholderTextColor="#94a3b8"
            />
            <Text style={[styles.label, styles.formLabel]}>Nachname</Text>
            <TextInput
              style={styles.input}
              value={editLastName}
              onChangeText={setEditLastName}
              placeholder="Nachname"
              placeholderTextColor="#94a3b8"
            />
            {error && <Text style={styles.formError}>{error}</Text>}
            <View style={styles.formButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleCloseEdit}
                accessible
                accessibilityLabel="Abbrechen"
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, isSaving && styles.buttonDisabled]}
                onPress={handleSaveName}
                disabled={isSaving}
                accessible
                accessibilityLabel="Speichern"
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Speichern…' : 'Speichern'}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 24,
  },
  loader: {
    marginTop: 24,
  },
  placeholder: {
    color: '#64748b',
    marginTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  formLabel: {
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    color: '#0f172a',
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editBtnText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#dc2626',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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
  buttonDisabled: {
    opacity: 0.6,
  },
})

export default ProfilScreen
