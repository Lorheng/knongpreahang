const CACHE_NAME = 'preahang-hike-v3';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  'https://raw.githubusercontent.com/Lorheng/knongpreahang/refs/heads/main/IMG_6657.JPG',
  'https://kohsantepheapdaily.com.kh/wp-content/uploads/2024/07/32e306abbd03809c70f67eb0ba1760f5-780x585.jpg',
  'https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&display=swap',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Pre-caching mountain expedition files...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purging legacy PWA cache assets:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Return cached asset instantly without internet access
      }
      return fetch(event.request).catch(() => {
        // Fallback gracefully if we are deep in the mountains
        console.warn('Network unavailable. Serving offline fallback cache context.');
      });
    })
  );
});
