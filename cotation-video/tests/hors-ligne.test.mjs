/* ============================================================================
   Mode hors ligne de l'analyse ergonomique.

   Le service worker du site (sw.js) est exécuté dans un bac à sable Node —
   aucun navigateur, aucun réseau — et on lui soumet ce qu'un poste sous terre
   lui demanderait : ouvrir l'outil, charger ses modules et ses polices, rejouer
   le moteur de pose ; puis ce qu'une mise à jour du moteur lui fait subir :
   reconduire un poste préparé, purger l'ancien magasin, tenir bon si le réseau
   lâche en plein renouvellement.

   Les autres vérifications s'assurent que les pièces se tiennent : une seule
   version du moteur partout, moteur embarqué au déploiement, polices servies
   par l'outil, détection du dossier local en GET, état du cache, choix du
   délégué (GPU ou processeur) et repli quand le GPU échoue.

   Le parcours complet dans un vrai navigateur est dans verifier-hors-ligne.mjs
   (Playwright ; lancé par la CI sur chaque pull request).
   ============================================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MEDIAPIPE, MODELE_POSE, VERSION_MOTEUR, MAGASIN_MOTEUR, SOURCES, fichiersMoteur,
         sourceDisponible } from "../js/config.js";
import { etatMoteur, expliquerErreurMoteur, choisirDelegue, creerDetecteur, bloquerTelemetrie,
         TELEMETRIE_MEDIAPIPE } from "../js/pose.js";

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
/* La portée du service worker : un sous-dossier de l'origine, comme sur GitHub Pages. */
const BASE = "https://exemple.test/TMS/";
const VENDOR = `${BASE}cotation-video/vendor/`;
const lire = f => readFileSync(path.join(RACINE, f), "utf8");
const TYPES = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css",
                wasm: "application/wasm", webmanifest: "application/manifest+json", woff2: "font/woff2" };

/** Un réseau qui sert les fichiers du dépôt, comme GitHub Pages le ferait. */
async function depuisDisque(req) {
  const url = new URL(req.url);
  if (!url.href.startsWith(BASE)) return new Response("hors site", { status: 404 });
  let rel = decodeURIComponent(url.pathname.slice(new URL(BASE).pathname.length));
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const fichier = path.join(RACINE, rel);
  if (!existsSync(fichier)) return new Response("absent", { status: 404 });
  const ext = rel.split(".").pop();
  return new Response(readFileSync(fichier), { status: 200, headers: { "content-type": TYPES[ext] || "application/octet-stream" } });
}
const horsLigne = async () => { throw new TypeError("Failed to fetch"); };
const requeteMoteur = url => ({ url, method: "GET", mode: "cors", headers: new Headers() });

