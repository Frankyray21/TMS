/* ============================================================================
   demo.js — Un cycle de levage simulé

   Sert à deux choses : montrer ce que produit l'outil dès l'ouverture, sans
   fichier ni téléchargement de modèle, et vérifier d'un coup d'œil que la
   chaîne angles → cotation → affichage fonctionne.

   Ce ne sont PAS de vraies mesures : les postures sont fabriquées. L'interface
   le dit explicitement tant qu'aucune vidéo n'est chargée.
   ============================================================================ */

import { P } from "./angles.js";

const rad = d => d * Math.PI / 180;

/* Basculement avant : un point au-dessus des hanches part du côté du visage. */
const basculer = (p, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return { ...p, y: p.y * c + p.z * s, z: -p.y * s + p.z * c };
};

/** Un corps paramétré, dans la convention MediaPipe (mètres, y vers le bas). */
function corps({ tronc = 0, genou = 0, bras = 0, coude = 20, cou = 10 }) {
  const pt = (x, y, z) => ({ x, y, z, visibility: 0.95 });
  const L = {};
  L[P.HANCHE_G] = pt(0.10, 0, 0); L[P.HANCHE_D] = pt(-0.10, 0, 0);

  for (const [h, gn, ch, ta, pi] of [
    [P.HANCHE_G, P.GENOU_G, P.CHEVILLE_G, P.TALON_G, P.PIED_G],
    [P.HANCHE_D, P.GENOU_D, P.CHEVILLE_D, P.TALON_D, P.PIED_D]]) {
    const x = L[h].x;
    L[gn] = pt(x, 0.45, 0);
    L[ch] = pt(x, 0.45 + 0.42 * Math.cos(rad(genou)), -0.42 * Math.sin(rad(genou)));
    L[ta] = pt(x, L[ch].y + 0.05, L[ch].z - 0.04);
    L[pi] = pt(x, L[ch].y + 0.05, L[ch].z + 0.12);
  }

  const haut = {};
  haut[P.EPAULE_G] = pt(0.18, -0.50, 0); haut[P.EPAULE_D] = pt(-0.18, -0.50, 0);
  const hy = -0.50 - 0.14 * Math.cos(rad(cou)), hz = 0.14 * Math.sin(rad(cou));
  haut[P.OREILLE_G] = pt(0.08, hy, hz); haut[P.OREILLE_D] = pt(-0.08, hy, hz);
  haut[P.NEZ] = pt(0, hy - 0.02, hz + 0.11);

  for (const [ep, cd, pg, ix, au, signe] of [
    [P.EPAULE_G, P.COUDE_G, P.POIGNET_G, P.INDEX_G, P.AURICULAIRE_G, 1],
    [P.EPAULE_D, P.COUDE_D, P.POIGNET_D, P.INDEX_D, P.AURICULAIRE_D, -1]]) {
    const e = haut[ep];
    haut[cd] = pt(e.x + signe * 0.02, e.y + 0.28 * Math.cos(rad(bras)), e.z + 0.28 * Math.sin(rad(bras)));
    const a = rad(bras + coude);
    haut[pg] = pt(haut[cd].x + signe * 0.02, haut[cd].y + 0.25 * Math.cos(a), haut[cd].z + 0.25 * Math.sin(a));
    haut[ix] = pt(haut[pg].x, haut[pg].y + 0.08 * Math.cos(a) + 0.02, haut[pg].z + 0.08 * Math.sin(a));
    haut[au] = pt(haut[pg].x + signe * 0.04, haut[pg].y + 0.08 * Math.cos(a) - 0.01, haut[pg].z + 0.08 * Math.sin(a));
  }
  for (const k of Object.keys(haut)) L[k] = { ...basculer(haut[k], tronc), visibility: 0.95 };
  return Array.from({ length: 33 }, (_, i) => L[i] || pt(0, 0, 0));
}

