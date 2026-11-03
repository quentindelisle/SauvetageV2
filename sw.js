/* Service worker – appli N'EPS (socle N'EPS) – réseau d'abord, cache si hors-ligne.
   À CHAQUE MISE EN LIGNE : changer CACHE (identifiant de l'appli + version), sinon les tablettes gardent l'ancienne version. */
const CACHE = 'sauvetage-ca2-q7v2-v1.0.0';
const ASSETS = ['./', './index.html', './activite.js', './socle.js', './outils.js', './specifique.js', './styles.css', './specifique.css', './manifest.webmanifest',
  './sauvetage/store.js', './sauvetage/schema.js', './sauvetage/sim.js', './sauvetage/chrono.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/favicon-48.png',
  './lib/qrcode.js', './lib/jsQR.js', './lib/zxing-reader.js', './lib/zxing_reader.wasm', './lib/xlsx.full.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(u => fetch(u, { cache:'reload' }).then(r => r.ok && c.put(u, r)).catch(()=>{})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache:'no-cache' }).then(resp => {
    if (resp.ok) { const cl = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); }
    return resp;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
