#!/usr/bin/env node
/* ============================================================================
   verifier-hors-ligne.mjs — Le mode hors ligne dans un vrai navigateur.

   Pas un test de la CI : il faut Chromium via Playwright et le moteur dans
   vendor/ (bash outils/telecharger-modeles.sh). Depuis la racine du dépôt :

     NODE_PATH="$(npm root -g)" node cotation-video/tests/verifier-hors-ligne.mjs
       [--photo chemin.jpg]   la photo analysée ; par défaut tests/posture-essai.jpg,
                              un travailleur de profil portant une caisse (détail
                              agrandi de images/posture_p1.webp), que le modèle détecte

   Déroulé :
     1. le dépôt est servi en HTTP local, sans cache HTTP (no-store), pour que
        seul le service worker puisse répondre une fois le réseau coupé ;
     2. en ligne — poste A : accueil du site (le service worker s'installe),
        puis l'outil : « Préparer le mode hors ligne », puis analyse d'une photo ;
        poste B : n'ouvre que l'accueil du site ;
     3. le serveur est arrêté ET le navigateur passé hors ligne ;
     4. hors ligne — poste A : l'outil se rouvre, la photo s'analyse (moteur et
        modèle viennent du cache) ; poste B : l'outil s'ouvre quand même, la
        démonstration marche, et l'importation dit pourquoi l'analyse attend
        le réseau.
   Chaque vérification est listée en sortie ; code de retour 1 si l'une échoue.
   ============================================================================ */
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (nom, defaut) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : defaut; };
const PHOTO = path.resolve(RACINE, option("--photo", "cotation-video/tests/posture-essai.jpg"));
const MAGASIN_MOTEUR = "cotation-video-modeles-v1";

function chargerPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require("playwright"); } catch (_) {}
  try { return require(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright")); } catch (_) {}
  console.error("Playwright introuvable : npm i -g playwright && npx playwright install chromium, puis relancer avec NODE_PATH=\"$(npm root -g)\".");
  process.exit(2);
}

/* ---------- Serveur statique : le dépôt tel que GitHub Pages le sert ---------- */
const TYPES = {
  html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css",
  json: "application/json", webmanifest: "application/manifest+json", wasm: "application/wasm",
  task: "application/octet-stream", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", svg: "image/svg+xml", glb: "model/gltf-binary", mp4: "video/mp4", xml: "application/xml"
};
const journal = [];   // chemins servis : ce qui est vraiment passé par le réseau
function demarrerServeur() {
  const sockets = new Set();
  const serveur = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const fichier = path.join(RACINE, path.normalize(rel));
    if (!fichier.startsWith(RACINE) || !existsSync(fichier) || statSync(fichier).isDirectory()) { res.writeHead(404); res.end("absent"); return; }
    journal.push(rel);
    /* no-store : le cache HTTP du navigateur ne doit rien pouvoir rejouer hors
       ligne, sinon il masquerait ce que le service worker fait — ou ne fait pas. */
    res.writeHead(200, { "content-type": TYPES[rel.split(".").pop().toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(fichier));
  });
  serveur.on("connection", s => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  return new Promise(resolve => serveur.listen(0, "127.0.0.1", () => resolve({
    base: `http://127.0.0.1:${serveur.address().port}/`,
    arreter: () => new Promise(r => { serveur.close(() => r()); for (const s of sockets) s.destroy(); })
  })));
}

/* ---------- Vérifications ---------- */
const verifs = [];
const verifier = (nom, ok, detail = "") => {
  verifs.push({ nom, ok: !!ok });
  console.log(`${ok ? "✔" : "✘"} ${nom}${detail ? `\n    ${detail}` : ""}`);
};
const texte = (page, sel) => page.locator(sel).evaluate(e => e.textContent.trim()).catch(() => "");
const messageSession = page => page.locator("#messageSession").evaluate(e => e.hidden ? "" : e.textContent.trim());

async function attendreServiceWorker(page) {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { support: false };
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("service worker jamais prêt : installation échouée ?")), 90000))
    ]);
    if (!navigator.serviceWorker.controller) {
      await new Promise(r => { navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }); setTimeout(r, 5000); });
    }
    return { support: true, scope: reg.scope, controle: !!navigator.serviceWorker.controller };
  });
}

async function contenuCaches(page) {
  return page.evaluate(async () => {
    const contenu = {};
    for (const nom of await caches.keys()) contenu[nom] = (await (await caches.open(nom)).keys()).map(r => r.url);
    return contenu;
  });
}

