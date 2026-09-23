/* ============================================================================
   pose.js — Détection de pose (MediaPipe Pose Landmarker)

   Isole complètement la dépendance : le reste de l'application ne connaît que
   `detecterImage` / `detecterVideo` et reçoit des repères bruts. Changer de
   détecteur ne toucherait que ce fichier.
   ============================================================================ */

import { SOURCES, DEFAUTS, PRECISIONS, MAGASIN_MOTEUR, VERSION_MOTEUR,
         sourceDisponible, fichiersMoteur } from "./config.js";

let detecteur = null;
let modeCourant = null;      // 'IMAGE' | 'VIDEO'
let cleCourante = null;      // `${source}:${précision demandée}` : évite de recharger pour rien
let infos = null;            // ce qui a réellement été chargé (voir infosMoteur)
let decalageHorodatage = 0;  // l'amorçage en mode VIDEO consomme l'horodatage 0

/* Le magasin du moteur : le même que celui du service worker du site (sw.js,
   CACHE_MOTEUR). Lui y garde le bundle et le WebAssembly au passage, ce module
   y range le modèle. Un seul endroit à interroger pour savoir si le mode hors
   ligne est prêt. Son nom porte la version du moteur (config.js). */
const CACHE_MODELES = MAGASIN_MOTEUR;

const autrePrecision = p => p === "lite" ? "full" : "lite";

/* ---------- Pas de télémétrie ----------
   MediaPipe envoie des statistiques d'usage à Google (odml.pa.googleapis.com) :
   à chaque minute et à la fermeture du détecteur, sans option pour s'en
   passer. Ce ne sont pas des images, mais c'est une requête vers un tiers que
   l'outil promet de ne jamais faire — et, hors ligne, un échec réseau de plus.
   Son transport est le fetch global : on y arrête cette seule adresse. La
   réponse 204 fabriquée ici compte comme un échec pour le journal, qui cesse
   alors de lui-même d'envoyer quoi que ce soit pour la session. */
export const TELEMETRIE_MEDIAPIPE = "https://odml.pa.googleapis.com/";
export function bloquerTelemetrie(portee = globalThis) {
  const fetchOrigine = portee.fetch;
  if (typeof fetchOrigine !== "function" || fetchOrigine.sansTelemetrie) return;
  const garde = (entree, init) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree?.url;
    if (String(url ?? "").startsWith(TELEMETRIE_MEDIAPIPE)) return Promise.resolve(new Response(null, { status: 204 }));
    return fetchOrigine(entree, init);
  };
  garde.sansTelemetrie = true;
  portee.fetch = garde;
}

/** Le fichier est-il conservé dans un cache de ce navigateur ? Aucune requête réseau. */
async function conserve(url) {
  if (!globalThis.caches) return false;
  return !!(await globalThis.caches.match(url).catch(() => null));
}

/**
 * Télécharge le modèle en rapportant l'avancement, et le garde en cache.
 *
 * MediaPipe sait charger un modèle depuis une URL, mais sans rien rapporter :
 * l'utilisateur voit une barre figée pendant plusieurs mégaoctets. En lisant le
 * flux nous-mêmes, on affiche les octets reçus — et on peut conserver le
 * fichier, si bien que les analyses suivantes démarrent tout de suite.
 *
 * @param {string} url
 * @param {(info:{recu:number,total:number,cache:boolean})=>void} onProgres
 * @returns {Promise<Uint8Array>}
 */
