import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyProfile, getProfileDisplayName, type Profile } from '../lib/userService'
import { fetchOrdersAssignedTo, fetchMaintenanceReminders } from '../lib/dataService'
import { subscribeToOrderChanges } from '../lib/orderRealtime'
import type { Order, OrderType, OrderStatus, MaintenanceReminder } from '../lib/types'
import type { StartStackParamList } from '../navigation/AppNavigator'

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

const DAY_STATUS_COLORS: Record<OrderStatus, string> = {
  offen: '#d97706',
  in_bearbeitung: '#2563eb',
  erledigt: '#64748b',
  storniert: '#94a3b8',
}

const formatDayStatusSummaryLines = (
  orders: Order[]
): { status: OrderStatus; text: string }[] => {
  const counts: Record<OrderStatus, number> = {
    offen: 0,
    in_bearbeitung: 0,
    erledigt: 0,
    storniert: 0,
  }
  orders.forEach((o) => {
    const s = o.status ?? 'offen'
    counts[s] = (counts[s] ?? 0) + 1
  })
  const abbrev: Record<OrderStatus, string> = {
    offen: 'offen',
    in_bearbeitung: 'i.B.',
    erledigt: 'erl.',
    storniert: 'storn.',
  }
  const result: { status: OrderStatus; text: string }[] = []
  ;(['offen', 'in_bearbeitung', 'erledigt', 'storniert'] as OrderStatus[]).forEach(
    (s) => {
      const n = counts[s]
      if (n > 0) result.push({ status: s, text: `${n} ${abbrev[s]}` })
    }
  )
  return result
}

const formatOrderDate = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y.slice(2)}`
}

const getWeekDates = () => {
  const today = new Date()
  const start = new Date(today)
  const daysFromMonday = today.getDay() === 0 ? 6 : today.getDay() - 1
  start.setDate(today.getDate() - daysFromMonday)
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const StartseiteScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<StartStackParamList, 'Startseite'>>()
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setProfile(null)
      setOrders([])
      setReminders([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const [profileData, ords, reminderData] = await Promise.all([
      fetchMyProfile(user.id),
      fetchOrdersAssignedTo(user.id),
      fetchMaintenanceReminders(),
    ])
    setProfile(profileData ?? null)
    setOrders(ords ?? [])
    setReminders(reminderData ?? [])
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const unsub = subscribeToOrderChanges(loadData)
    return unsub
  }, [loadData])

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Lade Dashboard…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        {profile
          ? `Hallo, ${getProfileDisplayName(profile)}! Willkommen bei Vico Türen & Tore.`
          : 'Willkommen bei Vico Türen & Tore.'}
      </Text>

      {user && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aufträge diese Woche</Text>
          <View style={styles.weekGrid}>
            {getWeekDates().map((d, i) => {
              const dayOrders = orders.filter(
                (o) => o.order_date === d && o.status !== 'erledigt' && o.status !== 'storniert'
              )
              const dayNum = new Date(d + 'T12:00:00').getDate()
              const isToday = d === new Date().toISOString().slice(0, 10)
              return (
                <View
                  key={d}
                  style={[
                    styles.weekDay,
                    isToday && styles.weekDayToday,
                  ]}
                >
                  <Text style={styles.weekDayName}>{DAY_NAMES[i]}</Text>
                  <Text style={styles.weekDayNum}>{dayNum}</Text>
                  {dayOrders.length > 0 && (
                    <View style={styles.weekDayStatusList}>
                      {formatDayStatusSummaryLines(dayOrders).map(({ status, text }) => (
                        <Text
                          key={status}
                          style={[styles.weekDayCount, { color: DAY_STATUS_COLORS[status] }]}
                        >
                          {text}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
          <Pressable
            style={styles.weekLink}
            onPress={() =>
              (navigation.getParent() as { navigate: (a: string, b?: object) => void })?.navigate(
                'Auftrag'
              )
            }
          >
            <Text style={styles.weekLinkText}>Kalender & Aufträge →</Text>
          </Pressable>
        </View>
      )}

      {user && reminders.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wartung fällig</Text>
          <View style={styles.orderList}>
            {reminders.map((r) => (
              <Pressable
                key={r.object_id}
                style={styles.reminderRow}
                onPress={() =>
                  (navigation.getParent() as { navigate: (a: string, b?: { screen: string; params: { customerId: string; bvId: string } }) => void })?.navigate(
                    'Kunden',
                    { screen: 'Objekte', params: { customerId: r.customer_id, bvId: r.bv_id } }
                  )
                }
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Objekt ${r.internal_id ?? r.object_id} öffnen`}
              >
                <Text style={styles.reminderTitle} numberOfLines={1}>
                  {r.customer_name} → {r.bv_name}
                  {r.internal_id ? ` · ${r.internal_id}` : ''}
                </Text>
                <Text
                  style={[
                    styles.reminderStatus,
                    r.status === 'overdue' ? { color: '#dc2626' } : { color: '#d97706' },
                  ]}
                >
                  {r.status === 'overdue'
                    ? r.last_maintenance_date
                      ? `Überfällig (letzte: ${r.last_maintenance_date})`
                      : 'Überfällig (noch nie gewartet)'
                    : `Fällig: ${r.next_maintenance_date}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {orders.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meine Aufträge</Text>
          <View style={styles.orderList}>
            {orders.filter((o) => o.status !== 'erledigt').slice(0, 5).map((o) => (
              <Pressable
                key={o.id}
                style={styles.orderRow}
                onPress={() =>
                  (navigation.getParent() as { navigate: (screen: string, params?: { orderId: string }) => void })?.navigate(
                    'Auftrag',
                    { orderId: o.id }
                  )
                }
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Auftrag ${formatOrderDate(o.order_date)} öffnen`}
              >
                <Text style={styles.orderDate} numberOfLines={1}>{formatOrderDate(o.order_date)}</Text>
                <Text style={styles.orderType}>{ORDER_TYPE_LABELS[o.order_type]}</Text>
                <Text style={[styles.orderStatus, { color: DAY_STATUS_COLORS[o.status ?? 'offen'] }]}>
                  {ORDER_STATUS_LABELS[o.status]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate('Kunden')}
        accessible
        accessibilityLabel="Kunden öffnen"
      >
        <Text style={styles.primaryButtonText}>Kunden</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5b7895',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#334155',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  subtitle: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 4,
    marginBottom: 12,
  },
  weekDay: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  weekDayToday: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  weekDayName: {
    fontSize: 11,
    color: '#64748b',
  },
  weekDayNum: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 2,
  },
  weekDayStatusList: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  weekDayCount: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  weekLink: {
    paddingVertical: 4,
  },
  weekLinkText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  orderList: {
    gap: 12,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  orderDate: { fontSize: 14, fontWeight: '600', color: '#0f172a', minWidth: 56, maxWidth: 64, textAlign: 'left' },
  orderType: { fontSize: 14, color: '#475569', flex: 1, textAlign: 'left' },
  orderStatus: { fontSize: 13, fontWeight: '600', minWidth: 70, textAlign: 'left' },
  reminderRow: {
    flexDirection: 'column',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  reminderTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  reminderStatus: { fontSize: 13, fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
})

export default StartseiteScreen
