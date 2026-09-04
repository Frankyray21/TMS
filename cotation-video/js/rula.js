/* ============================================================================
   rula.js — Le modèle de cotation RULA
   Rapid Upper Limb Assessment (McAtamney & Corlett, Applied Ergonomics 24, 1993)

   Même contrat que reba.js : module pur, aucune dépendance, aucun DOM.
   Il consomme les mêmes angles et rend un score 1–7 sur quatre niveaux d'action.

   RULA n'est pas un REBA allégé : il pèse davantage le membre supérieur, découpe
   le cou plus finement (quatre bandes, dont l'extension traitée à part) et
   distingue la pronosupination du poignet. C'est l'instrument des postes assis
   et du travail de précision, là où REBA, conçu pour le corps entier en
   manutention, est mal placé.
   ============================================================================ */

/* ---------- Tables officielles ----------------------------------------------
   Indexées à partir de 1, la case [0] laissée vide pour se lire comme la
   feuille papier.
---------------------------------------------------------------------------- */

/* Table A : bras × avant-bras × poignet × pronosupination → posture A */
const TABLE_A = [null,
  /* bras 1 */ [null,
    [null, [null,1,2], [null,2,2], [null,2,3], [null,3,3]],
    [null, [null,2,2], [null,2,2], [null,3,3], [null,3,3]],
    [null, [null,2,3], [null,3,3], [null,3,3], [null,4,4]]],
  /* bras 2 */ [null,
    [null, [null,2,3], [null,3,3], [null,3,4], [null,4,4]],
    [null, [null,3,3], [null,3,3], [null,3,4], [null,4,4]],
    [null, [null,3,4], [null,4,4], [null,4,4], [null,5,5]]],
  /* bras 3 */ [null,
    [null, [null,3,3], [null,4,4], [null,4,4], [null,5,5]],
    [null, [null,3,4], [null,4,4], [null,4,4], [null,5,5]],
    [null, [null,4,4], [null,4,4], [null,4,5], [null,5,5]]],
  /* bras 4 */ [null,
    [null, [null,4,4], [null,4,4], [null,4,5], [null,5,5]],
    [null, [null,4,4], [null,4,4], [null,4,5], [null,5,5]],
    [null, [null,4,4], [null,4,5], [null,5,5], [null,6,6]]],
  /* bras 5 */ [null,
    [null, [null,5,5], [null,5,5], [null,5,6], [null,6,7]],
    [null, [null,5,6], [null,6,6], [null,6,7], [null,7,7]],
    [null, [null,6,6], [null,6,7], [null,7,7], [null,7,8]]],
  /* bras 6 */ [null,
    [null, [null,7,7], [null,7,7], [null,7,8], [null,8,9]],
    [null, [null,8,8], [null,8,8], [null,8,9], [null,9,9]],
    [null, [null,9,9], [null,9,9], [null,9,9], [null,9,9]]]
];

/* Table B : cou × tronc × jambes → posture B */
const TABLE_B = [null,
  /* cou 1 */ [null, [null,1,3], [null,2,3], [null,3,4], [null,5,5], [null,6,6], [null,7,7]],
  /* cou 2 */ [null, [null,2,3], [null,2,3], [null,4,5], [null,5,5], [null,6,7], [null,7,7]],
  /* cou 3 */ [null, [null,3,3], [null,3,4], [null,4,5], [null,5,6], [null,6,7], [null,7,7]],
  /* cou 4 */ [null, [null,5,5], [null,5,6], [null,6,7], [null,7,7], [null,7,7], [null,8,8]],
  /* cou 5 */ [null, [null,7,7], [null,7,7], [null,7,8], [null,8,8], [null,8,8], [null,8,8]],
  /* cou 6 */ [null, [null,8,8], [null,8,8], [null,8,8], [null,8,9], [null,9,9], [null,9,9]]
];

