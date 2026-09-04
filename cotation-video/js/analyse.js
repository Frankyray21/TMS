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
import { calculerREBA, synthetiser, NIVEAUX as NIVEAUX_REBA } from "./reba.js";
import { calculerRULA, NIVEAUX as NIVEAUX_RULA } from "./rula.js";
import { mesuresLevage } from "./mesures.js";
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
 * On se déplace d'un instant à l'autre plutôt que de lire la vidéo. La lecture
 * paraissait plus naturelle — `requestVideoFrameCallback` donne l'horodatage
 * exact de chaque image décodée — mais elle a deux défauts rédhibitoires :
 * ce rappel ne se déclenche que lorsqu'une image est *présentée à l'écran*, donc
 * il se tait dans un onglet en arrière-plan ou quand rien ne compose la vidéo ;
 * et la lecture impose un plancher de durée/vitesse, même quand la machine
 * pourrait aller plus vite.
 *
 * Le déplacement, lui, est déterministe : on obtient exactement les instants
 * demandés, l'analyse avance en arrière-plan, et sa durée ne dépend que de la
 * vitesse d'inférence.
 *
 * @param {HTMLVideoElement} video
 * @param {object} o — { echantillonnage, signal, onProgres }
 * @returns {Promise<Array>} images relevées : { t, ecran, monde }
 */
export async function parcourirVideo(video, o = {}) {
  const pas = 1 / (o.echantillonnage || DEFAUTS.echantillonnage);
  const releves = [];
  let sansDetection = 0;
  const depart = performance.now();

  video.pause();
  video.muted = true;
  await pret(video);

  const duree = Number.isFinite(video.duration) && video.duration > 0
    ? video.duration
    : (video.seekable.length ? video.seekable.end(0) : 0);
  if (!duree) throw new Error("Durée de la vidéo indéterminée");

  let dernierHorodatage = -1;
  for (let t = 0; t <= duree - 1e-3; t += pas) {
    if (o.signal?.aborted) break;
    if (!(await allerA(video, t))) break;      // déplacement impossible : on s'arrête là

    /* MediaPipe exige des horodatages strictement croissants. */
    const tMs = Math.max(dernierHorodatage + 1, Math.round(t * 1000));
    dernierHorodatage = tMs;
    try {
      const pose = detecterVideo(video, tMs);
      if (pose) releves.push({ t: video.currentTime, ...pose });
      else sansDetection++;
    } catch (e) { sansDetection++; }

    /* Assez d'information pour que l'utilisateur sache où en est l'analyse :
       position dans la vidéo, images retenues, images sans personne détectée,
       et temps écoulé — dont se déduit le temps restant. */
    o.onProgres?.({
      part: Math.min(1, t / duree),
      t, duree,
      retenues: releves.length, sansDetection,
      ecoule: (performance.now() - depart) / 1000
    });
    /* Rendre la main au navigateur : sans ça l'interface se fige et le bouton
       « Arrêter » ne répond plus. */
    await new Promise(r => setTimeout(r, 0));
  }
  return releves;
}

/** Attend que la vidéo ait assez de données pour être déplacée. */
function pret(video) {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise(resolve => {
    const fini = () => { video.removeEventListener("loadeddata", fini); resolve(); };
    video.addEventListener("loadeddata", fini);
    setTimeout(fini, 8000);
  });
}

/**
 * Positionne la vidéo sur un instant et attend que l'image soit disponible.
 * @returns {Promise<boolean>} faux si le déplacement n'aboutit pas
 */
