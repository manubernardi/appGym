// Service worker: guarda la app (y las librerías) para que abra sin internet.
// Los datos los maneja Firestore con su propia caché offline.
// Al publicar cambios, subí el número de versión para forzar la actualización.

const CACHE = 'gimnasio-v1';
const APP_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './js/app.js',
  './js/db.js',
  './js/store.js',
  './js/ui.js',
  './js/data.js',
  './js/stats.js',
  './js/firebase-config.js',
  './js/views/train.js',
  './js/views/plan.js',
  './js/views/progress.js',
  './js/views/more.js',
  './js/views/exercises.js',
];
const CDN_HOSTS = ['www.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return; // Firebase/Google: directo a la red
  if (!sameOrigin && url.hostname === 'www.gstatic.com' && !url.pathname.startsWith('/firebasejs/')) return;

  // Responde rápido desde la caché y la actualiza en segundo plano.
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
