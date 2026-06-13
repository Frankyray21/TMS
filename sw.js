/* Service worker · Prévention TMS · hors ligne complet */
const VERSION = "tms-v4";
const CORE = [
  "./",
  "index.html",
  "index.en.html",
  "formation.html",
  "formation.en.html",
  "interactif.html",
  "manifest.webmanifest",
  "images/assis_basdudos.jpg",
  "images/icon-180.png",
  "images/icon-192.png",
  "images/icon-512.png",
  "images/icon-maskable-512.png",
  "images/info_angles.jpeg",
  "images/info_assis_disque.jpeg",
  "images/info_assis_muscles.jpeg",
  "images/info_dynamique.jpeg",
  "images/info_facteurs.jpeg",
  "images/info_facteurs_v2.png",
  "images/info_fatigue.jpeg",
  "images/info_fatigue2.jpeg",
  "images/info_micro_ab.jpg",
  "images/info_microlesions.jpeg",
  "images/info_perception.jpeg",
  "images/info_postures_eviter.jpeg",
  "images/info_regles.jpeg",
  "images/info_statique.jpeg",
  "images/logo_roger.png",
  "images/og.jpg",
  "images/sd_circulation.jpg",
  "images/sd_compression.jpg",
  "images/sd_tubes_dynamique.jpg",
  "images/sd_tubes_statique.jpg",
  "images/tms_bursite.jpeg",
  "images/tms_carpien.jpeg",
  "images/tms_lombalgie.jpeg",
  "images/tms_tendinite.jpeg",
  "images/zone_cou.jpeg",
  "images/zone_coudes.jpeg",
  "images/zone_dos.jpeg",
  "images/zone_epaules.jpeg",
  "images/zone_genoux.jpeg",
  "images/zone_poignets.jpeg",
  "images/zones_corps.jpg",
  "videos/preserver-son-corps-affiche.jpg"
];
const HEAVY = ["videos/preserver-son-corps.mp4"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    /* cache:"reload" = on contourne le cache HTTP du navigateur pour stocker des copies vraiment fraîches */
    await cache.addAll(CORE.map((u) => new Request(u, { cache: "reload" })));
    /* gros fichiers : au mieux, sans faire échouer l'installation */
    await Promise.allSettled(HEAVY.map((u) => cache.add(new Request(u, { cache: "reload" }))));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Pages : réseau d'abord (contenu frais), cache en secours */
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, net.clone());
        return net;
      } catch (_) {
        const cached = await caches.match(req, { ignoreSearch: true });
        return cached || caches.match("index.html");
      }
    })());
    return;
  }

  /* Ressources du site et polices Google : cache d'abord, réseau en complément */
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (sameOrigin || isFont) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        if (net && (net.ok || net.type === "opaque")) {
          const cache = await caches.open(VERSION);
          cache.put(req, net.clone());
        }
        return net;
      } catch (_) {
        return cached;
      }
    })());
  }
});
