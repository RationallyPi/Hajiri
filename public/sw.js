// Hajiri offline service worker — runtime caching.
//
// Strategy: cache every same-origin GET as it's requested, so the very first
// visit primes the cache and every later visit (including fully offline) works.
// Static assets are cache-first; navigations are network-first with the cached
// shell as fallback; /api/* is never cached.
const CACHE = "hajiri-v1";

// Precached on install: the app shell + key assets so even a cold offline start
// has something to show.
const PRECACHE = [
    "/",
    "/manifest.webmanifest",
    "/icon-192x192.png",
    "/icon-512x512.png",
    "/favicon.ico",
    "/student-placeholder.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

// Puts a fresh response into the cache (used by every network path below).
function cachePut(request, response) {
    const clone = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
    return response;
}

// Next.js App Router fetches RSC payloads for client-side navigation with a
// cache-busting query string (`?_rsc=...`). Normalize those to the bare
// pathname so a previously-visited route still resolves from cache offline.
function cacheKey(request) {
    const url = new URL(request.url);
    if (request.headers.get("rsc") === "1" || url.searchParams.has("_rsc")) {
        return new Request(url.origin + url.pathname, { headers: request.headers });
    }
    return request;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;

    // Static assets: cache-first, fill from network on first sight.
    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(
            caches.match(request).then(
                (cached) =>
                    cached ||
                    fetch(request).then((res) => (res.ok ? cachePut(request, res) : res)),
            ),
        );
        return;
    }

    // Page navigations: network-first so new builds propagate, cache fallback
    // so offline navigation still works.
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((res) => (res.ok ? cachePut(request, res) : res))
                .catch(() =>
                    caches.match(request).then((cached) => cached || caches.match("/")),
                ),
        );
        return;
    }

    // Everything else same-origin (RSC payloads, fonts, icons, etc.):
    // stale-while-revalidate, falling back to the normalized pathname so
    // client-side navigation still works offline.
    event.respondWith(
        caches.match(cacheKey(request)).then((cached) => {
            const network = fetch(request)
                .then((res) => (res.ok ? cachePut(cacheKey(request), res) : res))
                .catch(() => cached);
            return cached || network;
        }),
    );
});
