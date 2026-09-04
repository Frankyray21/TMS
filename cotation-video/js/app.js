/* ============================================================================
   app.js — Orchestration de l'interface

   Ne contient aucune règle de cotation : tout vient de reba.js et angles.js.
   Son travail est de brancher un fichier, une timeline et des champs de
   saisie sur ces modules, puis d'afficher le résultat.
   ============================================================================ */

import { analyserVideo, analyserImage, coter, recoter } from "./analyse.js";
import { sequenceDemo, PARAMS_DEMO } from "./demo.js";
import { NIVEAUX as NIVEAUX_REBA, ETIQUETTES_SEVERITE, severite } from "./reba.js";
import { NIVEAUX as NIVEAUX_RULA } from "./rula.js";
import { calculerNIOSH, NIVEAUX as NIVEAUX_NIOSH, ETIQUETTES as ETIQ_MULT } from "./niosh.js";
import { suggererLevage } from "./mesures.js";
import { dessinerHauteurMains, osAuPoint } from "./rendu.js";
import { dessinerSquelette, dessinerJauge, dessinerChronologie,
         imageALInstant, COULEURS, COULEURS_NIVEAU } from "./rendu.js";
import { sourceActive } from "./pose.js";

const $ = s => document.querySelector(s);
const el = {
  fichier: $("#fichier"), video: $("#video"), photo: $("#photo"), calque: $("#calque"),
  scene: $("#scene"), etatVide: $("#etatVide"),
  progres: $("#progres"), progresJauge: $("#progresJauge"), progresTexte: $("#progresTexte"),
  annuler: $("#annuler"), lecture: $("#lecture"), etapes: $("#etapes"),
  progresChiffres: $("#progresChiffres"), allerPire: $("#allerPire"), tCourant: $("#tCourant"),
  chrono: $("#chrono"), chronoLegende: $("#chronoLegende"), noteChrono: $("#noteChrono"),
  jauge: $(".jauge"), niveauLibelle: $("#niveauLibelle"), niveauAction: $("#niveauAction"),
  corpsSegments: $("#corpsSegments"), calcul: $("#calcul"),
  stats: $("#stats"), barres: $("#barres"), conclusion: $("#conclusion"),
  badgeMoteur: $("#badgeMoteur"),
  exportJson: $("#exportJson"), imprimer: $("#imprimer"), synthese: $("#synthese")
};

/* Les deux méthodes, et ce qui change de l'une à l'autre. */
const METHODES = {
  reba: {
    nom: "REBA", niveaux: NIVEAUX_REBA,
    ref: "REBA · Hignett &amp; McAtamney (2000)",
    lignes: [
      { cle: "tronc",     nom: "Tronc",       angle: a => a.tronc.flexion,       unite: "° flexion" },
      { cle: "cou",       nom: "Cou",         angle: a => a.cou.flexion,         unite: "° flexion" },
      { cle: "jambes",    nom: "Jambes",      angle: a => a.jambes.flexionGenou, unite: "° genou" },
      { cle: "bras",      nom: "Bras",        angle: a => a.bras.flexionBras,    unite: "° élévation" },
      { cle: "avantBras", nom: "Avant-bras",  angle: a => a.bras.flexionCoude,   unite: "° coude" },
      { cle: "poignet",   nom: "Poignet",     angle: a => a.bras.flexionPoignet, unite: "° flexion" }
    ],
    intro: "REBA croise la posture avec la charge, la qualité de la prise et la nature "
         + "de l'activité. Aucune image ne contient ces trois-là.",
    calcul: r => `Table A ${r.tableA} + charge ${r.segments.charge.cote} = <b>A ${r.scoreA}</b> · `
               + `Table B ${r.tableB} + prise ${r.segments.prise.cote} = <b>B ${r.scoreB}</b> · `
               + `Table C <b>${r.scoreC}</b> + activité ${r.activite.cote} = <b>REBA ${r.reba}</b>`
  },
  niosh: {
    nom: "NIOSH", niveaux: NIVEAUX_NIOSH, levage: true,
    ref: "NIOSH r&eacute;vis&eacute;e · Waters et coll. (1993)",
    titreChrono: "Hauteur des mains dans le temps"
  },
  rula: {
    nom: "RULA", niveaux: NIVEAUX_RULA,
    ref: "RULA · McAtamney &amp; Corlett (1993)",
    lignes: [
      { cle: "bras",            nom: "Bras",        angle: a => a.bras.flexionBras,    unite: "° élévation" },
      { cle: "avantBras",       nom: "Avant-bras",  angle: a => a.bras.flexionCoude,   unite: "° coude" },
      { cle: "poignet",         nom: "Poignet",     angle: a => a.bras.flexionPoignet, unite: "° flexion" },
      { cle: "pronosupination", nom: "Pronosupination", angle: () => null, unite: "" },
      { cle: "cou",             nom: "Cou",         angle: a => a.cou.flexion,         unite: "° flexion" },
      { cle: "tronc",           nom: "Tronc",       angle: a => a.tronc.flexion,       unite: "° flexion" },
      { cle: "jambes",          nom: "Jambes",      angle: a => a.jambes.flexionGenou, unite: "° genou" }
    ],
    intro: "RULA croise la posture avec la force et le caractère statique ou répété "
         + "du geste. Sa cote de force plafonne à 10 kg : c'est une méthode de poste, "
         + "pas de manutention.",
    calcul: r => `Posture A ${r.postureA} + muscle ${r.muscle.cote} + force ${r.force.cote} = <b>C ${r.scoreC}</b> · `
               + `Posture B ${r.postureB} + muscle ${r.muscle.cote} + force ${r.force.cote} = <b>D ${r.scoreD}</b> · `
               + `Table C = <b>RULA ${r.rula}</b>`
  }
};

const etat = {
  analyse: null,
  methode: "reba",
  /* Les deux repères du levage, en secondes, avec les mesures relevées à ces
     instants. L'opérateur peut corriger chaque valeur à la main. */
  niosh: { origine: null, destination: null },
  osSelectionne: null,
  mode: "demo",            // 'demo' | 'video' | 'image'
  t: 0,
  lecture: false,
  abandon: null,
  horlogeDemo: null
};

/* ---------- Détail d'un segment ----------
   Le squelette est la partie la plus lisible de l'analyse : on doit pouvoir
   l'interroger directement, plutôt que d'aller chercher la ligne correspondante
   dans le tableau. Le détail dit l'angle mesuré, la cote, la façon dont elle se
   compose, et la règle publiée qui s'applique. */

const OS_VERS_SEGMENT = {
  tronc: "tronc", cou: "cou", jambes: "jambes",
  brasG: "bras", brasD: "bras",
  avantBrasG: "avantBras", avantBrasD: "avantBras",
  poignetG: "poignet", poignetD: "poignet"
};
const COTE_DE_L_OS = { brasG: "G", brasD: "D", avantBrasG: "G", avantBrasD: "D", poignetG: "G", poignetD: "D" };

/* Deux choses que l'échelle des bandes ne peut pas dire, et sans lesquelles un
   chiffre reste incompréhensible : par rapport à quoi l'angle est mesuré, et ce
   qui le fait monter. Le cou en donne l'exemple type — mesuré par rapport au
   tronc, il passe en « extension » chez quelqu'un qui a pourtant la tête
   baissée, simplement parce que son tronc est plus penché que sa tête. */
