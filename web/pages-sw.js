// SW público (GitHub Pages en /<repo>/). Se publica como sw.js; scripts/build-pages.mjs
// sustituye el marcador de build por un hash del contenido publicado, así cada despliegue usa caché nueva.
// Todas las URLs son relativas al scope; solo gestiona sus propias cachés sama-public-*,
// porque el mismo origen github.io puede alojar otros proyectos.
const BUILD = '__BUILD__';
const PREFIX = 'sama-public-';
const CACHE = PREFIX + BUILD;
const SCOPE = self.registration.scope;
const PRECACHE = [
  // shell
  './', './index.html', './style.css', './tracker.css', './app.js', './tracker.js',
  './day-player.js', './manifest.json',
  // datos (week-data ≈744 KB)
  './sequences.json', './meditation.json', './images-map.json', './week-data.json',
  // sonido e iconos
  './audio/handpan.mp3', './audio/transition.mp3', './audio/gong.mp3',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  // shortcut: las imágenes (~148 MB) NO se precachean: el fetch de abajo las guarda bajo
  // demanda al usarse. La caché puede llegar a ~148 MB si se recorren todas las posturas;
  // conviene una política de cuota/LRU (p. ej. purgar las imágenes más antiguas al superar
  // un límite) cuando el almacenamiento del navegador sea una preocupación.
].map(p => new URL(p, SCOPE).href);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))
  ).then(() => clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(SCOPE)) return;
  // red primero: con conexión siempre la versión publicada; sin conexión, la caché de este build
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || Response.error())));
});
