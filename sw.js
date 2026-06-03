const CACHE_NAME = 'preahang-vercel-offline-v10'; // Upgraded cache version to v9 for Programmatic Font Unrolling

// Assets to cache relative to your Vercel root domain (fully CORS-compliant)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './IMG_6657.JPG',
  './_vercel/insights/script.js', // Pre-cache Vercel analytics on the very first try!
  'https://cdn.jsdelivr.net/npm/tailwindcss-cdn@3.4.10/tailwindcss.js',
  'https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&display=swap'
];

// Helper to strip the redirected flag from responses before writing to iOS cache
function cleanResponse(response) {
  if (!response.redirected) {
    return response;
  }
  
  // Clone headers and recreate response without the "redirected" flag to prevent crashes in standalone mode on iOS
  const cleanedHeaders = new Headers(response.headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: cleanedHeaders
  });
}

// Broadcast progress messages to the UI in index.html
async function broadcastProgress(progressValue) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(client => {
    client.postMessage({
      type: 'CACHE_PROGRESS',
      progress: progressValue
    });
  });
}

// Install event - Dynamic unrolling of font files and sequential caching progress reporting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('SW: Initializing clean cache layers with dynamic asset discovery...');
      
      // Compile the final flat list of assets to cache
      let finalUrlsToCache = [...ASSETS_TO_CACHE];
      
      // Programmatically unroll Google Font CSS rules to extract true underlying .woff2 files
      try {
        const fontCssUrl = 'https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&display=swap';
        const cssResponse = await fetch(fontCssUrl, { mode: 'cors' });
        if (cssResponse.ok) {
          const cssText = await cssResponse.text();
          // Regular expression to match all Google Font font file links inside CSS url() attributes
          const fontRegex = /url\(['"]?(https:\/\/fonts\.gstatic\.com\/[^'")]+)['"]?\)/g;
          let match;
          while ((match = fontRegex.exec(cssText)) !== null) {
            const fontFileUrl = match[1];
            if (!finalUrlsToCache.includes(fontFileUrl)) {
              finalUrlsToCache.push(fontFileUrl);
            }
          }
          console.log(`SW: Discovered ${finalUrlsToCache.length - ASSETS_TO_CACHE.length} dynamic Google font files to precache.`);
        }
      } catch (e) {
        console.warn('SW: Failed to dynamically discover Google font files during install:', e);
      }

      let cachedCount = 0;
      await broadcastProgress(0);

      // Download and cache all files sequentially
      for (let i = 0; i < finalUrlsToCache.length; i++) {
        const url = finalUrlsToCache[i];
        try {
          const isCrossOrigin = url.startsWith('http') && !url.includes(self.location.hostname);
          const fetchOptions = isCrossOrigin ? { mode: 'cors' } : {};
          
          const response = await fetch(url, fetchOptions);
          
          if (response.ok || response.status === 0) {
            const sanitizedResponse = cleanResponse(response);
            await cache.put(url, sanitizedResponse);
            console.log(`SW: Successfully cached during install: ${url}`);
          }
        } catch (error) {
          console.warn(`SW: Failed to cache asset: ${url}`, error);
        }
        
        // Broadcast accurate progress of all unrolled assets
        cachedCount++;
        const currentPercentage = Math.round((cachedCount / finalUrlsToCache.length) * 100);
        await broadcastProgress(currentPercentage);
      }
    })
  );
  self.skipWaiting();
});

// Activate event - Sweeps and destroys older Cache versions
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

// Fetch event - Serving cached assets instantly
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Load instantly from local storage
      }
      
      return fetch(event.request).then((networkResponse) => {
        // Cache dynamic runtime assets securely
        if (event.request.method === 'GET' && (networkResponse.status === 200 || networkResponse.status === 0)) {
          const responseToCache = cleanResponse(networkResponse.clone());
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        console.warn('SW: Network disconnected. Seamlessly serving offline cache.');
      });
    })
  );
});
