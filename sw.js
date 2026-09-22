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
/* Analyse ergonomique vidéo et photo (cotation-video/) : sa coquille — page,
   styles, modules — est mise en cache avec le reste du site, pour que l'outil
   s'ouvre sous terre. Le moteur de pose et son modèle (vendor/, ~22 Mo) ne
   sont PAS préchargés ici : ils entrent dans un magasin distinct à la première
   analyse, ou via « Préparer le mode hors ligne » dans l'outil (voir plus bas). */
const OUTIL = [
  "cotation-video/", "cotation-video/index.html",
  "cotation-video/css/app.css", "cotation-video/css/parcours.css",
  "cotation-video/js/analyse.js", "cotation-video/js/angles.js", "cotation-video/js/app.js",
  "cotation-video/js/config.js", "cotation-video/js/demo.js", "cotation-video/js/mesures.js",
  "cotation-video/js/niosh.js", "cotation-video/js/picto.js", "cotation-video/js/pose.js",
  "cotation-video/js/qualite.js", "cotation-video/js/reba.js", "cotation-video/js/rendu.js",
  "cotation-video/js/rula.js"
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
  "styles.css", "app.js", "app.en.js", "formation.js", "formation-guidee.js", "formation-guidee.en.js", "formation-attestation.js", "formation-parcours.css", "session.js", "quiz-feedback.js", "gsap.min.js", "hero-anim.js", "anatomy-hero-model.js"].concat(OUTIL);

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

/* Moteur de pose de l'analyse ergonomique : des binaires lourds et immuables
   (URL versionnées) — bundle MediaPipe, WebAssembly, modèles .task. Servis
   depuis cotation-video/vendor/ en production (le déploiement les y dépose),
   depuis le CDN public à défaut. Cache d'abord, dans un magasin distinct qui
   survit aux versions du site : pas de retéléchargement à chaque déploiement,
   et l'analyse reste possible sans réseau dès que le moteur a été chargé une
   fois. cotation-video/js/pose.js lit le même magasin (même nom) pour y garder
   le modèle et pour dire si le mode hors ligne est prêt. Son nom ne commence
   pas par « tms- » : la purge de l'activation ne doit pas le vider. */
const CACHE_MOTEUR = "cotation-video-modeles-v1";
/* Mises en cache en cours, par URL : l'outil vérifie la présence du bundle
   (GET) puis l'importe aussitôt ; sans ce registre, la seconde requête partirait
   sur le réseau avant que la première soit rangée, et le fichier serait
   téléchargé deux fois. Simple optimisation : le worker peut être arrêté
   entre deux événements, le registre repart alors de zéro. */
const MOTEUR_EN_COURS = new Map();
function estMoteurDePose(url, sameOrigin) {
  if (sameOrigin) return url.pathname.indexOf("/cotation-video/vendor/") !== -1;
  return (url.hostname === "cdn.jsdelivr.net" && url.pathname.indexOf("/npm/@mediapipe/tasks-vision") === 0)
      || (url.hostname === "storage.googleapis.com" && url.pathname.indexOf("/mediapipe-models/") === 0);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (estMoteurDePose(url, sameOrigin)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_MOTEUR);
      const cached = await cache.match(req);
      if (cached) return cached;
      const enCours = MOTEUR_EN_COURS.get(url.href);
      if (enCours) {
        await enCours;
        const range = await cache.match(req);
        if (range) return range;
      }
      try {
        const net = await fetch(req);
        /* 200 seulement : une réponse partielle (206) ou une page d'erreur gardée
           ici rendrait le moteur inutilisable jusqu'à la purge du magasin. Les
           réponses opaques (script du CDN chargé sans CORS) n'ont pas de statut
           lisible ; on les garde, sinon le repli CDN ne se rejoue jamais hors ligne.
           La réponse part tout de suite (la page affiche l'avancement du modèle
           en lisant le flux) ; la copie se range en parallèle. */
        if (net && (net.status === 200 || net.type === "opaque")) {
          const rangement = cache.put(req, net.clone()).catch(() => {}).finally(() => MOTEUR_EN_COURS.delete(url.href));
          MOTEUR_EN_COURS.set(url.href, rangement);
        }
        return net;
      } catch (_) {
        return Response.error();
      }
    })());
    return;
  }

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
