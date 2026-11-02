/* Network-first shell: prefer the newest HTML/CSS/JS; use cache only while offline. */
const CACHE_NAME = 'salehinsc-shell-v17';
const SHELL = ['./', './index.html', './teacher.html', './student.html', './admin.html', './styles.css', './modern.css', './config.js', './backend.js', './role-backend.js', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './assets/vazirmatn-arabic-400-normal.woff2', './assets/vazirmatn-arabic-600-normal.woff2'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/data/')) return;
  event.respondWith(fetch(new Request(request, { cache: 'no-store' })).then(response => {
    if (response.ok && (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') || url.pathname.endsWith('/'))) {
      const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? await caches.match('./index.html') : Response.error())));
});