/* Table C : score C (membre supérieur) × score D (cou-tronc-jambes) → RULA */
const TABLE_C = [null,
  [null, 1, 2, 3, 3, 4, 5, 5],
  [null, 2, 2, 3, 4, 4, 5, 5],
  [null, 3, 3, 3, 4, 4, 5, 6],
  [null, 3, 3, 3, 4, 5, 6, 6],
  [null, 4, 4, 4, 5, 6, 7, 7],
  [null, 4, 4, 5, 6, 6, 7, 7],
  [null, 5, 5, 6, 6, 7, 7, 7],
  [null, 5, 5, 6, 7, 7, 7, 7]
];

/* Les quatre niveaux d'action de la méthode. */
export const NIVEAUX = [
  { min: 1, max: 2, niveau: 1, libelle: "Acceptable",
    action: "Posture acceptable si elle n'est pas tenue longtemps ni répétée.", couleur: "vert" },
  { min: 3, max: 4, niveau: 2, libelle: "À investiguer",
    action: "Examen plus poussé nécessaire ; des changements peuvent s'imposer.", couleur: "jaune" },
  { min: 5, max: 6, niveau: 3, libelle: "À corriger bientôt",
    action: "Examen et modifications requis à brève échéance.", couleur: "orange" },
  { min: 7, max: 7, niveau: 4, libelle: "À corriger immédiatement",
    action: "Examen et modifications requis sans délai.", couleur: "rouge" }
];

export function niveauDeRisque(rula) {
  return NIVEAUX.find(n => rula >= n.min && rula <= n.max) || NIVEAUX[NIVEAUX.length - 1];
}

const borne = (v, min, max) => Math.min(max, Math.max(min, v));

/* ---------- Groupe A : bras, avant-bras, poignet ---------- */

export function coteBras({ flexion = 0, epauleHaussee = false, abduction = false, brasSoutenu = false } = {}) {
  const f = flexion;
  let base;
  if (f > 90) base = 4;
  else if (f > 45) base = 3;
  else if (f > 20) base = 2;
  else if (f >= -20) base = 1;
  else base = 2;
  let ajust = 0;
  if (epauleHaussee) ajust += 1;
  if (abduction) ajust += 1;
  if (brasSoutenu) ajust -= 1;
  return { base, ajust, cote: borne(base + ajust, 1, 6), max: 6 };
}

/** `horsAxe` : l'avant-bras travaille en travers du corps ou vers l'extérieur. */
export function coteAvantBras({ flexion = 90, horsAxe = false } = {}) {
  const base = (flexion >= 60 && flexion <= 100) ? 1 : 2;
  const ajust = horsAxe ? 1 : 0;
  return { base, ajust, cote: borne(base + ajust, 1, 3), max: 3 };
}

/** Poignet : RULA découpe plus finement que REBA (trois bandes au lieu de deux). */
export function cotePoignet({ flexion = 0, deviation = false } = {}) {
  const a = Math.abs(flexion);
  let base;
  if (a > 15) base = 3;
  else if (a > 2) base = 2;
  else base = 1;
  const ajust = deviation ? 1 : 0;
  return { base, ajust, cote: borne(base + ajust, 1, 4), max: 4 };
}

/** Pronosupination : 1 en milieu de course, 2 en fin de course. */
export function cotePronosupination({ finDeCourse = false } = {}) {
  const cote = finDeCourse ? 2 : 1;
  return { base: cote, ajust: 0, cote, max: 2 };
}

/* ---------- Groupe B : cou, tronc, jambes ---------- */

/** Cou : quatre bandes, l'extension étant traitée à part et cotée au maximum. */
export function coteCou({ flexion = 0, torsion = false, inclinaison = false } = {}) {
  let base;
  if (flexion < 0) base = 4;              // en extension
  else if (flexion > 20) base = 3;
  else if (flexion > 10) base = 2;
  else base = 1;
  const ajust = (torsion ? 1 : 0) + (inclinaison ? 1 : 0);
  return { base, ajust, cote: borne(base + ajust, 1, 6), max: 6 };
}

