/* Service worker — Sauvetage CA2 (hors-ligne)
   Changer CACHE_VERSION à chaque mise en ligne d'une nouvelle version. */
const CACHE_VERSION = 'sauvetage-ca2-v5.3.1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css',
  './js/store.js', './js/schema.js', './js/sim.js', './js/chrono.js', './js/export.js', './js/app.js',
  './assets/logo.jpg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-48.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (pour recevoir les mises à jour), cache en secours (hors-ligne).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req).then(resp => {
      if (resp && resp.ok) { const copy = resp.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); }
      return resp;
    }).catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
