// Service worker do PWA.
// Estratégia conservadora: cache só de IMAGENS/FONTES (/uploads e arquivos de
// mídia). NUNCA cacheia /api, páginas nem os chunks JS do Next (/_next/) — em
// dev os chunks têm o mesmo nome entre builds e o cache serviria código velho.
const STATIC_CACHE = 'static-v2';

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

  // nunca interceptar API/WebSocket nem código do app
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/_next')
  ) {
    return;
  }

  const isStatic =
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
