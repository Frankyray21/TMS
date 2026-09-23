#!/usr/bin/env node
/* ============================================================================
   verifier-hors-ligne.mjs — Le mode hors ligne dans un vrai navigateur.

   Lancé par la CI sur chaque pull request (.github/workflows/test-parcours.yml).
   Il faut Chromium via Playwright et le moteur dans vendor/
   (bash cotation-video/outils/telecharger-modeles.sh). Depuis la racine :

     NODE_PATH="$(npm root -g)" node cotation-video/tests/verifier-hors-ligne.mjs
       [--photo chemin.jpg] [--video chemin.webm]

   Par défaut : tests/posture-essai.jpg et tests/levage-essai.webm, tirés d'une
   image du site par tests/fabriquer-essais.mjs — aucun enregistrement réel.

   Le dépôt est servi en HTTP local, sans cache HTTP (no-store) : une fois le
   serveur arrêté, seul le service worker peut répondre. Chaque poste est un
   profil de navigateur distinct :
     A — préparé : « Préparer le mode hors ligne », puis photo et vidéo en
         ligne ; serveur arrêté : l'outil se rouvre, la photo et la vidéo
         donnent les mêmes scores, image par image, et le modèle rapide marche ;
     B — n'a vu que l'accueil du site : hors ligne, l'outil s'ouvre avec ses
         polices, la démonstration marche, l'importation explique l'attente ;
     C — a seulement analysé une photo en ligne : hors ligne, le réglage
         « rapide » bascule sur le modèle standard conservé, et le dit ;
     D — préparé, puis le moteur change de version sur le serveur : le service
         worker reconduit le moteur, purge l'ancien, et l'analyse hors ligne
         marche avec le nouveau, sans que personne ait rien « préparé » ;
     E — GPU matériel simulé : le calcul passe sur le GPU ; le même GPU sans
         tampons flottants : le calcul passe sur le processeur, et la personne
         est bien détectée (sans ce choix, MediaPipe n'en trouverait aucune).
   Chaque vérification est listée ; code de retour 1 si l'une échoue.
   ============================================================================ */
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, statSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
const ESSAIS = fileURLToPath(new URL("./", import.meta.url));
const args = process.argv.slice(2);
const option = (nom, defaut) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : defaut; };
const PHOTO = path.resolve(option("--photo", path.join(ESSAIS, "posture-essai.jpg")));
const VIDEO = path.resolve(option("--video", path.join(ESSAIS, "levage-essai.webm")));
const { VERSION_MOTEUR, MAGASIN_MOTEUR } = await import("../js/config.js");
const VERSION_MAJ = `${VERSION_MOTEUR}-maj`;
const MAGASIN_MAJ = `cotation-video-moteur-${VERSION_MAJ}`;

if (!existsSync(path.join(RACINE, "cotation-video/vendor", VERSION_MOTEUR, "vision_bundle.mjs"))) {
  console.error(`Moteur absent de cotation-video/vendor/${VERSION_MOTEUR}/ : lancez d'abord bash cotation-video/outils/telecharger-modeles.sh`);
  process.exit(2);
}

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
  webp: "image/webp", svg: "image/svg+xml", glb: "model/gltf-binary", mp4: "video/mp4", webm: "video/webm",
  xml: "application/xml", woff2: "font/woff2", txt: "text/plain; charset=utf-8"
};
/* Une mise à jour du moteur, simulée : sw.js et config.js annoncent une autre
   version, et le dossier vendor/<nouvelle>/ est servi depuis le dossier réel. */
const MOTIFS_VERSION = {
  "/sw.js": [/const VERSION_MOTEUR = "[^"]+";/, v => `const VERSION_MOTEUR = "${v}";`],
  "/cotation-video/js/config.js": [/export const VERSION_MOTEUR = [^;]+;/, v => `export const VERSION_MOTEUR = "${v}";`]
};

