const CORE_UI_CACHE = "novel-reader-v5";
const DATA_CACHE = "volume-downloads-v5";

const essentialFiles = [
    "index.html",
    "app.js",
    "style.css",
    "manifest.json",
    "Novel-Library/index.json"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CORE_UI_CACHE).then((cache) => cache.addAll(essentialFiles))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    console.log("[SW] Activated. Checking for old caches...");
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // If it's not our current shell cache, AND not our downloaded books... delete it.
                    if (cacheName !== CORE_UI_CACHE && cacheName !== DATA_CACHE) {
                        console.log("[SW] Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // If we manually downloaded it earlier, it lives here. Serve it offline.
            if (cachedResponse) {
                return cachedResponse;
            }
            // If not, fetch normally, but return immediately without caching.
            return fetch(event.request);
        })
    );
});

self.addEventListener("message", (event) => {
    const payload = event.data;

    if (payload.action === "MANUAL_SAVE") {
        event.waitUntil(
            caches.open(DATA_CACHE).then((cache) => {
                // Fetch the specific file and force it into the vault
                return fetch(payload.targetUrl).then((networkResponse) => {
                    return cache.put(payload.targetUrl, networkResponse);
                });
            }).then(() => {
                // Report back to the main thread
                event.source.postMessage({ status: "SAVE_COMPLETE", url: payload.targetUrl });
            })
        );
    }

    if (payload.action === "MANUAL_DELETE") {
        event.waitUntil(
            caches.open(DATA_CACHE).then((cache) => {
                // Remove the specific file from the vault
                return cache.delete(payload.targetUrl);
            }).then(() => {
                // Report back to the main thread
                event.source.postMessage({ status: "DELETE_COMPLETE", url: payload.targetUrl });
            })
        );
    }
});