/**
 * Tronc. La cote 1 de RULA vise le tronc droit et soutenu ; on la retient pour
 * un tronc quasi vertical, assis avec appui ou debout. L'extension n'a pas de
 * bande propre dans la méthode : on la cote par son amplitude, comme la flexion.
 */
export function coteTronc({ flexion = 0, torsion = false, inclinaison = false, assisSoutenu = false } = {}) {
  const a = Math.abs(flexion);
  let base;
  if (assisSoutenu && a <= 20) base = 1;
  else if (a < 5) base = 1;
  else if (a <= 20) base = 2;
  else if (a <= 60) base = 3;
  else base = 4;
  const ajust = (torsion ? 1 : 0) + (inclinaison ? 1 : 0);
  return { base, ajust, cote: borne(base + ajust, 1, 6), max: 6 };
}

/** Jambes : appuyées et équilibrées, ou non. */
export function coteJambes({ appuiEquilibre = true } = {}) {
  const cote = appuiEquilibre ? 1 : 2;
  return { base: cote, ajust: 0, cote, max: 2 };
}

/* ---------- Majorations communes aux deux groupes ---------- */

/** Utilisation musculaire : posture statique tenue, ou geste répété. */
export function coteMuscle({ statique = false, repete = false } = {}) {
  const cote = (statique || repete) ? 1 : 0;
  return { statique, repete, cote };
}

/**
 * Force et charge. L'échelle RULA diffère de celle de REBA : elle croise le
 * poids avec le caractère statique ou répété du geste.
 */
export function coteForce({ chargeKg = 0, statique = false, repete = false, effortBrusque = false } = {}) {
  const soutenu = statique || repete;
  let cote;
  if (chargeKg > 10 || effortBrusque) cote = 3;
  else if (chargeKg >= 2) cote = soutenu ? 2 : 1;
  else cote = soutenu ? 1 : 0;
  return { cote, soutenu };
}

/* ---------- Assemblage ---------- */

export function calculerRULA(e = {}) {
  const bras       = coteBras(e.bras);
  const avantBras  = coteAvantBras(e.avantBras);
  const poignet    = cotePoignet(e.poignet);
  const prono      = cotePronosupination(e.pronosupination);
  const cou        = coteCou(e.cou);
  const tronc      = coteTronc(e.tronc);
  const jambes     = coteJambes(e.jambes);
  const muscle     = coteMuscle(e.activite);
  const force      = coteForce({ ...e.charge, ...e.activite });

  const postureA = TABLE_A[bras.cote][avantBras.cote][poignet.cote][prono.cote];
  const scoreC = postureA + muscle.cote + force.cote;

  const postureB = TABLE_B[cou.cote][tronc.cote][jambes.cote];
  const scoreD = postureB + muscle.cote + force.cote;

  /* La table C plafonne à 8 en ligne et 7 en colonne. */
  const rula = TABLE_C[borne(scoreC, 1, 8)][borne(scoreD, 1, 7)];

  return {
    methode: "RULA",
    rula, score: rula, echelle: { min: 1, max: 7 },
    risque: niveauDeRisque(rula),
    postureA, postureB, scoreC, scoreD,
    segments: { bras, avantBras, poignet, pronosupination: prono, cou, tronc, jambes },
    muscle, force,
    dominant: segmentDominant({ bras, avantBras, poignet, cou, tronc, jambes })
  };
}

/* Le segment le plus éloigné de son minimum, rapporté à sa propre échelle. */
function segmentDominant(seg) {
  const ordre = ["bras", "poignet", "cou", "tronc", "avantBras", "jambes"];
  let meilleur = null;
  for (const nom of ordre) {
    const s = seg[nom];
    const ecart = (s.cote - 1) / (s.max - 1);
    if (!meilleur || ecart > meilleur.ecart) meilleur = { nom, ecart, cote: s.cote };
  }
  return meilleur && meilleur.ecart > 0 ? meilleur : null;
}

export const TABLES = { TABLE_A, TABLE_B, TABLE_C };