/** Attend la fin d'une analyse : un score affiché, ou un message de session. */
async function attendreAnalyse(page, delai = 240000) {
  await page.waitForFunction(() => {
    const m = document.querySelector("#messageSession");
    const n = document.querySelector("#niveauLibelle");
    const enCours = document.querySelector("#statutSession")?.textContent.includes("en cours");
    return !enCours && ((m && !m.hidden && m.textContent.trim()) || (n && n.textContent.trim() !== "—"));
  }, null, { timeout: delai });
  return {
    niveau: await texte(page, "#niveauLibelle"),
    message: await messageSession(page),
    moteur: await texte(page, "#badgeMoteur"),
    segments: await page.locator("#corpsSegments tr").count()
  };
}

const ECHEC = /n'a pas abouti|n'a pas pu|pas disponible hors ligne/;
const { chromium } = chargerPlaywright();
const serveur = await demarrerServeur();
const BASE = serveur.base;
/* SwiftShader : un rendu WebGL logiciel, pour que le délégué GPU de MediaPipe
   ait un contexte même sans carte graphique (serveur, conteneur). */
const navigateur = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctxA = await navigateur.newContext({ serviceWorkers: "allow" });
const ctxB = await navigateur.newContext({ serviceWorkers: "allow" });
const A = await ctxA.newPage(), B = await ctxB.newPage();
const erreursConsole = [];
for (const p of [A, B]) {
  p.on("pageerror", e => erreursConsole.push(e.stack || String(e)));
  p.on("console", m => { if (m.type() === "error") erreursConsole.push(m.text()); });
}

