import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  Image,
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
import { useNavigation, useRoute } from '@react-navigation/native'
import {
  fetchCustomer,
  fetchBv,
  fetchObjects,
  createObject,
  updateObject,
  deleteObject,
  subscribeToDataChange,
  fetchObjectPhotos,
  getObjectPhotoDisplayUrl,
} from '../lib/dataService'
import { getSupabaseErrorMessage } from '../lib/supabaseErrors'
import ObjectQRCodeModal from '../components/ObjectQRCodeModal'
import { useComponentSettings } from '../contexts/ComponentSettingsContext'
import { useAuth } from '../contexts/AuthContext'
import type { Object as Obj, ObjectFormData, BV, Customer, ObjectPhoto } from '../lib/types'

const INITIAL_FORM: ObjectFormData = {
  internal_id: '',
  door_position: '',
  internal_door_number: '',
  floor: '',
  room: '',
  type_tuer: false,
  type_sektionaltor: false,
  type_schiebetor: false,
  type_freitext: '',
  wing_count: '',
  manufacturer: '',
  build_year: '',
  lock_manufacturer: '',
  lock_type: '',
  has_hold_open: false,
  hold_open_manufacturer: '',
  hold_open_type: '',
  hold_open_approval_no: '',
  hold_open_approval_date: '',
  smoke_detector_count: '0',
  smoke_detector_build_years: [],
  panic_function: '',
  accessories: '',
  maintenance_by_manufacturer: false,
  hold_open_maintenance: false,
  defects: '',
  remarks: '',
  maintenance_interval_months: '',
}

type ObjekteRouteParams = { customerId: string; bvId: string }

const ObjekteScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { userRole } = useAuth()
  const { isEnabled } = useComponentSettings()
  const canEdit = userRole !== 'leser'
  const { customerId, bvId } = (route.params ?? {}) as ObjekteRouteParams
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bv, setBv] = useState<BV | null>(null)
  const [objects, setObjects] = useState<Obj[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ObjectFormData>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [qrObject, setQrObject] = useState<Obj | null>(null)
  const [objectPhotos, setObjectPhotos] = useState<ObjectPhoto[]>([])

  const loadData = useCallback(async () => {
    if (!customerId || !bvId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const [cust, bvData, objData] = await Promise.all([
      fetchCustomer(customerId),
      fetchBv(bvId),
      fetchObjects(bvId),
    ])
    setCustomer((cust ?? null) as Customer | null)
    setBv((bvData ?? null) as BV | null)
    setObjects((objData ?? []) as Obj[])
    setIsLoading(false)
  }, [customerId, bvId])

  useEffect(() => {
    if (!customerId || !bvId) return
    setLoading(true)
    loadData()
  }, [customerId, bvId, loadData])

  useEffect(() => {
    return subscribeToDataChange(loadData)
  }, [loadData])

  const filteredObjects = useMemo(
    () =>
      objects.filter(
        (o) =>
          (o.internal_id ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (o.room ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [objects, searchQuery]
  )

  const handleOpenCreate = () => {
    setFormData({
      ...INITIAL_FORM,
      internal_id: `OBJ-${Date.now().toString(36).toUpperCase()}`,
    })
    setEditingId(null)
    setFormError(null)
    setObjectPhotos([])
    setShowForm(true)
  }

  const handleOpenEdit = async (obj: Obj) => {
    const photos = await fetchObjectPhotos(obj.id)
    setObjectPhotos(photos)
    const raw = obj.smoke_detector_build_years
    const arr = Array.isArray(raw) ? raw.map((v) => String(v ?? '')) : []
    const count = obj.smoke_detector_count ?? 0
    setFormData({
      internal_id: obj.internal_id ?? '',
      door_position: obj.door_position ?? '',
      internal_door_number: obj.internal_door_number ?? '',
      floor: obj.floor ?? '',
      room: obj.room ?? '',
      type_tuer: obj.type_tuer ?? false,
      type_sektionaltor: obj.type_sektionaltor ?? false,
      type_schiebetor: obj.type_schiebetor ?? false,
      type_freitext: obj.type_freitext ?? '',
      wing_count: obj.wing_count?.toString() ?? '',
      manufacturer: obj.manufacturer ?? '',
      build_year: obj.build_year ?? '',
      lock_manufacturer: obj.lock_manufacturer ?? '',
      lock_type: obj.lock_type ?? '',
      has_hold_open: obj.has_hold_open ?? false,
      hold_open_manufacturer: obj.hold_open_manufacturer ?? '',
      hold_open_type: obj.hold_open_type ?? '',
      hold_open_approval_no: obj.hold_open_approval_no ?? '',
      hold_open_approval_date: obj.hold_open_approval_date ?? '',
      smoke_detector_count: obj.smoke_detector_count?.toString() ?? '0',
      smoke_detector_build_years: Array.from({ length: count }, (_, i) =>
        arr[i] ?? ''
      ),
      panic_function: obj.panic_function ?? '',
      accessories: obj.accessories ?? '',
      maintenance_interval_months: obj.maintenance_interval_months?.toString() ?? '',
      maintenance_by_manufacturer: obj.maintenance_by_manufacturer ?? false,
      hold_open_maintenance: obj.hold_open_maintenance ?? false,
      defects: obj.defects ?? '',
      remarks: obj.remarks ?? '',
    })
    setEditingId(obj.id)
    setFormError(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  const handleFormChange = (
    field: keyof ObjectFormData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'smoke_detector_count') {
        const count = parseInt(String(value), 10) || 0
        const buildYears = prev.smoke_detector_build_years
        next.smoke_detector_build_years = Array.from(
          { length: count },
          (_, i) => buildYears[i] ?? ''
        )
      }
      return next
    })
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!bvId) return
    setIsSaving(true)
    const payload = {
      bv_id: bvId,
      internal_id: formData.internal_id.trim() || null,
      door_position: formData.door_position.trim() || null,
      internal_door_number: formData.internal_door_number.trim() || null,
      floor: formData.floor.trim() || null,
      room: formData.room.trim() || null,
      type_tuer: formData.type_tuer,
      type_sektionaltor: formData.type_sektionaltor,
      type_schiebetor: formData.type_schiebetor,
      type_freitext: formData.type_freitext.trim() || null,
      wing_count: formData.wing_count
        ? parseInt(formData.wing_count, 10)
        : null,
      manufacturer: formData.manufacturer.trim() || null,
      build_year: formData.build_year.trim() || null,
      lock_manufacturer: formData.lock_manufacturer.trim() || null,
      lock_type: formData.lock_type.trim() || null,
      has_hold_open: formData.has_hold_open,
      hold_open_manufacturer: formData.hold_open_manufacturer.trim() || null,
      hold_open_type: formData.hold_open_type.trim() || null,
      hold_open_approval_no: formData.hold_open_approval_no.trim() || null,
      hold_open_approval_date:
        formData.hold_open_approval_date.trim() || null,
      smoke_detector_count:
        parseInt(formData.smoke_detector_count, 10) || 0,
      smoke_detector_build_years: formData.smoke_detector_build_years,
      panic_function: formData.panic_function.trim() || null,
      accessories: formData.accessories.trim() || null,
      maintenance_by_manufacturer: formData.maintenance_by_manufacturer,
      hold_open_maintenance: formData.hold_open_maintenance,
      defects: formData.defects.trim() || null,
      remarks: formData.remarks.trim() || null,
      maintenance_interval_months: formData.maintenance_interval_months.trim()
        ? parseInt(formData.maintenance_interval_months, 10) || null
        : null,
    }
    if (editingId) {
      const { error } = await updateObject(editingId, payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
      } else {
        handleCloseForm()
        loadData()
      }
    } else {
      const { data, error } = await createObject(payload)
      if (error) {
        setFormError(getSupabaseErrorMessage(error))
      } else if (data) {
        handleCloseForm()
        loadData()
      }
    }
    setIsSaving(false)
  }

  const handleDelete = (obj: Obj) => {
    Alert.alert(
      'Objekt löschen',
      `Objekt „${obj.internal_id || obj.id}“ wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteObject(obj.id)
            if (!error) loadData()
          },
        },
      ]
    )
  }

  const handleNavigateToWartung = (objectId: string) => {
    ;(navigation as { navigate: (a: string, b: object) => void }).navigate(
      'Wartung',
      { customerId, bvId, objectId }
    )
  }

  const handleShowQr = (obj: Obj) => setQrObject(obj)

  const handleGoBack = () => {
    ;(navigation as { navigate: (a: string, b?: object) => void }).navigate(
      'BVs',
      { customerId }
    )
  }

  if (!customerId || !bvId) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Ungültige Navigation.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Zurück</Text>
        </Pressable>
      </View>
    )
  }

  if (isLoading || !customer || !bv) {
    return (
      <View style={[styles.center, { gap: 12 }]}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Lade Objekte…</Text>
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
          accessibilityLabel="Zurück zu BVs"
          accessibilityRole="button"
        >
          <Text style={styles.breadcrumbText}>← {bv.name}</Text>
        </Pressable>
        <Text style={styles.customerName}>
          {customer.name} / {bv.name}
        </Text>
        <Text style={styles.title}>Objekte</Text>
        <TextInput
          style={styles.search}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Objekte suchen..."
          placeholderTextColor="#94a3b8"
        />
        {canEdit && (
          <Pressable
            style={styles.addButton}
            onPress={handleOpenCreate}
            accessible
            accessibilityLabel="Neues Objekt anlegen"
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+ Neu</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={filteredObjects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {searchQuery
              ? 'Keine Objekte gefunden.'
              : 'Noch keine Objekte angelegt.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.internal_id || '–'}</Text>
            <Text style={styles.detail}>
              {[item.room, item.floor].filter(Boolean).join(' · ') ||
                item.manufacturer ||
                '–'}
            </Text>
            <View style={styles.actions}>
              {isEnabled('wartungsprotokolle') && (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => handleNavigateToWartung(item.id)}
                  accessible
                  accessibilityLabel="Wartungsprotokolle"
                  accessibilityRole="button"
                >
                  <Text style={styles.actionText}>Wartung</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.actionButton}
                onPress={() => handleShowQr(item)}
                accessible
                accessibilityLabel="QR-Code anzeigen"
                accessibilityRole="button"
              >
                <Text style={styles.actionText}>QR-Code</Text>
              </Pressable>
              {canEdit && (
                <>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleOpenEdit(item)}
                    accessible
                    accessibilityLabel="Bearbeiten"
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionText}>Bearbeiten</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(item)}
                    accessible
                    accessibilityLabel="Löschen"
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
                {editingId ? 'Objekt bearbeiten' : 'Objekt anlegen'}
              </Text>

              <Text style={styles.label}>Interne ID</Text>
              <TextInput
                style={styles.input}
                value={formData.internal_id}
                onChangeText={(v) => handleFormChange('internal_id', v)}
                placeholder="z. B. OBJ-001"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Raum</Text>
              <TextInput
                style={styles.input}
                value={formData.room}
                onChangeText={(v) => handleFormChange('room', v)}
                placeholder="Raum"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Etage</Text>
              <TextInput
                style={styles.input}
                value={formData.floor}
                onChangeText={(v) => handleFormChange('floor', v)}
                placeholder="Etage"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Hersteller</Text>
              <TextInput
                style={styles.input}
                value={formData.manufacturer}
                onChangeText={(v) => handleFormChange('manufacturer', v)}
                placeholder="Hersteller"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Baujahr</Text>
              <TextInput
                style={styles.input}
                value={formData.build_year}
                onChangeText={(v) => handleFormChange('build_year', v)}
                placeholder="Baujahr"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
              />

              <View style={styles.toggleRow}>
                <Text style={styles.label}>Tür</Text>
                <Switch
                  value={formData.type_tuer}
                  onValueChange={(v) => handleFormChange('type_tuer', v)}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.label}>Sektionaltor</Text>
                <Switch
                  value={formData.type_sektionaltor}
                  onValueChange={(v) => handleFormChange('type_sektionaltor', v)}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.label}>Schiebetor</Text>
                <Switch
                  value={formData.type_schiebetor}
                  onValueChange={(v) => handleFormChange('type_schiebetor', v)}
                />
              </View>

              <Text style={styles.label}>Mängel / Bemerkungen</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.defects}
                onChangeText={(v) => handleFormChange('defects', v)}
                placeholder="Vorhandene Mängel"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.remarks}
                onChangeText={(v) => handleFormChange('remarks', v)}
                placeholder="Bemerkungen"
                placeholderTextColor="#94a3b8"
                multiline
              />

              <Text style={styles.label}>Wartungsintervall (Monate)</Text>
              <TextInput
                style={styles.input}
                value={formData.maintenance_interval_months}
                onChangeText={(v) => handleFormChange('maintenance_interval_months', v)}
                placeholder="z. B. 12 für jährlich"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                accessibilityLabel="Wartungsintervall in Monaten"
              />

              {editingId && objectPhotos.length > 0 && (
                <View style={styles.photosSection}>
                  <Text style={styles.photosTitle}>Fotos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                    {objectPhotos.map((p) => (
                      <Image
                        key={p.id}
                        source={{ uri: getObjectPhotoDisplayUrl(p) }}
                        style={styles.photoThumb}
                        accessibilityLabel={p.caption || 'Objekt-Foto'}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
              {formError && <Text style={styles.formError}>{formError}</Text>}

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

      {qrObject && customer && bv && (
        <ObjectQRCodeModal
          visible
          onClose={() => setQrObject(null)}
          object={qrObject}
          customerName={customer.name}
          bvName={bv.name}
          customerId={customerId}
          bvId={bvId}
        />
      )}
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
  loadingText: {
    fontSize: 14,
    color: '#334155',
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
  detail: {
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
  textArea: {
    minHeight: 60,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
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
  photosSection: {
    marginTop: 16,
  },
  photosTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
})

export default ObjekteScreen
