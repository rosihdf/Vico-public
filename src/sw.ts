/// <reference lib="webworker" />
import { NetworkFirst } from 'workbox-strategies'
import { registerRoute, setCatchHandler } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

const RUNTIME_CACHE = 'vico-runtime-v1'

// Runtime-Caching: Alle App-Assets (HTML, JS, CSS) – NetworkFirst = bei Nutzung cachen, bei Offline aus Cache
// Cache wächst mit der Nutzung; bei Online wird er mit frischen Daten aktualisiert
registerRoute(
  ({ request, url }) => {
    if (request.method !== 'GET') return false
    const u = new URL(url)
    if (u.origin !== self.location.origin) return false
    if (u.pathname.startsWith('/rest/') || u.pathname.startsWith('/auth/') || u.pathname.startsWith('/realtime/')) return false
    return true
  },
  new NetworkFirst({
    cacheName: RUNTIME_CACHE,
    networkTimeoutSeconds: 5,
  })
)

// Fallback: Bei Navigation (SPA) und Cache-Miss – index.html aus Cache (z.B. von /)
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const cache = await caches.open(RUNTIME_CACHE)
    return (await cache.match('/')) ?? (await cache.match('/index.html')) ?? Response.error()
  }
  return Response.error()
})

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(Promise.resolve(clientsClaim()))
})

// Web Push: Standortanfrage-Benachrichtigung
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  const payload = event.data
  let data: { title?: string; body?: string }
  try {
    data = payload.json() as { title?: string; body?: string }
  } catch {
    data = {
      title: 'Standortanfrage',
      body: payload.text() || 'Ihr Standort wurde angefordert.',
    }
  }
  const title = data.title ?? 'Standortanfrage'
  const body = data.body ?? 'Admin/Teamleiter hat Ihren aktuellen Standort angefordert. Öffnen Sie die App, um zu antworten.'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      tag: 'standort-anfrage',
      requireInteraction: true,
      data: { url: '/arbeitszeit' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) || '/arbeitszeit'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(new URL(url, self.location.origin).href)
      }
    })
  )
})
