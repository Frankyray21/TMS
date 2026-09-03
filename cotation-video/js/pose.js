/* ============================================================================
   pose.js — Détection de pose (MediaPipe Pose Landmarker)

   Isole complètement la dépendance : le reste de l'application ne connaît que
   `detecterImage` / `detecterVideo` et reçoit des repères bruts. Changer de
   détecteur ne toucherait que ce fichier.
   ============================================================================ */

import { SOURCES, DEFAUTS, sourceDisponible } from "./config.js";

let detecteur = null;
let modeCourant = null;      // 'IMAGE' | 'VIDEO'
let sourceUtilisee = null;

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
  o.onProgres?.(`Chargement du moteur (${S.nom})…`);

  const { FilesetResolver, PoseLandmarker } = await import(/* @vite-ignore */ S.bundle);
  const fileset = await FilesetResolver.forVisionTasks(S.wasm);

  o.onProgres?.(`Chargement du modèle (${precision})…`);
  detecteur?.close?.();
  detecteur = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: S.modele[precision], delegate: "GPU" },
    runningMode: mode,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false
  });
  modeCourant = mode;
  sourceUtilisee = `${source}:${precision}`;
  o.onProgres?.(null);
  return detecteur;
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
