const CACHE_NAME = 'preahang-vercel-offline-v7'; // Incremented cache version to v7 to force clear all previous states

// Assets to cache relative to your Vercel root domain
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './IMG_6657.JPG',
  'https://cdn.jsdelivr.net/npm/tailwindcss-cdn@3.4.10/tailwindcss.js', // Directly CORS-enabled on jsDelivr!
  'https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&display=swap'
];

// Helper to strip the redirected flag from responses before writing to iOS cache
function cleanResponse(response) {
  if (!response.redirected) {
    return response;
  }
  
  // Clone headers and recreate response without the "redirected" flag to prevent iOS webapp crashes
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
          // Explicitly fetch cross-origin scripts/fonts with CORS configuration
          const isCrossOrigin = url.startsWith('http') && !url.includes(self.location.hostname);
          const fetchOptions = isCrossOrigin ? { mode: 'cors' } : {};
          
          const response = await fetch(url, fetchOptions);
          
          // Allow cross-origin caching if response status is successful (200) or opaque (0)
          if (response.ok || response.status === 0) {
            const sanitizedResponse = cleanResponse(response);
            await cache.put(url, sanitizedResponse);
            console.log(`SW: Successfully cached during install: ${url}`);
          } else {
            console.warn(`SW: Fetch returned bad status (${response.status}) for: ${url}`);
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
        // Cache new successful GET requests dynamically (supporting status 0 for CDN requests)
        if (event.request.method === 'GET' && (networkResponse.status === 200 || networkResponse.status === 0)) {
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
