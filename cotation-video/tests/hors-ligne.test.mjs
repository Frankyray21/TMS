/* ============================================================================
   Mode hors ligne de l'analyse ergonomique.

   Le service worker du site (sw.js) est exécuté dans un bac à sable Node —
   aucun navigateur, aucun réseau — et on lui soumet les requêtes qu'un poste
   sous terre lui ferait : ouvrir l'outil, charger ses modules, rejouer le
   moteur de pose. Les autres vérifications s'assurent que les pièces se
   tiennent : même nom de magasin des deux côtés, enregistrement du service
   worker par l'outil, moteur embarqué au déploiement, détection du dossier
   local en GET, état hors ligne annoncé à l'écran.

   Le parcours complet dans un vrai navigateur est dans verifier-hors-ligne.mjs
   (Playwright, à lancer à la main avant une publication).
   ============================================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
/* La portée du service worker : un sous-dossier de l'origine, comme sur GitHub Pages. */
const BASE = "https://exemple.test/TMS/";
const MAGASIN_MOTEUR = "cotation-video-modeles-v1";
const lire = f => readFileSync(path.join(RACINE, f), "utf8");
const TYPES = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css",
                wasm: "application/wasm", webmanifest: "application/manifest+json" };

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
    Request: RequeteSW, Response, URL, console
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
  return { magasins, declencher, requete, version };
}

async function installer(env = { reseau: depuisDisque }) {
  const sw = demarrerServiceWorker(env);
  await sw.declencher("install");
  return { sw, env };
}

test("à l'installation, la coquille de l'outil est mise en cache avec le site — et chaque fichier listé existe", async () => {
  const { sw } = await installer();   // addAll est strict : un fichier listé mais absent ferait échouer l'installation
  const cles = [...sw.magasins.get(sw.version()).keys()];
  for (const f of ["cotation-video/", "cotation-video/index.html"]) assert.ok(cles.includes(BASE + f), f);
  const modules = readdirSync(path.join(RACINE, "cotation-video/js")).filter(f => f.endsWith(".js"));
  assert.ok(modules.length >= 10);
  for (const m of modules) assert.ok(cles.includes(`${BASE}cotation-video/js/${m}`), `module non préchargé : ${m}`);
  for (const c of readdirSync(path.join(RACINE, "cotation-video/css")).filter(f => f.endsWith(".css"))) {
    assert.ok(cles.includes(`${BASE}cotation-video/css/${c}`), `feuille non préchargée : ${c}`);
  }
  assert.ok(!cles.some(k => k.includes("/cotation-video/vendor/")), "le moteur (vendor/) ne doit pas être préchargé avec le site");
});

test("hors ligne, l'outil s'ouvre et ses modules se chargent depuis le cache", async () => {
  const { sw, env } = await installer();
  env.reseau = horsLigne;
  const page = await sw.declencher("fetch", { request: sw.requete("cotation-video/", "navigate") });
  assert.equal(page.status, 200);
  assert.equal(await page.text(), lire("cotation-video/index.html"));
  const module = await sw.declencher("fetch", { request: sw.requete("cotation-video/js/pose.js") });
  assert.equal(await module.text(), lire("cotation-video/js/pose.js"));
  const style = await sw.declencher("fetch", { request: sw.requete("cotation-video/css/parcours.css") });
  assert.equal(style.status, 200);
});

test("le moteur de pose est gardé à la première demande, dans un magasin distinct des versions du site", async () => {
  const fichiers = {
    [`${BASE}cotation-video/vendor/vision_bundle.mjs`]: "export const bundle = 1;",
    [`${BASE}cotation-video/vendor/wasm/vision_wasm_internal.js`]: "loader",
    [`${BASE}cotation-video/vendor/wasm/vision_wasm_internal.wasm`]: "\0asm",
    [`${BASE}cotation-video/vendor/pose_landmarker_full.task`]: "modele",
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs": "export const cdn = 1;",
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task": "modele cdn"
  };
  const { sw, env } = await installer();
  let appels = 0;
  env.reseau = async req => { appels++; return req.url in fichiers ? new Response(fichiers[req.url], { status: 200 }) : depuisDisque(req); };
  for (const url of Object.keys(fichiers)) {
    const rep = await sw.declencher("fetch", { request: requeteMoteur(url) });
    assert.equal(await rep.text(), fichiers[url], url);
  }
  const magasin = sw.magasins.get(MAGASIN_MOTEUR);
  assert.ok(magasin, "magasin du moteur absent");
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
  const url = `${BASE}cotation-video/vendor/vision_bundle.mjs`;
  const { sw, env } = await installer();
  let appels = 0, liberer;
  const rangementLent = new Promise(r => { liberer = r; });
  env.reseau = async () => { appels++; return new Response("export const bundle = 1;", { status: 200 }); };
  /* La vérification de présence (GET) puis l'import arrivent coup sur coup,
     avant que la première copie soit rangée. */
  const premiere = sw.declencher("fetch", { request: requeteMoteur(url) });
  const rep1 = await premiere;
  assert.equal(rep1.status, 200);
  const seconde = sw.declencher("fetch", { request: requeteMoteur(url) });
  liberer(); await rangementLent;
  const rep2 = await seconde;
  assert.equal(await rep2.text(), "export const bundle = 1;");
  assert.equal(appels, 1, "le second appel doit attendre le rangement du premier, pas retélécharger");
});

test("une réponse partielle ou une erreur du serveur n'est jamais gardée comme moteur", async () => {
  const url = `${BASE}cotation-video/vendor/wasm/vision_wasm_internal.wasm`;
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
  assert.equal(sw.declencher("fetch", { request: sw.requete("cotation-video/vendor/vision_bundle.mjs", "cors", "HEAD") }), null);
});

