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

  The only things cached are the static fallback page (offline.html) and its
  stylesheet (offline.css), which don't change often and hold no data. The
  stylesheet is a separate file because the CSP blocks inline <style> blocks.
*/

const CACHE_NAME = "job-tracker-shell-v2";   // v2: offline.css added
const OFFLINE_URL = "offline.html";
const OFFLINE_CSS = "offline.css";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, OFFLINE_CSS]))
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
  // The offline page's stylesheet: network first, the cached copy when offline.
  if (new URL(event.request.url).pathname.endsWith("/" + OFFLINE_CSS)) {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_CSS)));
    return;
  }
  // Otherwise we only touch page navigations (i.e. the actual loading of the app).
  // We don't intercept requests to Supabase, fonts, or other resources —
  // those go straight to the network, as if this file didn't exist.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
