/*
 * Nutriyet service worker — intentionally conservative.
 * - Precaches the offline fallback page only.
 * - Network-first for page navigations; falls back to cache, then /offline.
 * - Never intercepts non-GET, API, admin, account, checkout or auth requests,
 *   so dynamic/authenticated content is always fresh.
 * - NEVER serves or caches a redirected / opaque / non-OK response. This is
 *   critical: an alias host (e.g. www) that 307-redirects to the primary domain
 *   must be allowed to redirect — caching/returning that redirect would blank
 *   the page. Only clean same-origin 200s are cached.
 */
const VERSION = "nutriyet-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldBypass(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/account") ||
    url.pathname.startsWith("/checkout") ||
    url.pathname.includes("/auth")
  );
}

/** Only a clean, same-origin 200 response is safe to cache/serve from the SW. */
function isCacheable(response) {
  return (
    response &&
    response.ok && // 200–299 only (never a 3xx/4xx/5xx)
    response.type === "basic" && // same-origin, non-opaque
    !response.redirected // never a followed/opaque redirect
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || shouldBypass(url)) return;

  // Page navigations: network-first. Return the network response as-is (so any
  // redirect is followed by the browser); only cache clean 200s; fall back to
  // cache then /offline only when the network is unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  // Static assets: cache-first, then network (caching only clean 200s).
  if (/\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheable(response)) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
