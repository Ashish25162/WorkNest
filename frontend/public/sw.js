const CACHE_NAME = 'worknest-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg'
];

// Install Event
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event: Clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  // Never intercept or cache on localhost or for REST API calls
  const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isLocalhost || event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});
