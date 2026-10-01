// YA ROSUL - Progressive Web App Service Worker (v7)
const CACHE_NAME = 'yarosul-pwa-v7';

// Core app files - always try network first so updates are instant
const CORE_FILES = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/qrcode.min.js',
  './data/content.js',
  './manifest.json',
];

// Static assets that rarely change
const STATIC_ASSETS = [
  './assets/icons/favicon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// Precache all 48 pages of the book for 100% offline access anywhere
const PAGE_ASSETS = [];
for (let i = 1; i <= 48; i++) {
  PAGE_ASSETS.push(`./assets/pages/page_${i}.webp`);
}

const ALL_ASSETS = [...CORE_FILES, ...STATIC_ASSETS, ...PAGE_ASSETS];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache core files
      try {
        await cache.addAll(CORE_FILES);
        await cache.addAll(STATIC_ASSETS);
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
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Strategy:
// - Core files (HTML/CSS/JS): Network First → fallback to cache
// - Page images: Cache First → fallback to network (saves bandwidth)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // Network-first for core app files (ensures updates are always seen)
  const isCoreFile = CORE_FILES.some(f => pathname.endsWith(f.replace('./', '/')));

  if (isCoreFile || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: serve from cache
          return caches.match(event.request).then(cached => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Cache-first for images and other static assets
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          if (url.origin === location.origin ||
              url.hostname.includes('googleapis.com') ||
              url.hostname.includes('gstatic.com')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