const REGLES = {
  reba: {
    tronc: {
      repere: "Mesuré entre l'axe du tronc et la verticale. Positif = penché vers l'avant, négatif = cambré vers l'arrière.",
      seuils: "Au-delà de 20° : cote 3. Au-delà de 60° : cote 4. Une torsion ou une inclinaison latérale ajoute 1."
    },
    cou: {
      repere: "Mesuré par rapport au tronc, pas à la verticale. Penché en avant, quelqu'un qui garde la tête droite est donc en extension du cou — c'est bien ce que subit la nuque.",
      seuils: "Au-delà de 20° de flexion, ou dès l'extension : cote 2 au lieu de 1. Une torsion ou une inclinaison ajoute 1."
    },
    jambes: {
      repere: "Flexion du genou le plus fléchi. La cote de base vient de l'appui : 1 sur deux pieds, 2 sur un seul ou en équilibre instable.",
      seuils: "Le genou ajoute par-dessus : 1 entre 30 et 60°, 2 au-delà. Sans effet en position assise."
    },
    bras: {
      repere: "Élévation mesurée par rapport au tronc, bras au repos = 0°. Positif = vers l'avant, négatif = vers l'arrière.",
      seuils: "Au-delà de 20° : cote 2. De 45 à 90° : 3. Au-delà de 90° : 4. Épaule haussée +1, abduction +1, bras soutenu −1."
    },
    avantBras: {
      repere: "Angle du coude : 0° bras tendu, 90° angle droit.",
      seuils: "Entre 60 et 100°, cote 1. En dehors de cette plage, 2 — un coude trop ouvert coûte autant qu'un coude trop fermé."
    },
    poignet: {
      repere: "Flexion de la main par rapport à l'avant-bras. Mesure la moins fiable de toutes : trois repères de main ne suffisent pas à la donner au degré près.",
      seuils: "Au-delà de 15° dans un sens ou dans l'autre : cote 2. Une déviation latérale ajoute 1."
    }
  },
  rula: {
    tronc: {
      repere: "Mesuré entre l'axe du tronc et la verticale. Assis avec appui et tronc droit, la cote reste à 1.",
      seuils: "Au-delà de 20° : cote 3. Au-delà de 60° : 4. Torsion +1, inclinaison +1, cumulables."
    },
    cou: {
      repere: "Mesuré par rapport au tronc, pas à la verticale. Penché en avant, quelqu'un qui garde la tête droite est donc en extension du cou.",
      seuils: "De 10 à 20° : cote 2. Au-delà de 20° : 3. En extension : 4, la cote la plus forte. Torsion +1, inclinaison +1."
    },
    jambes: {
      repere: "Jambes appuyées et équilibrées, ou non — RULA ne mesure pas l'angle du genou.",
      seuils: "Appuyées et équilibrées : 1. Sinon : 2."
    },
    bras: {
      repere: "Élévation mesurée par rapport au tronc, bras au repos = 0°. Positif = vers l'avant.",
      seuils: "Au-delà de 20° : cote 2. De 45 à 90° : 3. Au-delà de 90° : 4. Épaule haussée +1, abduction +1, bras soutenu −1."
    },
    avantBras: {
      repere: "Angle du coude : 0° bras tendu, 90° angle droit.",
      seuils: "Entre 60 et 100°, cote 1. En dehors, 2. Travailler en travers du corps ou nettement à l'écart ajoute 1."
    },
    poignet: {
      repere: "Flexion de la main par rapport à l'avant-bras. RULA la découpe plus finement que REBA. Mesure la moins fiable de toutes.",
      seuils: "Jusqu'à 15° : cote 2. Au-delà : 3. Une déviation latérale ajoute 1."
    },
    pronosupination: {
      repere: "Rotation de l'avant-bras, paume vers le haut ou vers le bas. Non observable sur l'image : c'est vous qui la déclarez.",
      seuils: "Milieu de course : 1. En fin de course : 2."
    }
  }
};

/* Les bandes d'angle de chaque segment, telles que les fonctions de cotation
   les appliquent réellement. Elles répondent à la question qu'une règle écrite
   laisse en suspens : à partir de quel angle ça bascule, et où tombe la mesure. */
