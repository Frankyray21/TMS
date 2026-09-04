/* ============================================================================
   reba.js — Le modèle de cotation REBA
   Rapid Entire Body Assessment (Hignett & McAtamney, Applied Ergonomics 31, 2000)

   Module pur : aucune dépendance, aucun DOM, aucune notion de vidéo.
   Entrée  : des angles articulaires (degrés) + les paramètres non observables.
   Sortie  : le score REBA détaillé, décomposé, traçable.

   C'est volontairement séparé de l'estimation de pose : le jour où l'on change
   de détecteur, ce fichier ne bouge pas. Et il se teste sans navigateur.
   ============================================================================ */

/* ---------- Tables officielles ----------------------------------------------
   Recopiées de la feuille REBA publiée. Indexées à partir de 1 : la case [0]
   reste vide pour que le code se lise comme la table papier.
---------------------------------------------------------------------------- */

/* Table A : cou × tronc × jambes → score partiel A */
const TABLE_A = [null,
  /* cou = 1 */ [null,
    [null, 1, 2, 3, 4],
    [null, 2, 3, 4, 5],
    [null, 2, 4, 5, 6],
    [null, 3, 5, 6, 7],
    [null, 4, 6, 7, 8]],
  /* cou = 2 */ [null,
    [null, 1, 2, 3, 4],
    [null, 3, 4, 5, 6],
    [null, 4, 5, 6, 7],
    [null, 5, 6, 7, 8],
    [null, 6, 7, 8, 9]],
  /* cou = 3 */ [null,
    [null, 3, 3, 5, 6],
    [null, 4, 5, 6, 7],
    [null, 5, 6, 7, 8],
    [null, 6, 7, 8, 9],
    [null, 7, 7, 8, 9]]
];

/* Table B : avant-bras × bras × poignet → score partiel B */
const TABLE_B = [null,
  /* avant-bras = 1 */ [null,
    [null, 1, 2, 2],
    [null, 1, 2, 3],
    [null, 3, 4, 5],
    [null, 4, 5, 5],
    [null, 6, 7, 8],
    [null, 7, 8, 8]],
  /* avant-bras = 2 */ [null,
    [null, 1, 2, 3],
    [null, 2, 3, 4],
    [null, 4, 5, 5],
    [null, 5, 6, 7],
    [null, 7, 8, 8],
    [null, 8, 9, 9]]
];

/* Table C : score A × score B → score C */
const TABLE_C = [null,
  [null,  1,  1,  1,  2,  3,  3,  4,  5,  6,  7,  7,  7],
  [null,  1,  2,  2,  3,  4,  4,  5,  6,  6,  7,  7,  8],
  [null,  2,  3,  3,  3,  4,  5,  6,  7,  7,  8,  8,  8],
  [null,  3,  4,  4,  4,  5,  6,  7,  8,  8,  9,  9,  9],
  [null,  4,  4,  4,  5,  6,  7,  8,  8,  9,  9,  9,  9],
  [null,  6,  6,  6,  7,  8,  8,  9,  9, 10, 10, 10, 10],
  [null,  7,  7,  7,  8,  9,  9,  9, 10, 10, 11, 11, 11],
  [null,  8,  8,  8,  9, 10, 10, 10, 10, 10, 11, 11, 11],
  [null,  9,  9,  9, 10, 10, 10, 11, 11, 11, 12, 12, 12],
  [null, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12],
  [null, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12],
  [null, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12]
];

/* Les cinq niveaux de risque de la méthode. */
export const NIVEAUX = [
  { min:  1, max:  1, niveau: 0, libelle: "Négligeable",  action: "Aucune intervention nécessaire.",                     couleur: "vert" },
  { min:  2, max:  3, niveau: 1, libelle: "Faible",       action: "Une intervention peut être nécessaire.",              couleur: "vert" },
  { min:  4, max:  7, niveau: 2, libelle: "Moyen",        action: "Intervention nécessaire.",                            couleur: "jaune" },
  { min:  8, max: 10, niveau: 3, libelle: "Élevé",        action: "Intervention nécessaire rapidement.",                 couleur: "orange" },
  { min: 11, max: 15, niveau: 4, libelle: "Très élevé",   action: "Intervention immédiate.",                             couleur: "rouge" }
];