function demarrerServeur() {
  const journal = [];            // chemins servis : ce qui est vraiment passé par le réseau
  let simulation = null;
  const sockets = new Set();
  const serveur = http.createServer((req, res) => {
    const rel = (p => p.endsWith("/") ? p + "index.html" : p)(decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname));
    const surDisque = simulation ? rel.replace(`/cotation-video/vendor/${simulation}/`, `/cotation-video/vendor/${VERSION_MOTEUR}/`) : rel;
    const fichier = path.join(RACINE, path.normalize(surDisque));
    if (!fichier.startsWith(RACINE) || !existsSync(fichier) || statSync(fichier).isDirectory()) { res.writeHead(404); res.end("absent"); return; }
    let corps = readFileSync(fichier);
    if (simulation && MOTIFS_VERSION[rel]) {
      const [motif, ligne] = MOTIFS_VERSION[rel];
      corps = Buffer.from(corps.toString("utf8").replace(motif, ligne(simulation)));
    }
    journal.push(rel);
    /* no-store : le cache HTTP du navigateur ne doit rien pouvoir rejouer hors
       ligne, sinon il masquerait ce que le service worker fait — ou ne fait pas. */
    res.writeHead(200, { "content-type": TYPES[rel.split(".").pop().toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(corps);
  });
  serveur.on("connection", s => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  return new Promise(resolve => serveur.listen(0, "127.0.0.1", () => resolve({
    base: `http://127.0.0.1:${serveur.address().port}/`,
    journal,
    simulerMiseAJour(version) {
      for (const [rel, [motif]] of Object.entries(MOTIFS_VERSION)) {
        if (!motif.test(readFileSync(path.join(RACINE, rel), "utf8"))) throw new Error(`VERSION_MOTEUR introuvable dans ${rel}`);
      }
      simulation = version;
    },
    arreter: () => new Promise(r => { serveur.close(() => r()); for (const s of sockets) s.destroy(); })
  })));
}

/* ---------- Vérifications ---------- */
const verifs = [];
let section = "";
const titre = t => { section = t; console.log(`\n— ${t} —`); };
const verifier = (nom, ok, detail = "") => {
  verifs.push({ section, nom, ok: !!ok, detail: String(detail ?? "") });
  console.log(`${ok ? "✔" : "✘"} ${nom}${detail ? `\n    ${detail}` : ""}`);
};

const BASES = [];
const erreursConsole = [];
/** Écoute une page : erreurs, requêtes vers un tiers depuis l'outil, réponses et échecs. */
function surveiller(page, nom) {
  const suivi = { tiers: [], reponses: [], echecs: [] };
  const depuisOutil = () => page.url().includes("/cotation-video/");
  page.on("pageerror", e => erreursConsole.push(`${nom} : ${e.stack || e}`));
  page.on("console", m => { if (m.type() === "error") erreursConsole.push(`${nom} : ${m.text()}`); });
  page.on("request", r => {
    const u = r.url();
    if (/^(data|blob):/.test(u) || BASES.some(b => u.startsWith(b))) return;
    if (depuisOutil() || u.includes("/cotation-video/")) suivi.tiers.push(u);
  });
  page.on("response", r => { if (BASES.some(b => r.url().startsWith(b))) suivi.reponses.push({ url: r.url(), sw: r.fromServiceWorker(), statut: r.status() }); });
  /* Un abandon voulu par la page (net::ERR_ABORTED : corps d'une réponse dont
     seul le statut comptait) n'est pas une panne réseau. */
  page.on("requestfailed", r => {
    const raison = r.failure()?.errorText || "";
    if (!/favicon/.test(r.url()) && !/ERR_ABORTED/.test(raison)) suivi.echecs.push(`${r.url()} ← ${raison}`);
  });
  return suivi;
}

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
/** Les fichiers d'un magasin du moteur, relatifs à leur dossier de version. */
const relatifs = (urls = []) => urls.map(u => u.replace(/^.*\/cotation-video\/vendor\/[^/]+\//, "")).sort();

/** La ligne d'état du mode hors ligne (sur l'accueil de l'outil — masqué après
    une analyse, d'où l'attente sur l'attribut plutôt que sur la visibilité).
    Sa mise à jour est asynchrone : on attend l'état voulu, puis on lit ce qui est affiché. */
async function etatHorsLigne(page, attendu) {
  await page.waitForFunction(a => {
    const bloc = document.querySelector("#horsLigne");
    return bloc && !bloc.hidden && bloc.dataset.etat === a;
  }, attendu, { timeout: 30000 }).catch(() => {});
  return page.evaluate(() => ({
    texte: document.querySelector("#horsLigneEtat").textContent.trim(),
    etat: document.querySelector("#horsLigne").dataset.etat,
    bouton: document.querySelector("#preparerHorsLigne").hidden ? "" : document.querySelector("#preparerHorsLigne").textContent.trim()
  }));
}

async function preparer(page) {
  await page.click("#preparerHorsLigne");
  await page.waitForSelector('#horsLigne[data-etat="pret"], #messageSession:not([hidden])', { timeout: 240000 });
  return { ...(await etatHorsLigne(page, "pret")), message: await page.evaluate(() => { const m = document.querySelector("#messageSession"); return m.hidden ? "" : m.textContent.trim(); }) };
}

function lireResultat(page) {
  return page.evaluate(() => {
    const t = s => document.querySelector(s)?.textContent.trim() ?? "";
    const m = document.querySelector("#messageSession"), b = document.querySelector("#badgeMoteur");
    return {
      niveau: t("#niveauLibelle"), message: m.hidden ? "" : m.textContent.trim(),
      moteur: { texte: b.textContent.trim(), titre: b.title, source: b.dataset.source, delegue: b.dataset.delegue, precision: b.dataset.precision },
      segments: document.querySelectorAll("#corpsSegments tr").length,
      exportable: !document.querySelector("#exportJson").disabled, imprimable: !document.querySelector("#imprimer").disabled
    };
  });
}

/** Importe un fichier et attend la fin de l'analyse : un score affiché, ou un message. */
async function importer(page, fichier, delai = 240000) {
  await page.setInputFiles("#fichier", fichier);
  await page.waitForFunction(() => {
    const m = document.querySelector("#messageSession"), n = document.querySelector("#niveauLibelle");
    const enCours = document.querySelector("#statutSession")?.textContent.includes("en cours");
    return !enCours && ((!m.hidden && m.textContent.trim()) || n.textContent.trim() !== "—");
  }, null, { timeout: delai });
  return lireResultat(page);
}

/** L'export JSON de l'analyse affichée, tel que l'utilisateur le télécharge. */
async function exporter(page) {
  const [telechargement] = await Promise.all([page.waitForEvent("download"), page.click("#exportJson")]);
  return JSON.parse(readFileSync(await telechargement.path(), "utf8"));
}
/** Ce qui doit être identique d'une analyse à l'autre : les scores et les angles, image par image. */
const scores = donnees => JSON.stringify(donnees.images.map(({ t, reba, rula, scores, angles, fiable }) => ({ t, reba, rula, scores, angles, fiable })));
const decrire = r => `${r.niveau !== "—" ? r.niveau : r.message} · ${r.moteur.texte}${r.segments ? ` · ${r.segments} segments` : ""}`;

/* Un GPU matériel, simulé : le nom du rendu que WebGL annonce. */
const RENDU_MATERIEL = `(() => {
  const NOM = "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)";
  for (const C of [globalThis.WebGL2RenderingContext, globalThis.WebGLRenderingContext]) {
    if (!C) continue;
    const lire = C.prototype.getParameter;
    C.prototype.getParameter = function (p) { return p === 0x9246 ? NOM : lire.call(this, p); };
  }
})();`;
/* Le même GPU, sans tampons de couleur flottants (fréquent sur les GPU mobiles anciens). */
const SANS_FLOTTANTS = `(() => {
  for (const C of [globalThis.WebGL2RenderingContext, globalThis.WebGLRenderingContext]) {
    if (!C) continue;
    const ext = C.prototype.getExtension, liste = C.prototype.getSupportedExtensions;
    C.prototype.getExtension = function (n) { return n === "EXT_color_buffer_float" ? null : ext.call(this, n); };
    C.prototype.getSupportedExtensions = function () { return (liste.call(this) || []).filter(n => n !== "EXT_color_buffer_float"); };
  }
})();`;

const ECHEC = /n'a pas abouti|n'a pas pu|pas disponible hors ligne/;
const { chromium } = chargerPlaywright();
const serveur = await demarrerServeur();
const BASE = serveur.base;
BASES.push(BASE);
/* SwiftShader : un WebGL logiciel, même sans carte graphique (serveur de CI,
   conteneur). L'outil y reconnaît un rendu logiciel et calcule sur le
   processeur ; le poste E simule un GPU matériel pour exercer l'autre voie. */
const navigateur = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
/* Mouvement réduit : le site fige alors son corps 3D. Sans ça, en rendu
   logiciel, l'animation de l'accueil occupe le processeur de la CI pendant que
   d'autres postes chargent ou analysent. */
const nouveauPoste = async (nom, initScripts = []) => {
  const contexte = await navigateur.newContext({ serviceWorkers: "allow", acceptDownloads: true, reducedMotion: "reduce" });
  for (const s of initScripts) await contexte.addInitScript(s);
  const page = await contexte.newPage();
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);
  return { contexte, page, suivi: surveiller(page, nom) };
};

try {
  console.log(`Serveur : ${BASE}\nMoteur  : ${VERSION_MOTEUR}\nPhoto   : ${path.relative(RACINE, PHOTO)}\nVidéo   : ${path.relative(RACINE, VIDEO)}`);
  const A = await nouveauPoste("A"), B = await nouveauPoste("B"), C = await nouveauPoste("C");

  /* ================= En ligne ================= */
  titre("Poste A, en ligne : préparation, photo, vidéo");
  await A.page.goto(BASE + "index.html");
  const swA = await attendreServiceWorker(A.page);
  verifier("site : service worker installé, actif et aux commandes", swA.support && swA.controle, `portée ${swA.scope || "?"}`);
  const cachesA = await contenuCaches(A.page);
  const versionA = Object.keys(cachesA).find(k => k.startsWith("tms-"));
  const coquille = ["cotation-video/", "cotation-video/index.html", "cotation-video/css/polices.css", "cotation-video/js/pose.js",
                    "cotation-video/polices/barlow-latin-400-normal.woff2", "cotation-video/polices/barlow-condensed-latin-700-normal.woff2"].map(f => BASE + f);
  verifier("site : la coquille de l'outil, polices comprises, est préchargée dès la visite de l'accueil",
    versionA && coquille.every(u => cachesA[versionA].includes(u)), `${cachesA[versionA]?.length ?? 0} entrées dans ${versionA}`);

  await A.page.goto(BASE + "cotation-video/");
  await attendreServiceWorker(A.page);
  const etat0 = await etatHorsLigne(A.page, "a-preparer");
  verifier("outil : propose de préparer le mode hors ligne avant toute analyse",
    etat0.etat === "a-preparer" && etat0.bouton === "Préparer le mode hors ligne", etat0.texte);

  const avantPreparation = serveur.journal.length;
  const prepA = await preparer(A.page);
  const telecharges = serveur.journal.slice(avantPreparation).filter(r => r.includes("/vendor/"));
  verifier("outil : « Préparer le mode hors ligne » garde le moteur et les deux modèles",
    prepA.etat === "pret" && /deux modèles/.test(prepA.texte) && !prepA.message, prepA.message || prepA.texte);
  verifier(`outil : le moteur vient de vendor/${VERSION_MOTEUR}/ (même origine), pas d'un CDN`,
    telecharges.length > 0 && telecharges.every(r => r.startsWith(`/cotation-video/vendor/${VERSION_MOTEUR}/`)),
    relatifs(telecharges).join(", "));
  const moteurA = (await contenuCaches(A.page))[MAGASIN_MOTEUR] || [];
  verifier(`cache : ${MAGASIN_MOTEUR} contient bundle, WebAssembly et les deux modèles`,
    ["vision_bundle.mjs", "pose_landmarker_full.task", "pose_landmarker_lite.task"].every(f => relatifs(moteurA).includes(f))
      && moteurA.some(u => u.endsWith(".wasm")), relatifs(moteurA).join(", "));

  const photoA = await importer(A.page, PHOTO);
  verifier("outil : la photo s'analyse en ligne", !ECHEC.test(photoA.message) && photoA.segments > 0, decrire(photoA));
  verifier("outil : sur un rendu logiciel, le calcul passe sur le processeur", photoA.moteur.delegue === "CPU", photoA.moteur.titre);
  const exportPhotoA = await exporter(A.page);
  const videoA = await importer(A.page, VIDEO);
  const exportVideoA = videoA.exportable ? await exporter(A.page) : null;
  const nbImages = exportVideoA?.images.length ?? 0;
  verifier("outil : la vidéo s'analyse en ligne, première image comprise",
    exportVideoA && exportVideoA.synthese && nbImages >= 15 && exportVideoA.images[0].t === 0,
    `${decrire(videoA)} · ${nbImages} images, médiane ${exportVideoA?.synthese?.median}, pire ${exportVideoA?.synthese?.max}`);
  verifier("export : il nomme le moteur qui a produit les repères",
    exportVideoA?.moteur?.version === VERSION_MOTEUR && exportVideoA.moteur.source === "local" && exportVideoA.moteur.modele === "full",
    JSON.stringify(exportVideoA?.moteur));

  titre("Poste B, en ligne : l'accueil du site seulement");
  await B.page.goto(BASE + "index.html");
  verifier("B : service worker aux commandes", (await attendreServiceWorker(B.page)).controle);
  await B.page.goto("about:blank");   // l'accueil a fait son travail ; le service worker et ses caches restent

  titre("Poste C, en ligne : une analyse, sans préparer");
  await C.page.goto(BASE + "index.html");
  await attendreServiceWorker(C.page);
  await C.page.goto(BASE + "cotation-video/");
  await attendreServiceWorker(C.page);
  const photoC = await importer(C.page, PHOTO);
  const etatC = await etatHorsLigne(C.page, "pret");
  verifier("C : l'analyse en ligne suffit à rendre le poste prêt, avec le modèle standard seulement",
    photoC.segments > 0 && etatC.etat === "pret" && /modèle standard\. Le modèle rapide n'est pas conservé/.test(etatC.texte), etatC.texte);
  verifier("C : l'outil propose de compléter avec le modèle rapide", /^Conserver aussi le modèle rapide/.test(etatC.bouton), etatC.bouton);

  titre("Poste E : GPU matériel simulé");
  for (const [nom, scripts, attendu] of [
    ["E1 · GPU complet", [RENDU_MATERIEL], "GPU"],
    ["E2 · GPU sans tampons flottants", [RENDU_MATERIEL, SANS_FLOTTANTS], "CPU"]
  ]) {
    const E = await nouveauPoste(nom, scripts);
    await E.page.goto(BASE + "cotation-video/");
    const r = await importer(E.page, PHOTO);
    verifier(`${nom} : calcul sur ${attendu === "GPU" ? "le GPU" : "le processeur"}, personne détectée`,
      r.moteur.delegue === attendu && r.segments > 0, `${decrire(r)} — ${r.moteur.titre}`);
    await E.contexte.close();
  }

  /* ================= Hors ligne ================= */
  await serveur.arreter();
  for (const p of [A, B, C]) await p.contexte.setOffline(true);

  titre("Poste A, serveur arrêté et navigateur hors ligne");
  A.suivi.reponses.length = 0; A.suivi.echecs.length = 0;
  const repA = await A.page.goto(BASE + "cotation-video/");
  verifier("A : l'outil se rouvre, servi par le service worker", repA?.ok() && await repA.fromServiceWorker(), `HTTP ${repA?.status()} · « ${await A.page.title()} »`);
  verifier("A : le navigateur se sait hors ligne", (await A.page.evaluate(() => navigator.onLine)) === false);
  const etatA = await etatHorsLigne(A.page, "pret");
  verifier("A : l'outil annonce « Prêt hors ligne »", etatA.etat === "pret" && /deux modèles/.test(etatA.texte), etatA.texte);
  const photoAh = await importer(A.page, PHOTO);
  verifier("A : la photo s'analyse sans réseau, avec le moteur local",
    photoAh.segments > 0 && photoAh.moteur.source === "local" && !ECHEC.test(photoAh.message), decrire(photoAh));
  verifier("A : même score qu'en ligne", scores(await exporter(A.page)) === scores(exportPhotoA), `${photoAh.niveau} / en ligne : ${photoA.niveau}`);
  const videoAh = await importer(A.page, VIDEO);
  const exportVideoAh = videoAh.exportable ? await exporter(A.page) : null;
  verifier("A : la vidéo s'analyse sans réseau : mêmes scores qu'en ligne, image par image",
    exportVideoAh && scores(exportVideoAh) === scores(exportVideoA),
    `${exportVideoAh?.images.length ?? 0} images, médiane ${exportVideoAh?.synthese?.median}, pire ${exportVideoAh?.synthese?.max}`);
  verifier("A : le rapport et l'export restent disponibles", videoAh.exportable && videoAh.imprimable);
  await A.page.evaluate(() => { const s = document.querySelector("#precision"); s.value = "lite"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  const rapideA = await importer(A.page, PHOTO);
  verifier("A : le modèle rapide fonctionne aussi sans réseau", rapideA.segments > 0 && rapideA.moteur.precision === "lite" && !rapideA.message, decrire(rapideA));
  const horsCache = A.suivi.reponses.filter(r => !r.sw);
  verifier("A : chaque ressource de l'outil est venue du service worker, aucune n'a échoué",
    A.suivi.reponses.length > 0 && !horsCache.length && !A.suivi.echecs.length,
    horsCache.length || A.suivi.echecs.length
      ? [...horsCache.map(r => `${r.url} (HTTP ${r.statut}, hors service worker)`), ...A.suivi.echecs].slice(0, 5).join(" · ")
      : `${A.suivi.reponses.length} réponses, toutes du service worker`);

  titre("Poste B, hors ligne : n'a jamais ouvert l'outil");
  const repB = await B.page.goto(BASE + "cotation-video/");
  verifier("B : l'outil s'ouvre bien qu'il n'ait jamais été visité", repB?.ok() && await repB.fromServiceWorker(), `HTTP ${repB?.status()}`);
  const polices = await B.page.evaluate(async () => {
    const faces = ["400 16px Barlow", "500 16px Barlow", "600 16px Barlow", "700 16px Barlow",
                   "500 16px 'Barlow Condensed'", "600 16px 'Barlow Condensed'", "700 16px 'Barlow Condensed'"];
    const manquantes = [];
    for (const f of faces) {
      try { if (!(await document.fonts.load(f)).some(x => x.status === "loaded")) manquantes.push(f); } catch (_) { manquantes.push(f); }
    }
    return manquantes;
  });
  verifier("B : les polices de l'outil sont là, hors ligne", !polices.length, polices.length ? `manquantes : ${polices.join(", ")}` : "Barlow 400–700, Barlow Condensed 500–700");
  const etatB = await etatHorsLigne(B.page, "absent");
  verifier("B : l'outil dit que le moteur n'est pas conservé et que l'analyse attendra le réseau",
    etatB.etat === "absent" && !etatB.bouton, etatB.texte);
  await B.page.click("#voirDemo");
  await B.page.waitForSelector("#atelier:not([hidden])");
  const niveauDemo = (await lireResultat(B.page)).niveau;
  verifier("B : la démonstration simulée fonctionne", niveauDemo && niveauDemo !== "—", niveauDemo);
  const echecB = await importer(B.page, PHOTO);
  verifier("B : l'importation explique en français que le moteur attend le réseau",
    /pas disponible hors ligne/.test(echecB.message) && /Préparer le mode hors ligne/.test(echecB.message), echecB.message);
  verifier("B : aucun résultat n'est affiché après cet échec", echecB.niveau === "—" && echecB.segments === 0);

  titre("Poste C, hors ligne : réglage « rapide », seul le standard est conservé");
  await C.page.goto(BASE + "cotation-video/");
  await C.page.evaluate(() => { const s = document.querySelector("#precision"); s.value = "lite"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await C.page.waitForFunction(() => /remplacera/.test(document.querySelector("#horsLigneEtat").textContent));
  const etatCh = await etatHorsLigne(C.page, "pret");
  verifier("C : l'outil annonce que le modèle standard remplacera le rapide", /standard seulement : sans réseau, il remplacera le modèle rapide/.test(etatCh.texte), etatCh.texte);
  const repliC = await importer(C.page, PHOTO);
  verifier("C : l'analyse aboutit avec le modèle standard, et le dit",
    repliC.segments > 0 && repliC.moteur.precision === "full" && /Analyse faite avec le modèle standard/.test(repliC.message), `${decrire(repliC)} — ${repliC.message}`);

  const tiers = [A, B, C].flatMap(p => p.suivi.tiers);
  verifier("réseau : l'outil n'a jamais rien demandé à un tiers (polices, CDN…)", !tiers.length, tiers.slice(0, 5).join(", "));
  for (const p of [A, B, C]) await p.contexte.close();

  /* ================= Mise à jour du moteur ================= */
  titre(`Poste D : le moteur passe de ${VERSION_MOTEUR} à ${VERSION_MAJ}`);
  const serveur2 = await demarrerServeur();
  BASES.push(serveur2.base);
  const D = await nouveauPoste("D");
  await D.page.goto(serveur2.base + "index.html");
  await attendreServiceWorker(D.page);
  await D.page.goto(serveur2.base + "cotation-video/");
  await attendreServiceWorker(D.page);
  const prepD = await preparer(D.page);
  const avantMaj = relatifs((await contenuCaches(D.page))[MAGASIN_MOTEUR]);
  verifier("D : préparé avec l'ancienne version", prepD.etat === "pret" && avantMaj.length >= 5, avantMaj.join(", "));

  serveur2.simulerMiseAJour(VERSION_MAJ);
  const journalAvant = serveur2.journal.length;
  await D.page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const change = new Promise(r => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    await reg.update();
    await Promise.race([change, new Promise((_, ko) => setTimeout(() => ko(new Error("le nouveau service worker n'a pas pris la main")), 180000))]);
    /* controllerchange précède l'événement activate (où a lieu la purge) : on attend la fin de l'activation. */
    const w = reg.active;
    if (w && w.state !== "activated") await new Promise(r => w.addEventListener("statechange", () => w.state === "activated" && r()));
  });
  const apresMaj = await contenuCaches(D.page);
  const reconduits = serveur2.journal.slice(journalAvant).filter(r => r.startsWith(`/cotation-video/vendor/${VERSION_MAJ}/`));
  verifier("D : à l'installation, le service worker a téléchargé le nouveau moteur — les mêmes fichiers que l'ancien",
    JSON.stringify(relatifs(apresMaj[MAGASIN_MAJ])) === JSON.stringify(avantMaj) && reconduits.length === avantMaj.length,
    `${reconduits.length} fichiers de vendor/${VERSION_MAJ}/`);
  verifier("D : l'ancien magasin du moteur est purgé", !apresMaj[MAGASIN_MOTEUR], Object.keys(apresMaj).join(", "));
  await D.page.reload();
  const etatD = await etatHorsLigne(D.page, "pret");
  verifier("D : sans rien préparer de nouveau, l'outil se dit prêt hors ligne", etatD.etat === "pret" && /deux modèles/.test(etatD.texte), etatD.texte);
  await serveur2.arreter();
  await D.contexte.setOffline(true);
  await D.page.reload();
  const photoD = await importer(D.page, PHOTO);
  const exportD = photoD.segments > 0 ? await exporter(D.page) : null;
  verifier("D : hors ligne, la photo s'analyse avec le nouveau moteur — même score",
    exportD?.moteur?.version === VERSION_MAJ && scores(exportD) === scores(exportPhotoA), `${decrire(photoD)} · moteur ${exportD?.moteur?.version}`);
  await D.contexte.close();
} catch (e) {
  verifier(`déroulé interrompu : ${String(e.message || e).split("\n")[0]}`, false);
} finally {
  await navigateur.close().catch(() => {});
  await serveur.arreter().catch(() => {});
}

const echecs = verifs.filter(v => !v.ok);
console.log(`\n${verifs.length - echecs.length}/${verifs.length} vérifications réussies.`);
/* Attendues : polices et 3D des pages du site hors ligne, l'ErreurMoteur du
   poste B (c'est le scénario), les journaux de MediaPipe, les requêtes
   refusées hors ligne. */
const inattendues = [...new Set(erreursConsole)].filter(m => !/fonts\.g(oogleapis|static)\.com|ERR_INTERNET_DISCONNECTED|Failed to load resource|ErreurMoteur|model-viewer\.min\.js|: (INFO|WARNING):|: [IWE]\d{4} /.test(m));
if (inattendues.length) console.log(`Erreurs console inattendues (${inattendues.length}) :\n  ${inattendues.slice(0, 12).join("\n  ")}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lignes = verifs.map(v => `| ${v.ok ? "✅" : "❌"} | ${v.section} | ${v.nom.replace(/\|/g, "\\|")} |`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    `### Analyse ergonomique hors ligne : ${verifs.length - echecs.length}/${verifs.length} vérifications`, "",
    "| | Poste | Vérification |", "|---|---|---|", ...lignes, ""
  ].join("\n"));
}
process.exit(echecs.length ? 1 : 0);