/** Charge sw.js dans un contexte isolé, avec une API Cache en mémoire. */
function demarrerServiceWorker(env) {
  const magasins = new Map();          // nom du cache -> Map(url -> Response)
  class RequeteSW extends Request {    // les URL relatives du SW se résolvent sur sa portée
    constructor(entree, init) { super(typeof entree === "string" ? new URL(entree, BASE).href : entree, init); }
  }
  const versRequete = r => typeof r === "string" ? new RequeteSW(r) : r;
  const cle = (req, opts) => {
    const u = new URL(typeof req === "string" ? req : req.url, BASE);
    if (opts?.ignoreSearch) u.search = "";
    return u.href;
  };
  const cachePour = m => ({
    async match(req, opts) {
      if (typeof req !== "string" && req.method && req.method !== "GET" && !opts?.ignoreMethod) return undefined;
      const r = m.get(cle(req, opts));
      return r ? r.clone() : undefined;
    },
    async put(req, res) { m.set(cle(req), res); },
    async add(req) {
      const r = versRequete(req);
      const res = await env.reseau(r);
      if (!res.ok) throw new TypeError(`add : ${r.url} → ${res.status}`);
      m.set(cle(r), res);
    },
    async addAll(reqs) { for (const r of reqs) await this.add(r); },
    async keys() { return [...m.keys()].map(u => new Request(u)); },
    async delete(req) { return m.delete(cle(req)); }
  });
  const caches = {
    async open(nom) { if (!magasins.has(nom)) magasins.set(nom, new Map()); return cachePour(magasins.get(nom)); },
    async keys() { return [...magasins.keys()]; },
    async has(nom) { return magasins.has(nom); },
    async delete(nom) { return magasins.delete(nom); },
    async match(req, opts) {
      for (const m of magasins.values()) { const r = await cachePour(m).match(req, opts); if (r) return r; }
      return undefined;
    }
  };
  const ecouteurs = {};
  const bac = {
    addEventListener: (type, fn) => { ecouteurs[type] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
    location: new URL(BASE), caches, fetch: req => env.reseau(versRequete(req)),
    Request: RequeteSW, Response, URL, console, setTimeout, clearTimeout
  };
  bac.self = bac;
  vm.createContext(bac);
  new vm.Script(lire("sw.js"), { filename: "sw.js" }).runInContext(bac);

  /** Déclenche un événement ; rend la promesse confiée à waitUntil/respondWith, ou null si le SW a laissé passer. */
  const declencher = (type, ev = {}) => {
    let confie = null;
    ecouteurs[type]({ ...ev, waitUntil: p => { confie = p; }, respondWith: p => { confie = p; } });
    return confie;
  };
  const requete = (chemin, mode = "cors", method = "GET") =>
    ({ url: new URL(chemin, BASE).href, method, mode, headers: new Headers() });
  const version = () => [...magasins.keys()].find(k => k.startsWith("tms-"));
  /** Garnit un magasin comme si un navigateur l'avait rempli auparavant. */
  const garnir = (nom, urls) => magasins.set(nom, new Map(urls.map(u => [u, new Response(`ancien ${u}`)])));
  /** Les constantes du service worker (const de premier niveau, visibles dans le contexte). */
  const constante = nom => vm.runInContext(nom, bac);
  return { magasins, declencher, requete, version, garnir, constante };
}

async function installer(env = { reseau: depuisDisque }) {
  const sw = demarrerServiceWorker(env);
  await sw.declencher("install");
  return { sw, env };
}

/* ---------- La coquille de l'outil ---------- */

test("à l'installation, la coquille de l'outil (page, styles, polices, modules) est mise en cache — et chaque fichier listé existe", async () => {
  const { sw } = await installer();   // addAll est strict : un fichier listé mais absent ferait échouer l'installation
  const cles = [...sw.magasins.get(sw.version()).keys()];
  for (const f of ["cotation-video/", "cotation-video/index.html"]) assert.ok(cles.includes(BASE + f), f);
  const dossiers = { js: ".js", css: ".css", polices: ".woff2" };
  for (const [dossier, ext] of Object.entries(dossiers)) {
    const fichiers = readdirSync(path.join(RACINE, "cotation-video", dossier)).filter(f => f.endsWith(ext));
    assert.ok(fichiers.length >= (dossier === "js" ? 10 : 3), dossier);
    for (const f of fichiers) assert.ok(cles.includes(`${BASE}cotation-video/${dossier}/${f}`), `non préchargé : ${dossier}/${f}`);
  }
  assert.ok(!cles.some(k => k.includes("/cotation-video/vendor/")), "le moteur (vendor/) ne doit pas être préchargé avec le site");
});

test("hors ligne, l'outil s'ouvre et ses modules et polices se chargent depuis le cache", async () => {
  const { sw, env } = await installer();
  env.reseau = horsLigne;
  const page = await sw.declencher("fetch", { request: sw.requete("cotation-video/", "navigate") });
  assert.equal(page.status, 200);
  assert.equal(await page.text(), lire("cotation-video/index.html"));
  const module = await sw.declencher("fetch", { request: sw.requete("cotation-video/js/pose.js") });
  assert.equal(await module.text(), lire("cotation-video/js/pose.js"));
  const style = await sw.declencher("fetch", { request: sw.requete("cotation-video/css/polices.css") });
  assert.equal(await style.text(), lire("cotation-video/css/polices.css"));
  const police = await sw.declencher("fetch", { request: sw.requete("cotation-video/polices/barlow-condensed-latin-700-normal.woff2") });
  assert.equal(police.status, 200);
  assert.equal((await police.arrayBuffer()).byteLength, readFileSync(path.join(RACINE, "cotation-video/polices/barlow-condensed-latin-700-normal.woff2")).length);
});

test("l'outil ne charge rien d'un tiers : polices servies par lui-même, chaque fichier référencé existe", () => {
  const html = lire("cotation-video/index.html");
  const externes = [...html.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)="(https?:)?\/\/[^"]+"/g)].map(m => m[0]);
  assert.deepEqual(externes, [], "ressource externe dans index.html");
  assert.match(html, /<link rel="stylesheet" href="css\/polices\.css">/);
  const css = lire("cotation-video/css/polices.css");
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
  assert.equal(urls.length, 7);
  for (const u of urls) assert.ok(existsSync(path.join(RACINE, "cotation-video/css", u)), `police absente : ${u}`);
  /* Les graisses que les feuilles de l'outil utilisent réellement. */
  const faces = [...css.matchAll(/font-family: '([^']+)'; font-style: normal; font-weight: (\d+)/g)].map(m => `${m[1]} ${m[2]}`);
  assert.deepEqual(faces.sort(), ["Barlow 400", "Barlow 500", "Barlow 600", "Barlow 700",
    "Barlow Condensed 500", "Barlow Condensed 600", "Barlow Condensed 700"]);
  for (const licence of ["OFL-Barlow.txt", "OFL-Barlow-Condensed.txt"]) {
    assert.match(lire(`cotation-video/polices/${licence}`), /SIL Open Font License, Version 1\.1/);
  }
});

