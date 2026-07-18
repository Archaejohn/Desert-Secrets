/**
 * Offline cache for the PWA install — network-first, with the browser HTTP
 * cache deliberately bypassed so "network-first" actually means it.
 *
 * Two caching layers used to conspire to keep players a version (or more)
 * behind, which is why updates were so hard to get:
 *
 *  1. This file never changed bytes between deploys (`CACHE` was a constant
 *     "desert-secrets-v1"), so the browser — which only re-installs a service
 *     worker when its bytes differ — never picked up a new SW, never ran a
 *     newer fetch strategy, and never purged the old cache. Fixed by stamping
 *     the build version in below (`2026-07-18T15:52:06.258Z`, replaced at build time):
 *     every deploy is now a genuinely new SW that installs, activates,
 *     `skipWaiting()`s, claims clients, and deletes every prior cache.
 *  2. Plain `fetch(request)` still honours the browser's HTTP cache, so on
 *     GitHub Pages (which serves index.html with a max-age) a reload could be
 *     answered from the stale HTTP cache before the network was ever hit —
 *     even though this SW is "network-first". Fixed by fetching the page
 *     navigation with `{ cache: "reload" }`, which forces a real network
 *     round-trip and bypasses the HTTP cache. The single-file build means the
 *     navigation IS the whole app, so that one bypass covers everything.
 *
 * The cache is now purely an offline fallback, refreshed opportunistically on
 * every successful fetch and re-seeded fresh on each new SW's install.
 */
const VERSION = "2026-07-18T15:52:06.258Z"; // replaced with the build's APP_VERSION at build time
const CACHE = `desert-secrets-${VERSION}`;
const ASSETS = ["./", "./index.html", "./version.json", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  // `cache: "reload"` so the precache seeds from the network, never from a
  // stale HTTP cache.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Let the page trigger an immediate takeover (the "Update now" button posts this).
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Page navigations bypass the HTTP cache entirely (truly network-first);
  // other same-origin GETs use the default fetch, still network-first here.
  const fetchReq = req.mode === "navigate" ? new Request(req.url, { cache: "reload" }) : req;
  event.respondWith(
    fetch(fetchReq)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