function allerA(video, t) {
  return new Promise(resolve => {
    let repondu = false;
    const fini = ok => {
      if (repondu) return;
      repondu = true;
      video.removeEventListener("seeked", surSeek);
      clearTimeout(minuteur);
      resolve(ok);
    };
    const surSeek = () => fini(true);
    video.addEventListener("seeked", surSeek);
    /* Un déplacement qui n'aboutit pas ne doit pas bloquer toute l'analyse. */
    const minuteur = setTimeout(() => fini(false), 4000);
    try { video.currentTime = t; } catch (e) { fini(false); }
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

/** Même médiane glissante sur les distances du levage. */
export function lisserMesures(mesures, fenetre = DEFAUTS.lissage) {
  if (!fenetre || fenetre < 3 || mesures.length < fenetre) return mesures;
  const copie = mesures.map(m => ({ ...m }));
  for (const champ of ["H", "V", "A"]) {
    const lisse = medianeGlissante(copie.map(m => m[champ]), fenetre);
    copie.forEach((m, i) => { m[champ] = lisse[i]; });
  }
  return copie;
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

  const methode = ["rula", "niosh"].includes(params.methode) ? params.methode : "reba";
  /* NIOSH ne se cote pas image par image : il porte sur un levage entier, entre
     deux instants que l'opérateur désigne. L'affichage par image reste donc sur
     REBA, et l'onglet NIOSH travaille sur les mesures de la séquence. */
  const optsMesure = { tailleCm: params.tailleCm, seuilVisibilite: opts.seuilVisibilite };
  const bruts = releves.map(r => ({
    releve: r,
    angles: extraireAngles(r.monde, opts),
    mesures: mesuresLevage(r.monde, optsMesure)
  }));
  /* Les distances sont lissées comme les angles : mêmes tremblements, même
     remède. On lisse la mesure, jamais la cote qui en découle. */
  const mesuresLissees = lisserMesures(bruts.map(b => b.mesures), params.lissage ?? DEFAUTS.lissage);
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
    /* Les deux méthodes sont calculées à chaque image : ce ne sont que des
       lectures de tables, et ça permet de basculer de l'une à l'autre sans
       relancer quoi que ce soit. */
    const versRULA = {
      bras:      { ...versREBA.bras },
      avantBras: { flexion: a.bras.flexionCoude, horsAxe: !!a.bras.horsAxe },
      poignet:   { flexion: a.bras.flexionPoignet,
                   deviation: a.bras.deviationDeg > opts.seuilDeviation },
      pronosupination: { finDeCourse: !!params.pronosupination },
      cou:       { ...versREBA.cou },
      tronc:     { ...versREBA.tronc, assisSoutenu: versREBA.jambes.assis },
      /* RULA ne demande qu'une chose des jambes : appuyées et équilibrées, ou
         non. Assis avec appui compte comme équilibré ; debout, il faut les deux
         pieds au sol et pas d'accroupissement marqué. */
      jambes:    { appuiEquilibre: versREBA.jambes.assis
                     ? true
                     : (versREBA.jambes.appuiBilateral && versREBA.jambes.flexionGenou < 60) },
      charge:    { ...versREBA.charge },
      activite:  { ...versREBA.activite }
    };
    const resultats = { reba: calculerREBA(versREBA), rula: calculerRULA(versRULA) };

    return {
      t: b.releve.t,
      ecran: b.releve.ecran,
      /* Ce qui a été supposé plutôt que mesuré, pour l'afficher. */
      avertissements: jambesEstimees ? ["jambes"] : [],
      /* Conservés pour pouvoir recoter (charge, prise, activité) sans
         repasser par la détection, qui est la partie coûteuse. */
      monde: b.releve.monde,
      angles: a,
      mesures: mesuresLissees[i],
      fiable: a.fiabilite.fiable,
      confiance: a.fiabilite.global,
      resultats,
      resultat: resultats[methode === "niosh" ? "reba" : methode]
    };
  });

  return {
    images, methode,
    synthese: synthetiser(images, methode === "rula" ? NIVEAUX_RULA : NIVEAUX_REBA),
    params: { ...params }
  };
}

/** Chaîne complète, du fichier au résultat. */
export async function analyserVideo(video, params = {}, o = {}) {
  await chargerDetecteur({ mode: "VIDEO", precision: params.precision, source: params.source, onEtape: o.onEtape });
  const releves = await parcourirVideo(video, {
    echantillonnage: params.echantillonnage,
    signal: o.signal,
    onProgres: o.onProgres
  });
  o.onEtape?.({ etape: "cotation", libelle: `Cotation de ${releves.length} images`, part: null });
  return coter(releves, params);
}

export async function analyserImage(element, params = {}, o = {}) {
  await chargerDetecteur({ mode: "IMAGE", precision: params.precision, source: params.source, onEtape: o.onEtape });
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