/* ---------- Le moteur de pose dans le service worker ---------- */

test("le moteur de pose est gardé à la première demande, dans un magasin versionné distinct des versions du site", async () => {
  const V = `${VENDOR}${VERSION_MOTEUR}/`;
  const fichiers = {
    [`${V}vision_bundle.mjs`]: "export const bundle = 1;",
    [`${V}wasm/vision_wasm_internal.js`]: "loader",
    [`${V}wasm/vision_wasm_internal.wasm`]: "\0asm",
    [`${V}pose_landmarker_full.task`]: "modele",
    [`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE}/vision_bundle.mjs`]: "export const cdn = 1;",
    [SOURCES.distant.modele.full]: "modele cdn"
  };
  const { sw, env } = await installer();
  let appels = 0;
  env.reseau = async req => { appels++; return req.url in fichiers ? new Response(fichiers[req.url], { status: 200 }) : depuisDisque(req); };
  for (const url of Object.keys(fichiers)) {
    const rep = await sw.declencher("fetch", { request: requeteMoteur(url) });
    assert.equal(await rep.text(), fichiers[url], url);
  }
  const magasin = sw.magasins.get(MAGASIN_MOTEUR);
  assert.ok(magasin, `magasin ${MAGASIN_MOTEUR} absent`);
  assert.deepEqual([...magasin.keys()].sort(), Object.keys(fichiers).sort());
  const versionne = [...sw.magasins.get(sw.version()).keys()];
  assert.ok(!versionne.some(k => k.includes("/cotation-video/vendor/") || k.includes("mediapipe")), "rien du moteur dans le cache versionné");

  env.reseau = horsLigne;
  const avant = appels;
  for (const url of Object.keys(fichiers)) {
    const rep = await sw.declencher("fetch", { request: requeteMoteur(url) });
    assert.equal(await rep.text(), fichiers[url], `${url} hors ligne`);
  }
  assert.equal(appels, avant, "aucune requête réseau ne doit partir hors ligne");
});

test("deux demandes simultanées du même fichier du moteur ne partent qu'une fois sur le réseau", async () => {
  const url = `${VENDOR}${VERSION_MOTEUR}/vision_bundle.mjs`;
  const { sw, env } = await installer();
  let appels = 0;
  env.reseau = async () => { appels++; return new Response("export const bundle = 1;", { status: 200 }); };
  /* La vérification de présence (GET) puis l'import arrivent coup sur coup,
     avant que la première copie soit rangée. */
  const premiere = sw.declencher("fetch", { request: requeteMoteur(url) });
  const seconde = sw.declencher("fetch", { request: requeteMoteur(url) });
  assert.equal((await premiere).status, 200);
  assert.equal(await (await seconde).text(), "export const bundle = 1;");
  assert.equal(appels, 1, "le second appel doit attendre le rangement du premier, pas retélécharger");
});

test("une réponse partielle ou une erreur du serveur n'est jamais gardée comme moteur", async () => {
  const url = `${VENDOR}${VERSION_MOTEUR}/wasm/vision_wasm_internal.wasm`;
  const { sw, env } = await installer();
  env.reseau = async () => new Response("morceau", { status: 206 });
  assert.equal((await sw.declencher("fetch", { request: requeteMoteur(url) })).status, 206);
  env.reseau = async () => new Response("erreur", { status: 500 });
  assert.equal((await sw.declencher("fetch", { request: requeteMoteur(url) })).status, 500);
  assert.ok(!sw.magasins.get(MAGASIN_MOTEUR)?.has(url));
  env.reseau = horsLigne;
  const rep = await sw.declencher("fetch", { request: requeteMoteur(url) });
  assert.equal(rep.type, "error", "hors ligne sans cache : une erreur réseau franche, pas une page déguisée");
});

test("le service worker laisse passer ce qui n'est ni au site ni au moteur", async () => {
  const { sw } = await installer();
  assert.equal(sw.declencher("fetch", { request: requeteMoteur("https://cdn.jsdelivr.net/npm/autre-paquet@1/x.js") }), null);
  assert.equal(sw.declencher("fetch", { request: requeteMoteur("https://storage.googleapis.com/autre-seau/fichier.bin") }), null);
  assert.equal(sw.declencher("fetch", { request: sw.requete(`cotation-video/vendor/${VERSION_MOTEUR}/vision_bundle.mjs`, "cors", "HEAD") }), null);
});

