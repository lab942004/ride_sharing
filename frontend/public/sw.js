// Service Worker for Web Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'RideShare', body: 'You have a new notification', url: '/#/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // fall back to defaults if payload isn't valid JSON
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url || '/#/' },
    })
  )
})

// Handle notification click — open the app at the target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/#/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})