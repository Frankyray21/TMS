/* ============================================================================
   picto.js — Les pictogrammes d'angle

   Une planche d'ergonomie miniature par segment : la silhouette prend la
   posture mesurée, les zones d'angle disent où ça bascule, et la valeur
   relevée est portée dessus — ce qu'une planche imprimée ne peut pas faire.

   Aucune dépendance au DOM : ce module rend une chaîne SVG, ce qui le rend
   vérifiable hors navigateur (voir tests/rendre-picto.mjs).
   ============================================================================ */

import { severite } from "./reba.js";
import { COULEURS } from "./rendu.js";

/* Les bandes d'angle de chaque segment, telles que les fonctions de cotation
   les appliquent réellement. Elles répondent à la question qu'une règle écrite
   laisse en suspens : à partir de quel angle ça bascule, et où tombe la mesure. */
export const BANDES = {
  reba: {
    tronc:     { min: -40, max: 90, b: [[-40,-20,3],[-20,20,2],[20,60,3],[60,90,4]] },
    cou:       { min: -30, max: 60, b: [[-30,0,2],[0,20,1],[20,60,2]] },
    jambes:    { min: 0, max: 120, b: [[0,30,1],[30,60,2],[60,120,3]], majoration: true },
    bras:      { min: -45, max: 140, b: [[-45,-20,2],[-20,20,1],[20,45,2],[45,90,3],[90,140,4]] },
    avantBras: { min: 0, max: 160, b: [[0,60,2],[60,100,1],[100,160,2]] },
    poignet:   { min: -45, max: 45, b: [[-45,-15,2],[-15,15,1],[15,45,2]] }
  },
  rula: {
    tronc:     { min: -60, max: 90, b: [[-60,-20,3],[-20,-5,2],[-5,5,1],[5,20,2],[20,60,3],[60,90,4]] },
    cou:       { min: -30, max: 60, b: [[-30,0,4],[0,10,1],[10,20,2],[20,60,3]] },
    bras:      { min: -45, max: 140, b: [[-45,-20,2],[-20,20,1],[20,45,2],[45,90,3],[90,140,4]] },
    avantBras: { min: 0, max: 160, b: [[0,60,2],[60,100,1],[100,160,2]] },
    poignet:   { min: -45, max: 45, b: [[-45,-15,3],[-15,-2,2],[-2,2,1],[2,15,2],[15,45,3]] }
  }
};

/* Le pictogramme de chaque segment : le corps au repos, les zones d'angle en
   arcs colorés depuis l'articulation, les seuils chiffrés, et l'aiguille de la
   mesure. C'est le langage des planches d'ergonomie — mais avec la valeur
   relevée dessus, ce qu'une planche imprimée ne peut pas faire.

   pivot   : centre de rotation dans le repère du dessin
   r       : rayon des arcs
   base    : direction du 0°, en degrés SVG (0 = vers la droite, −90 = vers le haut)
   signe   : sens des angles positifs
   corps   : la silhouette, dessinée au repos */
/* ---- Silhouettes ----
   Des bâtons ne se lisent pas comme un corps : on ne sait pas d'où part
   l'angle. Ces tracés sont des profils humains simplifiés — tête avec nez et
   menton, torse galbé, membres fuselés — orientés vers la droite, comme les
   planches d'ergonomie. */

export const PEAU = 'fill="var(--carte-2)" stroke="var(--sourd)" stroke-width="1.6" stroke-linejoin="round"';

/** Tête de profil tournée vers la droite, centrée sur (x,y). */
const tete = (x, y, t = 1) => `<g transform="translate(${x},${y}) scale(${t})">
  <path d="M0,-21 C12,-21 19,-13 19,-3 C19,1 18,3 20.5,5.5 C22.5,7.5 22,10 18.5,10.5
           C17,14 15.5,16.5 12.5,18.5 C9.5,20.5 5,21.5 0,21.5
           C-11.5,21.5 -19,13 -19,0 C-19,-13 -11.5,-21 0,-21 Z" ${PEAU}/>
  <path d="M-4,-11 a10,10 0 0 1 15,3" fill="none" stroke="var(--sourd)" stroke-width="1.1" opacity=".55"/>
</g>`;

