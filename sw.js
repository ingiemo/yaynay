// Service worker: lagrer alle filene så appen virker uten nett.
// VIKTIG: Øk VERSION hver gang du publiserer endringer, ellers får ikke telefonen dem.

const VERSION = 'v2';
const CACHE = `yaynay-${VERSION}`;

const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/catalog.js',
  'js/format.js',
  'js/stats.js',
  'js/store.js',
  'js/ui.js',
  'js/views/fristelse.js',
  'js/views/innstillinger.js',
  'js/views/oversikt.js',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' sørger for at vi henter ferske filer, ikke nettleserens HTTP-cache.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('yaynay-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Appen sier fra når du trykker «Oppdater».
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Cache først (rask og offline). Sidevisninger faller tilbake til index.html.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      throw err;
    }
  })());
});