test("à l'activation, la purge des anciennes versions épargne le magasin du moteur et les caches des autres sites", async () => {
  const { sw } = await installer();
  sw.magasins.set("tms-ancienne", new Map());
  sw.magasins.set(MAGASIN_MOTEUR, new Map());
  sw.magasins.set("wiki-sst-v3", new Map());
  await sw.declencher("activate");
  assert.deepEqual([...sw.magasins.keys()].sort(), [sw.version(), MAGASIN_MOTEUR, "wiki-sst-v3"].sort());
});

test("le magasin du moteur porte le même nom dans le service worker et dans pose.js", () => {
  const nom = /const CACHE_MOTEUR = "([^"]+)"/.exec(lire("sw.js"))?.[1];
  assert.equal(nom, MAGASIN_MOTEUR);
  assert.ok(lire("cotation-video/js/pose.js").includes(`const CACHE_MODELES = "${nom}"`));
  assert.ok(!nom.startsWith("tms-"), "un nom en « tms- » serait purgé à chaque version du site");
});

test("l'outil enregistre lui-même le service worker du site, et n'insiste pas sur file://", () => {
  const app = lire("cotation-video/js/app.js");
  assert.ok(app.includes('navigator.serviceWorker.register("../sw.js")'));
  assert.ok(app.includes('location.protocol !== "file:"'));
});

test("le déploiement embarque le moteur (vendor/) avant la publication, sans le versionner", () => {
  const deploiement = lire(".github/workflows/deploy-pages.yml");
  assert.match(deploiement, /telecharger-modeles\.sh tous/);
  assert.ok(deploiement.indexOf("telecharger-modeles.sh") < deploiement.indexOf("rsync"), "le moteur doit être en place avant la copie du site");
  assert.ok(!/--exclude='cotation-video/.test(deploiement), "l'outil fait partie du site publié");
  assert.match(lire("cotation-video/.gitignore"), /^vendor\/$/m);
  const script = lire("cotation-video/outils/telecharger-modeles.sh");
  assert.match(script, /tous\) MODELES="full lite"/);
});

test("la détection du dossier local passe par GET, le seul verbe servi depuis le cache", async (t) => {
  const { sourceDisponible } = await import("../js/config.js");
  const fetchInitial = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchInitial; });
  const appels = [];
  globalThis.fetch = async (url, init) => { appels.push({ url: String(url), method: init?.method ?? "GET" }); return { ok: true }; };
  assert.equal(await sourceDisponible(), "local");
  assert.equal(appels[0].method, "GET");
  assert.match(appels[0].url, /cotation-video\/vendor\/vision_bundle\.mjs$/);
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  assert.equal(await sourceDisponible(), "distant");
  globalThis.fetch = horsLigne;
  assert.equal(await sourceDisponible(), "distant");
});

test("moteurEnCache ne dit « prêt » que si bundle, une variante WebAssembly complète et le modèle sont conservés", async (t) => {
  const { moteurEnCache } = await import("../js/pose.js");
  const { fichiersMoteur } = await import("../js/config.js");
  const presents = new Set();
  globalThis.caches = { match: async url => presents.has(String(url)) ? new Response("x") : undefined };
  t.after(() => { delete globalThis.caches; });

  assert.deepEqual(await moteurEnCache("full"), { pret: false });
  const local = fichiersMoteur("local", "full");
  assert.match(local.bundle, /cotation-video\/vendor\/vision_bundle\.mjs$/);
  assert.equal(local.wasm.length, 2);
  for (const u of [local.bundle, local.modele, local.wasm[0].script]) presents.add(u);
  assert.deepEqual(await moteurEnCache("full"), { pret: false }, "binaire WebAssembly manquant");
  presents.add(local.wasm[0].binaire);
  assert.deepEqual(await moteurEnCache("full"), { pret: true, source: "local" });
  assert.deepEqual(await moteurEnCache("lite"), { pret: false }, "l'autre modèle n'est pas là");

  presents.clear();
  const distant = fichiersMoteur("distant", "lite");
  assert.match(distant.modele, /^https:\/\/storage\.googleapis\.com\/mediapipe-models\//);
  for (const u of [distant.bundle, distant.modele, distant.wasm[1].script, distant.wasm[1].binaire]) presents.add(u);
  assert.deepEqual(await moteurEnCache("lite"), { pret: true, source: "distant" });
});

test("un échec du moteur est expliqué en français, avec la marche à suivre hors ligne", async () => {
  const { expliquerErreurMoteur } = await import("../js/pose.js");
  const S = { nom: "local (hors ligne)" };
  const brute = new TypeError("Failed to fetch dynamically imported module");
  const sansReseau = expliquerErreurMoteur(brute, S, true);
  assert.equal(sansReseau.name, "ErreurMoteur");
  assert.match(sansReseau.message, /hors ligne/);
  assert.match(sansReseau.message, /Préparer le mode hors ligne/);
  assert.equal(sansReseau.cause, brute);
  const avecReseau = expliquerErreurMoteur(brute, S, false);
  assert.match(avecReseau.message, /local \(hors ligne\)/);
  assert.match(avecReseau.message, /Failed to fetch dynamically imported module/);
});

test("l'accueil de l'outil annonce l'état hors ligne et propose de s'y préparer", () => {
  const html = lire("cotation-video/index.html");
  assert.match(html, /id="horsLigne"/);
  assert.match(html, /id="horsLigneEtat" role="status"/);
  assert.match(html, /id="preparerHorsLigne"/);
  const app = lire("cotation-video/js/app.js");
  assert.ok(app.includes('e.name === "ErreurMoteur" ? e.message'), "le message du moteur est montré tel quel");
  assert.ok(app.includes('window.addEventListener("offline", majHorsLigne)'));
});