/* ---------- Une seule version du moteur ---------- */

test("une seule version du moteur : config.js la définit, le service worker, les adresses et le script la suivent", () => {
  const sw = demarrerServiceWorker({ reseau: depuisDisque });
  assert.equal(VERSION_MOTEUR, `${MEDIAPIPE}-pose${MODELE_POSE}`);
  assert.equal(sw.constante("VERSION_MOTEUR"), VERSION_MOTEUR,
    `sw.js doit porter const VERSION_MOTEUR = "${VERSION_MOTEUR}" (valeur de cotation-video/js/config.js)`);
  assert.equal(sw.constante("CACHE_MOTEUR"), MAGASIN_MOTEUR, "pose.js et sw.js doivent partager le magasin");
  assert.ok(!MAGASIN_MOTEUR.startsWith("tms-"), "un nom en « tms- » serait purgé à chaque version du site");
  assert.ok(lire("cotation-video/js/pose.js").includes("const CACHE_MODELES = MAGASIN_MOTEUR;"));
  /* Chaque adresse du moteur porte sa version : un navigateur ne peut pas
     resservir un ancien fichier sous une nouvelle adresse. */
  for (const source of ["local", "distant"]) {
    for (const p of ["full", "lite"]) {
      const f = fichiersMoteur(source, p);
      const marque = source === "local" ? `/vendor/${VERSION_MOTEUR}/` : `@${MEDIAPIPE}/`;
      for (const u of [f.bundle, ...f.wasm.flatMap(v => [v.script, v.binaire])]) assert.ok(u.includes(marque), u);
      assert.ok(f.modele.includes(source === "local" ? `/vendor/${VERSION_MOTEUR}/` : `/float16/${MODELE_POSE}/`), f.modele);
    }
  }
  const script = lire("cotation-video/outils/telecharger-modeles.sh");
  assert.ok(script.includes('"$RACINE/js/config.js"') && script.includes("VERSION_MOTEUR"), "le script lit la version dans config.js");
  assert.doesNotMatch(script, /tasks-vision@\d|float16\/\d/, "aucune version écrite en dur dans le script");
  assert.match(script, /VENDOR="\$RACINE\/vendor\/\$VERSION_MOTEUR"/);
});

test("le déploiement embarque le moteur (vendor/) avant la publication, sans le versionner dans git", () => {
  const deploiement = lire(".github/workflows/deploy-pages.yml");
  assert.match(deploiement, /telecharger-modeles\.sh tous/);
  assert.ok(deploiement.indexOf("telecharger-modeles.sh") < deploiement.indexOf("rsync"), "le moteur doit être en place avant la copie du site");
  assert.ok(!/--exclude='cotation-video/.test(deploiement), "l'outil fait partie du site publié");
  assert.match(lire("cotation-video/.gitignore"), /^vendor\/$/m);
  assert.match(lire("cotation-video/outils/telecharger-modeles.sh"), /tous\) MODELES="full lite"/);
  /* Les adresses sont versionnées : « immutable » y est juste. */
  assert.match(lire("netlify.toml"), /for = "\/cotation-video\/vendor\/\*"[\s\S]*?immutable/);
  assert.match(lire("vercel.json"), /"\/cotation-video\/vendor\/\(\.\*\)"[^\n]*immutable/);
});

/* ---------- Mise à jour du moteur ---------- */

const ANCIENNE = "0.9.9-pose1";
const ANCIEN_MAGASIN = `cotation-video-moteur-${ANCIENNE}`;
const RELATIFS = ["vision_bundle.mjs", "wasm/vision_wasm_internal.js", "wasm/vision_wasm_internal.wasm", "pose_landmarker_full.task"];
const vendorEn = (version, rel) => `${VENDOR}${version}/${rel}`;

/** Un réseau qui sert la version courante du moteur, et note ce qu'on lui demande. */
function reseauMoteur({ manquants = [], coupe = () => false } = {}) {
  const demandes = [];
  const reseau = async req => {
    const url = req.url;
    if (url.startsWith(VENDOR)) {
      demandes.push(url);
      if (coupe(url)) throw new TypeError("Failed to fetch");
      const rel = url.slice(`${VENDOR}${VERSION_MOTEUR}/`.length);
      if (!url.startsWith(`${VENDOR}${VERSION_MOTEUR}/`) || manquants.includes(rel)) return new Response("absent", { status: 404 });
      return new Response(`nouveau ${rel}`, { status: 200 });
    }
    return depuisDisque(req);
  };
  return { reseau, demandes };
}