async function chargerModele(url, onProgres) {
  /* L'API Cache n'existe qu'en contexte sécurisé (https ou localhost). Sur
     file://, on télécharge simplement à chaque fois. */
  let cache = null;
  try { if (self.caches) cache = await caches.open(CACHE_MODELES); } catch (_) {}

  if (cache) {
    const garde = await cache.match(url).catch(() => null);
    if (garde) {
      const octets = new Uint8Array(await garde.arrayBuffer());
      onProgres?.({ recu: octets.length, total: octets.length, cache: true });
      return octets;
    }
  }

  const rep = await fetch(url);
  if (!rep.ok) throw new Error(`Modèle inaccessible (${rep.status})`);

  const total = Number(rep.headers.get("content-length")) || 0;
  /* Sans corps lisible en flux (vieux navigateur, réponse opaque), on retombe
     sur un téléchargement d'un bloc : pas d'avancement, mais ça fonctionne. */
  if (!rep.body?.getReader) {
    const octets = new Uint8Array(await rep.arrayBuffer());
    onProgres?.({ recu: octets.length, total: octets.length, cache: false });
    return octets;
  }

  const lecteur = rep.body.getReader();
  const morceaux = [];
  let recu = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(value);
    recu += value.length;
    onProgres?.({ recu, total, cache: false });
  }
  const octets = new Uint8Array(recu);
  let position = 0;
  for (const m of morceaux) { octets.set(m, position); position += m.length; }

  /* La copie est faite après coup : si la mise en cache échoue (quota, mode
     privé), l'analyse se poursuit quand même. */
  await cache?.put(url, new Response(octets)).catch(() => {});
  return octets;
}

/**
 * Le modèle demandé, ou, s'il est injoignable, l'autre précision si elle est
 * conservée. Sous terre, un poste préparé en « standard » doit analyser même
 * si le réglage est resté sur « rapide » — et un réseau local sans Internet,
 * que navigator.onLine prend pour une connexion, ne doit pas bloquer non plus.
 * @returns {Promise<{precision:string, octets:Uint8Array}>}
 */
async function chargerModeleOuRepli(S, precision, onEtape) {
  const suivi = p => info => onEtape?.({
    etape: "modele",
    libelle: info.cache ? "Modèle déjà en cache" : `Modèle ${p}`,
    part: info.total ? info.recu / info.total : null,
    recu: info.recu, total: info.total, cache: info.cache, precision: p
  });
  try {
    return { precision, octets: await chargerModele(S.modele[precision], suivi(precision)) };
  } catch (e) {
    const autre = autrePrecision(precision);
    if (!(await conserve(S.modele[autre]))) throw e;
    return { precision: autre, octets: await chargerModele(S.modele[autre], suivi(autre)) };
  }
}

/* ---------- Le délégué : GPU ou processeur ----------
   MediaPipe fait tourner le réseau de neurones sur le GPU (WebGL) ou sur le
   processeur (WebAssembly). Le GPU n'est le bon choix que s'il est réel et
   complet :
   - sur un rendu graphique logiciel (poste sans carte graphique, machine
     virtuelle, bureau à distance), le « GPU » est émulé par le processeur :
     mesuré à 650 ms par image, contre 80 ms en calcul direct sur le processeur ;
   - sur un GPU sans tampons de couleur flottants (EXT_color_buffer_float),
     MediaPipe ne lève aucune erreur : il ne détecte plus personne, ce qui
     passerait pour un mauvais cadrage.
   WebGL reste nécessaire dans tous les cas : MediaPipe y prépare l'image, même
   quand le calcul se fait sur le processeur. */
const RENDU_LOGICIEL = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;

/**
 * Le délégué conseillé pour un contexte WebGL 2 donné.
 * @param {WebGL2RenderingContext|null} gl
 * @returns {{delegue:"GPU"|"CPU", raison:string, rendu?:string}}
 */
export function choisirDelegue(gl) {
  if (!gl) return { delegue: "CPU", raison: "WebGL 2 indisponible" };
  /* Firefox donne le vrai nom dans RENDERER ; Chrome et Safari y mettent
     « WebKit WebGL » et le réservent à WEBGL_debug_renderer_info (que Firefox
     déclare obsolète : on ne le demande qu'en second). */
  let rendu = String(gl.getParameter(gl.RENDERER) || "");
  if (!rendu || /webkit webgl/i.test(rendu)) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) rendu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || rendu);
  }
  if (RENDU_LOGICIEL.test(rendu)) return { delegue: "CPU", raison: "rendu graphique logiciel", rendu };
  if (!gl.getExtension("EXT_color_buffer_float")) return { delegue: "CPU", raison: "GPU sans tampons de couleur flottants", rendu };
  return { delegue: "GPU", raison: "GPU matériel complet", rendu };
}

