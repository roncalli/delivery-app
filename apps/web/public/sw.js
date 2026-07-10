// Service worker do PWA.
// Estratégia conservadora: cache só de estáticos (imagens, assets do Next).
// NUNCA cacheia /api nem páginas — pedido/checkout precisam estar sempre frescos.
const STATIC_CACHE = 'static-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // nunca interceptar API/WebSocket
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return;

  const isStatic =
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/uploads') ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
  }
});