/** Cou reliant deux hauteurs. */
const cou = (x, y1, y2) => `<path d="M${x - 8},${y1} L${x - 9},${y2} L${x + 9},${y2} L${x + 8},${y1} Z" ${PEAU}/>`;

/** Torse de profil, épaules en (x,y), hauteur h. */
const torse = (x, y, h, t = 1) => `<path transform="translate(${x},${y}) scale(${t})"
  d="M-14,0 C-21,7 -24,22 -23,38 C-22,54 -20,${h - 8} -18,${h}
     L18,${h} C20,${h - 12} 22,50 22,34 C22,19 18,7 13,0 Z" ${PEAU}/>`;

/** Membre fuselé de (x1,y1) à (x2,y2), d'épaisseur w1 à w2. */
function membre(x1, y1, x2, y2, w1, w2) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  const f = n => n.toFixed(1);
  return `<path d="M${f(x1 + nx * w1)},${f(y1 + ny * w1)} L${f(x2 + nx * w2)},${f(y2 + ny * w2)}
    L${f(x2 - nx * w2)},${f(y2 - ny * w2)} L${f(x1 - nx * w1)},${f(y1 - ny * w1)} Z" ${PEAU}/>`;
}

/** Articulation : le point d'où part l'angle, il doit se voir. */
const pivotVu = (x, y) => `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--texte)" opacity=".85"/>`;

export const PICTO = {
  cou: { pivot: [112, 148], r1: 76, r2: 98, base: -90, signe: 1, vue: "de profil, tourné vers la droite",
    corps: torse(112, 148, 40, .95) + cou(112, 148, 124) + tete(112, 104, .92) + pivotVu(112, 148) },

  tronc: { pivot: [112, 168], r1: 92, r2: 114, base: -90, signe: 1, vue: "de profil, tourné vers la droite",
    /* De profil, une seule jambe est visible : deux donnent une jupe. */
    corps: membre(112, 168, 108, 204, 11, 8)
         + torse(112, 112, 56, .74) + cou(112, 112, 102) + tete(112, 88, .6) + pivotVu(112, 168) },

  bras: { pivot: [112, 78], r1: 64, r2: 86, base: 90, signe: -1, vue: "de profil, tourné vers la droite",
    corps: torse(112, 78, 62, .8) + cou(112, 78, 62) + tete(112, 44, .62)
         + membre(112, 78, 108, 134, 9, 7) + pivotVu(112, 78) },

  avantBras: { pivot: [112, 122], r1: 58, r2: 80, base: 90, signe: -1, vue: "angle du coude",
    corps: membre(112, 48, 112, 122, 11, 9) + membre(112, 122, 112, 176, 9, 7) + pivotVu(112, 122) },

  poignet: { pivot: [136, 106], r1: 50, r2: 72, base: 0, signe: 1, vue: "main par rapport à l'avant-bras",
    corps: membre(52, 106, 136, 106, 11, 8)
         + `<path d="M136,98 l26,-2 q7,0 7,8 q0,8 -7,8 l-26,-2 z" ${PEAU}/>`
         + pivotVu(136, 106) },

  jambes: { pivot: [112, 96], r1: 58, r2: 80, base: 90, signe: 1, vue: "flexion du genou",
    corps: membre(112, 24, 112, 96, 14, 10) + membre(112, 96, 112, 160, 10, 7) + pivotVu(112, 96) }
};

const pointSur = (cx, cy, r, a) =>
  [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];

/**
 * Une couronne angulaire : l'arc court à l'extérieur du corps plutôt que de
 * partir du pivot, sinon les secteurs pleins recouvrent la silhouette qu'ils
 * sont censés commenter.
 */