test("mise à jour du moteur : un poste préparé reçoit le nouveau à l'installation, l'ancien est purgé à l'activation", async () => {
  const { reseau, demandes } = reseauMoteur();
  const env = { reseau };
  const sw = demarrerServiceWorker(env);
  /* Préparé avec l'ancienne version : bundle, variante SIMD, modèle standard — pas le rapide. */
  sw.garnir(ANCIEN_MAGASIN, [...RELATIFS.map(r => vendorEn(ANCIENNE, r)), SOURCES.distant.modele.full]);
  await sw.declencher("install");

  const courant = sw.magasins.get(MAGASIN_MOTEUR);
  assert.deepEqual([...courant.keys()].sort(), RELATIFS.map(r => vendorEn(VERSION_MOTEUR, r)).sort(),
    "exactement l'équivalent courant de ce que le poste avait gardé — ni le modèle rapide, ni l'entrée du CDN");
  assert.equal(await courant.get(vendorEn(VERSION_MOTEUR, "pose_landmarker_full.task")).clone().text(), "nouveau pose_landmarker_full.task");
  assert.equal(demandes.length, RELATIFS.length);
  assert.ok(sw.magasins.has(ANCIEN_MAGASIN), "l'ancien magasin reste en place tant que le nouveau service worker n'est pas actif");

  await sw.declencher("activate");
  assert.ok(!sw.magasins.has(ANCIEN_MAGASIN), "ancien magasin purgé");
  env.reseau = horsLigne;
  for (const rel of RELATIFS) {
    const rep = await sw.declencher("fetch", { request: requeteMoteur(vendorEn(VERSION_MOTEUR, rel)) });
    assert.equal(await rep.text(), `nouveau ${rel}`, `${rel} hors ligne après la mise à jour`);
  }
});

test("mise à jour du moteur : un fichier disparu de la nouvelle version (404) est ignoré, l'installation aboutit", async () => {
  const { reseau } = reseauMoteur({ manquants: ["wasm/vision_wasm_module_internal.wasm"] });
  const sw = demarrerServiceWorker({ reseau });
  sw.garnir(ANCIEN_MAGASIN, [...RELATIFS, "wasm/vision_wasm_module_internal.wasm"].map(r => vendorEn(ANCIENNE, r)));
  await sw.declencher("install");
  const courant = [...sw.magasins.get(MAGASIN_MOTEUR).keys()];
  assert.equal(courant.length, RELATIFS.length);
  assert.ok(!courant.some(u => u.includes("module_internal")));
});

test("mise à jour du moteur : une coupure fait échouer l'installation — l'ancien moteur reste, et l'essai suivant ne reprend que le manquant", async () => {
  let coupure = true;
  const { reseau, demandes } = reseauMoteur({ coupe: url => coupure && url.endsWith(".wasm") });
  const sw = demarrerServiceWorker({ reseau });
  sw.garnir(ANCIEN_MAGASIN, RELATIFS.map(r => vendorEn(ANCIENNE, r)));
  await assert.rejects(sw.declencher("install"), /Failed to fetch/);
  assert.equal(sw.magasins.get(ANCIEN_MAGASIN).size, RELATIFS.length, "l'ancien moteur, cohérent, reste disponible");
  const dejaLa = [...sw.magasins.get(MAGASIN_MOTEUR).keys()];
  assert.ok(dejaLa.length > 0 && dejaLa.length < RELATIFS.length);

  coupure = false;
  demandes.length = 0;
  await sw.declencher("install");            // le navigateur retente à la visite suivante
  assert.deepEqual(demandes, RELATIFS.map(r => vendorEn(VERSION_MOTEUR, r)).filter(u => !dejaLa.includes(u)),
    "seuls les fichiers manquants sont téléchargés de nouveau");
  assert.equal(sw.magasins.get(MAGASIN_MOTEUR).size, RELATIFS.length);
});

test("mise à jour du moteur : un poste qui n'avait jamais chargé le moteur embarqué ne télécharge rien ; l'ancien magasin est purgé", async () => {
  const { reseau, demandes } = reseauMoteur();
  const sw = demarrerServiceWorker({ reseau });
  /* Le magasin d'avant le versionnage, en production : pose.js n'y rangeait que le modèle, venu du CDN. */
  sw.garnir("cotation-video-modeles-v1", [SOURCES.distant.modele.full]);
  sw.garnir(ANCIEN_MAGASIN, [vendorEn(ANCIENNE, "pose_landmarker_full.task")]);   // modèle seul : jamais analysé ici
  sw.garnir("wiki-sst-v3", ["https://exemple.test/wiki/index.html"]);
  sw.garnir("tms-ancienne", [`${BASE}index.html`]);
  await sw.declencher("install");
  assert.deepEqual(demandes, []);
  await sw.declencher("activate");
  assert.deepEqual([...sw.magasins.keys()].sort(), [sw.version(), "wiki-sst-v3", MAGASIN_MOTEUR].filter(n => sw.magasins.has(n)).sort());
  assert.ok(!sw.magasins.has("cotation-video-modeles-v1") && !sw.magasins.has(ANCIEN_MAGASIN) && !sw.magasins.has("tms-ancienne"));
  assert.ok(sw.magasins.has("wiki-sst-v3"), "les caches des autres sites de l'origine ne sont jamais touchés");
});

