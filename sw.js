const CACHE_NAME = 'yarosul-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './data/content.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).then(fetchRes => {
        if (!fetchRes || fetchRes.status !== 200 || fetchRes.type !== 'basic') {
          return fetchRes;
        }
        // Cache requested pages dynamically
        const responseToCache = fetchRes.clone();
        if (event.request.url.includes('/assets/pages/')) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return fetchRes;
      }).catch(() => {
        // Fallback if offline
        return caches.match('./index.html');
      });
    })
  );
});
