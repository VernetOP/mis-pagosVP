// VernetO Gestión: solo guarda la portada para que la app se pueda instalar y abrir sin demora.
const C = 'verneto-gestion-v1';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('verneto-gestion') && n !== C).map(n => caches.delete(n))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
