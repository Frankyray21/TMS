/* Service worker · Prévention TMS · hors ligne complet */
/* VERSION remplacée automatiquement au déploiement par le hash du commit (.github/workflows/deploy-pages.yml) */
const VERSION = "tms-auto";
const CORE = [
  "./",
  "index.html",
  "index.en.html",
  "formation.html",
  "formation.en.html",
  "formation-2.html", "formation-3.html", "formation-4.html", "formation-5.html",
  "formation-2.en.html", "formation-3.en.html", "formation-4.en.html", "formation-5.en.html",
  "formation-guidee.html",
  "formation-guidee.en.html",
  "formation-guidee.js",
  "formation-guidee.en.js",
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
  "images/moyens_controle.jpg",
  "images/og.jpg",
  "images/posture_intro.jpg",
  "images/posture_p1.jpg",
  "images/posture_p2.jpg",
  "images/posture_p3.jpg",
  "images/posture_p4.jpg",
  "images/posture_positions.jpg",
  "images/pression_disque.jpg",
  "images/sd_circulation.jpg",
  "images/sd_compression.jpg",
  "images/sd_tubes_dynamique.jpg",
  "images/sd_tubes_statique.jpg",
  "images/tms_bursite.jpeg",
  "images/tms_carpien.jpeg",
  "images/tms_lombalgie.jpeg",
  "images/tms_tendinite.jpeg",
  "images/travail_statique.jpg",
  "images/zone_cou.jpeg",
  "images/zone_coudes.jpeg",
  "images/zone_dos.jpeg",
  "images/zone_epaules.jpeg",
  "images/zone_genoux.jpeg",
  "images/zone_poignets.jpeg",
  "images/zones_corps.jpg",
  "images/hero-anatomy.webp",
  "videos/preserver-son-corps-affiche.jpg"
];
/* pages + manifeste : doivent rester frais a chaque deploiement */
const PAGES = ["./", "index.html", "index.en.html",
  "partie-2.html", "partie-3.html", "partie-4.html", "partie-5.html",
  "partie-2.en.html", "partie-3.en.html", "partie-4.en.html", "partie-5.en.html",
  "formation.html", "formation.en.html",
  "formation-2.html", "formation-3.html", "formation-4.html", "formation-5.html",
  "formation-2.en.html", "formation-3.en.html", "formation-4.en.html", "formation-5.en.html",
  "formation-guidee.html", "formation-guidee.en.html",
  "interactif.html", "manifest.webmanifest",
  "styles.css", "formation.css", "app.js", "app.en.js", "formation.js", "formation-guidee.js", "formation-guidee.en.js", "gsap.min.js", "hero-anim.js", "anatomy-hero-model.js"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    /* pages : cache:"reload" pour contourner le cache HTTP et stocker des copies vraiment fraiches */
    await cache.addAll(PAGES.map((u) => new Request(u, { cache: "reload" })));
    /* images : best-effort, cache HTTP autorise (revalidation 304 peu couteuse) -> pas de re-telechargement force a chaque version */
    const ASSETS = CORE.filter((u) => PAGES.indexOf(u) === -1);
    await Promise.allSettled(ASSETS.map((u) => cache.add(u)));
    /* NB : la grosse video (~26 Mo) n'est plus prechargee -> elle se charge a la lecture, ce qui allege fortement le 1er chargement / les MAJ */
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

  /* Ressources du site et polices Google */
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (sameOrigin || isFont) {
    /* JS/CSS du site : réseau d'abord -> les mises à jour s'appliquent au prochain chargement
       (fini l'ancien code en cache dans la PWA) ; cache en secours hors ligne.
       Le reste (images, polices) : cache d'abord. */
    const freshFirst = sameOrigin && /\.(js|css)(\?|$)/i.test(url.pathname);
    e.respondWith((async () => {
      if (freshFirst) {
        try {
          const net = await fetch(req);
          if (net && net.ok) {
            const cache = await caches.open(VERSION);
            cache.put(req, net.clone());
          }
          return net;
        } catch (_) {
          return (await caches.match(req)) || Response.error();
        }
      }
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
