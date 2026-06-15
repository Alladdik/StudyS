// Bump this on every behavioural change so the activate handler purges old caches.
const CACHE_NAME = 'ltropik-v2';
const OFFLINE_URLS = ['/', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Push notifications ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'LTropik', body: 'Нове сповіщення', icon: '/favicon.svg', url: '/' };
  try { if (event.data) Object.assign(data, event.data.json()); } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const c = cls.find(c => c.url === url);
      if (c) return c.focus();
      return clients.openWindow(url);
    })
  );
});

// ── Fetch strategy ───────────────────────────────────────────────────
// HTML/navigation → network-first: always fetch the latest index.html (with the
// current bundle hashes), falling back to cache only when offline. This is what
// fixes "need Shift+R after every deploy" — the old code served a cached index.html
// that pointed at JS bundles which no longer existed.
// Everything else (Vite content-hashed assets) → cache-first; new deploys produce
// new filenames so there is never a stale hit.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/hubs/')) return;

  const isNavigation =
    req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/', clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res.ok && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached)
    )
  );
});
