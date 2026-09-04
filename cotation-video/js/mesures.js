/* ============================================================================
   mesures.js — Distances et angles du levage, mesurés sur le squelette

   NIOSH ne demande pas des angles articulaires mais des distances en
   centimètres : à quelle distance du corps la charge est saisie, à quelle
   hauteur, de combien elle monte, sous quel angle de torsion. Au poste, ça se
   mesure au galon, accroupi à côté du travailleur, en interrompant la tâche.
   Le squelette 3D les donne sans rien interrompre.

   Réserve importante : les repères « monde » de MediaPipe sont métriques mais
   approximatifs. Sans étalonnage, les distances sont des estimations à corriger
   à l'œil. Avec la taille du travailleur, elles deviennent exploitables — d'où
   le champ prévu pour ça.
   ============================================================================ */

import { P } from "./angles.js";

const v = p => ({ x: p.x, y: p.y, z: p.z ?? 0 });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const milieu = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const normeH = a => Math.hypot(a.x, a.z);          // longueur dans le plan du sol
const unite = a => { const n = Math.hypot(a.x, a.y, a.z); return n < 1e-9 ? { x:0,y:0,z:0 } : { x:a.x/n, y:a.y/n, z:a.z/n }; };

/* Rapport anthropométrique standard : la hauteur d'épaule (acromion) vaut
   environ 81,8 % de la stature debout. On étalonne là-dessus plutôt que sur la
   hauteur de tête mesurée à l'image : celle-ci s'effondre dès que le sujet se
   penche, et le facteur d'échelle se mettrait à varier d'une image à l'autre
   sur la même personne. La somme des segments, elle, ne bouge pas avec la
   posture. */
const RATIO_EPAULE = 0.818;

const longueur = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Stature estimée par la chaîne des segments : pied, jambe, cuisse, tronc.
 * Invariante à la posture, contrairement à toute mesure prise verticalement.
 */
function statureParSegments(pts, solY) {
  const cheville = milieu(v(pts[P.CHEVILLE_G]), v(pts[P.CHEVILLE_D]));
  const genou    = milieu(v(pts[P.GENOU_G]),    v(pts[P.GENOU_D]));
  const hanche   = milieu(v(pts[P.HANCHE_G]),   v(pts[P.HANCHE_D]));
  const epaule   = milieu(v(pts[P.EPAULE_G]),   v(pts[P.EPAULE_D]));
  const hauteurPied = Math.abs(solY - cheville.y);
  const chaine = hauteurPied + longueur(cheville, genou) + longueur(genou, hanche)
               + longueur(hanche, epaule);
  return chaine / RATIO_EPAULE;
}

/**
 * Mesure les grandeurs du levage sur une pose.
 *
 * @param {Array} pts — repères « monde » (mètres, y vers le bas)
 * @param {object} o — { tailleCm } taille réelle du travailleur, pour étalonner
 * @returns {object} { H, V, A, echelle, fiable, … } — H et V en centimètres
 */
export function mesuresLevage(pts, o = {}) {
  const chevilleG = v(pts[P.CHEVILLE_G]), chevilleD = v(pts[P.CHEVILLE_D]);
  const talonG = v(pts[P.TALON_G]), talonD = v(pts[P.TALON_D]);
  const piedG = v(pts[P.PIED_G]), piedD = v(pts[P.PIED_D]);
  const poignetG = v(pts[P.POIGNET_G]), poignetD = v(pts[P.POIGNET_D]);

  /* Le sol : le point le plus bas du pied. En convention y vers le bas, c'est
     le y le plus grand. */
  const solY = Math.max(talonG.y, talonD.y, piedG.y, piedD.y, chevilleG.y, chevilleD.y);

  const mains = milieu(poignetG, poignetD);
  const chevilles = milieu(chevilleG, chevilleD);

  /* Échelle : sans taille déclarée, on garde les mètres du modèle tels quels. */
  const statureModele = statureParSegments(pts, solY);      // mètres
  const echelle = (o.tailleCm && statureModele > 0.5)
    ? (o.tailleCm / 100) / statureModele
    : 1;

  /* V : hauteur des mains au-dessus du sol. */
  const V = (solY - mains.y) * 100 * echelle;

  /* H : distance horizontale entre les mains et le milieu des chevilles.
     La méthode mesure bien depuis les chevilles, pas depuis le tronc. */
  const H = normeH(sub(mains, chevilles)) * 100 * echelle;

  /* A : angle entre la direction du levage et le plan sagittal neutre.
     La référence est l'orientation des pieds, pas celle des épaules : c'est tout
     l'intérêt de la mesure, puisque la torsion se lit justement dans l'écart
     entre les deux. */
  const avantPieds = unite({
    x: (piedG.x - talonG.x) + (piedD.x - talonD.x), y: 0,
    z: (piedG.z - talonG.z) + (piedD.z - talonD.z)
  });
  const versCharge = sub(mains, chevilles);
  const versChargeH = unite({ x: versCharge.x, y: 0, z: versCharge.z });
  let A = 0;
  if (normeH(avantPieds) > 0.05 && normeH(versCharge) > 0.02) {
    const cos = Math.min(1, Math.max(-1, dot(avantPieds, versChargeH)));
    A = Math.acos(cos) * 180 / Math.PI;
  }

  /* Fiabilité : la mesure ne vaut rien si les pieds ou les mains sont hors cadre. */
  const visibilite = i => pts[i]?.visibility ?? 0;
  const visPieds = Math.min(visibilite(P.TALON_G), visibilite(P.TALON_D),
                            visibilite(P.PIED_G), visibilite(P.PIED_D));
  const visMains = Math.min(visibilite(P.POIGNET_G), visibilite(P.POIGNET_D));
  const seuil = o.seuilVisibilite ?? 0.5;

  return {
    H: Math.max(0, H), V, A,
    echelle, statureModeleCm: statureModele * 100,
    visPieds, visMains,
    /* L'angle d'asymétrie dépend de l'orientation des pieds : sans pieds nets,
       on ne le donne pas plutôt que d'en inventer un. */
    fiableA: visPieds >= seuil,
    fiable: visPieds >= seuil && visMains >= seuil,
    solY, mainsY: mains.y
  };
}

/**
 * Repère les deux instants d'un levage dans une séquence : la saisie (mains au
 * plus bas) et la dépose (mains au plus haut). Une suggestion, pas un verdict —
 * l'opérateur reste maître des deux repères.
 */
export function suggererLevage(images) {
  const utiles = images.filter(i => i.mesures?.fiable);
  if (utiles.length < 2) return null;
  let bas = utiles[0], haut = utiles[0];
  for (const i of utiles) {
    if (i.mesures.V < bas.mesures.V) bas = i;
    if (i.mesures.V > haut.mesures.V) haut = i;
  }
  if (bas === haut) return null;
  /* La saisie précède la dépose : si le plus bas arrive après, c'est une dépose
     au sol, et les deux repères s'inversent. */
  return bas.t <= haut.t
    ? { origine: bas.t, destination: haut.t, sens: "levage" }
    : { origine: haut.t, destination: bas.t, sens: "dépose" };
}
