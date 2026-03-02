import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'
import type { OrderType } from './types'

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  montage: 'Montage',
  sonstiges: 'Sonstiges',
}

const CHANNEL_ID = 'vico-orders'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Neue Aufträge',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

const showNewOrderNotification = async (order: {
  id: string
  order_date: string
  order_type: OrderType
  description: string | null
  created_by: string | null
}) => {
  const typeLabel = ORDER_TYPE_LABELS[order.order_type] ?? order.order_type
  const body = order.description
    ? `${typeLabel} – ${order.description.slice(0, 50)}${order.description.length > 50 ? '…' : ''}`
    : `${typeLabel} am ${order.order_date}`

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Neuer Auftrag',
      body,
      data: { orderId: order.id, screen: 'Auftrag' },
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: null,
  })
}

export type OrderInsertPayload = {
  new: {
    id: string
    order_date: string
    order_type: OrderType
    description: string | null
    created_by: string | null
  }
}

export const subscribeToNewOrders = (
  currentUserId: string | null,
  onNewOrder?: (order: OrderInsertPayload['new']) => void
): (() => void) => {
  const channel = supabase
    .channel('orders-insert')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        const newOrder = (payload as { new: OrderInsertPayload['new'] }).new
        if (!newOrder?.id) return
        if (newOrder.created_by === currentUserId) return
        showNewOrderNotification(newOrder)
        onNewOrder?.(newOrder)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
