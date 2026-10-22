/* AC SHS Load Manager - service worker
   - the page itself, icons and fonts are kept on the phone, so the app opens with no signal
   - the schedule data is NOT cached here: the page keeps the last loaded schedule itself (see Teacher.html)
   - everything else (the /admin page, the Apps Script server) goes straight to the network */
const CACHE = 'acshs-shell-v1.3';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // the teacher page: newest copy when online, the saved copy when offline
  if (req.mode === 'navigate') {
    if (url.origin !== location.origin || (url.pathname !== '/' && url.pathname !== '/index.html')) return;   // /admin etc. are not ours
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)); }
        return res;
      }).catch(() => caches.match('/', {ignoreSearch: true}))
    );
    return;
  }

  // fonts, the logo and our own icons: serve the saved copy, update it in the background
  const ours = url.origin === location.origin && (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest');
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const logo = url.hostname === 'i.ibb.co';
  if (ours || fonts || logo) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