export function niveauDeRisque(reba) {
  return NIVEAUX.find(n => reba >= n.min && reba <= n.max) || NIVEAUX[NIVEAUX.length - 1];
}

const borne = (v, min, max) => Math.min(max, Math.max(min, v));

/* ---------- Groupe A : tronc, cou, jambes ---------------------------------- */

/** Tronc. `flexion` en degrés : positif = flexion avant, négatif = extension. */
export function coteTronc({ flexion = 0, torsion = false, inclinaison = false } = {}) {
  const f = flexion;
  let base;
  if (f > 60) base = 4;
  else if (f > 20) base = 3;
  else if (f > 0) base = 2;
  else if (f === 0) base = 1;
  else if (f >= -20) base = 2;   // extension jusqu'à 20°
  else base = 3;                 // extension marquée
  const ajust = (torsion || inclinaison) ? 1 : 0;
  return { base, ajust, cote: borne(base + ajust, 1, 5), max: 5 };
}

/** Cou. `flexion` positif = flexion avant, négatif = extension. */
export function coteCou({ flexion = 0, torsion = false, inclinaison = false } = {}) {
  const base = (flexion > 20 || flexion < 0) ? 2 : 1;
  const ajust = (torsion || inclinaison) ? 1 : 0;
  return { base, ajust, cote: borne(base + ajust, 1, 3), max: 3 };
}

/**
 * Jambes. `flexionGenou` = flexion du genou le plus fléchi, en degrés.
 * `appuiBilateral` faux = appui unilatéral ou instable.
 */
export function coteJambes({ appuiBilateral = true, flexionGenou = 0, assis = false } = {}) {
  const base = appuiBilateral ? 1 : 2;
  let ajust = 0;
  if (!assis) {
    if (flexionGenou > 60) ajust = 2;
    else if (flexionGenou > 30) ajust = 1;
  }
  return { base, ajust, cote: borne(base + ajust, 1, 4), max: 4 };
}

/** Charge et force. `chargeKg` en kilogrammes. */
export function coteCharge({ chargeKg = 0, effortBrusque = false } = {}) {
  let base;
  if (chargeKg > 10) base = 2;
  else if (chargeKg >= 5) base = 1;
  else base = 0;
  const ajust = effortBrusque ? 1 : 0;
  return { base, ajust, cote: base + ajust, max: 3 };
}

/* ---------- Groupe B : bras, avant-bras, poignet --------------------------- */

/** Bras (épaule). `flexion` positif = élévation avant, négatif = extension. */
export function coteBras({ flexion = 0, epauleHaussee = false, abduction = false, brasSoutenu = false } = {}) {
  let base;
  const f = flexion;
  if (f > 90) base = 4;
  else if (f > 45) base = 3;
  else if (f > 20) base = 2;
  else if (f >= -20) base = 1;
  else base = 2;                 // extension au-delà de 20°
  let ajust = 0;
  if (epauleHaussee) ajust += 1;
  if (abduction) ajust += 1;
  if (brasSoutenu) ajust -= 1;
  return { base, ajust, cote: borne(base + ajust, 1, 6), max: 6 };
}

/** Avant-bras (coude). `flexion` = angle de flexion du coude, 0° = bras tendu. */
export function coteAvantBras({ flexion = 90 } = {}) {
  const base = (flexion >= 60 && flexion <= 100) ? 1 : 2;
  return { base, ajust: 0, cote: base, max: 2 };
}

