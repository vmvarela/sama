// SW privado (servidor local SAMA, origen propio). Caches propias con prefijo sama-private-.
const CACHE = 'sama-private-v10';
const OWN_CACHE = /^(sama-private-|yoga-minimal-)/; // yoga-minimal-*: nombre anterior del mismo proyecto
const SELF_UPDATE = ['/', '/index.html', '/style.css', '/tracker.css', '/app.js', '/tracker.js', '/day-player.js', '/sw.js'];
const OFFLINE_DATA = ['/manifest.json', '/sequences.json', '/meditation.json', '/week-data.json', '/images-map.json'];
const ICONS = ['/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png'];
const ASSETS = [...SELF_UPDATE, ...OFFLINE_DATA, ...ICONS];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && OWN_CACHE.test(k)).map(k => caches.delete(k)))
  ).then(() => clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // código y hojas de estilos: red primero (se actualizan solos), caché como respaldo sin conexión
  if (SELF_UPDATE.includes(url.pathname)) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  // datos, iconos y demás: caché primero
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
