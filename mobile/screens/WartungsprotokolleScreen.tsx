import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
  Alert,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import * as Print from 'expo-print'
import * as FileSystem from 'expo-file-system'
import {
  fetchCustomer,
  fetchBv,
  fetchObject,
  fetchMaintenanceReports,
  fetchMaintenanceReportSmokeDetectors,
  createMaintenanceReport,
  deleteMaintenanceReport,
  uploadMaintenancePdf,
  sendMaintenanceReportEmail,
} from '../lib/dataService'
import { generateMaintenanceHtml } from '../lib/generateMaintenanceHtml'
import { getSupabaseErrorMessage } from '../lib/supabaseErrors'
import { useAuth } from '../contexts/AuthContext'
import { useComponentSettings } from '../contexts/ComponentSettingsContext'
import type {
  Object as Obj,
  Customer,
  BV,
  MaintenanceReport,
  MaintenanceReportFormData,
  MaintenanceReason,
  MaintenanceUrgency,
  SmokeDetectorStatus,
} from '../lib/types'

const REASON_LABELS: Record<MaintenanceReason, string> = {
  regelwartung: 'Regelwartung',
  reparatur: 'Reparatur',
  nachpruefung: 'Nachprüfung',
  sonstiges: 'Sonstiges',
}

const URGENCY_LABELS: Record<MaintenanceUrgency, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
}

const STATUS_LABELS: Record<SmokeDetectorStatus, string> = {
  ok: 'OK',
  defekt: 'Defekt',
  ersetzt: 'Ersetzt',
}

const INITIAL_FORM: MaintenanceReportFormData = {
  maintenance_date: new Date().toISOString().slice(0, 10),
  maintenance_time: new Date().toTimeString().slice(0, 5),
  reason: 'regelwartung',
  reason_other: '',
  manufacturer_maintenance_done: false,
  hold_open_checked: false,
  deficiencies_found: false,
  deficiency_description: '',
  urgency: 'mittel',
  fixed_immediately: false,
  smoke_detector_statuses: [],
  technician_name_printed: '',
  customer_name_printed: '',
}

type WartungRouteParams = {
  customerId: string
  bvId: string
  objectId: string
}

const WartungsprotokolleScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { user, userRole } = useAuth()
  const canEdit = userRole !== 'leser'
  const { isEnabled } = useComponentSettings()
  const { customerId, bvId, objectId } = (route.params ?? {}) as WartungRouteParams
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bv, setBv] = useState<BV | null>(null)
  const [object, setObject] = useState<Obj | null>(null)
  const [reports, setReports] = useState<MaintenanceReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<MaintenanceReportFormData>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!customerId || !bvId || !objectId) return
    setLoading(true)
    const [cust, bvData, objData, reportData] = await Promise.all([
      fetchCustomer(customerId),
      fetchBv(bvId),
      fetchObject(objectId),
      fetchMaintenanceReports(objectId),
    ])
    setCustomer((cust ?? null) as Customer | null)
    setBv((bvData ?? null) as BV | null)
    setObject((objData ?? null) as Obj | null)
    setReports((reportData ?? []) as MaintenanceReport[])
    setLoading(false)
  }, [customerId, bvId, objectId])

  useEffect(() => {
    if (!isEnabled('wartungsprotokolle')) {
      ;(navigation as { goBack: () => void }).goBack()
      return
    }
    loadData()
  }, [loadData, isEnabled, navigation])

  const handleOpenCreate = () => {
    const smokeCount = object?.smoke_detector_count ?? 0
    setFormData({
      ...INITIAL_FORM,
      maintenance_date: new Date().toISOString().slice(0, 10),
      maintenance_time: new Date().toTimeString().slice(0, 5),
      smoke_detector_statuses: Array.from({ length: smokeCount }, (_, i) => ({
        label: `RM${i + 1}`,
        status: 'ok' as SmokeDetectorStatus,
      })),
    })
    setFormError(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setFormError(null)
  }

  const handleFormChange = (
    field: keyof MaintenanceReportFormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSmokeDetectorStatusChange = (
    index: number,
    status: SmokeDetectorStatus
  ) => {
    setFormData((prev) => {
      const next = [...prev.smoke_detector_statuses]
      next[index] = { ...next[index], status }
      return { ...prev, smoke_detector_statuses: next }
    })
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!objectId || !object) return
    setIsSaving(true)
    const payload = {
      object_id: objectId,
      maintenance_date: formData.maintenance_date,
      maintenance_time: formData.maintenance_time.trim() || null,
      technician_id: user?.id ?? null,
      reason: (formData.reason || null) as MaintenanceReport['reason'],
      reason_other: formData.reason_other.trim() || null,
      manufacturer_maintenance_done: formData.manufacturer_maintenance_done,
      hold_open_checked: object.has_hold_open
        ? formData.hold_open_checked
        : null,
      deficiencies_found: formData.deficiencies_found,
      deficiency_description: formData.deficiency_description.trim() || null,
      urgency: (formData.urgency || null) as MaintenanceReport['urgency'],
      fixed_immediately: formData.fixed_immediately,
      customer_signature_path: null,
      technician_signature_path: null,
      technician_name_printed: formData.technician_name_printed.trim() || null,
      customer_name_printed: formData.customer_name_printed.trim() || null,
      pdf_path: null,
      synced: true,
    }
    const smokeDetectors = formData.smoke_detector_statuses.map((sd) => ({
      label: sd.label,
      status: sd.status,
    }))
    const { data, error } = await createMaintenanceReport(
      payload,
      smokeDetectors
    )
    setIsSaving(false)
    if (error) {
      setFormError(getSupabaseErrorMessage({ message: error.message }))
      return
    }
    if (data) {
      handleCloseForm()
      loadData()
    }
  }

  const handleDelete = (report: MaintenanceReport) => {
    Alert.alert(
      'Protokoll löschen',
      `Wartungsprotokoll vom ${report.maintenance_date} wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteMaintenanceReport(report.id)
            if (!error) loadData()
          },
        },
      ]
    )
  }

  const getRecipientEmail = (): string | null => {
    const bvEmail = bv?.maintenance_report_email !== false ? bv?.maintenance_report_email_address : null
    const custEmail = customer?.maintenance_report_email !== false ? customer?.maintenance_report_email_address : null
    return (bvEmail || custEmail || '').trim() || null
  }

  const handleSendEmail = async (r: MaintenanceReport) => {
    const recipient = getRecipientEmail()
    if (!recipient) {
      Alert.alert('Keine E-Mail', 'Bitte unter Kunde oder BV eine E-Mail für Wartungsprotokoll eintragen.')
      return
    }
    if (!customer || !bv || !object) return
    setSendingEmailFor(r.id)
    try {
      const smokeDetectors = await fetchMaintenanceReportSmokeDetectors(r.id)
      const sds = smokeDetectors.map((sd) => ({ label: sd.smoke_detector_label, status: sd.status }))
      const html = generateMaintenanceHtml({
        report: r,
        customer,
        bv,
        object,
        smokeDetectors: sds,
      })
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      const { path, error: uploadError } = await uploadMaintenancePdf(r.id, base64)
      if (uploadError || !path) {
        Alert.alert('Fehler', uploadError?.message ?? 'PDF konnte nicht hochgeladen werden.')
        return
      }
      const filename = `Wartungsprotokoll_${r.maintenance_date}_${object.internal_id || r.id}.pdf`
      const subject = `Wartungsprotokoll ${object.internal_id ?? 'Objekt'} – ${r.maintenance_date}`
      const { error: sendError } = await sendMaintenanceReportEmail(path, recipient, subject, filename)
      if (sendError) {
        Alert.alert('Fehler', `E-Mail konnte nicht gesendet werden: ${sendError.message}`)
        return
      }
      Alert.alert('Gesendet', `Wartungsprotokoll wurde an ${recipient} gesendet.`)
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setSendingEmailFor(null)
    }
  }

  const handleGoBack = () => {
    ;(navigation as { navigate: (a: string, b: object) => void }).navigate(
      'Objekte',
      { customerId, bvId }
    )
  }

  if (!customerId || !bvId || !objectId) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Ungültige Navigation.</Text>
      </View>
    )
  }

  if (loading || !customer || !bv || !object) {
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
          accessibilityLabel="Zurück zu Objekten"
          accessibilityRole="button"
        >
          <Text style={styles.breadcrumbText}>
            ← {object.internal_id || 'Objekt'}
          </Text>
        </Pressable>
        <Text style={styles.title}>Wartungsprotokolle</Text>
        <Text style={styles.subtitle}>
          {customer.name} · {bv.name}
        </Text>
        {canEdit && (
          <Pressable
            style={styles.addButton}
            onPress={handleOpenCreate}
            accessible
            accessibilityLabel="Neues Wartungsprotokoll"
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+ Neues Protokoll</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {reports.length === 0 ? (
          <Text style={styles.empty}>Noch keine Wartungsprotokolle.</Text>
        ) : (
          reports.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardDate}>{r.maintenance_date}</Text>
              <Text style={styles.cardMeta}>
                {r.reason ? REASON_LABELS[r.reason] : '-'}
                {r.deficiencies_found ? ' · Mängel' : ''}
              </Text>
              {canEdit && (
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.emailBtn}
                    onPress={() => handleSendEmail(r)}
                    disabled={!getRecipientEmail() || sendingEmailFor === r.id}
                    accessible
                    accessibilityLabel="E-Mail senden"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.emailBtnText, (!getRecipientEmail() || sendingEmailFor === r.id) && { opacity: 0.5 }]}>
                      {sendingEmailFor === r.id ? 'Sende…' : 'E-Mail'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(r)}
                    accessible
                    accessibilityLabel="Protokoll löschen"
                    accessibilityRole="button"
                  >
                    <Text style={styles.deleteText}>Löschen</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

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
              <Text style={styles.modalTitle}>Neues Wartungsprotokoll</Text>

              <Text style={styles.label}>Datum *</Text>
              <TextInput
                style={styles.input}
                value={formData.maintenance_date}
                onChangeText={(v) => handleFormChange('maintenance_date', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Uhrzeit</Text>
              <TextInput
                style={styles.input}
                value={formData.maintenance_time}
                onChangeText={(v) => handleFormChange('maintenance_time', v)}
                placeholder="HH:MM"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Prüfgrund</Text>
              <View style={styles.optionRow}>
                {(Object.keys(REASON_LABELS) as MaintenanceReason[]).map(
                  (k) => (
                    <Pressable
                      key={k}
                      style={[
                        styles.optionChip,
                        formData.reason === k && styles.optionChipActive,
                      ]}
                      onPress={() => handleFormChange('reason', k)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          formData.reason === k && styles.optionChipTextActive,
                        ]}
                      >
                        {REASON_LABELS[k]}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
              {formData.reason === 'sonstiges' && (
                <>
                  <Text style={styles.label}>Sonstiges (Text)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.reason_other}
                    onChangeText={(v) => handleFormChange('reason_other', v)}
                    placeholder="Details"
                    placeholderTextColor="#94a3b8"
                  />
                </>
              )}

              <View style={styles.toggleRow}>
                <Text style={styles.label}>
                  Wartung nach Herstellerangaben durchgeführt
                </Text>
                <Switch
                  value={formData.manufacturer_maintenance_done}
                  onValueChange={(v) =>
                    handleFormChange('manufacturer_maintenance_done', v)
                  }
                />
              </View>
              {object.has_hold_open && (
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>Feststellanlage geprüft</Text>
                  <Switch
                    value={formData.hold_open_checked}
                    onValueChange={(v) =>
                      handleFormChange('hold_open_checked', v)
                    }
                  />
                </View>
              )}

              {formData.smoke_detector_statuses.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Rauchmelder</Text>
                  {formData.smoke_detector_statuses.map((sd, i) => (
                    <View key={i} style={styles.smokeRow}>
                      <Text style={styles.smokeLabel}>{sd.label}</Text>
                      <View style={styles.smokeOptions}>
                        {(Object.keys(STATUS_LABELS) as SmokeDetectorStatus[]).map(
                          (s) => (
                            <Pressable
                              key={s}
                              style={[
                                styles.smokeChip,
                                sd.status === s && styles.optionChipActive,
                              ]}
                              onPress={() =>
                                handleSmokeDetectorStatusChange(i, s)
                              }
                            >
                              <Text
                                style={[
                                  styles.smokeChipText,
                                  sd.status === s && styles.optionChipTextActive,
                                ]}
                              >
                                {STATUS_LABELS[s]}
                              </Text>
                            </Pressable>
                          )
                        )}
                      </View>
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.label}>Techniker (Druckschrift)</Text>
              <TextInput
                style={styles.input}
                value={formData.technician_name_printed}
                onChangeText={(v) => handleFormChange('technician_name_printed', v)}
                placeholder="Name Techniker"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Kunde (Druckschrift)</Text>
              <TextInput
                style={styles.input}
                value={formData.customer_name_printed}
                onChangeText={(v) => handleFormChange('customer_name_printed', v)}
                placeholder="Name Kunde"
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.toggleRow}>
                <Text style={styles.label}>Neue Mängel festgestellt</Text>
                <Switch
                  value={formData.deficiencies_found}
                  onValueChange={(v) =>
                    handleFormChange('deficiencies_found', v)
                  }
                />
              </View>
              {formData.deficiencies_found && (
                <>
                  <Text style={styles.label}>Beschreibung</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formData.deficiency_description}
                    onChangeText={(v) =>
                      handleFormChange('deficiency_description', v)
                    }
                    placeholder="Mängel beschreiben"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  <Text style={styles.label}>Dringlichkeit</Text>
                  <View style={styles.optionRow}>
                    {(Object.keys(URGENCY_LABELS) as MaintenanceUrgency[]).map(
                      (k) => (
                        <Pressable
                          key={k}
                          style={[
                            styles.optionChip,
                            formData.urgency === k && styles.optionChipActive,
                          ]}
                          onPress={() => handleFormChange('urgency', k)}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              formData.urgency === k &&
                                styles.optionChipTextActive,
                            ]}
                          >
                            {URGENCY_LABELS[k]}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.label}>Sofort behoben</Text>
                    <Switch
                      value={formData.fixed_immediately}
                      onValueChange={(v) =>
                        handleFormChange('fixed_immediately', v)
                      }
                    />
                  </View>
                </>
              )}

              {formError && (
                <Text style={styles.formError}>{formError}</Text>
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
  container: { flex: 1, backgroundColor: '#5b7895' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: { color: '#dc2626', padding: 16 },
  header: {
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#5b7895',
  },
  breadcrumb: { marginBottom: 4 },
  breadcrumbText: { color: '#334155', fontSize: 14 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 16 },
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
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 48 },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardDate: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardMeta: { fontSize: 14, color: '#64748b', marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 12, alignItems: 'center' },
  emailBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  emailBtnText: { fontSize: 14, color: '#059669', fontWeight: '600' },
  actionBtn: {},
  deleteBtn: {},
  deleteText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
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
  textArea: { minHeight: 60 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  optionChipActive: { backgroundColor: '#059669' },
  optionChipText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  optionChipTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  smokeRow: { marginTop: 12 },
  smokeLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6 },
  smokeOptions: { flexDirection: 'row', gap: 8 },
  smokeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  smokeChipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  formError: { color: '#dc2626', fontSize: 14, marginTop: 12 },
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
  buttonDisabled: { opacity: 0.6 },
})

export default WartungsprotokolleScreen