/** Ouvre un contexte WebGL 2 le temps de l'examiner, comme MediaPipe le fera. */
function sonderWebGL(examiner) {
  let gl = null;
  try {
    const toile = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1)
      : typeof document !== "undefined" ? document.createElement("canvas") : null;
    gl = toile?.getContext("webgl2") || null;
    return examiner(gl);
  } catch (_) {
    return examiner(null);
  } finally {
    /* Les contextes WebGL sont comptés : on rend celui-ci tout de suite. */
    try { gl?.getExtension("WEBGL_lose_context")?.loseContext(); } catch (_) {}
  }
}

let conseilMemorise = null;
function delegueConseille() {
  return conseilMemorise ??= sonderWebGL(choisirDelegue);
}

/**
 * Crée le détecteur sur le délégué conseillé, et bascule sur le processeur si
 * le GPU échoue — à la création, ou au premier passage dans le graphe : une
 * partie des pannes GPU n'apparaissent qu'à ce moment-là (« Calculator::Open()
 * failed »). D'où l'amorçage sur une image vide, qui avance au passage la
 * compilation des shaders dans l'étape « Préparation du détecteur ».
 *
 * @param {object} PoseLandmarker — la classe MediaPipe (ou une doublure)
 * @param {object} fileset
 * @param {object} options — options MediaPipe, sans le délégué
 * @param {object} [o] — { conseil, amorce } : injectables pour les tests
 * @returns {Promise<{detecteur:object, delegue:"GPU"|"CPU", raison:string, decalage:number}>}
 *   `decalage` : l'amorçage en mode VIDEO a consommé l'horodatage 0, et
 *   MediaPipe exige des horodatages strictement croissants — sans ce décalage,
 *   la première image de chaque vidéo serait rejetée.
 */
export async function creerDetecteur(PoseLandmarker, fileset, options, o = {}) {
  const conseil = o.conseil || delegueConseille();
  const amorce = o.amorce || (() => new ImageData(16, 16));
  const essais = conseil.delegue === "GPU" ? ["GPU", "CPU"] : ["CPU"];
  let erreur = null;
  for (const delegue of essais) {
    let d = null;
    try {
      d = await PoseLandmarker.createFromOptions(fileset,
        { ...options, baseOptions: { ...options.baseOptions, delegate: delegue } });
      const video = options.runningMode === "VIDEO";
      if (video) d.detectForVideo(amorce(), 0);
      else d.detect(amorce());
      /* Un GPU qui a échoué une fois échouera encore : les détecteurs suivants
         de la session (nouvelle vidéo, autre précision) iront droit au processeur. */
      if (!o.conseil && delegue !== conseil.delegue) conseilMemorise = { delegue, raison: "échec du GPU, calcul sur le processeur" };
      return {
        detecteur: d, delegue, decalage: video ? 1 : 0,
        raison: delegue === conseil.delegue ? conseil.raison : "échec du GPU, calcul sur le processeur"
      };
    } catch (e) {
      try { d?.close?.(); } catch (_) {}
      erreur = e;
    }
  }
  throw erreur;
}

/**
 * Charge le détecteur. Long au premier appel (téléchargement du modèle).
 * @param {object} o — { precision, source, mode, onEtape }
 */
