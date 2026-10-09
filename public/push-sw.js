// Loaded into the app's service worker (workbox importScripts): shows the countdown reminders.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || 'Confra da Firma', {
      body: data.body || '',
      tag: data.tag || 'confra',
      renotify: true,
      icon: scope + 'icon-192.png',
      badge: scope + 'icon-192.png',
      data: { url: scope },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(url) && 'focus' in c) return c.focus()
      return self.clients.openWindow(url)
    }),
  )
})
