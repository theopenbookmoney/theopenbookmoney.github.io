// Open Book tools service worker: cache-first so tools work offline
// (e.g. Sleep Sounds from the home screen in airplane mode).
var CACHE = 'openbook-tools-v11';
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
  '/tools/rent-vs-buy-calc-manifest.json',
  '/tools/take-home-pay-calc.html',
  '/tools/take-home-pay-calc-icon-180.png',
  '/tools/take-home-pay-calc-icon-512.png',
  '/tools/take-home-pay-calc-manifest.json',
  '/tools/mortgage-calc.html',
  '/tools/mortgage-calc-icon-180.png',
  '/tools/mortgage-calc-icon-512.png',
  '/tools/mortgage-calc-manifest.json',
  '/tools/net-worth-calc.html',
  '/tools/net-worth-calc-icon-180.png',
  '/tools/net-worth-calc-icon-512.png',
  '/tools/net-worth-calc-manifest.json',
  '/tools/fhsa-calc.html',
  '/tools/fhsa-calc-icon-180.png',
  '/tools/fhsa-calc-icon-512.png',
  '/tools/fhsa-calc-manifest.json',
  '/tools/debt-payoff-calc.html',
  '/tools/debt-payoff-calc-icon-180.png',
  '/tools/debt-payoff-calc-icon-512.png',
  '/tools/debt-payoff-calc-manifest.json',
  '/tools/retirement-calc.html',
  '/tools/retirement-calc-icon-180.png',
  '/tools/retirement-calc-icon-512.png',
  '/tools/retirement-calc-manifest.json',
  '/tools/emergency-fund-calc.html',
  '/tools/emergency-fund-calc-icon-180.png',
  '/tools/emergency-fund-calc-icon-512.png',
  '/tools/emergency-fund-calc-manifest.json',
  '/tools/budget-calc.html',
  '/tools/budget-calc-icon-180.png',
  '/tools/budget-calc-icon-512.png',
  '/tools/budget-calc-manifest.json',
  '/tools/capital-gains-calc.html',
  '/tools/capital-gains-calc-icon-180.png',
  '/tools/capital-gains-calc-icon-512.png',
  '/tools/capital-gains-calc-manifest.json',
  '/tools/resp-calc.html',
  '/tools/resp-calc-icon-180.png',
  '/tools/resp-calc-icon-512.png',
  '/tools/resp-calc-manifest.json',
  '/tools/safe-withdrawal-calc.html',
  '/tools/safe-withdrawal-calc-icon-180.png',
  '/tools/safe-withdrawal-calc-icon-512.png',
  '/tools/safe-withdrawal-calc-manifest.json',
  '/tools/mortgage-renewal-calc.html',
  '/tools/mortgage-renewal-calc-icon-180.png',
  '/tools/mortgage-renewal-calc-icon-512.png',
  '/tools/mortgage-renewal-calc-manifest.json',
  '/tools/credit-card-apr-calc.html',
  '/tools/credit-card-apr-calc-icon-180.png',
  '/tools/credit-card-apr-calc-icon-512.png',
  '/tools/credit-card-apr-calc-manifest.json',
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
