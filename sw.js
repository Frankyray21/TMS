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
  "formation-attestation.js",
  "formation-parcours.css",
  "session.js",
  "quiz-feedback.js",
  "interactif.html",
  "manifest.webmanifest",
  "manifest.en.webmanifest",
  "vendor/model-viewer.min.js",
  "vendor/modern-screenshot.umd.js",
  "images/assis_basdudos.jpg",
  "images/icon-180.png",
  "images/icon-192.png",
  "images/icon-512.png",
  "images/icon-maskable-512.png",
  "images/info_micro_ab.jpg",
  "images/logo_roger.png",
  "images/moyens_controle.webp",
  "images/og.jpg",
  "images/posture_intro.jpg",
  "images/posture_p1.webp",
  "images/posture_p2.webp",
  "images/posture_p3.webp",
  "images/posture_p4.webp",
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
  "images/zones_corps.webp",
  "images/zones_corps_en.webp",
  "images/hero-anatomy.webp",
  "images/hero-systems.webp",
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
  "interactif.html", "manifest.webmanifest", "manifest.en.webmanifest",
  "styles.css", "app.js", "app.en.js", "formation.js", "formation-guidee.js", "formation-guidee.en.js", "formation-attestation.js", "formation-parcours.css", "session.js", "quiz-feedback.js", "gsap.min.js", "hero-anim.js", "anatomy-hero-model.js"];

/* « Télécharger hors ligne » (bouton du pied de page) : tout ce qui n'est pas préchargé
   d'office — vidéo et modèles 3D — en plus des pages et images, pour un usage sans réseau. */
const EXTRA = ["videos/preserver-son-corps.mp4",
  "models/corps-anatomie-mobile.glb", "models/corps-anatomie-web.glb", "models/male-full-body-ecorche-hero.glb",
  "vendor/draco/draco_decoder.js", "vendor/draco/draco_decoder.wasm", "vendor/draco/draco_wasm_wrapper.js"];
const OFFLINE_ALL = Array.from(new Set(PAGES.concat(CORE, EXTRA)));

async function offlineMissing(cache) {
  const out = [];
  for (const u of OFFLINE_ALL) if (!(await cache.match(u, { ignoreSearch: true }))) out.push(u);
  return out;
}

self.addEventListener("message", (e) => {
  const type = e.data && e.data.type;
  const reply = (m) => { if (e.source) e.source.postMessage(m); };
  if (type === "offline-status") {
    e.waitUntil((async () => {
      const missing = await offlineMissing(await caches.open(VERSION));
      reply({ type: "offline-status", ready: missing.length === 0 });
    })());
  } else if (type === "offline-download") {
    e.waitUntil((async () => {
      const cache = await caches.open(VERSION);
      const missing = await offlineMissing(cache);
      const total = OFFLINE_ALL.length;
      let done = total - missing.length, failed = 0;
      reply({ type: "offline-progress", done, total });
      for (const u of missing) {
        try { await cache.add(u); } catch (_) { failed++; }
        done++;
        reply({ type: "offline-progress", done, total });
      }
      reply({ type: "offline-done", failed });
    })());
  }
});

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
    /* Ne purger QUE nos propres caches (préfixe « tms- ») : l'origine
       frankyray21.github.io est partagée avec les autres sites (Wiki SST,
       Procédures MRI, RodBot…) — leurs caches hors-ligne ne doivent jamais être touchés. */
    await Promise.all(keys.filter((k) => k.indexOf("tms-") === 0 && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* L'outil de cotation vidéo est une application distincte, servie sous
     /cotation-video/. On la laisse entièrement au réseau : sans ça, ses modules
     et surtout son modèle de pose (plusieurs mégaoctets) atterriraient dans le
     cache du site, qu'on vient justement d'assainir. */
  if (url.origin === self.location.origin && url.pathname.includes("/cotation-video/")) return;

  /* Pages : réseau d'abord (contenu frais), cache en secours */
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        if (net && net.ok) { /* ne pas écraser une copie saine du cache par une page d'erreur */
          const cache = await caches.open(VERSION);
          cache.put(req, net.clone());
        }
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
        return Response.error(); /* cached est forcément absent ici (déjà testé plus haut) */
      }
    })());
  }
});
