/* ============================================================================
   analyse.js — La chaîne complète : vidéo → série de cotes

   Trois passes, volontairement séparées :
   1. parcours  — on traverse la vidéo et on relève une pose par échantillon ;
   2. lissage   — médiane glissante sur chaque angle, pour absorber le
                  tremblement du détecteur sans écraser les vrais pics ;
   3. cotation  — REBA image par image, puis synthèse de la séquence.

   Le lissage porte sur les angles, jamais sur le score : moyenner des cotes
   issues de tables non linéaires produirait un chiffre qui ne correspond à
   aucune posture réelle.
   ============================================================================ */

import { chargerDetecteur, detecterImage, detecterVideo } from "./pose.js";
import { extraireAngles } from "./angles.js";
import { calculerREBA, synthetiser } from "./reba.js";
import { DEFAUTS } from "./config.js";

/* Hypothèses de repli quand les jambes ne sont pas dans le cadre. */
const POSTURES_JAMBES = {
  debout:     { appuiBilateral: true,  flexionGenou: 0,  assis: false },
  unilateral: { appuiBilateral: false, flexionGenou: 0,  assis: false },
  flechi:     { appuiBilateral: true,  flexionGenou: 45, assis: false },
  accroupi:   { appuiBilateral: true,  flexionGenou: 75, assis: false },
  assis:      { appuiBilateral: true,  flexionGenou: 90, assis: true  }
};

/* Les angles soumis au lissage. */
const CANAUX = [
  ["tronc", "flexion"], ["tronc", "inclinaisonDeg"], ["tronc", "torsionDeg"],
  ["cou", "flexion"], ["cou", "inclinaisonDeg"], ["cou", "torsionDeg"],
  ["jambes", "flexionGenou"],
  ["bras", "flexionBras"], ["bras", "abductionDeg"],
  ["bras", "flexionCoude"], ["bras", "flexionPoignet"], ["bras", "deviationDeg"]
];

/**
 * Parcourt une vidéo et relève une pose tous les 1/échantillonnage de seconde.
 *
 * On lit la vidéo au lieu de la parcourir par sauts : `requestVideoFrameCallback`
 * donne l'horodatage exact de chaque image décodée, là où enchaîner des `seek`
 * est beaucoup plus lent et pas plus précis.
 *
 * @param {HTMLVideoElement} video
 * @param {object} o — { echantillonnage, vitesse, signal, onProgres }
 * @returns {Promise<Array>} images relevées : { t, ecran, monde }
 */
export async function parcourirVideo(video, o = {}) {
  const pas = 1 / (o.echantillonnage || DEFAUTS.echantillonnage);
  const releves = [];
  let prochain = 0;
  let dernierHorodatage = -1;

  video.pause();
  video.currentTime = 0;
  video.muted = true;
  video.playbackRate = o.vitesse || 2;
  await new Promise(r => {
    if (video.readyState >= 2) return r();
    video.addEventListener("loadeddata", r, { once: true });
  });

  return new Promise((resolve, reject) => {
    const utiliseRVFC = typeof video.requestVideoFrameCallback === "function";

    const traiter = () => {
      if (o.signal?.aborted) { video.pause(); return resolve(releves); }
      const t = video.currentTime;

      if (t + 1e-4 >= prochain) {
        prochain = t + pas;
        /* MediaPipe exige des horodatages strictement croissants. */
        const tMs = Math.max(dernierHorodatage + 1, Math.round(t * 1000));
        dernierHorodatage = tMs;
        try {
          const pose = detecterVideo(video, tMs);
          if (pose) releves.push({ t, ...pose });
        } catch (e) { /* image indécodable : on continue */ }
        o.onProgres?.(video.duration ? t / video.duration : 0, releves.length);
      }
      planifier();
    };

    const planifier = () => {
      if (video.ended || (video.duration && video.currentTime >= video.duration - 1e-3)) {
        video.pause();
        return resolve(releves);
      }
      if (utiliseRVFC) video.requestVideoFrameCallback(traiter);
      else requestAnimationFrame(traiter);
    };

    video.addEventListener("ended", () => resolve(releves), { once: true });
    video.addEventListener("error", () => reject(new Error("Lecture de la vidéo impossible")), { once: true });
    video.play().then(planifier).catch(reject);
  });
}

/** Une image fixe : même chaîne, un seul relevé. */
export function releverImage(element) {
  const pose = detecterImage(element);
  return pose ? [{ t: 0, ...pose }] : [];
}

/* ---------- Lissage ---------- */

/** Médiane glissante sur une fenêtre impaire centrée. */
function medianeGlissante(valeurs, fenetre) {
  if (!fenetre || fenetre < 3) return valeurs.slice();
  const demi = Math.floor(fenetre / 2);
  return valeurs.map((_, i) => {
    const t = valeurs.slice(Math.max(0, i - demi), Math.min(valeurs.length, i + demi + 1))
                     .filter(Number.isFinite)
                     .sort((a, b) => a - b);
    return t.length ? t[Math.floor(t.length / 2)] : valeurs[i];
  });
}

