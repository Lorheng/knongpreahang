const CACHE_NAME = 'preahang-expedition-v4';

// The essential files required to make the UI render and look amazing offline
const MANDATORY_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com'
];

// Optional assets (images/fonts/sounds) that we want to cache, but shouldn't break the installation if blocked
const OPTIONAL_ASSETS = [
  'https://raw.githubusercontent.com/Lorheng/knongpreahang/refs/heads/main/IMG_6657.JPG',
  'https://kohsantepheapdaily.com.kh/wp-content/uploads/2024/07/32e306abbd03809c70f67eb0ba1760f5-780x585.jpg',
  'https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&display=swap',
  'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
  'https://actions.google.com/sounds/v1/telecom/phone_connect.ogg',
  'https://actions.google.com/sounds/v1/telecom/hang_up.ogg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Installing offline caching layers...');
      
      // 1. Force cache the core files first
      await cache.addAll(MANDATORY_ASSETS);
      
      // 2. Cache optional assets one-by-one so any network/CORS blocks won't fail the PWA install
      for (const asset of OPTIONAL_ASSETS) {
        try {
          const response = await fetch(asset, { mode: 'no-cors' });
          if (response.status === 200 || response.type === 'opaque') {
            await cache.put(asset, response);
          }
        } catch (err) {
          console.warn(`Optional asset failed to cache: ${asset}`, err);
        }
      }
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
            console.log('Cleaning old cache version:', key);
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
        return cachedResponse; // Load instantly from offline phone cache
      }
      return fetch(event.request).catch(() => {
        console.warn('Network unavailable. Operating in full offline mountain mode.');
      });
    })
  );
});
