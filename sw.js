// YA ROSUL - Progressive Web App Service Worker (v3)
const CACHE_NAME = 'yarosul-pwa-v3';

const STATIC_CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/qrcode.min.js',
  './data/content.js',
  './manifest.json',
  './assets/icons/favicon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// Precache all 48 pages of the book for 100% offline access anywhere
const PAGE_ASSETS = [];
for (let i = 1; i <= 48; i++) {
  PAGE_ASSETS.push(`./assets/pages/page_${i}.webp`);
}

const ALL_ASSETS = [...STATIC_CORE, ...PAGE_ASSETS];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache core assets first
      try {
        await cache.addAll(STATIC_CORE);
      } catch (err) {
        console.warn('Failed to cache some core assets', err);
      }
      // Cache page images progressively in background
      for (const pageUrl of PAGE_ASSETS) {
        cache.add(pageUrl).catch(e => console.warn('Preload page skip:', pageUrl));
      }
    })
  );
  self.skipWaiting();
});

// Activate Event & Cache Cleanup
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

// Fetch Strategy: Cache First, fallback to Network
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Handle Google Fonts or same-origin requests
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        // Cache external fonts or dynamic assets
        if (networkResponse && networkResponse.status === 200) {
          if (url.origin === location.origin || url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for document navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