/* ---------- L'outil ---------- */

test("l'outil enregistre lui-même le service worker du site, et n'insiste pas sur file://", () => {
  const app = lire("cotation-video/js/app.js");
  assert.ok(app.includes('navigator.serviceWorker.register("../sw.js")'));
  assert.ok(app.includes('location.protocol !== "file:"'));
});

test("la détection du dossier local passe par GET, le seul verbe servi depuis le cache", async (t) => {
  const fetchInitial = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchInitial; });
  const appels = [];
  let corpsAbandonne = false;
  const corps = { cancel: async () => { corpsAbandonne = true; } };
  globalThis.fetch = async (url, init) => { appels.push({ url: String(url), method: init?.method ?? "GET" }); return { ok: true, body: corps }; };
  assert.equal(await sourceDisponible(), "local");
  assert.equal(appels[0].method, "GET");
  assert.ok(corpsAbandonne, "le corps non lu est abandonné : sinon il retient le service worker et bloque les mises à jour");
  assert.ok(appels[0].url.endsWith(`cotation-video/vendor/${VERSION_MOTEUR}/vision_bundle.mjs`), appels[0].url);
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  assert.equal(await sourceDisponible(), "distant");
  globalThis.fetch = horsLigne;
  assert.equal(await sourceDisponible(), "local", "une coupure ne renvoie pas au CDN : il serait tout aussi injoignable, et c'est un tiers");
});

test("la télémétrie de MediaPipe est arrêtée avant de partir : aucune requête vers Google, le reste passe", async () => {
  const appels = [];
  const portee = { fetch: async (entree, init) => { appels.push(String(entree?.url ?? entree)); return new Response("ok"); } };
  bloquerTelemetrie(portee);
  bloquerTelemetrie(portee);   // idempotent : pas de garde empilée sur la garde
  const journal = await portee.fetch("https://odml.pa.googleapis.com/v1/log", { method: "POST", body: "x" });
  assert.equal(journal.status, 204, "le journal de MediaPipe voit un échec et cesse d'envoyer");
  assert.equal((await portee.fetch(new URL("https://odml.pa.googleapis.com/v1/log"))).status, 204);
  assert.equal(await (await portee.fetch(`${VENDOR}${VERSION_MOTEUR}/vision_bundle.mjs`)).text(), "ok");
  assert.deepEqual(appels, [`${VENDOR}${VERSION_MOTEUR}/vision_bundle.mjs`]);
  /* L'adresse bloquée est bien celle que le bundle embarqué appelle. */
  const bundle = path.join(RACINE, "cotation-video/vendor", VERSION_MOTEUR, "vision_bundle.mjs");
  if (existsSync(bundle)) assert.ok(readFileSync(bundle, "utf8").includes(`url:"${TELEMETRIE_MEDIAPIPE}v1/log"`), "adresse de télémétrie changée : mettre à jour TELEMETRIE_MEDIAPIPE");
});

test("etatMoteur détaille ce qui est conservé : le moteur (bundle + une variante WebAssembly complète), puis chaque modèle", async (t) => {
  const presents = new Set();
  globalThis.caches = { match: async url => presents.has(String(url)) ? new Response("x") : undefined };
  t.after(() => { delete globalThis.caches; });
  const vide = { moteur: false, source: null, modeles: { full: false, lite: false } };

  assert.deepEqual(await etatMoteur(), vide);
  const local = fichiersMoteur("local");
  assert.equal(local.wasm.length, 2);
  for (const u of [local.bundle, SOURCES.local.modele.full, local.wasm[0].script]) presents.add(u);
  assert.deepEqual(await etatMoteur(), vide, "binaire WebAssembly manquant : pas de moteur");
  presents.add(local.wasm[0].binaire);
  assert.deepEqual(await etatMoteur(), { moteur: true, source: "local", modeles: { full: true, lite: false } });
  presents.add(SOURCES.local.modele.lite);
  assert.deepEqual(await etatMoteur(), { moteur: true, source: "local", modeles: { full: true, lite: true } });

  presents.clear();
  const distant = fichiersMoteur("distant");
  for (const u of [distant.bundle, distant.wasm[1].script, distant.wasm[1].binaire]) presents.add(u);
  assert.deepEqual(await etatMoteur(), { moteur: true, source: "distant", modeles: { full: false, lite: false } },
    "moteur sans modèle : conservé, mais pas encore prêt");
  presents.add(SOURCES.distant.modele.lite);
  assert.deepEqual(await etatMoteur(), { moteur: true, source: "distant", modeles: { full: false, lite: true } });
});