const BANDES = {
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

const PEAU = 'fill="var(--carte-2)" stroke="var(--sourd)" stroke-width="1.6" stroke-linejoin="round"';

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

const PICTO = {
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
function couronne(cx, cy, r1, r2, a1, a2) {
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
function pictogramme(cle, methode, valeur, maxCote) {
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
            aria-label="Zones d'angle du segment ; mesure : ${Math.round(valeur)} degrés">
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

const NOMS_SEGMENT = {
  tronc: "Tronc", cou: "Cou", jambes: "Jambes", bras: "Bras",
  avantBras: "Avant-bras", poignet: "Poignet", pronosupination: "Pronosupination"
};

/** Les majorations qui se sont appliquées, avec leur cause. */
function majorations(cle, entrees, angles) {
  const e = entrees[cle] || {};
  const l = [];
  const deg = v => Number.isFinite(v) ? `${Math.round(v)}°` : "";
  if (e.torsion)       l.push({ t: `torsion ${deg(angles[cle]?.torsionDeg)}`, n: 1 });
  if (e.inclinaison)   l.push({ t: `inclinaison latérale ${deg(angles[cle]?.inclinaisonDeg)}`, n: 1 });
  if (e.abduction)     l.push({ t: `abduction ${deg(angles.bras?.abductionDeg)}`, n: 1 });
  if (e.epauleHaussee) l.push({ t: "épaule haussée (déclarée)", n: 1 });
  if (e.brasSoutenu)   l.push({ t: "bras soutenu (déclaré)", n: -1 });
  if (e.deviation)     l.push({ t: `déviation ${deg(angles.bras?.deviationDeg)}`, n: 1 });
  if (e.horsAxe)       l.push({ t: "avant-bras hors de l'axe du corps", n: 1 });
  if (cle === "jambes") {
    if (!e.appuiBilateral) l.push({ t: "appui unilatéral ou instable", n: 0 });
    const g = e.flexionGenou;
    if (!e.assis && g > 60) l.push({ t: `genou fléchi ${deg(g)}`, n: 2 });
    else if (!e.assis && g > 30) l.push({ t: `genou fléchi ${deg(g)}`, n: 1 });
  }
  return l;
}

const ANGLE_SEGMENT = {
  tronc:     a => ({ v: a.tronc.flexion,       u: "de flexion du tronc" }),
  cou:       a => ({ v: a.cou.flexion,         u: "de flexion du cou" }),
  jambes:    a => ({ v: a.jambes.flexionGenou, u: "de flexion du genou" }),
  bras:      a => ({ v: a.bras.flexionBras,    u: "d'élévation du bras" }),
  avantBras: a => ({ v: a.bras.flexionCoude,   u: "de flexion du coude" }),
  poignet:   a => ({ v: a.bras.flexionPoignet, u: "de flexion du poignet" })
};

function afficherDetail(os, x, y) {
  const image = etat.analyse && imageALInstant(etat.analyse, etat.t);
  if (!image) return;
  const cle = OS_VERS_SEGMENT[os];
  const methode = etat.methode === "niosh" ? "reba" : etat.methode;
  const r = image.resultats[methode];
  const seg = r.segments[cle];
  if (!seg) return;

  /* Un membre du côté non coté n'a pas de valeur : REBA et RULA s'appliquent à
     un côté à la fois, et prétendre le contraire serait inventer une mesure. */
  const coteOs = COTE_DE_L_OS[os];
  const autreCote = coteOs && coteOs !== image.angles.cote;

  const sev = severite(seg.cote, seg.max);
  const mes = ANGLE_SEGMENT[cle]?.(image.angles);
  const maj = majorations(cle, image.entrees[methode], image.angles);

  $("#detailCorps").innerHTML = autreCote
    ? `<div class="detail-titre">${NOMS_SEGMENT[cle]} ${coteOs === "G" ? "gauche" : "droit"}</div>
       <div class="detail-etat" style="color:var(--sourd)">Côté non coté</div>
       <div class="detail-regle">${METHODES[methode].nom} s'applique à un côté à la fois. Le côté retenu est
       le ${image.angles.cote === "G" ? "gauche" : "droit"} — modifiable dans « Côté coté ».</div>`
    : `<div class="detail-titre">${NOMS_SEGMENT[cle]}${coteOs ? (coteOs === "G" ? " gauche" : " droit") : ""}</div>
       <div class="detail-etat" style="color:${COULEURS[sev]}">${ETIQUETTES_SEVERITE[sev]}</div>
       ${mes && Number.isFinite(mes.v)
          ? `<div class="detail-mesure">${Math.round(mes.v)}° <small>${mes.u}</small></div>` : ""}
       ${mes ? pictogramme(cle, methode, mes.v, seg.max) : ""}
       <div class="detail-calc">
         Cote <b>${seg.cote}</b> sur ${seg.max}
         ${seg.base != null ? `<br>base ${seg.base}` : ""}
         ${maj.length ? `<ul>${maj.map(m =>
            `<li class="${m.n < 0 ? "moins" : ""}">${m.t}${m.n ? ` (${m.n > 0 ? "+" : "−"}${Math.abs(m.n)})` : ""}</li>`).join("")}</ul>` : ""}
       </div>
       ${(() => {
         const r = REGLES[methode][cle];
         return r ? `<div class="detail-regle">
             <p><b>Comment c'est mesuré</b> — ${r.repere}</p>
             <p><b>Ce qui fait monter la cote</b> — ${r.seuils}</p>
           </div>` : "";
       })()}`;

  const boite = el.scene.getBoundingClientRect();
  const d = $("#detailSegment");
  d.style.setProperty("--stripe", autreCote ? "var(--sourd)" : COULEURS[sev]);
  d.hidden = false;
  const l = d.offsetWidth, h = d.offsetHeight;
  d.style.left = `${Math.max(8, Math.min(boite.width - l - 8, x + 14))}px`;
  d.style.top = `${Math.max(8, Math.min(boite.height - h - 8, y - h / 2))}px`;
}

function fermerDetail() {
  $("#detailSegment").hidden = true;
  if (etat.osSelectionne) { etat.osSelectionne = null; redessinerSquelette(); }
}

/** Redessine le seul squelette, sans toucher au reste du panneau. */
function redessinerSquelette() {
  if (!etat.analyse) return;
  const image = imageALInstant(etat.analyse, etat.t);
  if (!image) return;
  const { ctx, largeur, hauteur } = dimensionnerCalque();
  ctx.clearRect(0, 0, largeur, hauteur);
  dessinerSquelette(ctx, image, { largeur, hauteur, selection: etat.osSelectionne });
}

/* ---------- Suivi de l'analyse ----------
   Quatre étapes, affichées en permanence : l'attente a une carte, pas seulement
   une durée. Le téléchargement du modèle est le plus long à la première
   utilisation — c'est là qu'il faut des octets, pas un message figé. */
const ETAPES = [
  { cle: "moteur",   nom: "Moteur" },
  { cle: "modele",   nom: "Modèle" },
  { cle: "analyse",  nom: "Analyse" },
  { cle: "cotation", nom: "Cotation" }
];

const mo = o => (o / 1048576).toFixed(1).replace(".", ",");
const secondes = s => s >= 60
  ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`
  : `${s.toFixed(s < 10 ? 1 : 0).replace(".", ",")} s`;

function reinitialiserEtapes() {
  el.etapes.innerHTML = ETAPES.map(e => `<li data-etape="${e.cle}">${e.nom}</li>`).join("");
  el.progresJauge.style.width = "0%";
  el.progresChiffres.textContent = "";
  el.progres.classList.remove("indetermine");
  el.progresJauge.parentElement.classList.remove("indetermine");
}

/**
 * @param {string} cle — étape courante
 * @param {object} o — { libelle, part (0–1 ou null), detail }
 */
function majEtat(cle, o = {}) {
  const rang = ETAPES.findIndex(e => e.cle === cle);
  el.etapes.querySelectorAll("li").forEach((li, i) => {
    li.classList.toggle("faite", i < rang);
    li.classList.toggle("encours", i === rang);
    const e = ETAPES[i];
    li.innerHTML = e.nom + (i === rang && o.suffixe ? ` <small>${o.suffixe}</small>` : "");
  });
  if (o.libelle) el.progresTexte.textContent = o.libelle;
  el.progresChiffres.textContent = o.detail || "";

  /* Barre indéterminée tant qu'on ne sait pas mesurer : mieux vaut une barre
     qui bouge sans promettre qu'une barre à zéro qui a l'air bloquée. */
  const barre = el.progresJauge.parentElement;
  if (o.part == null) {
    barre.classList.add("indetermine");
  } else {
    barre.classList.remove("indetermine");
    el.progresJauge.style.width = `${Math.round(Math.max(0, Math.min(1, o.part)) * 100)}%`;
  }
}

/* Les rappels passés à la chaîne d'analyse. */
function suivi() {
  return {
    onEtape: info => {
      if (info.etape === "modele" && info.total) {
        majEtat("modele", {
          libelle: info.cache ? "Modèle chargé depuis le cache" : "Téléchargement du modèle de pose",
          part: info.part,
          suffixe: info.cache ? "en cache" : `${mo(info.recu)} / ${mo(info.total)} Mo`,
          detail: info.cache ? "" : "première utilisation seulement"
        });
      } else {
        majEtat(info.etape, { libelle: info.libelle, part: info.part ?? null });
      }
    },
    onProgres: p => {
      const reste = p.part > 0.02 ? p.ecoule / p.part - p.ecoule : null;
      majEtat("analyse", {
        libelle: "Analyse des images",
        part: p.part,
        suffixe: p.duree ? `${secondes(p.t)} / ${secondes(p.duree)}` : "",
        detail: `${p.retenues} image${p.retenues > 1 ? "s" : ""} cotée${p.retenues > 1 ? "s" : ""}`
          + (p.sansDetection ? ` · ${p.sansDetection} sans détection` : "")
          + (reste ? ` · reste ~${secondes(reste)}` : "")
      });
    }
  };
}

/* ---------- Paramètres saisis ---------- */
function lireParams() {
  return {
    chargeKg: +$("#charge").value,
    prise: +$("#prise").value,
    statique: $("#statique").checked,
    repete: $("#repete").checked,
    instable: $("#instable").checked,
    effortBrusque: $("#brusque").checked,
    cote: $("#cote").value,
    jambesManuel: $("#jambesManuel").value,
    pronosupination: $("#pronosupination").checked,
    tailleCm: +$("#taille").value,
    methode: etat.methode,
    precision: $("#precision").value,
    echantillonnage: +$("#fps").value,
    lissage: +$("#lissage").value
  };
}

function appliquerParamsAuFormulaire(p) {
  if (p.chargeKg != null) $("#charge").value = p.chargeKg;
  if (p.prise != null) $("#prise").value = p.prise;
  if (p.repete != null) $("#repete").checked = !!p.repete;
  if (p.cote) $("#cote").value = p.cote;
  majSorties();
}

function majSorties() {
  $("#chargeVal").textContent = `${$("#charge").value} kg`;
  $("#poidsChargeVal").textContent = `${$("#poidsCharge").value} kg`;
  $("#frequenceVal").textContent = `${$("#frequence").value} /min`;
  $("#tailleVal").textContent = `${$("#taille").value} cm`;
  if (!$("#idDate").value) $("#idDate").value = new Date().toISOString().slice(0, 10);
  $("#fpsVal").textContent = $("#fps").value;
  $("#lissageVal").textContent = $("#lissage").value === "0" ? "aucun" : $("#lissage").value;
}

/* ---------- Rendu ---------- */

function dimensionnerCalque() {
  const src = etat.mode === "image" ? el.photo : el.video;
  /* clientWidth/Height, pas getBoundingClientRect : le calque est positionné
     dans la boîte de contenu de la scène, alors que le rectangle englobant
     inclut la bordure. L'écart d'un pixel se voit sur un trait fin. */
  const boite = { width: el.scene.clientWidth, height: el.scene.clientHeight };
  let l = boite.width, h = boite.height;
  if (etat.mode !== "demo" && src) {
    const r = src.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) { l = r.width; h = r.height; }
  }
  const dpr = window.devicePixelRatio || 1;
  el.calque.width = l * dpr; el.calque.height = h * dpr;
  el.calque.style.width = `${l}px`; el.calque.style.height = `${h}px`;
  /* Le calque se centre comme la vidéo, qui n'occupe pas toute la scène. */
  el.calque.style.left = `${(boite.width - l) / 2}px`;
  el.calque.style.top = `${(boite.height - h) / 2}px`;
  const ctx = el.calque.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, largeur: l, hauteur: h };
}

/** Efface la surface de dessin et la chronologie, sans rien y remettre.
    Tout ce qui reste à l'écran d'une analyse précédente peut passer pour une
    mesure du fichier courant. */
function effacerCalque() {
  const { ctx, largeur, hauteur } = dimensionnerCalque();
  ctx.clearRect(0, 0, largeur, hauteur);
  const c = el.chrono.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, el.chrono.width, el.chrono.height);
  el.chronoLegende.innerHTML = "";
  el.noteChrono.textContent = "";
  el.tCourant.textContent = "0,0";
}

function dessinerInstant(t) {
  if (!etat.analyse) return;
  const image = imageALInstant(etat.analyse, t);
  if (!image) return;
  const { ctx, largeur, hauteur } = dimensionnerCalque();
  ctx.clearRect(0, 0, largeur, hauteur);
  dessinerSquelette(ctx, image, { largeur, hauteur, selection: etat.osSelectionne });
  el.tCourant.textContent = t.toFixed(1).replace(".", ",");
  /* Changer d'image invalide la sélection : la fiche décrirait une autre pose. */
  $("#detailSegment").hidden = true;
  etat.osSelectionne = null;
  $("#astuce").hidden = false;
  majSynoptique(image);
  if (METHODES[etat.methode].levage) {
    majPanneauNiosh();
  } else {
    majPanneau(image);
    dessinerChronologie(el.chrono, etat.analyse, { curseur: t, niveaux: METHODES[etat.methode].niveaux });
  }
}

function majPanneau(image) {
  const r = image.resultat;
  const M = METHODES[etat.methode];
  dessinerJauge(el.jauge, r.score, r.risque, r.echelle);
  el.niveauLibelle.textContent = `${r.risque.libelle} — niveau ${r.risque.niveau}`;
  el.niveauLibelle.style.color = COULEURS_NIVEAU[r.risque.couleur];
  el.niveauAction.textContent = r.risque.action;

  el.corpsSegments.innerHTML = M.lignes.map(l => {
    const seg = r.segments[l.cle];
    const cote = seg.cote;
    const sev = severite(cote, seg.max);
    const val = l.angle(image.angles);
    return `<tr>
      <td>${l.nom}</td>
      <td class="num">${Number.isFinite(val) ? Math.round(val) : "<span class='discret'>déclaré</span>"}${Number.isFinite(val) && l.unite ? `<span class="discret"> ${l.unite}</span>` : ""}</td>
      <td class="cote">${cote}</td>
      <td><span class="etat"><i style="background:${COULEURS[sev]}"></i>${ETIQUETTES_SEVERITE[sev]}</span></td>
    </tr>`;
  }).join("");

  el.calcul.innerHTML = M.calcul(r)
    + (image.fiable ? "" : ` · <span style="color:${COULEURS[2]}">repères peu visibles</span>`);

  const jambesSupposees = image.avertissements?.includes("jambes");
  $("#jambesEtat").textContent = jambesSupposees ? "— hors cadre, supposée" : "— mesurée";
  $("#jambesEtat").style.color = jambesSupposees ? COULEURS[1] : "";
  /* Quand les jambes sont dans le cadre, la mesure prime : le champ n'a plus
     d'effet, autant qu'il le montre au lieu de laisser croire à un réglage. */
  $("#jambesManuel").disabled = !jambesSupposees;
  if (jambesSupposees) {
    el.calcul.innerHTML += `<br><span style="color:${COULEURS[1]}">Jambes hors du cadre :`
      + ` cotées d'après la position choisie, pas mesurées.</span>`;
  }
}

function majSynthese() {
  const M = METHODES[etat.methode];
  if (M.levage) return;             // NIOSH a sa propre sortie
  const NIVEAUX = M.niveaux;
  const s = etat.analyse?.synthese;
  if (!s) { el.stats.innerHTML = ""; el.barres.innerHTML = ""; el.conclusion.textContent = ""; return; }

  const niveauMax = NIVEAUX.find(n => s.max >= n.min && s.max <= n.max);
  const niveauMed = NIVEAUX.find(n => s.median >= n.min && s.median <= n.max);
  el.stats.innerHTML = `
    <div class="stat"><div class="v" style="color:${COULEURS_NIVEAU[niveauMed.couleur]}">${s.median}</div><div class="k">Cote médiane — la posture habituelle</div></div>
    <div class="stat"><div class="v" style="color:${COULEURS_NIVEAU[niveauMax.couleur]}">${s.max}</div><div class="k">Pire cote, à ${s.pire.t.toFixed(1).replace(".", ",")} s</div></div>
    <div class="stat"><div class="v">${s.p90}</div><div class="k">9<sup>e</sup> décile — le haut du cycle</div></div>
    <div class="stat"><div class="v">${s.images}</div><div class="k">Images cotées${s.ignorees ? ` · ${s.ignorees} écartées` : ""}</div></div>`;

  const visibles = s.parNiveau.filter(n => n.part > 0.001);
  el.barres.innerHTML = visibles.map(n =>
    `<div style="width:${(n.part * 100).toFixed(2)}%;background:${COULEURS_NIVEAU[n.couleur]}" title="${n.libelle} : ${Math.round(n.part * 100)} %">${n.part > 0.09 ? Math.round(n.part * 100) + " %" : ""}</div>`).join("");
  el.barres.insertAdjacentHTML("afterend", "");
  const legende = el.barres.parentElement.querySelector(".barres-legende");
  legende?.remove();
  el.barres.insertAdjacentHTML("afterend",
    `<div class="barres-legende">${visibles.map(n =>
      `<span><i style="background:${COULEURS_NIVEAU[n.couleur]}"></i>${n.libelle} — ${Math.round(n.part * 100)} %</span>`).join("")}</div>`);

  const NOMS = { tronc:"le tronc", cou:"le cou", jambes:"les jambes", bras:"le bras",
                 avantBras:"l'avant-bras", poignet:"le poignet" };
  const dom = s.dominantFrequent;
  el.conclusion.innerHTML =
    `La posture reste à <b>${s.median}</b> l'essentiel du temps et culmine à <b>${s.max}</b> ` +
    `(${niveauMax.libelle.toLowerCase()}) à <b>${s.pire.t.toFixed(1).replace(".", ",")} s</b>. ` +
    (dom ? `C'est <b>${NOMS[dom.nom] || dom.nom}</b> qui pèse le plus lourd, sur ${Math.round(dom.part * 100)} % des images cotées. ` : "") +
    `${niveauMax.action}`;

  el.chronoLegende.innerHTML = NIVEAUX.map(n =>
    `<span style="color:${COULEURS_NIVEAU[n.couleur]}"><b>${n.min}${n.max !== n.min ? "–" + n.max : ""}</b> ${n.libelle.toLowerCase()}</span>`).join("");
  el.noteChrono.textContent = s.ignorees
    ? `${s.ignorees} image${s.ignorees > 1 ? "s" : ""} écartée${s.ignorees > 1 ? "s" : ""} faute de repères visibles — marquée${s.ignorees > 1 ? "s" : ""} en bas de la courbe.`
    : "Cliquez la courbe pour vous déplacer dans la séquence.";
}

/* ---------- Chargement d'un fichier ---------- */

async function chargerFichier(f) {
  if (!f) return;
  const url = URL.createObjectURL(f);
  etat.abandon = new AbortController();
  el.etatVide.hidden = true;
  el.progres.hidden = false;
  el.annuler.textContent = "Arrêter";
  reinitialiserEtapes();

  /* Abandonner l'analyse précédente AVANT d'afficher le nouveau fichier.
     Sans ça, la vidéo est lue pendant l'analyse, « timeupdate » se déclenche, et
     le squelette de l'analyse précédente — la démonstration, au premier
     chargement — se dessine par-dessus les images de l'utilisateur. Un squelette
     qui ne suit personne, et qui donne l'air d'un calque mal aligné. */
  etat.analyse = null;
  etat.niosh = { origine: null, destination: null };
  etat.t = 0;
  etat.lecture = false;
  el.lecture.textContent = "Lecture";
  el.lecture.disabled = true;
  viderPanneau();
  effacerCalque();
  fermerDetail();
  $("#astuce").hidden = true;

  const params = lireParams();
  try {
    if (f.type.startsWith("image/")) {
      etat.mode = "image";
      el.video.hidden = true; el.photo.hidden = false; el.photo.src = url;
      await el.photo.decode();
      etat.analyse = await analyserImage(el.photo, params, suivi());
    } else {
      etat.mode = "video";
      el.photo.hidden = true; el.video.hidden = false; el.video.src = url;
      etat.analyse = await analyserVideo(el.video, params, { signal: etat.abandon.signal, ...suivi() });
      el.video.currentTime = 0;
      el.lecture.disabled = false;
    }
    el.badgeMoteur.textContent = `Moteur : ${sourceActive() || "chargé"}`;
    if (!etat.analyse?.images.length) {
      /* Sans cette remise à zéro, la cote de la démonstration resterait
         affichée par-dessus le fichier de l'utilisateur : un résultat simulé
         passerait pour une mesure. */
      etat.analyse = null;
      effacerCalque();
      viderPanneau();
      el.progresTexte.textContent =
        "Aucune personne détectée. Cadrage trop serré, sujet coupé ou trop petit dans l'image ?";
      el.annuler.textContent = "Fermer";
      return;
    }
    el.progres.hidden = true;
    etat.t = 0;
    etat.niosh = { origine: null, destination: null };
    proposerLevage();
    majAvis();
    majSynthese();
    dessinerInstant(0);
  } catch (e) {
    console.error(e);
    /* On efface tout : laisser le squelette et la cote de la démonstration
       par-dessus la photo de l'utilisateur ferait passer un résultat simulé
       pour une mesure. */
    etat.analyse = null;
    effacerCalque();
    viderPanneau();
    el.progresTexte.textContent = `Échec : ${e.message}`;
    el.annuler.textContent = "Fermer";
  }
}

/** Remet le panneau à zéro : aucune valeur affichée ne doit survivre à un échec. */
function viderPanneau() {
  el.jauge.querySelector(".jauge-valeur").textContent = "—";
  el.jauge.querySelector(".jauge-valeur").style.fill = "";
  el.jauge.querySelector(".jauge-arc").style.strokeDasharray = "0 999";
  el.niveauLibelle.textContent = "—";
  el.niveauLibelle.style.color = "";
  el.niveauAction.textContent = "";
  el.corpsSegments.innerHTML = "";
  el.calcul.textContent = "";
  $("#synoptique").innerHTML = "";
  el.lecture.disabled = true;
  majSynthese();
}

/* ---------- Démonstration ---------- */

function chargerDemo() {
  etat.mode = "demo";
  etat.analyse = coter(sequenceDemo(), PARAMS_DEMO);
  appliquerParamsAuFormulaire(PARAMS_DEMO);
  synchroniserPoids("postural");
  proposerLevage();          // pour que le synoptique montre les trois d'emblée
  majAvis();                 // les paramètres viennent de changer
  majSynthese();
  etat.t = etat.analyse.synthese.pire.t;   // on ouvre sur l'instant le plus parlant
  dessinerInstant(etat.t);
  el.lecture.disabled = false;
}

/* ---------- Lecture ---------- */

function basculerLecture() {
  etat.lecture = !etat.lecture;
  el.lecture.textContent = etat.lecture ? "Pause" : "Lecture";
  if (etat.mode === "video") {
    etat.lecture ? el.video.play() : el.video.pause();
  } else if (etat.lecture) {
    const duree = Math.max(...etat.analyse.images.map(i => i.t));
    let precedent = performance.now();
    const pas = maintenant => {
      if (!etat.lecture) return;
      etat.t += (maintenant - precedent) / 1000;
      precedent = maintenant;
      if (etat.t > duree) etat.t = 0;
      dessinerInstant(etat.t);
      etat.horlogeDemo = requestAnimationFrame(pas);
    };
    etat.horlogeDemo = requestAnimationFrame(pas);
  } else {
    cancelAnimationFrame(etat.horlogeDemo);
  }
}

/* ---------- NIOSH ----------
   Le calcul ne porte pas sur une image mais sur un levage, entre deux repères.
   On les propose (mains au plus bas, mains au plus haut) et on laisse corriger. */

function relever(t) {
  const img = imageALInstant(etat.analyse, t);
  if (!img?.mesures) return null;
  return { t: img.t, H: Math.round(img.mesures.H), V: Math.round(img.mesures.V),
           A: Math.round(img.mesures.A), fiableA: img.mesures.fiableA, fiable: img.mesures.fiable };
}

function proposerLevage() {
  if (!etat.analyse) return;
  const sug = suggererLevage(etat.analyse.images);
  if (!sug) return;
  etat.niosh.origine = relever(sug.origine);
  etat.niosh.destination = relever(sug.destination);
  ecrireReperes();
}

function ecrireReperes() {
  for (const [cle, prefixe] of [["origine", "o"], ["destination", "d"]]) {
    const r = etat.niosh[cle];
    $("#" + prefixe + "H").value = r ? r.H : "";
    $("#" + prefixe + "V").value = r ? r.V : "";
    $("#" + prefixe + "A").value = r ? r.A : "";
    $("#" + prefixe + "T").textContent = r
      ? `relevé à ${r.t.toFixed(1).replace(".", ",")} s${r.fiableA ? "" : " · pieds hors cadre, angle non mesuré"}`
      : "non défini";
  }
}

function lireReperes() {
  const lire = p => ({
    t: etat.niosh[p === "o" ? "origine" : "destination"]?.t ?? null,
    H: +$("#" + p + "H").value, V: +$("#" + p + "V").value, A: +$("#" + p + "A").value
  });
  return { origine: lire("o"), destination: lire("d") };
}

/** Le calcul NIOSH courant, ou null tant que le levage n'est pas repéré. */
function resultatNiosh() {
  if (!etat.analyse || !etat.niosh.origine) return null;
  const r = lireReperes();
  return calculerNIOSH({
    origine: r.origine, destination: r.destination,
    controleDestination: $("#controleDestination").checked,
    poids: +$("#poidsCharge").value,
    frequence: +$("#frequence").value,
    duree: $("#dureeTache").value,
    prise: $("#priseNiosh").value
  });
}

function majPanneauNiosh() {
  if (!etat.analyse) return;
  const r = lireReperes();
  const res = resultatNiosh();
  if (!res) return;

  const fini = Number.isFinite(res.il);
  const texte = fini ? res.il.toFixed(1).replace(".", ",") : "∞";
  dessinerJauge(el.jauge, fini ? Math.min(3, res.il) : 3, res.risque, { min: 0, max: 3 }, texte);
  el.niveauLibelle.textContent = res.risque.libelle;
  el.niveauLibelle.style.color = COULEURS_NIVEAU[res.risque.couleur];
  el.niveauAction.textContent = res.risque.action;

  $("#plrValeur").textContent = res.plr > 0 ? res.plr.toFixed(1).replace(".", ",") : "0";
  $("#plrValeur").style.color = COULEURS_NIVEAU[res.risque.couleur];
  $("#poidsReel").textContent = String(+$("#poidsCharge").value).replace(".", ",");

  const MESURE = {
    HM: () => `${Math.round(r[res.gouverne].H)} cm du corps`,
    VM: () => `mains à ${Math.round(r[res.gouverne].V)} cm`,
    DM: () => `${Math.round(res.D)} cm de montée`,
    AM: () => `${Math.round(r[res.gouverne].A)}° de torsion`,
    FM: () => `${$("#frequence").value}/min · ${$("#dureeTache").selectedOptions[0].text.toLowerCase()}`,
    CM: () => $("#priseNiosh").selectedOptions[0].text.split(" — ")[0]
  };
  $("#corpsMult").innerHTML = Object.entries(res.multiplicateurs).map(([cle, m]) => {
    const pire = cle === res.pire.nom;
    return `<tr class="${pire ? "mult-pire" : ""}">
      <td>${ETIQ_MULT[cle]}</td>
      <td class="num discret">${MESURE[cle]()}</td>
      <td class="num" style="${pire ? `color:${COULEURS[3]}` : ""}">${m.valeur.toFixed(2).replace(".", ",")}</td>
    </tr>`;
  }).join("");

  const horsDomaine = res.horsDomaine.length
    ? `<br><span style="color:${COULEURS[3]}">Hors du domaine de la méthode : ${res.horsDomaine.map(x => x.motif).join(" ; ")}.</span>`
    : "";
  $("#calculNiosh").innerHTML =
    `23 kg × ${Object.values(res.multiplicateurs).map(m => m.valeur.toFixed(2).replace(".", ",")).join(" × ")} `
    + `= <b>${res.plr.toFixed(1).replace(".", ",")} kg</b> · indice ${fini ? res.il.toFixed(2).replace(".", ",") : "∞"} `
    + `(point le plus défavorable : ${res.gouverne})` + horsDomaine;

  dessinerHauteurMains(el.chrono, etat.analyse, {
    curseur: etat.t, origine: r.origine.t, destination: r.destination.t
  });
  el.noteChrono.textContent = "Hauteur des mains au-dessus du sol. Placez-vous sur une image, puis marquez la saisie ou la dépose.";
  el.chronoLegende.innerHTML = "";
}

/* Le poids de la charge est un fait physique unique : REBA et NIOSH le
   demandent tous les deux, il n'a pas à être saisi deux fois. Les deux curseurs
   restent visibles là où chaque méthode l'attend, mais ils sont liés. */
function synchroniserPoids(depuis) {
  const source = depuis === "niosh" ? $("#poidsCharge") : $("#charge");
  const cible = depuis === "niosh" ? $("#charge") : $("#poidsCharge");
  const v = Math.min(+cible.max, Math.max(+cible.min, +source.value));
  if (+cible.value !== v) cible.value = v;
}

/* ---------- Vue synoptique ----------
   Les trois verdicts ensemble, chacun sur son échelle. Pas de score composite :
   REBA va de 1 à 15, RULA de 1 à 7, et l'indice NIOSH est un ratio sans borne.
   Les moyenner produirait un chiffre indéfendable — et comme REBA et RULA
   partagent les mêmes angles, une somme compterait le tronc deux fois. */

/** Cette méthode est-elle le bon instrument pour la tâche décrite ? */
function pertinence(cle, image, niosh) {
  const charge = +$("#charge").value;
  const assis = image?.angles?.jambes?.assis;
  if (cle === "reba") {
    if (assis) return "Conçue pour le corps entier debout ; RULA est plus fine sur un poste assis.";
    return charge > 0
      ? "Adaptée — posture et charge, corps entier."
      : "Adaptée à la posture. Sans charge déclarée, elle ne cote que le geste.";
  }
  if (cle === "rula") {
    if (charge > 10) return "Hors de son domaine : sa cote de force plafonne à 10 kg, elle sature ici.";
    if (assis) return "Adaptée — poste assis, membre supérieur.";
    return "Adaptée au membre supérieur et aux gestes répétés.";
  }
  if (!niosh) return "Levage non repéré. Ouvrez l'onglet NIOSH pour poser la saisie et la dépose.";
  if (niosh.horsDomaine.length) return "Hors domaine : " + niosh.horsDomaine[0].motif + ".";
  return `Adaptée — levage. ${niosh.plr.toFixed(1).replace(".", ",")} kg admissibles.`;
}

function majSynoptique(image) {
  if (!etat.analyse || !image) { $("#synoptique").innerHTML = ""; return; }
  const niosh = resultatNiosh();

  const lignes = [
    { cle: "reba", nom: "REBA", sous: "corps entier",
      cote: image.resultats.reba.reba, risque: image.resultats.reba.risque, dispo: true },
    { cle: "rula", nom: "RULA", sous: "membre supérieur",
      cote: image.resultats.rula.rula, risque: image.resultats.rula.risque, dispo: true },
    { cle: "niosh", nom: "NIOSH", sous: "levage",
      cote: niosh ? (Number.isFinite(niosh.il) ? niosh.il.toFixed(1).replace(".", ",") : "∞") : "—",
      risque: niosh ? niosh.risque : null, dispo: !!niosh }
  ];

  $("#synoptique").innerHTML = lignes.map(l => `
    <button type="button" class="syn-ligne ${l.cle === etat.methode ? "actif" : ""} ${l.dispo ? "" : "syn-hs"}"
            data-methode="${l.cle}">
      <span class="syn-cote" style="${l.risque ? `color:${COULEURS_NIVEAU[l.risque.couleur]}` : ""}">${l.cote}</span>
      <span class="syn-corps">
        <span class="syn-nom"><b>${l.nom}</b> <span class="discret">· ${l.sous}</span>${
          l.risque ? ` — <span style="color:${COULEURS_NIVEAU[l.risque.couleur]}">${l.risque.libelle.toLowerCase()}</span>` : ""}</span>
        <span class="syn-note">${pertinence(l.cle, image, niosh)}</span>
      </span>
    </button>`).join("");

  $("#synoptique").querySelectorAll(".syn-ligne").forEach(b =>
    b.addEventListener("click", () => choisirMethode(b.dataset.methode)));
}

/* ---------- Choix de la méthode ----------
   RULA et REBA sont calculées à chaque image : basculer ne relance rien, ça ne
   fait que réafficher. Un avis prévient quand la méthode choisie n'est pas la
   bonne pour la tâche — RULA sature au-delà de 10 kg, elle n'est pas faite pour
   la manutention de charge. */
function choisirMethode(m) {
  if (!METHODES[m]) return;
  etat.methode = m;
  document.querySelectorAll(".methode").forEach(b => {
    const actif = b.dataset.methode === m;
    b.classList.toggle("actif", actif);
    b.setAttribute("aria-checked", String(actif));
  });
  const levage = !!METHODES[m].levage;
  $("#methodeRef").innerHTML = METHODES[m].ref;
  $("#chronoTitre").textContent = METHODES[m].titreChrono || `Cote ${METHODES[m].nom} dans le temps`;
  $("#casePronosupination").hidden = m !== "rula";
  if (!levage) $("#introParams").textContent = METHODES[m].intro;

  /* NIOSH remplace le panneau postural par le sien : ni les mêmes entrées, ni
     la même sortie. */
  $("#panneauNiosh").hidden = !levage;
  $("#carteNiosh").hidden = !levage;
  $("#panneauPostural").hidden = levage;
  $("#carteSegments").hidden = levage;
  el.synthese.hidden = levage;      // la synthèse par image n'a pas de sens ici

  if (etat.analyse) {
    etat.analyse = recoter(etat.analyse, lireParams());
    majSynthese();
    dessinerInstant(etat.t);
  }
  majAvis();
}

function majAvis() {
  const charge = +$("#charge").value;
  let texte = "";
  if (etat.methode === "rula" && charge > 10) {
    texte = `RULA plafonne sa cote de force au-delà de 10 kg : à ${charge} kg elle sature `
          + `et cesse de discriminer. Pour de la manutention de charge, REBA est l'instrument approprié.`;
  } else if (etat.methode === "reba" && charge === 0) {
    texte = "Sans charge déclarée, REBA ne cote que la posture. Pour un poste de "
          + "précision ou assis, RULA est plus sensible au membre supérieur.";
  }
  let bloc = document.getElementById("avisMethode");
  if (!texte) { bloc?.remove(); return; }
  if (!bloc) {
    bloc = document.createElement("p");
    bloc.id = "avisMethode";
    bloc.className = "avis";
    el.calcul.parentElement.appendChild(bloc);
  }
  bloc.textContent = texte;
}

document.querySelectorAll(".methode").forEach(b =>
  b.addEventListener("click", () => choisirMethode(b.dataset.methode)));

/* ---------- Branchements ---------- */

el.fichier.addEventListener("change", e => chargerFichier(e.target.files[0]));
el.annuler.addEventListener("click", () => { etat.abandon?.abort(); el.progres.hidden = true; });
el.lecture.addEventListener("click", basculerLecture);

el.allerPire.addEventListener("click", () => {
  const t = etat.analyse?.synthese?.pire?.t;
  if (t == null) return;
  etat.t = t;
  if (etat.mode === "video") el.video.currentTime = t;
  dessinerInstant(t);
});

el.chrono.addEventListener("click", e => {
  if (!etat.analyse?.images.length) return;
  const r = el.chrono.getBoundingClientRect();
  const tMax = Math.max(...etat.analyse.images.map(i => i.t));
  const t = Math.max(0, Math.min(tMax, ((e.clientX - r.left) / r.width) * tMax));
  etat.t = t;
  if (etat.mode === "video") el.video.currentTime = t;
  dessinerInstant(t);
});

/* Le squelette est cliquable : chaque os ouvre le détail de son segment. */
el.calque.addEventListener("click", e => {
  if (!etat.analyse) return;
  const r = el.calque.getBoundingClientRect();
  const image = imageALInstant(etat.analyse, etat.t);
  const os = osAuPoint(image, e.clientX - r.left, e.clientY - r.top,
                       { largeur: r.width, hauteur: r.height });
  const boite = el.scene.getBoundingClientRect();
  if (os) {
    etat.osSelectionne = os;
    redessinerSquelette();
    afficherDetail(os, e.clientX - boite.left, e.clientY - boite.top);
  } else fermerDetail();
});
el.calque.addEventListener("mousemove", e => {
  if (!etat.analyse) { el.calque.style.cursor = "default"; return; }
  const r = el.calque.getBoundingClientRect();
  const os = osAuPoint(imageALInstant(etat.analyse, etat.t), e.clientX - r.left, e.clientY - r.top,
                       { largeur: r.width, hauteur: r.height });
  el.calque.style.cursor = os ? "pointer" : "crosshair";
});
$("#detailFermer").addEventListener("click", fermerDetail);
document.addEventListener("keydown", e => { if (e.key === "Escape") fermerDetail(); });

el.video.addEventListener("timeupdate", () => {
  if (etat.mode === "video" && etat.analyse) { etat.t = el.video.currentTime; dessinerInstant(etat.t); }
});
el.video.addEventListener("loadedmetadata", () => dimensionnerCalque());

/* Recotation immédiate quand un paramètre non observable change : c'est la
   réponse à « et si la caisse pesait 15 kg ? », sans relancer la détection. */
for (const id of ["charge", "prise", "statique", "repete", "instable", "brusque",
                  "cote", "jambesManuel", "pronosupination", "lissage"]) {
  $("#" + id).addEventListener("input", () => {
    if (id === "charge") synchroniserPoids("postural");
    majSorties();
    majAvis();
    if (!etat.analyse) return;
    etat.analyse = recoter(etat.analyse, lireParams());
    majSynthese();
    dessinerInstant(etat.t);
  });
}
for (const id of ["fps", "precision"]) $("#" + id).addEventListener("input", majSorties);

el.exportJson.addEventListener("click", () => {
  if (!etat.analyse) return;
  const s = etat.analyse.synthese;
  const donnees = {
    methode: etat.methode === "rula"
      ? "RULA — McAtamney & Corlett, Applied Ergonomics 24 (1993)"
      : "REBA — Hignett & McAtamney, Applied Ergonomics 31 (2000)",
    genere: new Date().toISOString(),
    source: etat.mode === "demo" ? "séquence de démonstration (postures simulées)" : etat.mode,
    parametres: etat.analyse.params,
    synthese: s && {
      images: s.images, ecartees: s.ignorees, duree: +s.duree.toFixed(2),
      median: s.median, p90: s.p90, max: s.max, pire_a_s: +s.pire.t.toFixed(2),
      repartition: s.parNiveau.map(n => ({ niveau: n.niveau, libelle: n.libelle, part: +n.part.toFixed(4) })),
      segment_dominant: s.dominantFrequent
    },
    images: etat.analyse.images.map(i => ({
      t: +i.t.toFixed(3),
      score: i.resultat.score, niveau: i.resultat.risque.niveau,
      /* Les deux cotes sont exportées : le fichier reste exploitable même si
         l'on change d'avis sur la méthode après coup. */
      reba: i.resultats.reba.reba, rula: i.resultats.rula.rula,
      fiable: i.fiable,
      cotes: Object.fromEntries(Object.entries(i.resultat.segments).map(([k, v]) => [k, v.cote])),
      angles: {
        tronc: +i.angles.tronc.flexion.toFixed(1),
        cou: +i.angles.cou.flexion.toFixed(1),
        genou: +i.angles.jambes.flexionGenou.toFixed(1),
        bras: +i.angles.bras.flexionBras.toFixed(1),
        coude: +i.angles.bras.flexionCoude.toFixed(1),
        poignet: +i.angles.bras.flexionPoignet.toFixed(1)
      }
    }))
  };
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cotation-${etat.methode}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* Repères du levage : marquage depuis l'image courante, puis recalcul immédiat. */
for (const [bouton, cle] of [["#marquerOrigine", "origine"], ["#marquerDestination", "destination"]]) {
  $(bouton).addEventListener("click", () => {
    const r = relever(etat.t);
    if (!r) return;
    etat.niosh[cle] = r;
    ecrireReperes();
    majPanneauNiosh();
  });
}
for (const id of ["oH", "oV", "oA", "dH", "dV", "dA", "poidsCharge", "frequence",
                  "dureeTache", "priseNiosh", "controleDestination"]) {
  $("#" + id).addEventListener("input", () => {
    if (id === "poidsCharge") synchroniserPoids("niosh");
    majSorties();
    /* Le poids sert aux trois méthodes : on recote, pas seulement NIOSH. */
    if (id === "poidsCharge" && etat.analyse) {
      etat.analyse = recoter(etat.analyse, lireParams());
      majSynthese();
    }
    if (etat.methode === "niosh") majPanneauNiosh();
    if (etat.analyse) majSynoptique(imageALInstant(etat.analyse, etat.t));
  });
}
/* La taille étalonne les distances : il faut refaire les mesures, pas seulement
   la cotation. */
$("#taille").addEventListener("change", () => {
  majSorties();
  if (!etat.analyse) return;
  etat.analyse = recoter(etat.analyse, lireParams());
  if (etat.niosh.origine) etat.niosh.origine = relever(etat.niosh.origine.t);
  if (etat.niosh.destination) etat.niosh.destination = relever(etat.niosh.destination.t);
  ecrireReperes();
  dessinerInstant(etat.t);
});

/* ---------- Rapport ----------
   Le navigateur sait produire un PDF ; inutile d'embarquer une bibliothèque
   pour refaire ça moins bien. On remplit un document caché, puis on imprime. */

/** Positionne la vidéo sur un instant et attend l'image. */
function allerA(video, t) {
  return new Promise(resolve => {
    let repondu = false;
    const fini = () => { if (repondu) return; repondu = true;
      video.removeEventListener("seeked", fini); clearTimeout(m); resolve(); };
    video.addEventListener("seeked", fini);
    const m = setTimeout(fini, 3000);
    try { video.currentTime = t; } catch (e) { fini(); }
  });
}

/** L'image du pire instant, squelette compris, en JPEG encodé. */
async function imageDuPire() {
  const s = etat.analyse?.synthese;
  if (!s) return null;
  const img = imageALInstant(etat.analyse, s.pire.t);
  const src = etat.mode === "image" ? el.photo : el.video;
  const l = src?.videoWidth || src?.naturalWidth || 960;
  const h = src?.videoHeight || src?.naturalHeight || 540;
  const c = document.createElement("canvas");
  c.width = l; c.height = h;
  const ctx = c.getContext("2d");
  if (etat.mode === "video") await allerA(el.video, s.pire.t);
  ctx.fillStyle = "#0a0e17"; ctx.fillRect(0, 0, l, h);
  if (etat.mode !== "demo" && src) { try { ctx.drawImage(src, 0, 0, l, h); } catch (e) {} }
  dessinerSquelette(ctx, img, { largeur: l, hauteur: h });
  try { return c.toDataURL("image/jpeg", 0.85); } catch (e) { return null; }
}

const jourFr = v => v ? new Date(v + "T12:00:00").toLocaleDateString("fr-CA",
  { year: "numeric", month: "long", day: "numeric" }) : "—";

async function preparerRapport() {
  const a = etat.analyse, s = a?.synthese;
  if (!a || !s) return false;
  const M = METHODES[etat.methode];
  const niveaux = M.levage ? METHODES.reba.niveaux : M.niveaux;
  const pire = imageALInstant(a, s.pire.t);
  const niosh = resultatNiosh();

  $("#rapTitre").textContent = "Cotation ergonomique du poste";
  $("#rapSousTitre").innerHTML =
    `Analyse vidéo · ${a.images.length} images cotées`
    + (s.ignorees ? ` · ${s.ignorees} écartées faute de repères visibles` : "")
    + ` · échantillonnage ${a.params.echantillonnage || 6}/s`;

  const id = [
    ["Poste", $("#idPoste").value], ["Travailleur", $("#idTravailleur").value],
    ["Observateur", $("#idObservateur").value], ["Observation", jourFr($("#idDate").value)],
    ["Rapport", jourFr(new Date().toISOString().slice(0, 10))]
  ].filter(([, v]) => v && v !== "—" || true);
  $("#rapId").innerHTML = id.map(([k, v]) =>
    `<div><dt>${k}</dt><dd>${v || "—"}</dd></div>`).join("");

  const img = await imageDuPire();
  $("#rapImage").src = img || "";
  $("#rapImage").style.display = img ? "" : "none";
  $("#rapLegende").textContent =
    `Instant le plus contraignant de la séquence, à ${s.pire.t.toFixed(1).replace(".", ",")} s. `
    + `Squelette coloré par segment ; les cotes figurent au tableau ci-dessous.`;

  /* Les trois lectures, chacune sur son échelle — jamais additionnées. */
  const lignes = [
    { n: "REBA", s: "corps entier", v: pire.resultats.reba.reba, r: pire.resultats.reba.risque, e: "sur 15" },
    { n: "RULA", s: "membre supérieur", v: pire.resultats.rula.rula, r: pire.resultats.rula.risque, e: "sur 7" },
    niosh ? { n: "NIOSH", s: "indice de levage", r: niosh.risque, e: `${niosh.plr.toFixed(1).replace(".", ",")} kg admissibles`,
              v: Number.isFinite(niosh.il) ? niosh.il.toFixed(1).replace(".", ",") : "∞" } : null
  ].filter(Boolean);
  $("#rapLectures").innerHTML = lignes.map(l =>
    `<div class="rap-lec" style="border-left-color:${COULEURS_NIVEAU[l.r.couleur]}">
       <b>${l.v}</b> <span style="display:inline;font-size:8.5pt">${l.e}</span>
       <span><b style="font-size:9.5pt">${l.n}</b> · ${l.s} — ${l.r.libelle.toLowerCase()}</span>
       <span>${l.r.action}</span>
     </div>`).join("");

  const parNiveau = s.parNiveau.filter(n => n.part > 0.001);
  $("#rapSynthese").innerHTML = `
    <h2>Synthèse de la séquence</h2>
    <div class="rap-stats">
      <div><b>${s.median}</b><span>Cote médiane — la posture habituelle</span></div>
      <div><b>${s.max}</b><span>Pire cote, à ${s.pire.t.toFixed(1).replace(".", ",")} s</span></div>
      <div><b>${s.p90}</b><span>9<sup>e</sup> décile</span></div>
      <div><b>${a.images.length}</b><span>Images cotées</span></div>
    </div>
    <div class="rap-barres">${parNiveau.map(n =>
      `<i style="width:${(n.part * 100).toFixed(1)}%;background:${COULEURS_NIVEAU[n.couleur]}"></i>`).join("")}</div>
    <p class="rap-legende">${parNiveau.map(n =>
      `${n.libelle} ${Math.round(n.part * 100)} %`).join(" · ")}</p>
    <p class="rap-legende">${el.conclusion.textContent}</p>`;

  const r = pire.resultat;
  const lignesSeg = (M.levage ? METHODES.reba : M).lignes;
  $("#rapDetail").innerHTML = `
    <h2>Décomposition à l'instant le plus contraignant</h2>
    <table><thead><tr><th>Segment</th><th>Angle mesuré</th><th>Cote</th><th>État</th></tr></thead>
    <tbody>${lignesSeg.map(l => {
      const seg = r.segments[l.cle]; if (!seg) return "";
      const v = l.angle(pire.angles);
      return `<tr><td>${l.nom}</td>
        <td>${Number.isFinite(v) ? Math.round(v) + " ° " + l.unite.replace("° ", "") : "déclaré"}</td>
        <td>${seg.cote} / ${seg.max}</td>
        <td>${ETIQUETTES_SEVERITE[severite(seg.cote, seg.max)]}</td></tr>`;
    }).join("")}</tbody></table>
    ${niosh ? `<h2>Levage — équation révisée du NIOSH</h2>
      <table><thead><tr><th>Multiplicateur</th><th>Mesure</th><th>Valeur</th></tr></thead><tbody>
      ${Object.entries(niosh.multiplicateurs).map(([k, m]) =>
        `<tr><td>${ETIQ_MULT[k]}</td><td>${k === "HM" ? Math.round(lireReperes()[niosh.gouverne].H) + " cm du corps"
          : k === "VM" ? "mains à " + Math.round(lireReperes()[niosh.gouverne].V) + " cm"
          : k === "DM" ? Math.round(niosh.D) + " cm de montée"
          : k === "AM" ? Math.round(lireReperes()[niosh.gouverne].A) + "° de torsion"
          : k === "FM" ? $("#frequence").value + "/min" : $("#priseNiosh").selectedOptions[0].text.split(" — ")[0]}</td>
        <td>${m.valeur.toFixed(2).replace(".", ",")}</td></tr>`).join("")}
      </tbody></table>
      <p class="rap-legende">Poids limite recommandé ${niosh.plr.toFixed(1).replace(".", ",")} kg
      pour ${niosh.poids} kg manipulés.</p>` : ""}`;

  const p = a.params;
  $("#rapPied").innerHTML = `
    <b>Paramètres déclarés</b> — charge ${p.chargeKg || 0} kg ·
    prise ${["bonne", "correcte", "mauvaise", "inacceptable"][p.prise || 0]} ·
    ${[p.statique && "posture tenue", p.repete && "geste répété", p.instable && "amplitude brusque"]
      .filter(Boolean).join(", ") || "activité non majorée"} ·
    côté ${p.cote === "auto" ? "automatique" : p.cote === "G" ? "gauche" : "droit"}.<br>
    <b>Portée et limites</b> — Les angles sont mesurés sur une estimation de pose à partir d'une
    seule caméra. La charge, la prise et la nature de l'activité sont déclarées par l'observateur, non
    mesurées. La cote du poignet est la moins fiable. Une cotation reste un jugement professionnel :
    cet outil l'accélère et la rend reproductible, il ne la remplace pas.<br>
    <b>Méthodes</b> — REBA : Hignett &amp; McAtamney, Applied Ergonomics 31 (2000).
    RULA : McAtamney &amp; Corlett, Applied Ergonomics 24 (1993).
    NIOSH : Waters, Putz-Anderson, Garg &amp; Fine, Ergonomics 36 (1993).`;
  return true;
}

el.imprimer.addEventListener("click", async () => {
  if (!etat.analyse) return;
  el.imprimer.disabled = true;
  el.imprimer.textContent = "Préparation…";
  try {
    if (await preparerRapport()) window.print();
  } finally {
    el.imprimer.disabled = false;
    el.imprimer.textContent = "Rapport PDF";
    /* Remettre la vidéo là où l'utilisateur l'avait laissée. */
    if (etat.mode === "video") { el.video.currentTime = etat.t; dessinerInstant(etat.t); }
  }
});
window.addEventListener("resize", () => etat.analyse && dessinerInstant(etat.t));

majSorties();
choisirMethode("reba");
chargerDemo();
