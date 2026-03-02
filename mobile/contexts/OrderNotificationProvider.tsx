import React, { useEffect } from 'react'
import { subscribeToNewOrders, requestNotificationPermissions } from '../lib/orderNotificationService'
import { useAuth } from './AuthContext'

export const OrderNotificationProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const { user } = useAuth()
  const userId = user?.id ?? null

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const setup = async () => {
      const granted = await requestNotificationPermissions()
      if (!granted) return

      unsubscribe = subscribeToNewOrders(userId)
    }

    setup()
    return () => {
      unsubscribe?.()
    }
  }, [userId])

  return <>{children}</>
}