test("un échec du moteur est expliqué en français, avec ce qu'il faut faire", async () => {
  const S = { nom: "local (hors ligne)" };
  const brute = new TypeError("Failed to fetch dynamically imported module");
  const sansReseau = await expliquerErreurMoteur(brute, S, { horsLigne: true, webgl: true, conserve: false });
  assert.equal(sansReseau.name, "ErreurMoteur");
  assert.match(sansReseau.message, /pas disponible hors ligne/);
  assert.match(sansReseau.message, /Préparer le mode hors ligne/);
  assert.equal(sansReseau.cause, brute);
  /* Réseau local sans Internet : navigator.onLine dit « en ligne », le téléchargement échoue quand même. */
  const reseauMuet = await expliquerErreurMoteur(brute, S, { horsLigne: false, webgl: true, conserve: false });
  assert.match(reseauMuet.message, /la connexion ne répond pas/);
  assert.match(reseauMuet.message, /Préparer le mode hors ligne/);
  const sansWebGL = await expliquerErreurMoteur(new TypeError("Cannot read properties of undefined (reading 'activeTexture')"), S,
    { horsLigne: false, webgl: false, conserve: true });
  assert.match(sansWebGL.message, /WebGL 2/);
  assert.match(sansWebGL.message, /accélération graphique/);
  const autre = await expliquerErreurMoteur(new Error("RuntimeError: Aborted()"), S, { horsLigne: false, webgl: true, conserve: true });
  assert.match(autre.message, /local \(hors ligne\)/);
  assert.match(autre.message, /Aborted/);
});

/* ---------- Le délégué : GPU ou processeur ---------- */

/** Un contexte WebGL 2 de fantaisie : nom du rendu, extension de débogage, tampons flottants. */
function faux({ renderer = "WebKit WebGL", debug = null, float = true } = {}) {
  const demandees = [];
  return {
    RENDERER: 0x1F01,
    getParameter(p) { return p === 0x1F01 ? renderer : p === 0x9246 ? debug : null; },
    getExtension(nom) {
      demandees.push(nom);
      if (nom === "WEBGL_debug_renderer_info") return debug ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null;
      if (nom === "EXT_color_buffer_float") return float ? {} : null;
      return null;
    },
    demandees
  };
}

