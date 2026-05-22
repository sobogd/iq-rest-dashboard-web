// Kitchen kiosk service worker.
//
// Reason for existence:
//   1. Service worker registration is what makes Safari treat the origin as
//      "installable" — without it the Add-to-Home-Screen flow on iPad falls
//      back to plain bookmark behaviour and storage is subject to the 7-day
//      ITP eviction policy.
//   2. Once the kiosk is "installed", localStorage / Cache survives weeks
//      of idle time. That's the main win — not offline functionality.
//
// We intentionally do NOT try to fully cache the API surface. Kitchen needs
// live data; serving stale orders would be worse than showing the offline
// overlay. We cache the static shell so a flaky connection during boot
// doesn't leave the staff staring at a white screen, and that's it.

const SHELL_CACHE = "k-shell-v1";

self.addEventListener("install", (event) => {
  // Skip waiting so a refreshed staff tablet picks up the new SW without
  // having to manually close the PWA window.
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Best-effort precache. Missing files don't break the install — the
      // network fallback will handle them on first navigation.
      cache.addAll(["/", "/index.html"]).catch(() => undefined),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // /api/* always hits the network — never cache live data.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (HTML): network-first, fall back to cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((c) => c || new Response("Offline", { status: 503 }))),
    );
    return;
  }

  // Hashed asset bundles: cache-first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      }),
    );
  }
});
