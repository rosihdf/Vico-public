import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchCustomers,
  fetchAllBvs,
  fetchObjects,
  fetchOrders,
  createOrder,
  updateOrderStatus,
  updateOrderAssignedTo,
  updateOrderDate,
  deleteOrder,
} from '../lib/dataService'
import { subscribeToOrderChanges } from '../lib/orderRealtime'
import { subscribeToProfileChanges } from '../lib/profileRealtime'
import { fetchProfiles, getProfileDisplayName } from '../lib/userService'
import { OrderCalendar } from '../components/OrderCalendar'
import { getSupabaseErrorMessage } from '../lib/supabaseErrors'
import type { Order, Customer, BV, Object as Obj, OrderType, OrderStatus } from '../lib/types'
import type { Profile } from '../lib/userService'

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  storniert: 'Storniert',
}

const getStatusColor = (status: OrderStatus): string => {
  if (status === 'offen') return '#d97706'
  if (status === 'in_bearbeitung') return '#2563eb'
  return '#64748b'
}

type SelectModalProps<T extends string> = {
  visible: boolean
  onClose: () => void
  options: { value: T; label: string }[]
  onSelect: (value: T) => void
  title: string
}

const SelectModal = <T extends string>({
  visible,
  onClose,
  options,
  onSelect,
  title,
}: SelectModalProps<T>) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <Pressable style={modalStyles.overlay} onPress={onClose}>
      <Pressable style={modalStyles.content} onPress={(e) => e.stopPropagation()}>
        <Text style={modalStyles.title}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <Pressable
              style={modalStyles.option}
              onPress={() => {
                onSelect(item.value)
                onClose()
              }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={modalStyles.optionText}>{item.label}</Text>
            </Pressable>
          )}
        />
        <Pressable style={modalStyles.cancelButton} onPress={onClose}>
          <Text style={modalStyles.cancelText}>Abbrechen</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  </Modal>
)

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionText: {
    fontSize: 16,
    color: '#0f172a',
  },
  cancelButton: {
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#64748b',
  },
})

