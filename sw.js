/* GitHub Pages serves everything with max-age=600, so a returning reader
   re-asks for every script and stylesheet after ten minutes — one round trip
   each, which is what a slow connection feels. This worker answers only URLs
   whose content can never change — Nuxt's hashed chunks and the vendored
   renderer, pinned by its directory name — from its own cache, forever.
   HTML, payloads, data and fonts are never touched, so it cannot serve a stale
   page. To retire it, ship a worker that calls self.registration.unregister(). */
const CACHE = 'gazll-immutable-v1';
const MAX_ENTRIES = 400;
// builds/ holds latest.json and build metadata, which DO change per deploy.
const IMMUTABLE = /^\/(?:_nuxt\/(?!builds\/)|vendor\/mermaid-\d)/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(names => Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name))))
    .then(() => self.clients.claim()));
});

// Every deploy renames its chunks, so old ones pile up; drop the oldest.
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map(key => cache.delete(key)));
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search || !IMMUTABLE.test(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok) event.waitUntil(cache.put(request, response.clone()).then(() => trim(cache)));
    return response;
  }));
});
