/*
  Service Worker — Job Tracker

  Deliberately scoped to just (1) a "complete" install experience as an app
  (required by some browsers/stores as a quality signal) and (2) a decent
  fallback screen when offline, instead of the browser's ugly error page.

  We do NOT cache index.html / CSS / JS / manifest.json — intentionally.
  Reason: the app talks live to Supabase (auth + data), so there's no real
  "offline" mode anyway — and an aggressive cache on these files would create
  exactly the classic PWA bug: the user sees a stale version of the app after
  you ship an update, until they manually clear the cache. Better no cache on
  the code than a wrong cache.

  The only thing cached is the static fallback page (offline.html), which
  doesn't change often and holds no data.
*/

const CACHE_NAME = "job-tracker-shell-v1";
const OFFLINE_URL = "offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // We only touch page navigations (i.e. the actual loading of the app).
  // We don't intercept requests to Supabase, fonts, or other resources —
  // those go straight to the network, as if this file didn't exist.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
