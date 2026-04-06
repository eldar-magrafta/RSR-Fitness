const CACHE = 'trainer-v10';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './css/base.css',
  './css/exercises.css',
  './css/plans.css',
  './css/modals.css',
  './css/bodyweight.css',
  './css/nutrition.css',
  './css/summary.css',
  './css/auth.css',
  './js/app.js',
  './js/auth.js',
  './js/state.js',
  './js/store.js',
  './js/cloud.js',
  './js/firebase-config.js',
  './js/utils.js',
  './js/navigation.js',
  './js/exercises.js',
  './js/plans.js',
  './js/bodyweight.js',
  './js/nutrition.js',
  './js/history.js',
  './js/prs.js',
  './js/summary.js',
  './data/exercises.js',
  './data/ingredients.js',
];

// Pre-cache on install
self.addEventListener('install', e => {
  self.skipWaiting(); // activate immediately
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

// Take control immediately & clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
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
