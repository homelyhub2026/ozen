// OZEN service worker: opens instantly from the phone's copy, then updates quietly in the background.
// New versions still arrive by themselves (the app checks for a newer build and reloads).
const CACHE = 'ozen-v5';
const SHELL = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png'];
const CDN = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/firebase@|www\.gstatic\.com\/firebasejs\/|fonts\.(googleapis|gstatic)\.com\/)/;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && !k.startsWith('ozen-order')).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  // Firebase libraries and fonts: fixed versions, so keep them on the phone (no download on every open)
  if (CDN.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })));
    return;
  }
  if (u.origin !== location.origin) return;                 // Firebase data goes straight to Firebase
  if (u.search.includes('u=')) return;                     // the app's own "is there a new version?" check
  if (u.pathname.includes('/order/')) return;              // customer order page has its own worker
  // App files: answer from the phone's copy at once, refresh it in the background
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || c.match('./index.html');
  }));
});
