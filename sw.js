// Service worker — Pause Attitude · Catalogue
const CACHE_VERSION = "pa-catalogue-v16";
const APP_SHELL = [
  "./",
  "./index.html",
  "./pro.html",
  "./manifest.json",
  "./css/styles.css",
  "./css/fiche.css",
  "./css/pro.css",
  "./js/app.js",
  "./js/products.js",
  "./js/db.js",
  "./js/pro-router.js",
  "./js/pro-articles.js",
  "./js/pro-clients.js",
  "./js/pro-commandes.js",
  "./js/pro-fidelite.js",
  "./js/pro-lots.js",
  "./js/pro-tombola.js",
  "./js/pro-parametres.js",
  "./js/pro-app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/brand-mark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (new URL(request.url).origin !== self.location.origin) return; // laisse passer les images/polices distantes

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});