/** Applique le lissage sur chaque canal d'angle, en place sur une copie. */
export function lisser(anglesParImage, fenetre = DEFAUTS.lissage) {
  if (!fenetre || fenetre < 3 || anglesParImage.length < fenetre) return anglesParImage;
  const copie = anglesParImage.map(a => ({
    ...a,
    tronc: { ...a.tronc }, cou: { ...a.cou }, jambes: { ...a.jambes }, bras: { ...a.bras }
  }));
  for (const [groupe, champ] of CANAUX) {
    const serie = copie.map(a => a[groupe]?.[champ]);
    if (!serie.some(Number.isFinite)) continue;
    const lisse = medianeGlissante(serie, fenetre);
    copie.forEach((a, i) => { if (a[groupe]) a[groupe][champ] = lisse[i]; });
  }
  /* Les seuils booléens sont recalculés après lissage, jamais lissés eux-mêmes. */
  return copie;
}

/* ---------- Cotation ---------- */

/**
 * Transforme des relevés en série cotée.
 * @param {Array} releves — sortie de parcourirVideo / releverImage
 * @param {object} params — paramètres non observables et seuils :
 *   { chargeKg, effortBrusque, prise, statique, repete, instable,
 *     cote, epauleHaussee, brasSoutenu, seuils… }
 */
export function coter(releves, params = {}) {
  const opts = {
    cote: params.cote || "auto",
    seuilTorsion: params.seuilTorsion ?? DEFAUTS.seuilTorsion,
    seuilInclinaison: params.seuilInclinaison ?? DEFAUTS.seuilInclinaison,
    seuilDeviation: params.seuilDeviation ?? DEFAUTS.seuilDeviation,
    seuilVisibilite: params.seuilVisibilite ?? DEFAUTS.seuilVisibilite
  };

  const bruts = releves.map(r => ({ releve: r, angles: extraireAngles(r.monde, opts) }));
  const lisses = lisser(bruts.map(b => b.angles), params.lissage ?? DEFAUTS.lissage);

  const images = bruts.map((b, i) => {
    const a = lisses[i];
    /* Les seuils booléens sont réévalués sur les angles lissés. */
    const versREBA = {
      tronc: { flexion: a.tronc.flexion,
               torsion: a.tronc.torsionDeg > opts.seuilTorsion,
               inclinaison: a.tronc.inclinaisonDeg > opts.seuilInclinaison },
      cou:   { flexion: a.cou.flexion,
               torsion: a.cou.torsionDeg > opts.seuilTorsion,
               inclinaison: a.cou.inclinaisonDeg > opts.seuilInclinaison },
      /* Jambes hors cadre : on ne cote pas sur des repères extrapolés. On
         retient l'hypothèse de l'opérateur (debout, appui bilatéral par
         défaut) et l'interface signale que ce segment n'est pas mesuré. */
      jambes: (a.jambesObservables || params.jambesManuel === "mesure")
        ? { appuiBilateral: a.jambes.appuiBilateral,
            flexionGenou: a.jambes.flexionGenou,
            assis: a.jambes.assis }
        : POSTURES_JAMBES[params.jambesManuel] || POSTURES_JAMBES.debout,
      bras:  { flexion: a.bras.flexionBras,
               abduction: a.bras.abductionDeg > 45,
               epauleHaussee: !!params.epauleHaussee,
               brasSoutenu: !!params.brasSoutenu },
      avantBras: { flexion: a.bras.flexionCoude },
      poignet:   { flexion: a.bras.flexionPoignet,
                   deviation: a.bras.deviationDeg > opts.seuilDeviation },
      /* Non observables : ils viennent de l'opérateur, pas de l'image. */
      charge:   { chargeKg: params.chargeKg || 0, effortBrusque: !!params.effortBrusque },
      prise:    { prise: params.prise || 0 },
      activite: { statique: !!params.statique, repete: !!params.repete, instable: !!params.instable }
    };
    const jambesEstimees = !a.jambesObservables && params.jambesManuel !== "mesure";
    return {
      t: b.releve.t,
      ecran: b.releve.ecran,
      /* Ce qui a été supposé plutôt que mesuré, pour l'afficher. */
      avertissements: jambesEstimees ? ["jambes"] : [],
      /* Conservés pour pouvoir recoter (charge, prise, activité) sans
         repasser par la détection, qui est la partie coûteuse. */
      monde: b.releve.monde,
      angles: a,
      fiable: a.fiabilite.fiable,
      confiance: a.fiabilite.global,
      resultat: calculerREBA(versREBA)
    };
  });

  return { images, synthese: synthetiser(images), params: { ...params } };
}

/** Chaîne complète, du fichier au résultat. */
export async function analyserVideo(video, params = {}, o = {}) {
  await chargerDetecteur({ mode: "VIDEO", precision: params.precision, source: params.source, onProgres: o.onEtat });
  const releves = await parcourirVideo(video, {
    echantillonnage: params.echantillonnage,
    vitesse: params.vitesse,
    signal: o.signal,
    onProgres: o.onProgres
  });
  return coter(releves, params);
}

export async function analyserImage(element, params = {}, o = {}) {
  await chargerDetecteur({ mode: "IMAGE", precision: params.precision, source: params.source, onProgres: o.onEtat });
  return coter(releverImage(element), params);
}

/**
 * Recote une analyse déjà faite avec d'autres paramètres.
 * Sert à répondre en direct à « et si la caisse pesait 15 kg ? » : les repères
 * sont conservés, seule la cotation est refaite.
 */
export function recoter(analyse, params) {
  const releves = analyse.images.map(i => ({ t: i.t, ecran: i.ecran, monde: i.monde }));
  return coter(releves, { ...analyse.params, ...params });
}
