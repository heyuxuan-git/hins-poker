/* hin's poker PWA service worker */
const CACHE = 'hin-poker-v5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css?v=v5.0',
  './js/main.js?v=v5.0',
  './js/game.js',
  './js/deck.js',
  './js/evaluator.js',
  './js/ai.js',
  './js/audio.js',
  './js/net.js',
  './js/coach.js',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './assets/dealer.png',
  './assets/avatar-hero.png',
  './assets/avatar-chen.png',
  './assets/avatar-mei.png',
  './assets/avatar-zhou.png',
  './assets/avatar-lin.png',
  './assets/avatar-kai.png',
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