test("le délégué : GPU seulement s'il est matériel et a des tampons flottants ; sinon le processeur", () => {
  assert.equal(choisirDelegue(null).delegue, "CPU");
  assert.match(choisirDelegue(null).raison, /WebGL 2 indisponible/);
  /* Chrome et Safari masquent RENDERER : le vrai nom vient de l'extension de débogage. */
  const swiftshader = choisirDelegue(faux({ debug: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" }));
  assert.deepEqual([swiftshader.delegue, swiftshader.raison], ["CPU", "rendu graphique logiciel"]);
  assert.equal(choisirDelegue(faux({ debug: "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)" })).delegue, "CPU");
  /* Firefox donne le vrai nom dans RENDERER : l'extension obsolète n'est pas demandée. */
  const firefox = faux({ renderer: "llvmpipe, or similar" });
  assert.equal(choisirDelegue(firefox).delegue, "CPU");
  assert.ok(!firefox.demandees.includes("WEBGL_debug_renderer_info"));
  /* Matériel sans EXT_color_buffer_float : MediaPipe ne détecterait plus personne, sans erreur. */
  const sansFlottants = choisirDelegue(faux({ debug: "ANGLE (ARM, Mali-G52, OpenGL ES 3.2)", float: false }));
  assert.deepEqual([sansFlottants.delegue, sansFlottants.raison], ["CPU", "GPU sans tampons de couleur flottants"]);
  assert.equal(choisirDelegue(faux({ debug: "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)" })).delegue, "GPU");
  assert.equal(choisirDelegue(faux({ debug: "Apple GPU" })).delegue, "GPU");
});

/** Une doublure de PoseLandmarker : chaque délégué réussit ou échoue à la création, ou à l'amorçage. */
function doublure(pannes = {}) {
  const journal = [];
  const PoseLandmarker = {
    async createFromOptions(fileset, options) {
      const delegue = options.baseOptions.delegate;
      journal.push(`créer ${delegue}`);
      if (pannes[delegue] === "creation") throw new Error(`INTERNAL: Service "kGpuService" (${delegue})`);
      return {
        options,
        detect(image) { journal.push(`amorcer ${delegue} image`); if (pannes[delegue] === "amorce") throw new Error("Calculator::Open() failed"); return { landmarks: [] }; },
        detectForVideo(image, t) { journal.push(`amorcer ${delegue} vidéo t=${t}`); if (pannes[delegue] === "amorce") throw new Error("Calculator::Open() failed"); return { landmarks: [] }; },
        close() { journal.push(`fermer ${delegue}`); }
      };
    }
  };
  return { PoseLandmarker, journal };
}
const OPTIONS = { baseOptions: { modelAssetBuffer: new Uint8Array(4) }, runningMode: "IMAGE", numPoses: 1 };
const GPU = { delegue: "GPU", raison: "GPU matériel complet" };
const AMORCE = { amorce: () => ({ vide: true }) };

test("création du détecteur : GPU conseillé et sain, il est gardé — amorcé, options intactes", async () => {
  const { PoseLandmarker, journal } = doublure();
  const r = await creerDetecteur(PoseLandmarker, {}, OPTIONS, { conseil: GPU, ...AMORCE });
  assert.equal(r.delegue, "GPU");
  assert.equal(r.decalage, 0);
  assert.deepEqual(journal, ["créer GPU", "amorcer GPU image"]);
  assert.equal(r.detecteur.options.baseOptions.delegate, "GPU");
  assert.equal(r.detecteur.options.baseOptions.modelAssetBuffer, OPTIONS.baseOptions.modelAssetBuffer);
  assert.equal(r.detecteur.options.numPoses, 1);
  assert.equal(OPTIONS.baseOptions.delegate, undefined, "les options de l'appelant ne sont pas modifiées");
});

test("création du détecteur : le GPU échoue à la création → processeur", async () => {
  const { PoseLandmarker, journal } = doublure({ GPU: "creation" });
  const r = await creerDetecteur(PoseLandmarker, {}, OPTIONS, { conseil: GPU, ...AMORCE });
  assert.equal(r.delegue, "CPU");
  assert.match(r.raison, /échec du GPU/);
  assert.deepEqual(journal, ["créer GPU", "créer CPU", "amorcer CPU image"]);
});

test("création du détecteur : le GPU échoue au premier passage (amorçage) → fermé, puis processeur", async () => {
  const { PoseLandmarker, journal } = doublure({ GPU: "amorce" });
  const r = await creerDetecteur(PoseLandmarker, {}, { ...OPTIONS, runningMode: "VIDEO" }, { conseil: GPU, ...AMORCE });
  assert.equal(r.delegue, "CPU");
  assert.equal(r.decalage, 1, "l'amorçage vidéo a consommé l'horodatage 0 : les images réelles commencent à 1");
  assert.deepEqual(journal, ["créer GPU", "amorcer GPU vidéo t=0", "fermer GPU", "créer CPU", "amorcer CPU vidéo t=0"]);
});

test("création du détecteur : processeur conseillé → le GPU n'est jamais essayé ; tout échoue → l'erreur remonte", async () => {
  const conseilCPU = { delegue: "CPU", raison: "rendu graphique logiciel" };
  const saine = doublure();
  const r = await creerDetecteur(saine.PoseLandmarker, {}, OPTIONS, { conseil: conseilCPU, ...AMORCE });
  assert.deepEqual([r.delegue, r.raison], ["CPU", "rendu graphique logiciel"]);
  assert.deepEqual(saine.journal, ["créer CPU", "amorcer CPU image"]);
  const cassee = doublure({ GPU: "creation", CPU: "amorce" });
  await assert.rejects(creerDetecteur(cassee.PoseLandmarker, {}, OPTIONS, { conseil: GPU, ...AMORCE }), /Calculator::Open/);
  assert.deepEqual(cassee.journal, ["créer GPU", "créer CPU", "amorcer CPU image", "fermer CPU"]);
});

test("l'accueil de l'outil annonce l'état hors ligne, propose de s'y préparer, et le pied de page dit quel moteur a servi", () => {
  const html = lire("cotation-video/index.html");
  assert.match(html, /id="horsLigne"/);
  assert.match(html, /id="horsLigneEtat" role="status"/);
  assert.match(html, /id="preparerHorsLigne"/);
  const app = lire("cotation-video/js/app.js");
  assert.ok(app.includes('e.name === "ErreurMoteur" ? e.message'), "le message du moteur est montré tel quel");
  assert.ok(app.includes('window.addEventListener("offline", majHorsLigne)'));
  assert.ok(app.includes("Object.assign(el.badgeMoteur.dataset"), "source, délégué et modèle exposés sur le pied de page");
  assert.match(app, /moteur: etat\.mode === "demo" \|\| !etat\.moteur \? null/, "le moteur figure dans l'export JSON");
});
