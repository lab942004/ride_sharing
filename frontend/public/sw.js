// RideShare — Service Worker
//
// Responsibilities:
//   1. Web Push notifications (existing behaviour)
//   2. Offline support: precache the app shell (index.html, icons, manifest,
//      offline page) and apply stale-while-revalidate for static assets +
//      network-first for page navigations with an offline fallback.
//
// The service worker is registered from src/main.jsx in PRODUCTION builds only,
// so the caching below never interferes with the Vite dev server (HMR).

const CACHE_VERSION = 'rideshares-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// App shell to precache on install. Keep this list tiny and versioned —
// bump CACHE_VERSION whenever any of these files change.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const isDev = () =>
  self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      // addAll fails atomically if any request fails — ignore errors for the
      // offline page alone so an interrupted install can't block activation.
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        console.warn('[sw] precache install failed:', err.message);
      }
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Request handling ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Service workers may only answer GET/HEAD; skip everything else (POST etc.)
  if (req.method !== 'GET' && req.method !== 'HEAD') return;

  // Never intercept API / socket.io traffic (auth headers, dynamic JSON).
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // Dev mode: never run caching to avoid stale-HMR breakage.
  if (isDev()) return;

  // Cross-origin (Google Ads, fonts, CDNs) — pass straight through.
  if (url.origin !== self.location.origin) return;

  // ── Navigations (page loads / deep links): network-first, offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || caches.match('/offline.html');
        })
    );
    return;
  }

  // ── Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ── Push notifications (unchanged from before) ──────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'RideShare', body: 'You have a new notification', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // fall back to defaults if payload isn't valid JSON
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  )
})

// Handle notification click — open the app at the target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})