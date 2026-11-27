/* hin's poker PWA service worker — v7.10
   Navigations: network-first (always fresh HTML)
   Static assets: cache-first with background update */
const CACHE = 'hin-poker-v710';
const ASSETS = [
  './',
  './index.html',
  './css/style.css?v=v7.10',
  './js/main.js?v=v7.10',
  './js/game.js',
  './js/deck.js',
  './js/evaluator.js',
  './js/ai.js',
  './js/audio.js',
  './js/net.js',
  './js/coach.js',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isNavigation = e.request.mode === 'navigate' || e.request.destination === 'document';
  if (isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((cached) => cached || caches.match('./index.html')),
        ),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});