const AuftragAnlegenScreen = () => {
  const navigation = useNavigation()
  const route = useRoute<{ params?: { orderId?: string } }>()
  const initialOrderId = route.params?.orderId
  const { user, userRole } = useAuth()
  const canAssign = userRole === 'admin'
  const canEdit = userRole !== 'leser'
  const [orders, setOrders] = useState<Order[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [objects, setObjects] = useState<Obj[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [bvId, setBvId] = useState('')
  const [objectId, setObjectId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [orderType, setOrderType] = useState<OrderType>('wartung')
  const [status, setStatus] = useState<OrderStatus>('offen')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeModal, setActiveModal] = useState<
    'customer' | 'bv' | 'object' | 'orderType' | 'status' | 'assignedTo' | null
  >(null)
  const [editingOrder, setEditingOrder] = useState<
    { order: Order; field: 'status' | 'assignedTo' | 'date' } | null
  >(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(initialOrderId ? 'list' : 'list')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const [orderData, customerData, bvData, profileData] = await Promise.all([
      fetchOrders(),
      fetchCustomers(),
      fetchAllBvs(),
      canAssign ? fetchProfiles() : Promise.resolve([]),
    ])
    setOrders(orderData ?? [])
    setCustomers((customerData ?? []) as Customer[])
    setBvs((bvData ?? []) as BV[])
    setProfiles(profileData ?? [])
    setIsLoading(false)
  }, [canAssign])

  const loadObjectsForBv = useCallback(async () => {
    if (!bvId) {
      setObjects([])
      return
    }
    const objData = await fetchObjects(bvId)
    setObjects((objData ?? []) as Obj[])
  }, [bvId])

  useEffect(() => {
    loadObjectsForBv()
  }, [loadObjectsForBv])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const unsubOrders = subscribeToOrderChanges(loadData)
    const unsubProfiles = subscribeToProfileChanges(loadData)
    return () => {
      unsubOrders()
      unsubProfiles()
    }
  }, [loadData])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  const bvsForCustomer = bvs.filter((b) => b.customer_id === customerId)
  const objectsForBv = objects.filter((o) => o.bv_id === bvId)
  const displayOrders =
    userRole === 'admin' || userRole === 'leser'
      ? orders
      : user
        ? orders.filter((o) => o.assigned_to === user.id)
        : []

  const getCustomerName = (id: string) =>
    customers.find((c) => c.id === id)?.name ?? '-'
  const getBvName = (id: string) => bvs.find((b) => b.id === id)?.name ?? '-'
  const getProfileLabel = (id: string | null) => {
    if (!id) return '-'
    const p = profiles.find((p) => p.id === id)
    if (!p) return id.slice(0, 8)
    return p.first_name || p.last_name
      ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
      : (p.email ?? id.slice(0, 8))
  }

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    const { error } = await updateOrderStatus(order.id, newStatus)
    if (!error) loadData()
    setEditingOrder(null)
  }

  const handleAssignmentChange = async (
    order: Order,
    assignedTo: string | null
  ) => {
    const { error } = await updateOrderAssignedTo(
      order.id,
      assignedTo?.trim() || null
    )
    if (!error) loadData()
    setEditingOrder(null)
  }

  const handleDateChange = async (order: Order, newDate: string) => {
    const { error } = await updateOrderDate(order.id, newDate)
    if (!error) loadData()
  }

  const handleDeleteOrder = (order: Order) => {
    Alert.alert(
      'Auftrag löschen',
      `Auftrag am ${order.order_date} wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteOrder(order.id)
            if (!error) loadData()
          },
        },
      ]
    )
  }

  const handleNavigateToObjekte = (order: Order) => {
    ;(navigation as { navigate: (a: string, b: object) => void }).navigate(
      'Kunden',
      {
        screen: 'Objekte',
        params: {
          customerId: order.customer_id,
          bvId: order.bv_id,
        },
      }
    )
  }

  const handleSave = async () => {
    if (!customerId || !bvId) {
      setFormError('Kunde und BV sind erforderlich.')
      return
    }
    setFormError(null)
    setIsSaving(true)
    const { data, error } = await createOrder(
      {
        customer_id: customerId,
        bv_id: bvId,
        object_id: objectId.trim() || null,
        order_date: orderDate,
        order_type: orderType,
        status,
        description: description.trim() || null,
        assigned_to: canAssign && assignedTo ? assignedTo : null,
      },
      user?.id ?? null
    )
    setIsSaving(false)
    if (error) {
      setFormError(getSupabaseErrorMessage({ message: error.message }))
      return
    }
    if (data) {
      setOrders((prev) => [data, ...prev])
      setShowForm(false)
      setCustomerId('')
      setBvId('')
      setObjectId('')
      setDescription('')
      setAssignedTo('')
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    )
  }

  const dateOptions = (() => {
    const opts: { value: string; label: string }[] = []
    const base = new Date()
    for (let i = -14; i <= 60; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      const str = d.toISOString().slice(0, 10)
      const label = i === 0 ? 'Heute' : i === 1 ? 'Morgen' : str
      opts.push({ value: str, label })
    }
    return opts
  })()

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#059669']} />
      }
    >
      <Text style={styles.title}>Auftrag anlegen</Text>

      <View style={styles.viewToggle}>
        <Pressable
          style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>
            Liste
          </Text>
        </Pressable>
        <Pressable
          style={[styles.viewToggleBtn, viewMode === 'calendar' && styles.viewToggleBtnActive]}
          onPress={() => setViewMode('calendar')}
        >
          <Text style={[styles.viewToggleText, viewMode === 'calendar' && styles.viewToggleTextActive]}>
            Kalender
          </Text>
        </Pressable>
      </View>

      {viewMode === 'calendar' && (
        <OrderCalendar
          orders={displayOrders}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          currentMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
          getCustomerName={getCustomerName}
          getBvName={getBvName}
        />
      )}

      {!showForm ? (
        canEdit && (
          <Pressable
            style={styles.primaryButton}
            onPress={() => setShowForm(true)}
            accessible
            accessibilityLabel="Neuen Auftrag anlegen"
          >
            <Text style={styles.primaryButtonText}>+ Neuer Auftrag</Text>
          </Pressable>
        )
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Kunde *</Text>
          <Pressable
            style={styles.dropdown}
            onPress={() => setActiveModal('customer')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Kunde auswählen"
          >
            <Text
              style={[
                styles.dropdownText,
                !customerId && styles.dropdownPlaceholderText,
              ]}
            >
              {customerId
                ? customers.find((c) => c.id === customerId)?.name ?? customerId
                : '– Kunde wählen –'}
            </Text>
            <Text style={styles.dropdownChevron}>▼</Text>
          </Pressable>

          <Text style={styles.label}>BV *</Text>
          <Pressable
            style={[
              styles.dropdown,
              !customerId && styles.dropdownDisabled,
            ]}
            onPress={() => customerId && setActiveModal('bv')}
            disabled={!customerId}
            accessible
            accessibilityRole="button"
            accessibilityLabel="BV auswählen"
          >
            <Text
              style={[
                styles.dropdownText,
                !bvId && styles.dropdownPlaceholderText,
              ]}
            >
              {bvId
                ? bvsForCustomer.find((b) => b.id === bvId)?.name ?? bvId
                : '– BV wählen –'}
            </Text>
            <Text style={styles.dropdownChevron}>▼</Text>
          </Pressable>

          <Text style={styles.label}>Objekt (optional)</Text>
          <Pressable
            style={[styles.dropdown, !bvId && styles.dropdownDisabled]}
            onPress={() => bvId && setActiveModal('object')}
            disabled={!bvId}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Objekt auswählen"
          >
            <Text
              style={[
                styles.dropdownText,
                !objectId && styles.dropdownPlaceholderText,
              ]}
            >
              {objectId
                ? objectsForBv.find((o) => o.id === objectId)?.internal_id ??
                  objectId.slice(0, 8)
                : '– Keins –'}
            </Text>
            <Text style={styles.dropdownChevron}>▼</Text>
          </Pressable>

          <Text style={styles.label}>Datum</Text>
          <TextInput
            style={styles.input}
            value={orderDate}
            onChangeText={setOrderDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Auftragstyp</Text>
          <Pressable
            style={styles.dropdown}
            onPress={() => setActiveModal('orderType')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Auftragstyp auswählen"
          >
            <Text style={styles.dropdownText}>{ORDER_TYPE_LABELS[orderType]}</Text>
            <Text style={styles.dropdownChevron}>▼</Text>
          </Pressable>

          <Text style={styles.label}>Status</Text>
          <Pressable
            style={styles.dropdown}
            onPress={() => setActiveModal('status')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Status auswählen"
          >
            <Text style={styles.dropdownText}>{ORDER_STATUS_LABELS[status]}</Text>
            <Text style={styles.dropdownChevron}>▼</Text>
          </Pressable>

          {canAssign && (
            <>
              <Text style={styles.label}>Zugewiesen an</Text>
              <Pressable
                style={styles.dropdown}
                onPress={() => setActiveModal('assignedTo')}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Zugewiesenen Benutzer auswählen"
              >
                <Text style={styles.dropdownText}>
                  {assignedTo
                    ? getProfileLabel(assignedTo)
                    : '– Keiner –'}
                </Text>
                <Text style={styles.dropdownChevron}>▼</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.label}>Beschreibung</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optionale Beschreibung"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
          />

          {formError && (
            <Text style={styles.error}>{formError}</Text>
          )}

          <SelectModal
            visible={activeModal === 'customer'}
            onClose={() => setActiveModal(null)}
            title="Kunde wählen"
            options={[
              { value: '', label: '– Kunde wählen –' },
              ...customers.map((c) => ({ value: c.id, label: c.name })),
            ]}
            onSelect={(v) => {
              setCustomerId(v)
              setBvId('')
              setObjectId('')
            }}
          />
          <SelectModal
            visible={activeModal === 'bv'}
            onClose={() => setActiveModal(null)}
            title="BV wählen"
            options={[
              { value: '', label: '– BV wählen –' },
              ...bvsForCustomer.map((b) => ({ value: b.id, label: b.name })),
            ]}
            onSelect={(v) => {
              setBvId(v)
              setObjectId('')
            }}
          />
          <SelectModal
            visible={activeModal === 'object'}
            onClose={() => setActiveModal(null)}
            title="Objekt (optional)"
            options={[
              { value: '', label: '– Keins –' },
              ...objectsForBv.map((o) => ({
                value: o.id,
                label: o.internal_id || o.id.slice(0, 8),
              })),
            ]}
            onSelect={setObjectId}
          />
          <SelectModal
            visible={activeModal === 'orderType'}
            onClose={() => setActiveModal(null)}
            title="Auftragstyp"
            options={(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((k) => ({
              value: k,
              label: ORDER_TYPE_LABELS[k],
            }))}
            onSelect={(v) => setOrderType(v)}
          />
          <SelectModal
            visible={activeModal === 'status'}
            onClose={() => setActiveModal(null)}
            title="Status"
            options={(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((k) => ({
              value: k,
              label: ORDER_STATUS_LABELS[k],
            }))}
            onSelect={(v) => setStatus(v)}
          />
          {canAssign && (
            <SelectModal
              visible={activeModal === 'assignedTo'}
              onClose={() => setActiveModal(null)}
              title="Zugewiesen an"
              options={[
                { value: '', label: '– Keiner –' },
                ...profiles.map((p) => ({
                  value: p.id,
                  label: getProfileDisplayName(p),
                })),
              ]}
              onSelect={setAssignedTo}
            />
          )}

          <View style={styles.formButtons}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowForm(false)}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
            >
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Auftrag speichern"
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Speichern…' : 'Speichern'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {viewMode === 'list' && (
        <View style={styles.list}>
          <View style={styles.listTitleRow}>
            <Text style={styles.listTitle}>
              {initialOrderId ? 'Auftrag' : 'Letzte Aufträge'}
            </Text>
            {initialOrderId && (
              <Pressable
                onPress={() => navigation.setParams({ orderId: undefined })}
                style={styles.showAllBtn}
                accessible
                accessibilityLabel="Alle Aufträge anzeigen"
                accessibilityRole="button"
              >
                <Text style={styles.showAllBtnText}>Alle Aufträge</Text>
              </Pressable>
            )}
          </View>
          {!isLoading && initialOrderId && displayOrders.every((o) => o.id !== initialOrderId) ? (
            <Text style={styles.orderNotFound}>Auftrag nicht gefunden</Text>
          ) : (
          (initialOrderId
            ? displayOrders.filter((o) => o.id === initialOrderId)
            : displayOrders.slice(0, 10)
          ).map((o) => (
            <View
              key={o.id}
              style={[
                styles.orderCard,
                !o.assigned_to && styles.orderCardUnassigned,
              ]}
            >
              <View style={styles.orderCardMain}>
              <Text style={styles.orderCardTitle}>
                {getCustomerName(o.customer_id)} → {getBvName(o.bv_id)}
                {!o.assigned_to && (
                  <Text style={styles.orderUnassignedBadge}> (nicht zugewiesen)</Text>
                )}
              </Text>
              <Text style={styles.orderCardMeta}>
                {o.order_date} · {ORDER_TYPE_LABELS[o.order_type]} ·{' '}
                <Text style={{ color: getStatusColor(o.status) }}>
                  {ORDER_STATUS_LABELS[o.status]}
                </Text>
                {o.assigned_to ? (
                  <Text style={styles.orderAssigned}>
                    {' '}
                    → {getProfileLabel(o.assigned_to)}
                  </Text>
                ) : null}
              </Text>
              {o.description ? (
                <Text
                  style={styles.orderDescription}
                  numberOfLines={2}
                >
                  {o.description}
                </Text>
              ) : null}
            </View>
            <View style={styles.orderCardActions}>
              {canEdit && (
                <>
                  <Pressable
                    style={styles.orderActionBtn}
                    onPress={() => setEditingOrder({ order: o, field: 'date' })}
                    accessible
                    accessibilityLabel="Termin ändern"
                    accessibilityRole="button"
                  >
                    <Text style={styles.orderActionText}>{o.order_date}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.orderActionBtn}
                    onPress={() => setEditingOrder({ order: o, field: 'status' })}
                    accessible
                    accessibilityLabel="Status ändern"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.orderActionText, { color: getStatusColor(o.status) }]}>
                      {ORDER_STATUS_LABELS[o.status]}
                    </Text>
                  </Pressable>
                </>
              )}
              {canAssign && (
                <Pressable
                  style={styles.orderActionBtn}
                  onPress={() =>
                    setEditingOrder({ order: o, field: 'assignedTo' })
                  }
                  accessible
                  accessibilityLabel="Zuweisung ändern"
                  accessibilityRole="button"
                >
                  <Text style={styles.orderActionText}>
                    {o.assigned_to
                      ? getProfileLabel(o.assigned_to)
                      : 'Zuweisen'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={styles.orderActionBtn}
                onPress={() => handleNavigateToObjekte(o)}
                accessible
                accessibilityLabel="Zu Objekten navigieren"
                accessibilityRole="button"
              >
                <Text style={styles.orderActionText}>Objekte</Text>
              </Pressable>
              {canEdit && (
                <Pressable
                  style={[styles.orderActionBtn, styles.orderDeleteBtn]}
                  onPress={() => handleDeleteOrder(o)}
                  accessible
                  accessibilityLabel="Auftrag löschen"
                  accessibilityRole="button"
                >
                  <Text style={styles.orderDeleteText}>Löschen</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))
          )}
        </View>
      )}

      {editingOrder?.field === 'date' && (
        <SelectModal
          visible
          onClose={() => setEditingOrder(null)}
          title="Termin"
          options={dateOptions}
          onSelect={(v) => {
            if (editingOrder) handleDateChange(editingOrder.order, v)
            setEditingOrder(null)
          }}
        />
      )}
      {editingOrder?.field === 'status' && (
        <SelectModal
          visible
          onClose={() => setEditingOrder(null)}
          title="Status"
          options={(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map(
            (k) => ({ value: k, label: ORDER_STATUS_LABELS[k] })
          )}
          onSelect={(v) =>
            handleStatusChange(editingOrder.order, v as OrderStatus)
          }
        />
      )}
      {editingOrder?.field === 'assignedTo' && (
        <SelectModal
          visible
          onClose={() => setEditingOrder(null)}
          title="Zugewiesen an"
          options={[
            { value: '', label: '– Keiner –' },
            ...profiles.map((p) => ({
              value: p.id,
              label: getProfileDisplayName(p),
            })),
          ]}
          onSelect={(v) =>
            handleAssignmentChange(editingOrder.order, v || null)
          }
        />
      )}
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
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    minHeight: 80,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dropdownPlaceholderText: {
    color: '#94a3b8',
  },
  dropdownDisabled: {
    opacity: 0.6,
  },
  dropdownText: {
    fontSize: 16,
    color: '#0f172a',
    flex: 1,
  },
  dropdownChevron: {
    fontSize: 10,
    color: '#64748b',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  viewToggleBtnActive: {
    backgroundColor: '#e2e8f0',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  viewToggleTextActive: {
    color: '#0f172a',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1.4,
    padding: 16,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    flex: 2,
    padding: 16,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#059669',
    justifyContent: 'center',
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
  list: {
    marginTop: 8,
  },
  listTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  showAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  showAllBtnText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  orderNotFound: {
    fontSize: 14,
    color: '#64748b',
    paddingVertical: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderCardUnassigned: {
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  orderUnassignedBadge: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '400',
  },
  orderCardMain: {
    marginBottom: 12,
  },
  orderCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  orderCardMeta: {
    fontSize: 14,
    color: '#64748b',
  },
  orderAssigned: {
    color: '#475569',
  },
  orderDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
  orderCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  orderActionText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  orderDeleteBtn: {
    backgroundColor: '#fee2e2',
  },
  orderDeleteText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
  },
})

export default AuftragAnlegenScreen
