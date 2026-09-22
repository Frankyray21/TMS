/* ============================================================================
   config.js — D'où viennent le moteur de pose et son modèle

   Deux modes :
   - « local »  : tout est servi depuis vendor/. Aucune requête sortante, donc
                  utilisable sur un site sans réseau. Voir outils/telecharger-modeles.sh
   - « distant » : chargé depuis le CDN public. Rien à installer, mais il faut
                  Internet au premier chargement.
   Par défaut on teste la présence du dossier local et on retombe sur le CDN.
   ============================================================================ */

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";
const MODELES_GOOGLE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";

/* Les chemins locaux sont résolus en URL absolues depuis l'emplacement de ce
   module. C'est indispensable : un chemin « ./vendor/… » serait résolu
   relativement au module pour un import dynamique, mais relativement au
   document pour un fetch — deux cibles différentes, dont une fausse. */
const RACINE = new URL("../", import.meta.url);
const local = chemin => new URL(chemin, RACINE).href;

export const SOURCES = {
  local: {
    nom: "local (hors ligne)",
    bundle: local("vendor/vision_bundle.mjs"),
    wasm:   local("vendor/wasm"),
    modele: { lite: local("vendor/pose_landmarker_lite.task"),
              full: local("vendor/pose_landmarker_full.task") }
  },
  distant: {
    nom: "CDN public",
    bundle: `${CDN}/vision_bundle.mjs`,
    wasm:   `${CDN}/wasm`,
    modele: { lite: `${MODELES_GOOGLE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
              full: `${MODELES_GOOGLE}/pose_landmarker_full/float16/1/pose_landmarker_full.task` }
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

/** Le dossier vendor/ est-il présent et complet ?
    En GET, pas en HEAD : hors ligne, seul un GET peut être servi depuis le
    cache du service worker (une requête HEAD n'y correspond jamais), et rien
    n'est perdu — le bundle est importé juste après depuis la même URL, donc
    depuis le même cache. */
export async function sourceDisponible() {
  try {
    const r = await fetch(SOURCES.local.bundle);
    return r.ok ? "local" : "distant";
  } catch { return "distant"; }
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
