/* ============================================================================
   config.js — D'où viennent le moteur de pose et son modèle

   Deux modes :
   - « local »  : tout est servi depuis vendor/. Aucune requête sortante, donc
                  utilisable sur un site sans réseau. Voir outils/telecharger-modeles.sh
   - « distant » : chargé depuis le CDN public. Rien à installer, mais il faut
                  Internet au premier chargement.
   Par défaut on teste la présence du dossier local et on retombe sur le CDN.
   ============================================================================ */

/* ---------- Version du moteur : la source unique ----------
   Le moteur embarqué, c'est la bibliothèque MediaPipe et les modèles de pose.
   Sa version nomme le dossier vendor/<version>/ et le magasin où le service
   worker le garde. outils/telecharger-modeles.sh la lit ici ; sw.js la recopie
   (VERSION_MOTEUR) et un test vérifie que les deux concordent.

   Changer MEDIAPIPE ou MODELE_POSE change donc toutes les adresses du moteur :
   aucun navigateur ne peut resservir l'ancien fichier sous la nouvelle adresse,
   et un poste déjà préparé reçoit le nouveau moteur à sa prochaine visite du
   site, en ligne (sw.js, renouvelerMoteur), avant que l'ancien soit purgé. */
export const MEDIAPIPE = "1.0.1";     // paquet npm @mediapipe/tasks-vision
export const MODELE_POSE = 1;         // pose_landmarker_<précision>/float16/<n>/
export const VERSION_MOTEUR = `${MEDIAPIPE}-pose${MODELE_POSE}`;
export const MAGASIN_MOTEUR = `cotation-video-moteur-${VERSION_MOTEUR}`;

const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE}`;
const MODELES_GOOGLE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";

/* Les chemins locaux sont résolus en URL absolues depuis l'emplacement de ce
   module. C'est indispensable : un chemin « ./vendor/… » serait résolu
   relativement au module pour un import dynamique, mais relativement au
   document pour un fetch — deux cibles différentes, dont une fausse. */
const RACINE = new URL("../", import.meta.url);
const local = chemin => new URL(`vendor/${VERSION_MOTEUR}/${chemin}`, RACINE).href;

export const PRECISIONS = ["full", "lite"];

export const SOURCES = {
  local: {
    nom: "local (hors ligne)",
    bundle: local("vision_bundle.mjs"),
    wasm:   local("wasm"),
    modele: { lite: local("pose_landmarker_lite.task"),
              full: local("pose_landmarker_full.task") }
  },
  distant: {
    nom: "CDN public",
    bundle: `${CDN}/vision_bundle.mjs`,
    wasm:   `${CDN}/wasm`,
    modele: Object.fromEntries(PRECISIONS.map(p =>
      [p, `${MODELES_GOOGLE}/pose_landmarker_${p}/float16/${MODELE_POSE}/pose_landmarker_${p}.task`]))
  }
};

export const DEFAUTS = {
  precision: "full",        // 'lite' plus rapide, 'full' plus juste
  echantillonnage: 6,       // images analysées par seconde de vidéo
  seuilVisibilite: 0.5,     // en dessous, l'image est écartée
  seuilTorsion: 20,         // degrés à partir desquels REBA majore
  seuilInclinaison: 12,
  seuilDeviation: 15,
  lissage: 3                // médiane glissante sur N images (0 = désactivé)
};

/** Le moteur embarqué (vendor/) est-il là ? Sinon, le CDN public.
    En GET, pas en HEAD : hors ligne, seul un GET peut être servi depuis le
    cache du service worker (une requête HEAD n'y correspond jamais), et rien
    n'est perdu — le bundle est importé juste après depuis la même URL, donc
    depuis le même cache.
    Seule une réponse du serveur (404 : site publié sans vendor/) renvoie au
    CDN. Une coupure réseau, non : le CDN serait tout aussi injoignable, et
    l'appeler enverrait une requête à un tiers pour rien ; l'échec du moteur
    local explique alors ce qu'il faut faire. */
export async function sourceDisponible() {
  try {
    const r = await fetch(SOURCES.local.bundle);
    /* Seul le statut compte : le corps est abandonné tout de suite. Laissé en
       suspens, ce flux garderait le service worker occupé — et Chrome n'active
       une nouvelle version du site qu'une fois l'ancienne libre : la mise à
       jour attendrait la fermeture de l'onglet. */
    r.body?.cancel().catch(() => {});
    return r.ok ? "local" : "distant";
  } catch { return "local"; }
}

/**
 * Les fichiers qu'une analyse charge, pour une source et une précision.
 * Les deux variantes WebAssembly sont listées : le navigateur n'en prend
 * qu'une (SIMD si elle est prise en charge), on ne sait pas laquelle d'avance.
 * Sert à dire si le mode hors ligne est prêt (pose.js).
 */
export function fichiersMoteur(source, precision = DEFAUTS.precision) {
  const S = SOURCES[source];
  return {
    bundle: S.bundle,
    wasm: ["vision_wasm_internal", "vision_wasm_nosimd_internal"]
      .map(nom => ({ script: `${S.wasm}/${nom}.js`, binaire: `${S.wasm}/${nom}.wasm` })),
    modele: S.modele[precision]
  };
}
