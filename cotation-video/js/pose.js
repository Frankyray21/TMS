/* ============================================================================
   pose.js — Détection de pose (MediaPipe Pose Landmarker)

   Isole complètement la dépendance : le reste de l'application ne connaît que
   `detecterImage` / `detecterVideo` et reçoit des repères bruts. Changer de
   détecteur ne toucherait que ce fichier.
   ============================================================================ */

import { SOURCES, DEFAUTS, sourceDisponible, fichiersMoteur } from "./config.js";

let detecteur = null;
let modeCourant = null;      // 'IMAGE' | 'VIDEO'
let sourceUtilisee = null;

/* Même magasin que le service worker du site (sw.js, CACHE_MOTEUR) : lui y
   garde le bundle et le WebAssembly au passage, ce module y garde le modèle.
   Un seul endroit à interroger pour savoir si le mode hors ligne est prêt. */
const CACHE_MODELES = "cotation-video-modeles-v1";

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
  cache?.put(url, new Response(octets)).catch(() => {});
  return octets;
}

/**
 * Charge le détecteur. Long au premier appel (téléchargement du modèle).
 * @param {object} o — { precision, source, mode, onProgres }
 */
export async function chargerDetecteur(o = {}) {
  const precision = o.precision || DEFAUTS.precision;
  const mode = o.mode || "VIDEO";
  const source = o.source && o.source !== "auto" ? o.source : await sourceDisponible();
  const S = SOURCES[source];

  if (detecteur && modeCourant === mode && sourceUtilisee === `${source}:${precision}`) {
    return detecteur;
  }
  o.onEtape?.({ etape: "moteur", libelle: `Moteur de pose (${S.nom})`, part: null });
  let FilesetResolver, PoseLandmarker, fileset, octets;
  try {
    ({ FilesetResolver, PoseLandmarker } = await import(/* @vite-ignore */ S.bundle));
    fileset = await FilesetResolver.forVisionTasks(S.wasm);
    octets = await chargerModele(S.modele[precision], info => {
      o.onEtape?.({
        etape: "modele",
        libelle: info.cache ? "Modèle déjà en cache" : `Modèle ${precision}`,
        part: info.total ? info.recu / info.total : null,
        recu: info.recu, total: info.total, cache: info.cache
      });
    });
  } catch (e) {
    throw expliquerErreurMoteur(e, S);
  }

  o.onEtape?.({ etape: "modele", libelle: "Préparation du détecteur", part: 1 });
  detecteur?.close?.();
  detecteur = null; modeCourant = null; sourceUtilisee = null;
  try {
    /* C'est ici que le WebAssembly est réellement chargé : hors ligne sans
       cache, c'est cette étape qui échoue, pas l'import du bundle. */
    detecteur = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: octets, delegate: "GPU" },
      runningMode: mode,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false
    });
  } catch (e) {
    throw expliquerErreurMoteur(e, S);
  }
  modeCourant = mode;
  sourceUtilisee = `${source}:${precision}`;
  return detecteur;
}

/**
 * Traduit un échec de chargement du moteur en une phrase qui dit quoi faire.
 * Hors ligne, l'erreur brute du navigateur (« Failed to fetch dynamically
 * imported module ») ne dit ni pourquoi ni comment s'en sortir.
 * @param {Error} e — l'erreur d'origine (gardée en `cause`)
 * @param {{nom:string}} S — la source utilisée
 * @param {boolean} [horsLigne] — forcé dans les tests ; sinon lu sur le navigateur
 */
export function expliquerErreurMoteur(e, S, horsLigne = typeof navigator !== "undefined" && navigator.onLine === false) {
  const message = horsLigne
    ? "Le moteur de pose n'est pas disponible hors ligne : il n'a pas encore été conservé dans ce navigateur. "
      + "Au retour du réseau, ouvrez l'outil et utilisez « Préparer le mode hors ligne » (ou lancez une analyse), "
      + "puis réessayez sans réseau."
    : `Le moteur de pose (${S.nom}) n'a pas pu être chargé : ${e?.message || e}`;
  const erreur = new Error(message, { cause: e });
  erreur.name = "ErreurMoteur";
  return erreur;
}

/**
 * Le moteur et le modèle sont-ils déjà conservés dans ce navigateur ?
 * On interroge tous les caches (celui du service worker et le nôtre portent
 * le même nom), sans aucune requête réseau : la réponse doit rester juste
 * hors ligne. La source locale (vendor/) est regardée d'abord, puis le CDN —
 * un poste peut avoir chargé l'une ou l'autre selon le site qui l'a servi.
 * @returns {Promise<{pret:boolean, source?:string}>}
 */
export async function moteurEnCache(precision = DEFAUTS.precision) {
  if (!globalThis.caches) return { pret: false };
  const present = async url => !!(await globalThis.caches.match(url).catch(() => null));
  for (const source of ["local", "distant"]) {
    const f = fichiersMoteur(source, precision);
    if (!(await present(f.bundle)) || !(await present(f.modele))) continue;
    for (const v of f.wasm) {
      if ((await present(v.script)) && (await present(v.binaire))) return { pret: true, source };
    }
  }
  return { pret: false };
}

/**
 * Prépare le mode hors ligne : charge le moteur et le modèle une fois, en
 * ligne, exactement comme une analyse le ferait — c'est ce qui garantit que
 * les fichiers mis en cache sont ceux que ce navigateur utilisera (variante
 * SIMD ou non, précision choisie). On demande au passage un stockage
 * persistant : sans lui, le navigateur peut évacuer 20 Mo de cache au moment
 * où l'on en a besoin, sous terre.
 * @param {object} o — { precision, onEtape }
 */
export async function preparerHorsLigne(o = {}) {
  try { await navigator.storage?.persist?.(); } catch (_) {}
  await chargerDetecteur({ mode: "IMAGE", precision: o.precision, onEtape: o.onEtape });
  return moteurEnCache(o.precision || DEFAUTS.precision);
}

export function sourceActive() {
  return sourceUtilisee;
}

/** Une image fixe (HTMLImageElement, canvas, ImageBitmap). */
export function detecterImage(image) {
  if (!detecteur) throw new Error("Détecteur non chargé");
  return normaliser(detecteur.detect(image));
}

/** Une image de vidéo, horodatée en millisecondes (strictement croissantes). */
export function detecterVideo(video, tMs) {
  if (!detecteur) throw new Error("Détecteur non chargé");
  return normaliser(detecteur.detectForVideo(video, tMs));
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
  detecteur = null; modeCourant = null; sourceUtilisee = null;
}
