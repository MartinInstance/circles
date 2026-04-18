// Circles service worker — network-first strategy.
// Always serves fresh content; falls back to cache only when offline.
// No aggressive caching: the app requires live WebSocket connections.

const CACHE = 'circles-v1'
const PRECACHE = ['/', '/index.html']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Remove caches from old versions
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests; skip cross-origin (fonts, relays, etc.)
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache navigation requests (the app shell) for offline fallback
        if (e.request.mode === 'navigate' && res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