/** Poignet. `flexion` positif = flexion, négatif = extension. */
export function cotePoignet({ flexion = 0, deviation = false, torsion = false } = {}) {
  const base = Math.abs(flexion) > 15 ? 2 : 1;
  const ajust = (deviation || torsion) ? 1 : 0;
  return { base, ajust, cote: borne(base + ajust, 1, 3), max: 3 };
}

/** Qualité de la prise : 0 bonne, 1 correcte, 2 mauvaise, 3 inacceptable. */
export function cotePrise({ prise = 0 } = {}) {
  return { base: borne(prise, 0, 3), ajust: 0, cote: borne(prise, 0, 3), max: 3 };
}

/**
 * Score d'activité. Les trois majorations de la méthode, cumulables.
 *  - statique      : un segment maintenu plus d'une minute
 *  - repete        : gestes de faible amplitude répétés plus de 4 fois/minute
 *  - instable      : changements rapides d'amplitude ou base d'appui instable
 */
export function coteActivite({ statique = false, repete = false, instable = false } = {}) {
  const cote = (statique ? 1 : 0) + (repete ? 1 : 0) + (instable ? 1 : 0);
  return { statique, repete, instable, cote };
}

/* ---------- Assemblage ------------------------------------------------------ */

/**
 * Calcule le REBA complet.
 *
 * @param {object} e — les entrées, regroupées par segment. Chaque groupe accepte
 *   les mêmes clés que la fonction de cotation correspondante.
 * @returns {object} le score final et toute sa décomposition, pour que chaque
 *   chiffre affiché à l'écran puisse être remonté jusqu'à sa règle.
 */
export function calculerREBA(e = {}) {
  const tronc      = coteTronc(e.tronc);
  const cou        = coteCou(e.cou);
  const jambes     = coteJambes(e.jambes);
  const charge     = coteCharge(e.charge);
  const bras       = coteBras(e.bras);
  const avantBras  = coteAvantBras(e.avantBras);
  const poignet    = cotePoignet(e.poignet);
  const prise      = cotePrise(e.prise);
  const activite   = coteActivite(e.activite);

  const tableA  = TABLE_A[cou.cote][tronc.cote][jambes.cote];
  const scoreA  = tableA + charge.cote;

  const tableB  = TABLE_B[avantBras.cote][bras.cote][poignet.cote];
  const scoreB  = tableB + prise.cote;

  /* La table C est bornée à 12 de chaque côté : au-delà, la méthode plafonne. */
  const scoreC  = TABLE_C[borne(scoreA, 1, 12)][borne(scoreB, 1, 12)];
  const reba    = borne(scoreC + activite.cote, 1, 15);

  return {
    methode: "REBA",
    reba, score: reba, echelle: { min: 1, max: 15 },
    risque: niveauDeRisque(reba),
    scoreA, scoreB, scoreC, tableA, tableB,
    segments: { tronc, cou, jambes, charge, bras, avantBras, poignet, prise },
    activite,
    /* Ce qui pèse le plus lourd dans le score, pour pointer où agir. */
    dominant: segmentDominant({ tronc, cou, jambes, bras, avantBras, poignet })
  };
}

/* Le segment dont la cote est la plus éloignée de son minimum : le premier
   endroit où intervenir. À cote égale, l'ordre suit l'importance clinique. */
function segmentDominant(seg) {
  const ordre = ["tronc", "bras", "jambes", "poignet", "cou", "avantBras"];
  let meilleur = null;
  for (const nom of ordre) {
    const ecart = seg[nom].cote - 1;
    if (!meilleur || ecart > meilleur.ecart) meilleur = { nom, ecart, cote: seg[nom].cote };
  }
  return meilleur && meilleur.ecart > 0 ? meilleur : null;
}

/* ---------- Couleur par segment --------------------------------------------
   Le squelette se colore segment par segment. On normalise chaque cote sur sa
   propre échelle : un tronc à 4/5 et un poignet à 3/3 ne se comparent pas
   autrement. La couleur ne voyage jamais seule — l'interface affiche toujours
   la cote à côté (l'échelle vert-jaune-orange-rouge est illisible pour une
   partie des daltoniens).
---------------------------------------------------------------------------- */
const MAXIMA = { tronc: 5, cou: 3, jambes: 4, bras: 6, avantBras: 2, poignet: 3 };

