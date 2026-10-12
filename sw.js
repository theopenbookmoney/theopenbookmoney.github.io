// Open Book tools service worker: cache-first so tools work offline
// (e.g. Sleep Sounds from the home screen in airplane mode).
var CACHE = 'openbook-tools-v3';
var ASSETS = [
  '/tools/',
  '/tools/index.html',
  '/tools/white-noise.html',
  '/tools/tfsa-vs-rrsp-calc.html',
  '/tools/compound-interest-calc.html',
  '/tools/rent-vs-buy-calc.html',
  '/tools/white-noise-icon-180.png',
  '/tools/white-noise-icon-512.png',
  '/tools/tfsa-vs-rrsp-calc-icon-180.png',
  '/tools/tfsa-vs-rrsp-calc-icon-512.png',
  '/tools/compound-interest-calc-icon-180.png',
  '/tools/compound-interest-calc-icon-512.png',
  '/tools/rent-vs-buy-calc-icon-180.png',
  '/tools/rent-vs-buy-calc-icon-512.png',
  '/tools/white-noise-manifest.json',
  '/tools/tfsa-vs-rrsp-calc-manifest.json',
  '/tools/compound-interest-calc-manifest.json',
  '/tools/rent-vs-buy-calc-manifest.json'
];
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () { return hit; });
    })
  );
});
