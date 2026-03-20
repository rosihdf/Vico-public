import { supabase } from '../supabase'
import { isOnline } from '../../shared/networkUtils'

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim()

/** Prüft, ob Web Push unterstützt ist (Browser + VAPID-Key). */
export const isPushSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  if (!VAPID_PUBLIC_KEY) return false
  return 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator
}

/** Prüft, ob eine Push-Subscription aktiv ist. */
export const hasPushSubscription = async (): Promise<boolean> => {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub != null
}

/** Fordert Benachrichtigungsberechtigung an und speichert die Subscription. */
export const subscribeToPush = async (): Promise<{ error: string | null }> => {
  if (!isPushSupported()) {
    return { error: 'Web Push wird nicht unterstützt. VITE_VAPID_PUBLIC_KEY prüfen.' }
  }
  if (!isOnline()) {
    return { error: 'Offline – Push kann nicht aktiviert werden.' }
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { error: 'Benachrichtigungen wurden abgelehnt.' }
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Subscription fehlgeschlagen.' }
    }
  }
  const json = sub.toJSON()
  const endpoint = json.endpoint ?? ''
  const p256dh = json.keys?.p256dh ?? ''
  const auth = json.keys?.auth ?? ''
  if (!endpoint || !p256dh || !auth) {
    return { error: 'Push-Subscription unvollständig.' }
  }
  const { error } = await supabase.rpc('upsert_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
  })
  return { error: error?.message ?? null }
}

/** Entfernt die Push-Subscription und löscht sie aus der DB. */
export const unsubscribeFromPush = async (): Promise<{ error: string | null }> => {
  if (!isPushSupported()) return { error: null }
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    if (isOnline()) {
      await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint })
    }
  }
  return { error: null }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Url = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Url)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
