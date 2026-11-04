const CACHE = 'yoga-minimal-v8';
const SELF_UPDATE = ['/', '/index.html', '/style.css', '/app.js', '/tracker.js', '/tracker.css', '/sw.js'];
const OFFLINE_DATA = ['/manifest.json', '/sequences.json', '/meditation.json', '/week-data.json', '/images-map.json'];
const ASSETS = [...SELF_UPDATE, ...OFFLINE_DATA];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
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
  // datos y demás: caché primero
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