export function severiteSegment(nom, cote) {
  return severite(cote, MAXIMA[nom]);
}

/** Sévérité générique : chaque segment est normalisé sur sa propre échelle,
    puisqu'un tronc à 4/5 et un poignet à 3/3 ne se comparent pas autrement. */
export function severite(cote, max) {
  if (!max || max < 2) return 0;
  const r = (cote - 1) / (max - 1);        // 0 = neutre, 1 = pire cas
  if (r <= 0.001) return 0;                // vert
  if (r <= 0.34) return 1;                 // jaune
  if (r <= 0.67) return 2;                 // orange
  return 3;                                // rouge
}

export const ETIQUETTES_SEVERITE = ["Confort", "À surveiller", "Élevé", "Contraignant"];

/* ---------- Agrégation sur une séquence ------------------------------------
   Une cote décrit un instant. Une tâche, non. Ces fonctions résument une suite
   d'images en gardant ce qui compte : le pire instant, et le temps passé dans
   chaque niveau.
---------------------------------------------------------------------------- */

/**
 * @param {Array<{t:number, resultat:object, fiable:boolean}>} images
 * @returns {object} synthèse de la séquence
 */
export function synthetiser(images, niveaux = NIVEAUX) {
  const valides = images.filter(i => i.resultat && i.fiable !== false);
  if (!valides.length) return null;

  const scores = valides.map(i => i.resultat.score);
  const trie = [...scores].sort((a, b) => a - b);
  const percentile = p => trie[Math.min(trie.length - 1, Math.floor(p * trie.length))];

  let pire = valides[0];
  for (const i of valides) if (i.resultat.score > pire.resultat.score) pire = i;

  /* Temps passé dans chaque niveau, pondéré par la durée réelle de chaque image. */
  const duree = dureeParImage(valides);
  const parNiveau = niveaux.map(n => ({ ...n, secondes: 0 }));
  valides.forEach((img, k) => {
    const n = parNiveau.find(x => img.resultat.score >= x.min && img.resultat.score <= x.max);
    if (n) n.secondes += duree[k];
  });
  const total = parNiveau.reduce((s, n) => s + n.secondes, 0) || 1;
  parNiveau.forEach(n => n.part = n.secondes / total);

  /* Quel segment domine le plus souvent : la cible d'intervention prioritaire. */
  const compte = {};
  valides.forEach(i => {
    const d = i.resultat.dominant;
    if (d) compte[d.nom] = (compte[d.nom] || 0) + 1;
  });
  const dominantFrequent = Object.entries(compte).sort((a, b) => b[1] - a[1])[0] || null;

  return {
    images: valides.length,
    ignorees: images.length - valides.length,
    duree: total,
    median: percentile(0.5),
    p90: percentile(0.9),
    max: Math.max(...scores),
    moyenne: scores.reduce((s, v) => s + v, 0) / scores.length,
    pire: { t: pire.t, score: pire.resultat.score, reba: pire.resultat.score, resultat: pire.resultat },
    parNiveau,
    dominantFrequent: dominantFrequent
      ? { nom: dominantFrequent[0], part: dominantFrequent[1] / valides.length }
      : null
  };
}

/* Durée attribuée à chaque image : l'écart jusqu'à la suivante. La dernière
   hérite de l'avant-dernière. Évite de fausser les pourcentages quand
   l'échantillonnage n'est pas régulier. */
function dureeParImage(images) {
  if (images.length === 1) return [1];
  const d = images.map((img, k) =>
    k < images.length - 1 ? Math.max(0, images[k + 1].t - img.t) : 0);
  d[d.length - 1] = d[d.length - 2] || 1;
  return d;
}

export const TABLES = { TABLE_A, TABLE_B, TABLE_C };