try {
  console.log(`Serveur : ${BASE}\nPhoto   : ${path.relative(RACINE, PHOTO)}\n\n— En ligne —`);
  await A.goto(BASE + "index.html");
  const swA = await attendreServiceWorker(A);
  verifier("site : service worker installé, actif et aux commandes", swA.support && swA.controle, `portée ${swA.scope || "?"}`);
  const cachesA = await contenuCaches(A);
  const versionA = Object.keys(cachesA).find(k => k.startsWith("tms-"));
  const coquille = ["cotation-video/", "cotation-video/index.html", "cotation-video/css/app.css", "cotation-video/css/parcours.css",
                    "cotation-video/js/app.js", "cotation-video/js/pose.js", "cotation-video/js/config.js"].map(f => BASE + f);
  verifier("site : la coquille de l'outil est préchargée dès la visite de l'accueil",
    versionA && coquille.every(u => cachesA[versionA].includes(u)), `${cachesA[versionA]?.length ?? 0} entrées dans ${versionA}`);

  await A.goto(BASE + "cotation-video/");
  await attendreServiceWorker(A);
  await A.waitForSelector("#horsLigne:not([hidden])");
  const etat0 = await texte(A, "#horsLigneEtat");
  verifier("outil : propose de préparer le mode hors ligne avant toute analyse",
    /Pour analyser sans réseau/.test(etat0) && await A.locator("#preparerHorsLigne").isVisible(), etat0);

  const avantPreparation = journal.length;
  await A.click("#preparerHorsLigne");
  await A.waitForSelector('#horsLigne[data-etat="pret"], #messageSession:not([hidden])', { timeout: 240000 });
  const etat1 = await texte(A, "#horsLigneEtat");
  const message1 = await messageSession(A);
  const telecharges = journal.slice(avantPreparation).filter(r => r.includes("/vendor/"));
  verifier("outil : « Préparer le mode hors ligne » aboutit à « Prêt hors ligne »", /Prêt hors ligne/.test(etat1) && !message1, message1 || etat1);
  verifier("outil : le moteur vient de vendor/ (même origine), pas d'un CDN",
    telecharges.some(r => r.endsWith(".mjs")) && telecharges.some(r => r.endsWith(".wasm")) && telecharges.some(r => r.endsWith(".task")),
    telecharges.map(r => r.replace("/cotation-video/vendor/", "")).join(", "));

  await A.setInputFiles("#fichier", PHOTO);
  const enLigne = await attendreAnalyse(A);
  verifier("outil : la photo s'analyse en ligne", !ECHEC.test(enLigne.message), `${enLigne.niveau !== "—" ? enLigne.niveau : enLigne.message} · ${enLigne.moteur}`);
  const moteur = (await contenuCaches(A))[MAGASIN_MOTEUR] || [];
  verifier("cache : le magasin du moteur contient bundle, WebAssembly et modèle",
    moteur.some(u => u.endsWith("vision_bundle.mjs")) && moteur.some(u => u.endsWith(".wasm")) && moteur.some(u => u.endsWith(".task")),
    moteur.map(u => u.replace(BASE + "cotation-video/vendor/", "")).join(", "));

  await B.goto(BASE + "index.html");
  const swB = await attendreServiceWorker(B);
  verifier("poste B : n'a visité que l'accueil du site ; service worker aux commandes", swB.controle);

  /* ---- Coupure ---- */
  await serveur.arreter();
  await ctxA.setOffline(true);
  await ctxB.setOffline(true);
  const requetesAvant = journal.length;
  console.log("\n— Serveur arrêté, navigateur hors ligne —");

  /* ---- Poste A : a préparé le mode hors ligne ---- */
  const repA = await A.goto(BASE + "cotation-video/");
  verifier("A : l'outil se rouvre, servi par le service worker", repA?.ok() && await repA.fromServiceWorker(), `HTTP ${repA?.status()} · « ${await A.title()} »`);
  verifier("A : le navigateur se sait hors ligne", (await A.evaluate(() => navigator.onLine)) === false);
  await A.waitForSelector("#horsLigne:not([hidden])");
  const etat2 = await texte(A, "#horsLigneEtat");
  verifier("A : l'outil annonce « Prêt hors ligne »", /Prêt hors ligne/.test(etat2), etat2);
  await A.setInputFiles("#fichier", PHOTO);
  const horsLigne = await attendreAnalyse(A);
  verifier("A : la photo s'analyse sans réseau, avec le moteur local",
    !ECHEC.test(horsLigne.message) && /local/.test(horsLigne.moteur),
    `${horsLigne.niveau !== "—" ? horsLigne.niveau : horsLigne.message} · ${horsLigne.moteur} · ${horsLigne.segments} segments`);
  verifier("A : même résultat qu'en ligne", horsLigne.niveau === enLigne.niveau && horsLigne.message === enLigne.message);
  verifier("A : le rapport et l'export restent disponibles", horsLigne.segments === 0 || !(await A.locator("#exportJson").isDisabled()));

  /* ---- Poste B : n'a jamais ouvert l'outil ---- */
  const repB = await B.goto(BASE + "cotation-video/");
  verifier("B : l'outil s'ouvre bien qu'il n'ait jamais été visité", repB?.ok() && await repB.fromServiceWorker(), `HTTP ${repB?.status()}`);
  await B.waitForSelector("#horsLigne:not([hidden])");
  const etatB = await texte(B, "#horsLigneEtat");
  verifier("B : l'outil dit que le moteur n'est pas conservé et que l'analyse attendra le réseau",
    /Hors ligne, et le moteur/.test(etatB) && !(await B.locator("#preparerHorsLigne").isVisible()), etatB);
  await B.click("#voirDemo");
  await B.waitForSelector("#atelier:not([hidden])");
  const niveauDemo = await texte(B, "#niveauLibelle");
  verifier("B : la démonstration simulée fonctionne", niveauDemo && niveauDemo !== "—", niveauDemo);
  await B.setInputFiles("#fichier", PHOTO);
  const echecB = await attendreAnalyse(B);
  verifier("B : l'importation explique en français que le moteur attend le réseau",
    /pas disponible hors ligne/.test(echecB.message) && /Préparer le mode hors ligne/.test(echecB.message), echecB.message);
  verifier("B : aucun résultat n'est affiché après cet échec", echecB.niveau === "—" && echecB.segments === 0);
  verifier("réseau : aucune requête n'a atteint le serveur après la coupure", journal.length === requetesAvant);
} catch (e) {
  verifier(`déroulé interrompu : ${String(e.message || e).split("\n")[0]}`, false);
} finally {
  await navigateur.close().catch(() => {});
  await serveur.arreter().catch(() => {});
}

const echecs = verifs.filter(v => !v.ok);
console.log(`\n${verifs.length - echecs.length}/${verifs.length} vérifications réussies.`);
/* Attendues : les polices hors ligne, l'ErreurMoteur du poste B (c'est le scénario),
   et le corps 3D de l'accueil dont le chargement est interrompu par la navigation vers l'outil. */
const inattendues = [...new Set(erreursConsole)]
  .filter(m => !/fonts\.g(oogleapis|static)\.com|ERR_INTERNET_DISCONNECTED|Failed to load resource|ErreurMoteur|model-viewer\.min\.js/.test(m));
if (inattendues.length) console.log(`Erreurs console inattendues (${inattendues.length}) :\n  ${inattendues.slice(0, 12).join("\n  ")}`);
process.exit(echecs.length ? 1 : 0);
