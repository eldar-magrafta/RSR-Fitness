const CACHE = 'trainer-v1';
const FILES = ['/', '/index.html', '/manifest.json'];

// Pre-cache on install
self.addEventListener('install', e => {
  self.skipWaiting(); // activate immediately
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

// Take control immediately
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Network first — always get fresh code, fall back to cache if offline
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