export function couronne(cx, cy, r1, r2, a1, a2) {
  const [xa, ya] = pointSur(cx, cy, r2, a1);
  const [xb, yb] = pointSur(cx, cy, r2, a2);
  const [xc, yc] = pointSur(cx, cy, r1, a2);
  const [xd, yd] = pointSur(cx, cy, r1, a1);
  const grand = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sens = a2 > a1 ? 1 : 0;
  const f = n => n.toFixed(1);
  return `M${f(xa)},${f(ya)} A${r2},${r2} 0 ${grand} ${sens} ${f(xb)},${f(yb)} `
       + `L${f(xc)},${f(yc)} A${r1},${r1} 0 ${grand} ${sens ? 0 : 1} ${f(xd)},${f(yd)} Z`;
}

/**
 * Le pictogramme d'un segment : le corps au repos, les zones d'angle en arcs
 * depuis l'articulation, les seuils chiffrés, et l'aiguille de la mesure.
 * C'est le langage des planches d'ergonomie, avec la valeur relevée dessus —
 * ce qu'une planche imprimée ne peut pas faire.
 */
export function pictogramme(cle, methode, valeur, maxCote) {
  const d = BANDES[methode]?.[cle];
  const g = PICTO[cle];
  if (!d || !g || !Number.isFinite(valeur)) return "";
  const [cx, cy] = g.pivot;
  const svgA = v => g.base + g.signe * Math.max(d.min, Math.min(d.max, v));

  const zones = d.b.map(([de, a, cote]) => {
    const sev = severite(cote, d.majoration ? 3 : maxCote);
    return `<path d="${couronne(cx, cy, g.r1, g.r2, svgA(de), svgA(a))}" fill="${COULEURS[sev]}"
                  fill-opacity=".55" stroke="var(--fond)" stroke-width="1"/>`;
  }).join("");

  /* La cote de chaque zone, au milieu de son arc : la couleur ne suffit pas. */
  const cotes = d.b.map(([de, a, cote]) => {
    const large = Math.abs(svgA(a) - svgA(de)) > 22;
    if (!large) return "";
    const [tx, ty] = pointSur(cx, cy, (g.r1 + g.r2) / 2, (svgA(de) + svgA(a)) / 2);
    return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
              font-size="13" font-weight="700" fill="#0a0e17">${d.majoration ? "+" + (cote - 1) : cote}</text>`;
  }).join("");

  /* Les seuils intérieurs : la réponse à « à partir de combien ». */
  const seuils = d.b.slice(1).map(([de]) => {
    const a = svgA(de);
    const [tx, ty] = pointSur(cx, cy, g.r2 + 17, a);
    return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
              font-size="12" fill="var(--texte-2)">${de}°</text>`;
  }).join("");

  const [z1, z2] = pointSur(cx, cy, g.r2 + 6, g.base);
  const aM = svgA(valeur);
  const [mx, my] = pointSur(cx, cy, g.r2 + 2, aM);
  const [ex, ey] = pointSur(cx, cy, g.r2 + 32, aM);

  return `<svg class="picto" viewBox="0 0 280 224" role="img"
            aria-label="Zones de score du segment ; mesure : ${Math.round(valeur)} degrés">
    ${zones}${cotes}
    <line x1="${cx}" y1="${cy}" x2="${z1.toFixed(1)}" y2="${z2.toFixed(1)}"
          stroke="var(--sourd)" stroke-width="1.2" stroke-dasharray="4 3"/>
    <text x="${z1.toFixed(1)}" y="${(z2 - 8).toFixed(1)}" text-anchor="middle"
          font-size="12" fill="var(--sourd)">0°</text>
    ${g.corps}${seuils}
    <line x1="${cx}" y1="${cy}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}"
          stroke="var(--texte)" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4" fill="var(--texte)"/>
    <rect x="${(ex - 20).toFixed(1)}" y="${(ey - 11).toFixed(1)}" width="40" height="22" rx="4"
          fill="var(--carte)" stroke="var(--texte)" stroke-width="1.4"/>
    <text x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
          font-size="14" font-weight="700" fill="var(--texte)">${Math.round(valeur)}°</text>
  </svg>
  <p class="picto-vue">${g.vue}</p>`;
}
