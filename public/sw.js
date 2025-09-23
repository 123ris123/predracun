const CACHE_NAME = 'caffe-club-m-pos-v1';
const ASSETS = [
  '/', '/index.html', '/manifest.webmanifest'
];

// Install
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(ASSETS); } catch (e) {}
    self.skipWaiting();
  })());
});

// Activate – očisti stare cacheve
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

// Network-first za HTML, cache-first za ostalo
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const isHtml = request.headers.get('accept')?.includes('text/html');
  if (isHtml) {
    e.respondWith((async () => {
      try {
        const net = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, net.clone());
        return net;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match('/'));
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const net = await fetch(request);
      if (request.method === 'GET' && request.url.startsWith(self.location.origin)) {
        cache.put(request, net.clone());
      }
      return net;
    } catch {
      return cached || Response.error();
    }
  })());
});
