/**
 * Minimal offline cache for the PWA install. Network-first with a cache
 * fallback: the game is a single self-contained HTML file, so this is all
 * that's needed to make it launch instantly offline while still always
 * showing the latest deploy when a connection is available.
 *
 * Previously cache-first-with-background-refresh: `caches.match()` would
 * return an existing cached hit immediately and only fetch+update the cache
 * for the NEXT load, never the current one. Under active development (many
 * deploys in quick succession) that meant every visit was served the
 * PREVIOUS deploy, one version behind, no matter how hard the page was
 * reloaded — a real bug, not just an inconvenience (it's exactly what made
 * a shipped feature look like it "wasn't there"). Network-first fixes that:
 * a normal reload with connectivity always gets the current bytes; the
 * cache is now purely an offline fallback, updated opportunistically on
 * every successful fetch.
 */
const CACHE = "desert-secrets-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