/* Projection vers des coordonnées écran normalisées.
   Vue de trois quarts plutôt que de face : une flexion du tronc se fait dans le
   plan sagittal, elle serait presque invisible vue de devant — c'est d'ailleurs
   pour la même raison qu'on filme un poste de manutention de côté. */
function versEcran(monde, { aspect = 16 / 9, vue = 72 } = {}) {
  const a = rad(vue), c = Math.cos(a), s = Math.sin(a);
  const plan = monde.map(p => ({ u: p.x * c + p.z * s, v: p.y }));
  const vs = plan.map(p => p.v);
  const vMin = Math.min(...vs), vMax = Math.max(...vs);
  const k = 0.68 / Math.max(0.5, vMax - vMin);          // le corps occupe 68 % de la hauteur
  const us = plan.map(p => p.u);
  const uCentre = (Math.min(...us) + Math.max(...us)) / 2;
  return plan.map((p, i) => ({
    x: 0.5 + ((p.u - uCentre) * k) / aspect,            // aspect : sinon le corps s'étire
    y: 0.28 + (p.v - vMin) * k,                         // sous l'encadré de démonstration
    z: monde[i].z,
    visibility: monde[i].visibility
  }));
}

/* Les étapes du cycle : debout, descente, saisie au sol, relevage, port, dépose.
   Les angles sont ceux d'une manutention ordinaire, pas d'un cas extrême. */
/* Les angles sont ceux d'une manutention ordinaire : saisie d'une caisse à
   hauteur de palette, port contre le corps, dépose. Les valeurs de `bras` sont
   choisies pour que les mains restent à une distance plausible du corps — c'est
   ce que NIOSH mesure, et une posture synthétique invraisemblable donnerait un
   « hors domaine » qui n'apprendrait rien. */
const ETAPES = [
  { t: 0.0, tronc:  5, genou:  5, bras:  8, coude: 15, cou: 10 },
  { t: 0.8, tronc: 40, genou: 35, bras:  6, coude: 30, cou: 20 },
  { t: 1.6, tronc: 72, genou: 55, bras: 15, coude: 25, cou: 30 },
  { t: 2.2, tronc: 68, genou: 50, bras: 18, coude: 45, cou: 28 },
  { t: 3.0, tronc: 35, genou: 25, bras:  6, coude: 70, cou: 15 },
  { t: 3.8, tronc: 10, genou:  5, bras:  8, coude: 85, cou: 12 },
  { t: 4.6, tronc:  8, genou:  5, bras:  8, coude: 85, cou: 12 },
  { t: 5.4, tronc: 45, genou: 30, bras:  8, coude: 60, cou: 22 },
  { t: 6.0, tronc: 15, genou: 10, bras:  5, coude: 20, cou: 12 }
];

const interp = (a, b, k) => a + (b - a) * k;

/** Séquence complète, échantillonnée régulièrement. */
export function sequenceDemo({ fps = 8 } = {}) {
  const duree = ETAPES[ETAPES.length - 1].t;
  const releves = [];
  for (let t = 0; t <= duree + 1e-9; t += 1 / fps) {
    let i = 0;
    while (i < ETAPES.length - 2 && ETAPES[i + 1].t < t) i++;
    const a = ETAPES[i], b = ETAPES[i + 1];
    const k = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    /* Adoucit les transitions : une interpolation linéaire donnerait des
       ruptures d'angle qu'aucun corps ne produit. */
    const e = k * k * (3 - 2 * k);
    const monde = corps({
      tronc: interp(a.tronc, b.tronc, e), genou: interp(a.genou, b.genou, e),
      bras: interp(a.bras, b.bras, e), coude: interp(a.coude, b.coude, e),
      cou: interp(a.cou, b.cou, e)
    });
    releves.push({ t: +t.toFixed(3), monde, ecran: versEcran(monde) });
  }
  return releves;
}

export const PARAMS_DEMO = {
  chargeKg: 12, prise: 1, repete: true, cote: "D",
  lissage: 0, echantillonnage: 8
};
