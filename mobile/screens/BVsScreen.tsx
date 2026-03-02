import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  Switch,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchCustomer,
  fetchBvs,
  createBv,
  updateBv,
  deleteBv,
  subscribeToDataChange,
} from '../lib/dataService'
import { getSupabaseErrorMessage } from '../lib/supabaseErrors'
import type { BV, BVFormData, Customer } from '../lib/types'

const INITIAL_FORM: BVFormData = {
  name: '',
  street: '',
  postal_code: '',
  city: '',
  email: '',
  phone: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  maintenance_report_email: true,
  maintenance_report_email_address: '',
  copy_from_customer: false,
}

type BVsRouteParams = { customerId: string }

const BVsScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { userRole } = useAuth()
  const canEdit = userRole !== 'leser'
  const { customerId } = (route.params ?? {}) as BVsRouteParams
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bvs, setBvs] = useState<BV[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<BVFormData>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!customerId) return
    const [cust, bvData] = await Promise.all([
      fetchCustomer(customerId),
      fetchBvs(customerId),
    ])
    setCustomer(cust ?? null)
    setBvs((bvData ?? []) as BV[])
    setLoading(false)
  }, [customerId])

  useEffect(() => {
    if (!customerId) return
    setLoading(true)
    loadData()
  }, [customerId, loadData])

  useEffect(() => {
    return subscribeToDataChange(loadData)
  }, [loadData])

  const filteredBvs = bvs.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCopyFromCustomer = () => {
    if (!customer) return
    setFormData((prev) => ({
      ...prev,
      street: customer.street ?? '',
      postal_code: customer.postal_code ?? '',
      city: customer.city ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      contact_name: customer.contact_name ?? '',
      contact_email: customer.contact_email ?? '',
      contact_phone: customer.contact_phone ?? '',
      maintenance_report_email: customer.maintenance_report_email ?? true,
      maintenance_report_email_address:
        customer.maintenance_report_email_address ?? '',
    }))
  }

  const handleOpenCreate = () => {
    setFormData({ ...INITIAL_FORM, copy_from_customer: false })
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  const handleOpenEdit = (bv: BV) => {
    setFormData({
      name: bv.name,
      street: bv.street ?? '',
      postal_code: bv.postal_code ?? '',
      city: bv.city ?? '',
      email: bv.email ?? '',
      phone: bv.phone ?? '',
      contact_name: bv.contact_name ?? '',
      contact_email: bv.contact_email ?? '',
      contact_phone: bv.contact_phone ?? '',
      maintenance_report_email: bv.maintenance_report_email ?? true,
      maintenance_report_email_address:
        bv.maintenance_report_email_address ?? '',
      copy_from_customer: false,
    })
    setEditingId(bv.id)
    setFormError(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  const handleFormChange = (
    field: keyof BVFormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!formData.name.trim() || !customerId) {
      setFormError('Name ist erforderlich.')
      return
    }
    const data =
      formData.copy_from_customer && customer
        ? {
            ...formData,
            street: customer.street ?? '',
            postal_code: customer.postal_code ?? '',
            city: customer.city ?? '',
            email: customer.email ?? '',
            phone: customer.phone ?? '',
            contact_name: customer.contact_name ?? '',
            contact_email: customer.contact_email ?? '',
            contact_phone: customer.contact_phone ?? '',
            maintenance_report_email: customer.maintenance_report_email ?? true,
            maintenance_report_email_address:
              customer.maintenance_report_email_address ?? '',
          }
        : formData

    setIsSaving(true)
    const payload = {
      customer_id: customerId,
      name: data.name.trim(),
      street: data.street.trim() || null,
      postal_code: data.postal_code.trim() || null,
      city: data.city.trim() || null,
      email: data.email.trim() || null,
      phone: data.phone.trim() || null,
      contact_name: data.contact_name.trim() || null,
      contact_email: data.contact_email.trim() || null,
      contact_phone: data.contact_phone.trim() || null,
      maintenance_report_email: data.maintenance_report_email,
      maintenance_report_email_address:
        data.maintenance_report_email_address.trim() || null,
    }
    if (editingId) {
      const { error } = await updateBv(editingId, payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
      } else {
        handleCloseForm()
        loadData()
      }
    } else {
      const { data: created, error } = await createBv(payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
      } else if (created) {
        handleCloseForm()
        loadData()
      }
    }
    setIsSaving(false)
  }

  const handleDelete = (bv: BV) => {
    Alert.alert(
      'BV löschen',
      `BV „${bv.name}“ wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteBv(bv.id)
            if (!error) loadData()
          },
        },
      ]
    )
  }

  const handleNavigateToObjekte = (bvId: string) => {
    ;(navigation as { navigate: (a: string, b?: object) => void }).navigate(
      'Objekte',
      { customerId, bvId }
    )
  }

  const handleGoBack = () => {
    ;(navigation as { navigate: (a: string) => void }).navigate('KundenListe')
  }

  if (!customerId) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Kein Kunde ausgewählt.</Text>
        <Pressable onPress={handleGoBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Zurück zu Kunden</Text>
        </Pressable>
      </View>
    )
  }

  if (loading || !customer) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={handleGoBack}
          style={styles.breadcrumb}
          accessible
          accessibilityLabel="Zurück zu Kunden"
          accessibilityRole="button"
        >
          <Text style={styles.breadcrumbText}>← Kunden</Text>
        </Pressable>
        <Text style={styles.customerName}>{customer.name}</Text>
        <Text style={styles.title}>BVs</Text>
        <TextInput
          style={styles.search}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="BVs suchen..."
          placeholderTextColor="#94a3b8"
        />
        {canEdit && (
          <Pressable
            style={styles.addButton}
            onPress={handleOpenCreate}
            accessible
            accessibilityLabel="Neuen BV anlegen"
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+ Neu</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={filteredBvs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {searchQuery ? 'Keine BVs gefunden.' : 'Noch keine BVs angelegt.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            {(item.city || item.postal_code) && (
              <Text style={styles.city}>
                {[item.postal_code, item.city].filter(Boolean).join(' ')}
              </Text>
            )}
            <View style={styles.actions}>
              <Pressable
                style={styles.actionButton}
                onPress={() => handleNavigateToObjekte(item.id)}
                accessible
                accessibilityLabel={`Objekte von ${item.name}`}
                accessibilityRole="button"
              >
                <Text style={styles.actionText}>Objekte</Text>
              </Pressable>
              {canEdit && (
                <>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleOpenEdit(item)}
                    accessible
                    accessibilityLabel={`${item.name} bearbeiten`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionText}>Bearbeiten</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(item)}
                    accessible
                    accessibilityLabel={`${item.name} löschen`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.deleteText}>Löschen</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}
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
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editingId ? 'BV bearbeiten' : 'BV anlegen'}
              </Text>
              {!editingId && customer && (
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => {
                    const next = !formData.copy_from_customer
                    handleFormChange('copy_from_customer', next)
                    if (next) handleCopyFromCustomer()
                  }}
                  accessible
                  accessibilityLabel="Daten aus Kundenverwaltung übernehmen"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: formData.copy_from_customer }}
                >
                  <Ionicons
                    name={formData.copy_from_customer ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={formData.copy_from_customer ? '#059669' : '#94a3b8'}
                  />
                  <Text style={styles.checkboxLabel}>
                    Daten aus Kundenverwaltung übernehmen
                  </Text>
                </Pressable>
              )}

              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(v) => handleFormChange('name', v)}
                placeholder="BV-Name"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Straße</Text>
              <TextInput
                style={styles.input}
                value={formData.street}
                onChangeText={(v) => handleFormChange('street', v)}
                placeholder="Straße"
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>PLZ</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.postal_code}
                    onChangeText={(v) => handleFormChange('postal_code', v)}
                    placeholder="PLZ"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Ort</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.city}
                    onChangeText={(v) => handleFormChange('city', v)}
                    placeholder="Ort"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
              <Text style={styles.label}>E-Mail</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(v) => handleFormChange('email', v)}
                placeholder="E-Mail"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.label}>Telefon</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(v) => handleFormChange('phone', v)}
                placeholder="Telefon"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
              <Text style={styles.sectionTitle}>Ansprechpartner</Text>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_name}
                onChangeText={(v) => handleFormChange('contact_name', v)}
                placeholder="Ansprechpartner Name"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>E-Mail</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_email}
                onChangeText={(v) => handleFormChange('contact_email', v)}
                placeholder="Ansprechpartner E-Mail"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.label}>Telefon</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_phone}
                onChangeText={(v) => handleFormChange('contact_phone', v)}
                placeholder="Ansprechpartner Telefon"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
              <View style={styles.toggleRow}>
                <Text style={styles.label}>Wartungsbericht per E-Mail</Text>
                <Switch
                  value={formData.maintenance_report_email}
                  onValueChange={(v) =>
                    handleFormChange('maintenance_report_email', v)
                  }
                />
              </View>
              {formData.maintenance_report_email && (
                <>
                  <Text style={styles.label}>
                    Wartungsbericht E-Mail-Adresse
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={formData.maintenance_report_email_address}
                    onChangeText={(v) =>
                      handleFormChange('maintenance_report_email_address', v)
                    }
                    placeholder="E-Mail für Wartungsbericht"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </>
              )}

              {formError && <Text style={styles.error}>{formError}</Text>}

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
                  onPress={handleSubmit}
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
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  },
  error: {
    color: '#dc2626',
    padding: 16,
  },
  backLink: {
    padding: 16,
  },
  backLinkText: {
    color: '#0f172a',
    fontSize: 14,
  },
  header: {
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#5b7895',
  },
  breadcrumb: {
    marginBottom: 4,
  },
  breadcrumbText: {
    color: '#334155',
    fontSize: 14,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  search: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addButton: {
    backgroundColor: '#059669',
    padding: 14,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  city: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  actionText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  deleteText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
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
    maxHeight: '90%',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  error: {
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

export default BVsScreen