export async function chargerDetecteur(o = {}) {
  const precision = o.precision || DEFAUTS.precision;
  const mode = o.mode || "VIDEO";
  const source = o.source && o.source !== "auto" ? o.source : await sourceDisponible();
  const S = SOURCES[source];
  const cle = `${source}:${precision}`;

  if (detecteur && modeCourant === mode && cleCourante === cle) return detecteur;

  o.onEtape?.({ etape: "moteur", libelle: `Moteur de pose (${S.nom})`, part: null });
  bloquerTelemetrie();
  let PoseLandmarker, fileset, modele;
  try {
    let FilesetResolver;
    ({ FilesetResolver, PoseLandmarker } = await import(/* @vite-ignore */ S.bundle));
    fileset = await FilesetResolver.forVisionTasks(S.wasm);
    modele = await chargerModeleOuRepli(S, precision, o.onEtape);
  } catch (e) {
    throw await expliquerErreurMoteur(e, S);
  }

  /* Barre indéterminée : l'amorçage peut prendre quelques secondes (shaders). */
  o.onEtape?.({ etape: "modele", libelle: "Préparation du détecteur", part: null });
  libererDetecteur();
  let cree;
  try {
    /* C'est ici que le WebAssembly est réellement chargé : hors ligne sans
       cache, c'est cette étape qui échoue, pas l'import du bundle. */
    cree = await creerDetecteur(PoseLandmarker, fileset, {
      baseOptions: { modelAssetBuffer: modele.octets },
      runningMode: mode,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false
    });
  } catch (e) {
    throw await expliquerErreurMoteur(e, S);
  }
  detecteur = cree.detecteur;
  modeCourant = mode;
  cleCourante = cle;
  decalageHorodatage = cree.decalage;
  infos = {
    source, version: VERSION_MOTEUR,
    precision: modele.precision, precisionDemandee: precision,
    delegue: cree.delegue, raisonDelegue: cree.raison
  };
  return detecteur;
}

/** Les erreurs d'un chargement qui n'a pas pu joindre le réseau. */
const ERREUR_RESEAU = /failed to fetch|networkerror|load failed|network request failed|dynamically imported module|importing a module script failed|modèle inaccessible/i;

/**
 * Traduit un échec de chargement du moteur en une phrase qui dit quoi faire.
 * Hors ligne, l'erreur brute du navigateur (« Failed to fetch dynamically
 * imported module ») ne dit ni pourquoi ni comment s'en sortir.
 * @param {Error} e — l'erreur d'origine (gardée en `cause`)
 * @param {{nom:string}} S — la source utilisée
 * @param {object} [c] — { horsLigne, webgl, conserve } : forcés dans les tests,
 *   sinon lus sur le navigateur
 */
export async function expliquerErreurMoteur(e, S, c = {}) {
  const horsLigne = c.horsLigne ?? (typeof navigator !== "undefined" && navigator.onLine === false);
  const webgl = c.webgl ?? sonderWebGL(gl => !!gl);
  const garde = c.conserve ?? (await etatMoteur().catch(() => ({ moteur: false }))).moteur;
  const brut = String(e?.message || e || "");
  let message;
  if (!webgl) {
    message = "Ce navigateur ne fournit pas WebGL 2, dont le moteur de pose a besoin pour lire les images. "
      + "Activez l'accélération graphique (matérielle) dans ses réglages, ou utilisez Chrome, Edge, Firefox ou Safari à jour.";
  } else if (!garde && horsLigne) {
    message = "Le moteur de pose n'est pas disponible hors ligne : il n'a pas encore été conservé dans ce navigateur. "
      + "Au retour du réseau, ouvrez l'outil et utilisez « Préparer le mode hors ligne » (ou lancez une analyse), "
      + "puis réessayez sans réseau.";
  } else if (!garde && ERREUR_RESEAU.test(brut)) {
    message = "Le moteur de pose n'a pas pu être téléchargé : la connexion ne répond pas, et il n'est pas encore "
      + "conservé dans ce navigateur. Réessayez avec un accès à Internet, puis utilisez « Préparer le mode hors ligne » "
      + "pour ne plus en dépendre.";
  } else {
    message = `Le moteur de pose (${S.nom}) n'a pas pu être chargé : ${brut}`;
  }
  const erreur = new Error(message, { cause: e });
  erreur.name = "ErreurMoteur";
  return erreur;
}

/**
 * Ce que ce navigateur conserve du moteur, sans aucune requête réseau : la
 * réponse doit rester juste hors ligne. On interroge tous les caches (celui du
 * service worker et le nôtre portent le même nom). La source locale (vendor/)
 * est regardée d'abord, puis le CDN — un poste peut avoir chargé l'une ou
 * l'autre selon le site qui l'a servi.
 * - `moteur` : le bundle et une variante WebAssembly complète (SIMD ou non) ;
 * - `modeles` : chaque précision dont le modèle est conservé.
 * @returns {Promise<{moteur:boolean, source:string|null, modeles:{full:boolean, lite:boolean}}>}
 */
