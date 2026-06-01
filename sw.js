const CACHE_NAME = 'preahang-vercel-offline-v5';

// Assets to cache relative to your Vercel root domain
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './IMG_6657.JPG',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&display=swap'
];

// Helper to strip the redirected flag from responses before writing to iOS cache
function cleanResponse(response) {
  if (!response.redirected) {
    return response;
  }
  
  // Clone headers and recreate response without the "redirected" flag
  const cleanedHeaders = new Headers(response.headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: cleanedHeaders
  });
}

// Install event - Cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('SW: Initializing clean cache layers for Vercel...');
      
      for (const url of ASSETS_TO_CACHE) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            // Clean response before storing in cache
            const sanitizedResponse = cleanResponse(response);
            await cache.put(url, sanitizedResponse);
          }
        } catch (error) {
          console.warn(`SW: Failed to cache asset during install: ${url}`, error);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Sweeping old cache version:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Respond from cache immediately when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Instant offline loading
      }
      
      return fetch(event.request).then((networkResponse) => {
        // Cache new successful GET requests dynamically
        if (event.request.method === 'GET' && networkResponse.status === 200) {
          const responseToCache = cleanResponse(networkResponse.clone());
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        console.warn('SW: Network offline. Operating in mountain mode.');
      });
    })
  );
});
