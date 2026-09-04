/* ============================================================================
   niosh.js — Équation révisée du NIOSH pour le levage
   Waters, Putz-Anderson, Garg & Fine (1993, 1994)

   Même contrat que reba.js et rula.js : module pur, sans DOM ni dépendance.

   Ce n'est pas une cotation posturale : c'est un calcul de charge admissible.
       PLR = 23 × HM × VM × DM × AM × FM × CM
   La PLR (poids limite recommandé) est la charge que la tâche autoriserait ;
   l'indice de levage IL = poids réel / PLR dit de combien on la dépasse.

   L'intérêt en vidéo : H, V, D et A sont des distances et des angles, c'est-à-
   dire précisément ce qu'on mesure au galon en s'accroupissant à côté du poste.
   Le squelette 3D les donne. Restent le poids, la fréquence, la durée et la
   prise, qui viennent de l'opérateur.
   ============================================================================ */

export const CONSTANTE_CHARGE = 23;   // kg, la charge de référence de la méthode

/* Fréquence : table officielle. Colonnes = durée de la tâche, sous-colonnes =
   hauteur des mains au départ (sous ou au-dessus de 75 cm). */
const FREQUENCES = [0.2, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const TABLE_FM = {
  /* [≤1 h : V<75, V≥75] , [>1–2 h : …] , [>2–8 h : …] */
  0.2: [[1.00, 1.00], [0.95, 0.95], [0.85, 0.85]],
  0.5: [[0.97, 0.97], [0.92, 0.92], [0.81, 0.81]],
  1:   [[0.94, 0.94], [0.88, 0.88], [0.75, 0.75]],
  2:   [[0.91, 0.91], [0.84, 0.84], [0.65, 0.65]],
  3:   [[0.88, 0.88], [0.79, 0.79], [0.55, 0.55]],
  4:   [[0.84, 0.84], [0.72, 0.72], [0.45, 0.45]],
  5:   [[0.80, 0.80], [0.60, 0.60], [0.35, 0.35]],
  6:   [[0.75, 0.75], [0.50, 0.50], [0.27, 0.27]],
  7:   [[0.70, 0.70], [0.42, 0.42], [0.22, 0.22]],
  8:   [[0.60, 0.60], [0.35, 0.35], [0.18, 0.18]],
  9:   [[0.52, 0.52], [0.30, 0.30], [0.00, 0.15]],
  10:  [[0.45, 0.45], [0.26, 0.26], [0.00, 0.13]],
  11:  [[0.41, 0.41], [0.00, 0.23], [0.00, 0.00]],
  12:  [[0.37, 0.37], [0.00, 0.21], [0.00, 0.00]],
  13:  [[0.00, 0.34], [0.00, 0.00], [0.00, 0.00]],
  14:  [[0.00, 0.31], [0.00, 0.00], [0.00, 0.00]],
  15:  [[0.00, 0.28], [0.00, 0.00], [0.00, 0.00]]
};

export const DUREES = [
  { cle: "courte", libelle: "1 h ou moins", index: 0 },
  { cle: "moyenne", libelle: "Plus de 1 h, jusqu'à 2 h", index: 1 },
  { cle: "longue", libelle: "Plus de 2 h, jusqu'à 8 h", index: 2 }
];

export const PRISES = [
  { cle: "bonne", libelle: "Bonne — poignée ou prise franche", index: 0 },
  { cle: "correcte", libelle: "Correcte — prise acceptable", index: 1 },
  { cle: "mauvaise", libelle: "Mauvaise — pas de prise adaptée", index: 2 }
];

/* ---------- Les six multiplicateurs ---------- */

/** Horizontal : distance des mains à la mi-distance des chevilles, en cm. */
export function multiplicateurH(H) {
  if (!Number.isFinite(H)) return { valeur: 0, motif: "distance horizontale inconnue" };
  if (H > 63) return { valeur: 0, motif: "charge à plus de 63 cm du corps : hors domaine de la méthode" };
  if (H <= 25) return { valeur: 1, motif: null };
  return { valeur: 25 / H, motif: null };
}

/** Vertical : hauteur des mains au-dessus du sol, en cm. Optimum à 75 cm. */
export function multiplicateurV(V) {
  if (!Number.isFinite(V)) return { valeur: 0, motif: "hauteur des mains inconnue" };
  if (V > 175) return { valeur: 0, motif: "mains à plus de 175 cm : hors domaine" };
  if (V < 0) return { valeur: 0, motif: "hauteur négative" };
  return { valeur: 1 - 0.003 * Math.abs(V - 75), motif: null };
}

/** Déplacement vertical entre l'origine et la destination, en cm. */
export function multiplicateurD(D) {
  if (!Number.isFinite(D)) return { valeur: 0, motif: "déplacement inconnu" };
  if (D > 175) return { valeur: 0, motif: "déplacement de plus de 175 cm : hors domaine" };
  if (D < 25) return { valeur: 1, motif: null };
  return { valeur: 0.82 + 4.5 / D, motif: null };
}

/** Asymétrie : angle de torsion du levage, en degrés. */
export function multiplicateurA(A) {
  if (!Number.isFinite(A)) return { valeur: 0, motif: "angle d'asymétrie inconnu" };
  if (A > 135) return { valeur: 0, motif: "torsion de plus de 135° : hors domaine" };
  return { valeur: 1 - 0.0032 * Math.max(0, A), motif: null };
}

/** Fréquence : levages par minute, croisés avec la durée et la hauteur. */
export function multiplicateurF(levagesParMinute, duree = "courte", V = 75) {
  const d = DUREES.find(x => x.cle === duree) || DUREES[0];
  const colonne = V >= 75 ? 1 : 0;
  if (!Number.isFinite(levagesParMinute) || levagesParMinute <= 0) return { valeur: 1, motif: null };
  if (levagesParMinute > 15) return { valeur: 0, motif: "plus de 15 levages/min : hors domaine" };
  /* La table est à paliers : on retient le premier palier au moins égal à la
     fréquence observée, jamais une interpolation — la méthode ne le permet pas. */
  const palier = FREQUENCES.find(f => levagesParMinute <= f) ?? 15;
  const valeur = TABLE_FM[palier][d.index][colonne];
  return {
    valeur, palier,
    motif: valeur === 0 ? `${palier} levages/min sur ${d.libelle.toLowerCase()} : hors domaine` : null
  };
}

/** Prise : dépend aussi de la hauteur de départ. */
export function multiplicateurC(prise = "bonne", V = 75) {
  const p = PRISES.find(x => x.cle === prise) || PRISES[0];
  const haut = V >= 75;
  const valeur = p.index === 0 ? 1.00
               : p.index === 1 ? (haut ? 1.00 : 0.95)
               : 0.90;
  return { valeur, motif: null };
}

/* ---------- Niveaux de risque de l'indice de levage ---------- */

export const NIVEAUX = [
  { min: 0,    max: 1,        niveau: 1, libelle: "Acceptable",
    action: "Charge tolérable pour la grande majorité des travailleurs.", couleur: "vert" },
  { min: 1.001, max: 2,       niveau: 2, libelle: "Risque accru",
    action: "Une partie des travailleurs est exposée. Réduire la charge ou revoir le poste.", couleur: "jaune" },
  { min: 2.001, max: 3,       niveau: 3, libelle: "Risque élevé",
    action: "Exposition importante. Correction requise.", couleur: "orange" },
  { min: 3.001, max: Infinity, niveau: 4, libelle: "Risque très élevé",
    action: "Charge inacceptable en l'état. Correction immédiate.", couleur: "rouge" }
];

export function niveauDeRisque(il) {
  return NIVEAUX.find(n => il >= n.min && il <= n.max) || NIVEAUX[NIVEAUX.length - 1];
}

/* ---------- Assemblage ---------- */

/**
 * Poids limite recommandé en un point du levage.
 * @param {object} p — { H, V, D, A, frequence, duree, prise }
 */
export function calculerPLR(p = {}) {
  const HM = multiplicateurH(p.H);
  const VM = multiplicateurV(p.V);
  const DM = multiplicateurD(p.D);
  const AM = multiplicateurA(p.A);
  const FM = multiplicateurF(p.frequence, p.duree, p.V);
  const CM = multiplicateurC(p.prise, p.V);

  const multiplicateurs = { HM, VM, DM, AM, FM, CM };
  const plr = CONSTANTE_CHARGE * HM.valeur * VM.valeur * DM.valeur * AM.valeur * FM.valeur * CM.valeur;

  /* Le multiplicateur le plus pénalisant : c'est lui qu'il faut corriger. */
  let pire = null;
  for (const [nom, m] of Object.entries(multiplicateurs)) {
    if (!pire || m.valeur < pire.valeur) pire = { nom, valeur: m.valeur, motif: m.motif };
  }
  const horsDomaine = Object.entries(multiplicateurs)
    .filter(([, m]) => m.motif).map(([nom, m]) => ({ nom, motif: m.motif }));

  return { plr, multiplicateurs, pire, horsDomaine };
}

/**
 * Calcul complet : la méthode s'applique à l'origine et, quand la pose demande
 * du contrôle, à la destination. L'indice retenu est le plus défavorable.
 *
 * @param {object} e — { origine:{H,V,A}, destination:{H,V,A}, poids,
 *                       frequence, duree, prise, controleDestination }
 */
export function calculerNIOSH(e = {}) {
  const o = e.origine || {};
  const d = e.destination || {};
  const commun = { frequence: e.frequence, duree: e.duree, prise: e.prise };

  /* Le déplacement vertical est le même des deux côtés. */
  const D = (Number.isFinite(o.V) && Number.isFinite(d.V)) ? Math.abs(d.V - o.V) : (e.D ?? 0);

  const origine = calculerPLR({ H: o.H, V: o.V, A: o.A, D, ...commun });
  const utiliseDestination = e.controleDestination && Number.isFinite(d.H) && Number.isFinite(d.V);
  const destination = utiliseDestination
    ? calculerPLR({ H: d.H, V: d.V, A: d.A ?? o.A, D, ...commun })
    : null;

  const poids = e.poids ?? 0;
  const ilOrigine = origine.plr > 0 ? poids / origine.plr : Infinity;
  const ilDestination = destination ? (destination.plr > 0 ? poids / destination.plr : Infinity) : null;

  /* On retient le point le plus défavorable : c'est lui qui gouverne la tâche. */
  const gouverne = (ilDestination !== null && ilDestination > ilOrigine) ? "destination" : "origine";
  const point = gouverne === "destination" ? destination : origine;
  const il = gouverne === "destination" ? ilDestination : ilOrigine;

  return {
    methode: "NIOSH",
    D, poids,
    plr: point.plr,
    il, score: il, echelle: { min: 0, max: 3 },
    risque: niveauDeRisque(il),
    gouverne,
    origine: { ...origine, il: ilOrigine },
    destination: destination ? { ...destination, il: ilDestination } : null,
    multiplicateurs: point.multiplicateurs,
    pire: point.pire,
    horsDomaine: point.horsDomaine,
    /* Ce qu'il faudrait ramener la charge à pour rentrer dans le domaine. */
    poidsAdmissible: point.plr
  };
}

export const ETIQUETTES = {
  HM: "Distance horizontale", VM: "Hauteur des mains", DM: "Déplacement vertical",
  AM: "Asymétrie", FM: "Fréquence", CM: "Prise"
};