export async function etatMoteur() {
  let premier = null;
  for (const source of ["local", "distant"]) {
    const f = fichiersMoteur(source);
    if (!(await conserve(f.bundle))) continue;
    let wasm = false;
    for (const v of f.wasm) {
      if ((await conserve(v.script)) && (await conserve(v.binaire))) { wasm = true; break; }
    }
    if (!wasm) continue;
    const modeles = {};
    for (const p of PRECISIONS) modeles[p] = await conserve(SOURCES[source].modele[p]);
    const etat = { moteur: true, source, modeles };
    if (modeles.full || modeles.lite) return etat;
    premier ??= etat;
  }
  return premier || { moteur: false, source: null, modeles: { full: false, lite: false } };
}

/**
 * Prépare le mode hors ligne : charge le moteur une fois, en ligne, exactement
 * comme une analyse le ferait — c'est ce qui garantit que les fichiers gardés
 * sont ceux que ce navigateur utilisera (variante SIMD ou non) — puis garde
 * aussi l'autre modèle : sous terre, « standard » comme « rapide » doivent
 * fonctionner. On demande au passage un stockage persistant : sans lui, le
 * navigateur peut évacuer ces 26 Mo au moment où l'on en a besoin.
 * @param {object} o — { precision, onEtape }
 * @returns {Promise<{moteur:boolean, source:string|null, modeles:object, persistant:boolean}>}
 */
export async function preparerHorsLigne(o = {}) {
  let persistant = false;
  try { persistant = !!(await navigator.storage?.persist?.()); } catch (_) {}
  await chargerDetecteur({ mode: "IMAGE", precision: o.precision, onEtape: o.onEtape });
  const S = SOURCES[infos.source];
  const autre = autrePrecision(infos.precision);
  await chargerModele(S.modele[autre], info => o.onEtape?.({
    etape: "modele", libelle: `Modèle ${autre}`,
    part: info.total ? info.recu / info.total : null,
    recu: info.recu, total: info.total, cache: info.cache, precision: autre
  }));
  return { ...(await etatMoteur()), persistant };
}

/**
 * Ce qui a réellement été chargé pour la dernière analyse, ou null.
 * @returns {{source:string, version:string, precision:string, precisionDemandee:string,
 *            delegue:"GPU"|"CPU", raisonDelegue:string}|null}
 */
export function infosMoteur() {
  return infos ? { ...infos } : null;
}

export function sourceActive() {
  return infos ? `${infos.source}:${infos.precision}` : null;
}

/** Une image fixe (HTMLImageElement, canvas, ImageBitmap). */
export function detecterImage(image) {
  if (!detecteur) throw new Error("Détecteur non chargé");
  return normaliser(detecteur.detect(image));
}

/** Une image de vidéo, horodatée en millisecondes (strictement croissantes). */
export function detecterVideo(video, tMs) {
  if (!detecteur) throw new Error("Détecteur non chargé");
  return normaliser(detecteur.detectForVideo(video, tMs + decalageHorodatage));
}

/* MediaPipe renvoie des tableaux de poses ; on n'en suit qu'une. On sépare
   clairement les deux jeux de repères :
   - `ecran` (normalisés 0–1) pour dessiner sur la vidéo ;
   - `monde` (mètres, origine aux hanches) pour mesurer les angles. */
function normaliser(res) {
  if (!res || !res.landmarks?.length) return null;
  const ecran = res.landmarks[0];
  const monde = res.worldLandmarks?.[0];
  if (!monde) return null;
  /* La visibilité n'est portée que par les repères écran : on la recopie sur
     les repères monde, que le calcul d'angles utilise. */
  const mondeAvecVisibilite = monde.map((p, i) => ({
    x: p.x, y: p.y, z: p.z,
    visibility: ecran[i]?.visibility ?? 0
  }));
  return { ecran, monde: mondeAvecVisibilite };
}

export function libererDetecteur() {
  detecteur?.close?.();
  detecteur = null; modeCourant = null; cleCourante = null; infos = null; decalageHorodatage = 0;
}
