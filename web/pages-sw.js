// SW público (GitHub Pages en /<repo>/). Se publica como sw.js; scripts/build-pages.mjs
// sustituye el marcador de build por un hash del contenido publicado, así cada despliegue usa caché nueva.
// Todas las URLs son relativas al scope; solo gestiona sus propias cachés sama-public-*,
// porque el mismo origen github.io puede alojar otros proyectos.
const BUILD = '__BUILD__';
const PREFIX = 'sama-public-';
const CACHE = PREFIX + BUILD;
const SCOPE = self.registration.scope;
const PRECACHE = [
  './', './index.html', './public-manifest.json', './style.css', './app.js',
  './sequences.json', './meditation.json',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './images/tadasana.png', './images/uttanasana.png', './images/adho-mukha-svanasana.png',
  './images/virabhadrasana-i.png', './images/virabhadrasana-ii.png', './images/trikonasana.png',
  './images/setu-bandhasana.png', './images/balasana.png', './images/meditation.png',
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
