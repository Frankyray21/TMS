/* ============================================================================
   picto.js — Le pictogramme d'angle : un mannequin articulé

   Parti pris : UN SEUL MANNEQUIN, articulé, pour les six planches. Un gabarit
   anatomique unique (le squelette ci-dessous, exprimé en hauteurs de tête) est
   habillé de pièces — os en trait épais, torse, tête, main, pied — et chaque
   planche se contente de choisir un pivot, une chaîne mobile et un cadrage.
   La posture mesurée est appliquée au pivot : le corps ADOPTE l'angle, il ne
   le commente pas. Le segment coté n'est donc plus désigné par une aiguille,
   il EST l'aiguille.

   La lecture « à partir de quel angle ça devient contraignant, et où tombe ma
   mesure » est portée par une réglette verticale à droite : une bande par
   plage de cotation, ses bornes chiffrées à gauche, sa cote dedans, et le
   repère de la mesure à droite. Les trois familles d'étiquettes vivent dans
   trois colonnes qui ne se recouvrent jamais — le désencombrement est obtenu
   par la construction, pas par un réglage.

   Aucune dépendance au DOM : ce module rend une chaîne (voir
   tests/rendre-picto.mjs et tests/verifier-picto.mjs).
   ============================================================================ */

import { severite } from "./reba.js";
import { COULEURS } from "./rendu.js";

/* Les bandes d'angle de chaque segment, telles que les fonctions de cotation
   les appliquent réellement. Ce sont des données : copiées telles quelles. */
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

/* ---------------------------------------------------------------------------
   1. LE GABARIT — un seul homme, un seul canon

   Toutes les longueurs sont en hauteurs de tête (H = 1). Le sujet est vu de
   profil, tourné vers la DROITE : +x est l'avant du corps, +y le bas. La
   hanche est à l'origine. Stature ≈ 7,8 H, canon académique.
   --------------------------------------------------------------------------- */

const SQUELETTE = {
  hanche:   [ 0.00,  0.00],   // grand trochanter — pivot du tronc
  epaule:   [ 0.08, -2.55],   // acromion, en avant du plan médian
  c7:       [-0.10, -2.58],   // base du cou — pivot du cou
  teteBas:  [-0.02, -2.92],   // charnière occipitale (cou visible : 0,34 H)
  sommet:   [ 0.03, -3.92],   // vertex — donne l'axe de la tête
  coude:    [ 0.08, -1.10],   // humérus : 1,45 H
  poignet:  [ 0.08,  0.05],   // avant-bras : 1,15 H
  mainBout: [ 0.08,  0.67],   // main : 0,62 H
  genou:    [ 0.00,  1.90],   // cuisse : 1,90 H
  cheville: [ 0.00,  3.65]    // jambe : 1,75 H
};

/* Ce qui suit chaque articulation : tourner un pivot entraîne ses descendants,
   et rien d'autre. C'est toute la cinématique du mannequin. */
const ENFANTS = {
  hanche:  ["epaule", "c7", "teteBas", "sommet", "coude", "poignet", "mainBout"],
  c7:      ["teteBas", "sommet"],
  epaule:  ["coude", "poignet", "mainBout"],
  coude:   ["poignet", "mainBout"],
  poignet: ["mainBout"],
  genou:   ["cheville"]
};

/* ---- Les pièces de chair -------------------------------------------------
   Chaque forme est tracée dans son repère local : origine sur l'articulation
   d'ancrage, +y vers l'articulation suivante, +x vers l'avant du corps. Elle
   suit donc son os sans qu'on ait à réécrire un seul point. */

/* Torse de profil : moignon d'épaule, bombé sternal, creux lombaire à 0,45 du
   tronc, sacrum, fesse. Profondeur 0,95 H à la poitrine, 0,61 à la taille, 0,79 aux hanches,
   pour 2,94 H de haut — élancement 3,3, celui du canon de profil. C'est le
   creux de taille, et non un ovale, qui galbe la figure. */
const TORSE = `M-0.08,2.72 C-0.28,2.64 -0.42,2.44 -0.46,2.10
  C-0.50,1.76 -0.34,1.48 -0.30,1.18 C-0.27,0.86 -0.38,0.56 -0.46,0.24
  C-0.50,0.00 -0.32,-0.26 -0.06,-0.26 C0.14,-0.26 0.31,-0.14 0.33,0.10
  C0.34,0.42 0.29,0.72 0.31,0.98 C0.35,1.40 0.46,1.78 0.49,2.14
  C0.50,2.40 0.42,2.60 0.26,2.68 C0.16,2.72 0.04,2.74 -0.08,2.72 Z`;

/* Le même torse, coupé à la taille — là où il est le plus étroit : le bassin
   de la planche du genou. Coupé plus bas, à toit plat, il se lisait comme un
   flacon. Recadrer vaut mieux que comprimer la figure entière. */
const TORSE_BAS = `M-0.30,1.18 C-0.27,0.86 -0.38,0.56 -0.46,0.24
  C-0.50,0.00 -0.32,-0.26 -0.06,-0.26 C0.14,-0.26 0.31,-0.14 0.33,0.10
  C0.34,0.42 0.29,0.72 0.31,0.98 L0.31,1.18 Z`;

/* Crâne de profil 0,77 × 1,00 : front, nez, échancrure sous-nasale, menton,
   angle de mâchoire net, occiput. Ce sont ces accidents — pas un nez de 2 px —
   qui donnent l'orientation à 296 px de large. */
const TETE = `M0.02,1.00 C0.24,0.99 0.37,0.85 0.38,0.66
  C0.385,0.60 0.365,0.55 0.345,0.50 L0.46,0.34 L0.31,0.30
  C0.33,0.25 0.33,0.20 0.29,0.15 C0.26,0.10 0.24,0.06 0.16,0.03
  C0.06,0.00 -0.06,0.02 -0.14,0.08 C-0.24,0.16 -0.32,0.28 -0.35,0.42
  C-0.38,0.58 -0.32,0.82 -0.16,0.95 C-0.10,0.99 -0.04,1.00 0.02,1.00 Z`;
const TETE_DETAIL = `M-0.09,0.40 C-0.17,0.42 -0.18,0.56 -0.09,0.57`;

/* Main en coin avec bosse du pouce du côté palmaire. */
const MAIN = `M-0.120,0.05 C-0.140,0.22 -0.144,0.42 -0.136,0.54
  C-0.128,0.64 -0.064,0.70 0.008,0.69 C0.080,0.68 0.128,0.62 0.136,0.52
  C0.140,0.44 0.144,0.38 0.160,0.34 C0.216,0.32 0.272,0.26 0.272,0.17
  C0.272,0.09 0.216,0.05 0.168,0.09 C0.112,0.13 0.080,0.15 0.048,0.13
  C0.000,0.10 -0.064,0.07 -0.120,0.05 Z`;
const MAIN_DETAIL = `M-0.088,0.56 C-0.032,0.545 0.040,0.545 0.096,0.56
  M0.152,0.34 C0.104,0.28 0.080,0.22 0.072,0.16`;

/* Pied : talon en arrière, pointe en avant — c'est lui qui dit de quel côté
   le sujet regarde, et il survit à 296 px. */
const PIED = `M-0.20,0.12 C-0.30,0.08 -0.32,-0.06 -0.22,-0.12 L0.40,-0.16
  C0.54,-0.17 0.56,-0.03 0.44,0.00 C0.28,0.05 0.12,0.10 0.04,0.16 Z`;

/* Boîte locale d'une forme : tous les points de contrôle sont des couples de
   coordonnées, donc l'enveloppe des nombres majore l'enveloppe du tracé. */
function boiteLocale(d) {
  const n = d.match(/-?\d*\.?\d+/g).map(Number);
  const x = n.filter((_, i) => i % 2 === 0), y = n.filter((_, i) => i % 2 === 1);
  return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)];
}

/* Les pièces. « couche » sépare le tronc (0) du membre supérieur (1) : chaque
   couche est peinte en deux passes indépendantes, si bien que le bras garde
   son contour par-dessus le torse au lieu de s'y noyer. */
const p_os = (id, a, b, w, opt = {}) => ({ id, os: [a, b], w, couche: 0, ...opt });
/* Un renflement marque l'articulation par la forme du contour — un moignon
   d'épaule, une rotule — plutôt que par un rond posé par-dessus. */
const p_bosse = (id, a, r, opt = {}) => ({ id, bosse: a, r, couche: 0, ...opt });
const p_forme = (id, a, b, d, s, opt = {}) =>
  ({ id, forme: d, bb: boiteLocale(d), a, b, s, couche: 0, ...opt });

const PIECE = {
  cuisse:    p_os("cuisse", "hanche", "genou", 0.56),
  cuisseC:   p_os("cuisse", "hanche", "genou", 0.56, { f: 0.42, coupe: true }),
  jambe:     p_os("jambe", "genou", "cheville", 0.34),
  /* Le pied a sa couche : peint après la teinte de la jambe, sinon le tibia
     coté traverse la semelle et la colore. */
  pied:      p_forme("pied", "cheville", "genou", PIED, 1, { couche: 2 }),
  torse:     p_forme("torse", "hanche", "epaule", TORSE, 1),
  bassin:    p_forme("bassin", "hanche", "epaule", TORSE_BAS, 1),
  cou:       p_os("cou", "c7", "teteBas", 0.42),
  tete:      p_forme("tete", "teteBas", "sommet", TETE, 1, { detail: TETE_DETAIL }),
  bras:      p_os("bras", "epaule", "coude", 0.30, { couche: 1 }),
  /* Un moignon se coupe du côté LOIN de l'articulation qu'il porte, sinon le
     membre suivant flotte : celui-ci tient au coude, seule fin qui compte. */
  brasBas:   p_os("bras", "coude", "epaule", 0.34, { f: 0.55, coupe: true, couche: 1 }),
  avantBras: p_os("avantBras", "coude", "poignet", 0.24, { couche: 1 }),
  main:      p_forme("main", "poignet", "mainBout", MAIN, -1, { couche: 1, detail: MAIN_DETAIL }),
  /* La même main, paume vers le bas : celle de la planche du poignet. Pouce en
     haut, une bascule dans le plan de la vue serait une déviation, pas une
     flexion — et REBA comme RULA les cotent séparément. */
  mainP:     p_forme("main", "poignet", "mainBout", MAIN, 1, { couche: 1, detail: MAIN_DETAIL }),
  epauleB:   p_bosse("epauleB", "epaule", 0.25),
  coudeB:    p_bosse("coudeB", "coude", 0.12, { couche: 1 }),
  genouB:    p_bosse("genouB", "genou", 0.25)
};
const PC = PIECE;

/* ---------------------------------------------------------------------------
   2. LES SIX PLANCHES — même mannequin, un pivot chacune

   pivot    : l'articulation qui porte l'angle
   sens     : signe de la rotation SVG pour une valeur positive
   ref      : point qui matérialise la direction du 0°
   fixe     : la chaîne qui reste — c'est elle qui donne la référence
   mobile   : la chaîne qui prend la posture mesurée
   avant    : les pièces cotées, cerclées de la couleur de la sévérité
   pose     : angles fixes donnés aux AUTRES articulations, pour cadrer la
              planche (le coude à 90° du poignet) ou sortir un membre du torse
   contre   : contre-rotations cosmétiques, plafonnées, d'articulations que la
              mesure n'entraîne pas (le bras qui pend, la nuque qui se relève)
   ra       : rayon de l'arc de mesure, quand la pièce mobile est trop trapue
   derriere : le membre passe derrière le corps quand l'angle est négatif
   brasDerriere : le bras non coté passe derrière le tronc coté en extension
   ecart0   : écart latéral de l'étiquette 0°, quand le dos ou la nuque est
              plus loin du fantôme que la valeur par défaut
   sol      : ligne d'appui sous le pied
   --------------------------------------------------------------------------- */

const PLANCHES = {
  /* Le tronc bascule sur la hanche ; la jambe reste debout. Flexion vers
     l'avant = positive (ISO 11226), donc rotation SVG positive : le haut du
     corps part vers la droite, du côté où le sujet regarde.
     Le bras est contre-tourné d'autant : un opérateur penché ne tend pas le
     bras en arrière, il le laisse pendre. La nuque se relève de 22° au plus,
     comme un opérateur qui regarde devant lui. Ni l'un ni l'autre ne touche à
     l'angle mesuré, qui se lit entre la hanche et l'épaule. */
  tronc: {
    pivot: "hanche", sens: 1, ref: "epaule", sol: true, brasDerriere: true, ecart0: 0.95,
    pose: [["epaule", -14], ["coude", -30]],
    contre: [["epaule", 1], ["c7", 0.35, 22]],
    fixe: [PC.cuisse, PC.genouB, PC.jambe, PC.pied],
    mobile: [PC.torse, PC.cou, PC.tete, PC.epauleB, PC.bras, PC.coudeB, PC.avantBras, PC.main],
    avant: ["torse"],
    vue: "tronc de profil · pointillé : 0° · en avant = +"
  },

  /* Le cou bascule sur C7 ; le tronc reste la référence — c'est bien ce que
     mesurent REBA et RULA, pas l'angle avec la verticale — d'où le tronc
     entier, qui est la référence de la mesure. */
  cou: {
    pivot: "c7", sens: 1, ref: "sommet", derriere: true, ra: 1.62,
    pose: [["epaule", -14], ["coude", -30]],
    fixe: [PC.cuisseC, PC.torse, PC.epauleB, PC.bras, PC.coudeB, PC.avantBras, PC.main],
    mobile: [PC.cou, PC.tete],
    avant: ["cou", "tete"],
    vue: "cou de profil · pointillé : 0° · tête baissée = +"
  },

  /* Le bras s'élève sur l'épaule, coude tendu : c'est la vignette des feuilles
     RULA. Le 0° est le bras pendant le long du tronc, donc l'élévation vers
     l'avant est une rotation SVG négative. */
  bras: {
    pivot: "epaule", sens: -1, ref: "coude", derriere: true, ecart0: 1.05,
    fixe: [PC.cuisseC, PC.torse, PC.cou, PC.tete, PC.epauleB],
    mobile: [PC.bras, PC.coudeB, PC.avantBras, PC.main],
    avant: ["bras"],
    vue: "bras de profil · pointillé : 0° · levé devant = +"
  },

  /* Le coude ferme l'avant-bras ; l'humérus, porté un peu en avant pour qu'il
     sorte du torse, et l'amorce du corps disent d'où l'on part — sans quoi
     deux bâtons ne se lisent pas. */
  avantBras: {
    pivot: "coude", sens: -1, ref: "poignet",
    pose: [["epaule", -20]],
    fixe: [PC.cuisseC, PC.torse, PC.cou, PC.tete, PC.epauleB, PC.bras, PC.coudeB],
    mobile: [PC.avantBras, PC.main],
    avant: ["avantBras"],
    vue: "coude de profil · pointillé : 0°, bras tendu"
  },

  /* Le poignet se juge coude fléchi à 90°, avant-bras vers l'avant, paume vers
     le bas (pronation) : c'est la posture de travail, et c'est la convention
     des feuilles. Flexion palmaire = la main descend vers la paume = rotation
     positive ; l'extension monte. */
  poignet: {
    pivot: "poignet", sens: 1, ref: "mainBout", pose: [["coude", -90]], ra: 0.88,
    fixe: [PC.brasBas, PC.coudeB, PC.avantBras],
    mobile: [PC.mainP],
    avant: ["main"],
    vue: "paume en bas · pointillé : 0° · main baissée = +"
  },

  /* Le genou plie ; la cuisse reste l'axe de référence, car l'angle du genou
     est intrinsèque et non gravitaire. Le sujet regardant à droite, le talon
     part en ARRIÈRE : la rotation positive envoie la jambe vers la gauche.
     C'est le seul balayage de ce côté — l'« harmoniser » vers la droite
     donnerait un genou en hyperextension. */
  jambes: {
    pivot: "genou", sens: 1, ref: "cheville",
    fixe: [PC.bassin, PC.cuisse, PC.genouB],
    mobile: [PC.jambe, PC.pied],
    avant: ["jambe"],
    vue: "genou de profil · pointillé : 0°, jambe tendue"
  }
};

/* ---------------------------------------------------------------------------
   3. CINÉMATIQUE
   --------------------------------------------------------------------------- */

const rad = a => a * Math.PI / 180;
const f = n => Math.round(n * 1000) / 1000;

function tournerAutour(p, c, a) {
  const co = Math.cos(rad(a)), si = Math.sin(rad(a));
  const x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * co - y * si, c[1] + x * si + y * co];
}

/** Le mannequin dans la posture demandée : pose préalable, puis rotation du
    pivot de la planche. Chaque articulation n'entraîne que ses descendants. */
function poser(pl, deg) {
  const pts = {};
  for (const k in SQUELETTE) pts[k] = SQUELETTE[k];
  const tourner = (j, a) => {
    if (!a) return;
    const c = pts[j];
    for (const k of ENFANTS[j]) pts[k] = tournerAutour(pts[k], c, a);
  };
  for (const [j, a] of pl.pose || []) tourner(j, a);
  tourner(pl.pivot, deg);
  /* Contre-rotation : une articulation que la mesure n'entraîne pas peut
     rester d'aplomb (le bras pend, la nuque se relève). Purement cosmétique,
     plafonnée, et sans effet sur l'angle affiché. */
  for (const [j, k, cap = 999] of pl.contre || [])
    tourner(j, Math.max(-cap, Math.min(cap, -deg * k)));
  return pts;
}

/** Les deux extrémités d'un os, tronçon compris. */
function boutsOs(pts, p) {
  const a = pts[p.os[0]], b0 = pts[p.os[1]];
  const b = p.f ? [a[0] + (b0[0] - a[0]) * p.f, a[1] + (b0[1] - a[1]) * p.f] : b0;
  return [a, b];
}

/** Repère local d'une forme : origine sur son ancrage, +y vers l'articulation
    suivante, +x vers l'avant du corps (le signe s le fixe une fois pour toutes). */
function repere(pts, p) {
  const a = pts[p.a], b = pts[p.b];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const ey = [dx / l, dy / l], s = p.s;
  return [-ey[1] * s, ey[0] * s, ey[0], ey[1], a[0], a[1]];
}

/** Enveloppe d'une pièce, marge de contour comprise. */
function boitePiece(pts, p) {
  if (p.bosse) {
    const a = pts[p.bosse], r = p.r + 0.07;
    return [a[0] - r, a[1] - r, a[0] + r, a[1] + r];
  }
  if (p.os) {
    const [a, b] = boutsOs(pts, p), r = p.w / 2 + 0.07;
    return [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r,
            Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r];
  }
  const m = repere(pts, p), q = p.bb, e = 0.07;
  const co = [[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]]
    .map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  return [Math.min(...co.map(c => c[0])) - e, Math.min(...co.map(c => c[1])) - e,
          Math.max(...co.map(c => c[0])) + e, Math.max(...co.map(c => c[1])) + e];
}

/* ---------------------------------------------------------------------------
   4. LA MISE EN PAGE — trois colonnes qui ne se croisent jamais

   [ 5 … 150 ]  la scène : le mannequin, le fantôme du 0°, l'arc de mesure
   [154 … 178 ]  les bornes de plage, alignées à droite
   [182 … 206 ]  la réglette des bandes, avec la cote dedans
   [207 … 279 ]  le cartouche de la mesure, qui glisse le long de la réglette

   Aucune étiquette ne peut en rencontrer une autre : elles n'ont pas de
   colonne commune, et dans une même colonne l'écart minimal est garanti par
   la hauteur de bande plancher (24 u) et par le cadrage de la scène.
   --------------------------------------------------------------------------- */

const L = 280, H = 224;                       // viewBox
const SX = 5, SY = 8, SW = 145, SH = 208;     // la scène
const KMAX = 50;                              // une tête ne dépasse pas 50 u
const RX = 182, RW = 24, RY1 = 18, RY2 = 208; // la réglette
const XBORNE = 178;                           // bornes, ancrage « end »
const XCART = 243;                            // centre du cartouche
const HMIN = 24;                              // hauteur plancher d'une bande

/** Hauteurs des bandes : proportionnelles à leur étendue, mais jamais sous le
    plancher — sinon la bande de confort du poignet RULA (4°) serait un filet
    muet. Le reste se répartit au prorata. C'est la convention des feuilles
    publiées, qui donnent une vignette de même taille à chaque plage. */
function hauteursBandes(spans, total, hmin) {
  const h = spans.map(() => 0);
  let libres = spans.map((_, i) => i), reste = total;
  for (let garde = 0; garde <= spans.length; garde++) {
    const som = libres.reduce((s, i) => s + spans[i], 0) || 1;
    const petits = libres.filter(i => reste * spans[i] / som < hmin - 1e-9);
    if (!petits.length) { for (const i of libres) h[i] = reste * spans[i] / som; break; }
    for (const i of petits) { h[i] = hmin; reste -= hmin; }
    libres = libres.filter(i => !petits.includes(i));
    if (!libres.length) break;
  }
  return h;
}

/** Largeur d'un texte, majorée : le cartouche doit contenir le sien, sinon le
    contrôle géométrique le compte comme une étiquette de plus. */
function largeurTexte(s, taille) {
  let w = 0;
  for (const c of s)
    w += c === "°" ? 0.50 : c === "−" || c === "-" ? 0.60
       : c === "≥" || c === "≤" ? 0.72 : c === "1" ? 0.60 : 0.64;
  return w * taille;
}

const cacheCadre = new Map();

/** Le cadrage d'une planche : calculé sur TOUTE l'étendue de sa bande, donc
    stable d'une valeur à l'autre — le mannequin ne saute pas d'une image à
    la suivante, seule la posture change. */
function cadre(cle, methode) {
  const clef = cle + "/" + methode;
  if (cacheCadre.has(clef)) return cacheCadre.get(clef);
  const pl = PLANCHES[cle], d = BANDES[methode][cle];
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  const avaler = b => { x1 = Math.min(x1, b[0]); y1 = Math.min(y1, b[1]);
                        x2 = Math.max(x2, b[2]); y2 = Math.max(y2, b[3]); };

  const valeurs = [d.min, d.max, 0];
  for (let v = d.min; v < d.max; v += 5) valeurs.push(v);
  for (const v of valeurs) {
    const pts = poser(pl, pl.sens * Math.max(d.min, Math.min(d.max, v)));
    for (const p of pl.fixe) avaler(boitePiece(pts, p));
    for (const p of pl.mobile) avaler(boitePiece(pts, p));
  }
  /* Le fantôme du 0° et l'arc de mesure font partie du dessin : ils comptent. */
  const p0 = poser(pl, 0), pv = p0[pl.pivot], rf = p0[pl.ref];
  const lref = Math.hypot(rf[0] - pv[0], rf[1] - pv[1]);
  const u = [(rf[0] - pv[0]) / lref, (rf[1] - pv[1]) / lref];
  /* L'arc de mesure se pose au ras du pivot, sauf là où la pièce mobile est
     trapue (tête, main) : il passerait alors sous elle. Le fantôme va toujours
     un peu plus loin que l'arc. */
  const ra = pl.ra ?? 0.62 * lref, lf = Math.max(1.16 * lref, ra * 1.14);
  const fin = [pv[0] + u[0] * lf, pv[1] + u[1] * lf];
  avaler([fin[0] - 0.22, fin[1] - 0.22, fin[0] + 0.22, fin[1] + 0.22]);
  /* L'étiquette du 0° se pose au bout du fantôme, du côté OPPOSÉ au balayage :
     là, aucune posture ne viendra jamais la recouvrir. */
  /* Deux positions, une par signe : un angle négatif balaie précisément du
     côté « opposé au balayage » d'un angle positif, et l'étiquette s'y
     retrouvait sur le visage. On choisit dans scene(), selon la mesure. */
  const tg = [-u[1], u[0]], loin = pl.sens > 0 ? -1 : 1;
  const ecart = pl.ecart0 ?? 0.55;
  const e0 = sg => [fin[0] + tg[0] * ecart * loin * sg + u[0] * 0.08,
                    fin[1] + tg[1] * ecart * loin * sg + u[1] * 0.08];
  const e0p = e0(1), e0m = e0(-1);
  for (const e of [e0p, e0m]) avaler([e[0] - 0.30, e[1] - 0.26, e[0] + 0.30, e[1] + 0.26]);
  avaler([pv[0] - ra, pv[1] - ra, pv[0] + ra, pv[1] + ra]);

  const k = Math.min(SW / (x2 - x1), SH / (y2 - y1), KMAX);
  const c = { k, lref, u, pv, e0: e0p, e0m, ra, lf, boite: [x1, y1, x2, y2],
              tx: SX + (SW - (x2 - x1) * k) / 2 - x1 * k,
              ty: SY + (SH - (y2 - y1) * k) / 2 - y1 * k };
  cacheCadre.set(clef, c);
  return c;
}

/* ---------------------------------------------------------------------------
   5. LE DESSIN
   --------------------------------------------------------------------------- */

/* La chair. Plus claire que la carte d'un bon cran : à la couleur de la carte,
   le corps n'était qu'un contour, un fil de fer sur fond sombre. Une figure
   d'ergonomie est une silhouette pleine. */
const CHAIR = "#33415a";
/* Le segment coté est REMPLI de sa couleur de sévérité, pas seulement cerclé :
   c'est la convention des planches, où le membre en cause est peint en rouge.
   L'œil va d'abord au tronc orange, avant même de lire la réglette. */
const TEINTE = 0.42;

/** Une couche de pièces, en deux passes : d'abord tous les tracés en trait
    épais couleur peau (le contour), puis les mêmes remplis de chair. Le
    contour extérieur est alors unique et continu, les coutures internes
    disparaissent, et l'articulation est correcte à n'importe quel angle
    puisqu'un os n'est qu'un trait à bouts ronds. */
function couche(pts, pieces, avant, coul, k = KMAX) {
  let contour = "", chair = "", teinte = "", detail = "";
  /* Les os cotés passent en dernier dans chaque passe : leur bout rond recouvre
     la rotule et la calotte grise du membre voisin, au lieu d'en être mordu. */
  const ordre = [...pieces].sort((a, b) =>
    (avant.includes(a.id) && a.os ? 1 : 0) - (avant.includes(b.id) && b.os ? 1 : 0));
  for (const p of ordre) {
    const vedette = avant.includes(p.id);
    const t = vedette ? 0.075 : 0.055;
    const c = vedette ? coul : "var(--sourd)";
    if (p.bosse) {
      const a = pts[p.bosse];
      contour += `<circle cx="${f(a[0])}" cy="${f(a[1])}" r="${f(p.r + t)}" fill="${c}"/>`;
      chair   += `<circle cx="${f(a[0])}" cy="${f(a[1])}" r="${p.r}" fill="${CHAIR}"/>`;
      if (vedette) teinte += `<circle cx="${f(a[0])}" cy="${f(a[1])}" r="${p.r}" fill="${coul}"/>`;
      continue;
    }
    if (p.os) {
      const [a, b] = boutsOs(pts, p);
      const d = `M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}`;
      const cap = p.coupe ? "butt" : "round";
      contour += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(p.w + 2 * t)}" stroke-linecap="${cap}"/>`;
      chair   += `<path d="${d}" fill="none" stroke="${CHAIR}" stroke-width="${p.w}" stroke-linecap="${cap}"/>`;
      if (vedette) teinte += `<path d="${d}" fill="none" stroke="${coul}" stroke-width="${p.w}" stroke-linecap="${cap}"/>`;
    } else {
      const m = repere(pts, p).map(f).join(",");
      contour += `<path transform="matrix(${m})" d="${p.forme}" fill="${c}" stroke="${c}" stroke-width="${f(2 * t)}" stroke-linejoin="round"/>`;
      chair   += `<path transform="matrix(${m})" d="${p.forme}" fill="${CHAIR}"/>`;
      if (vedette) teinte += `<path transform="matrix(${m})" d="${p.forme}" fill="${coul}"/>`;
      /* Les plis d'une main ne se lisent qu'en grand ; en petit ils font une tache. */
      if (p.detail && k >= 40)
        detail += `<path transform="matrix(${m})" d="${p.detail}" fill="none" stroke="var(--sourd)" stroke-width="0.05" stroke-linecap="round" opacity=".75"/>`;
    }
  }
  /* L'opacité est posée sur le GROUPE : elle s'applique à l'union des formes,
     pas à leurs recouvrements. Pièce par pièce, la tête et le cou faisaient
     un goitre sombre là où ils se superposent. */
  return contour + chair + (teinte ? `<g opacity="${TEINTE}">${teinte}</g>` : "") + detail;
}

/** Une chaîne entière, couche par couche : le tronc d'abord, le membre
    supérieur ensuite, pour qu'il garde son contour au lieu de s'y noyer. */
function chaine(pts, pieces, avant, coul, inverse = false, k = KMAX) {
  const n = [...new Set(pieces.map(p => p.couche))].sort((a, b) => a - b);
  if (inverse) n.reverse();
  return n.map(i => couche(pts, pieces.filter(p => p.couche === i), avant, coul, k)).join("");
}

/** Le corps dans sa posture, le fantôme de la référence, l'arc de mesure. */
function scene(cle, methode, vb, coul) {
  const pl = PLANCHES[cle], c = cadre(cle, methode);
  const deg = pl.sens * vb;
  const pts = poser(pl, deg);

  /* En extension, le bras non coté passerait DEVANT le tronc coté et le
     couperait en deux : on le peint derrière. */
  const mobile = chaine(pts, pl.mobile, pl.avant, coul, pl.brasDerriere && vb < 0, c.k);
  const fixe = `<g opacity=".72">${chaine(poser(pl, 0), pl.fixe, [], coul, false, c.k)}</g>`;
  /* Un membre parti en arrière passe DERRIÈRE le corps : l'ordre de tracé
     dépend du signe, sinon l'extension se dessine collée sur la poitrine. */
  const corps = (pl.derriere && vb < 0) ? mobile + fixe : fixe + mobile;

  const [px, py] = c.pv;
  const fin = [px + c.u[0] * c.lf, py + c.u[1] * c.lf];
  /* Quand le segment coïncide avec la référence, le pointillé passerait sur
     lui — et sur le visage, pour le cou : on ne trace que le dépassement. */
  const d0 = Math.abs(deg) < 4 ? c.lref : 0;
  const deb = [px + c.u[0] * d0, py + c.u[1] * d0];
  const fantome = `<path d="M${f(deb[0])},${f(deb[1])}L${f(fin[0])},${f(fin[1])}" fill="none"
      stroke="var(--texte-2)" stroke-width="0.055" stroke-dasharray="0.17 0.13" opacity=".9"/>`;

  /* L'arc de mesure : il part du sommet de l'angle, entre le fantôme et le
     segment posé. C'est le marquage d'angle des planches — plus d'aiguille
     qui traverse le corps, le segment posé EST l'aiguille. */
  let arc = "";
  const a0 = Math.atan2(c.u[1], c.u[0]) * 180 / Math.PI, a1 = a0 + deg, ra = c.ra;
  if (Math.abs(deg) >= 4) {
    const p1 = [px + ra * Math.cos(rad(a0)), py + ra * Math.sin(rad(a0))];
    const p2 = [px + ra * Math.cos(rad(a1)), py + ra * Math.sin(rad(a1))];
    const grand = Math.abs(deg) > 180 ? 1 : 0, sens = deg > 0 ? 1 : 0;
    const tg = [-Math.sin(rad(a1)) * Math.sign(deg), Math.cos(rad(a1)) * Math.sign(deg)];
    const nr = [Math.cos(rad(a1)), Math.sin(rad(a1))];
    const tri = [[p2[0] + tg[0] * 0.13, p2[1] + tg[1] * 0.13],
                 [p2[0] + nr[0] * 0.09, p2[1] + nr[1] * 0.09],
                 [p2[0] - nr[0] * 0.09, p2[1] - nr[1] * 0.09]];
    /* Sous 10°, l'arc est plus court que sa pointe : elle seule resterait, posée
       sur la poitrine comme un signe. On la garde pour les angles qui la portent. */
    const pointe = Math.abs(deg) >= 10
      ? `<path d="M${tri.map(q => f(q[0]) + "," + f(q[1])).join("L")}Z" fill="var(--texte)"/>` : "";
    arc = `<path d="M${f(p1[0])},${f(p1[1])}A${f(ra)},${f(ra)} 0 ${grand} ${sens} ${f(p2[0])},${f(p2[1])}"
             fill="none" stroke="var(--texte)" stroke-width="0.07" stroke-linecap="round"/>${pointe}`;
  }
  /* Le sol : sans lui, un corps penché à 90° a l'air de tomber. */
  const sol = pl.sol
    ? `<path d="M${f(c.pv[0] - 1.7)},${f(c.boite[3] - 0.04)}H${f(c.pv[0] + 1.7)}" stroke="var(--sourd)"
         stroke-width="0.05" stroke-dasharray="0.22 0.16" opacity=".55"/>` : "";

  const pivot = `<circle cx="${f(px)}" cy="${f(py)}" r="0.12" fill="var(--texte)"/>
                 <circle cx="${f(px)}" cy="${f(py)}" r="0.055" fill="var(--carte)"/>`;

  /* L'étiquette du 0° est posée hors du groupe mis à l'échelle : elle doit
     rester lisible, pas grossir avec le mannequin. Bornée à la scène, elle ne
     peut atteindre aucune autre étiquette. */
  const e0 = vb < 0 ? c.e0m : c.e0;
  const ex = Math.max(16, Math.min(132, c.tx + c.k * e0[0]));
  const ey = Math.max(14, Math.min(212, c.ty + c.k * e0[1]));

  return `<g transform="translate(${f(c.tx)},${f(c.ty)}) scale(${f(c.k)})">
      ${sol}<g class="corps">${corps}</g>${fantome}${arc}${pivot}</g>
    <text x="${f(ex)}" y="${f(ey)}" text-anchor="middle" dominant-baseline="central"
          font-size="11" fill="var(--texte-2)">0°</text>`;
}

/* ---------------------------------------------------------------------------
   6. LA RÉGLETTE — où bascule la cote, et où tombe la mesure
   --------------------------------------------------------------------------- */

function reglette(d, maxCote, valeur, vb, iActive, decal = 0) {
  const spans = d.b.map(([a, z]) => z - a);
  const h = hauteursBandes(spans, RY2 - RY1, HMIN);
  const bas = [];                      // y de la borne basse de chaque bande
  let y = RY2;
  for (let i = 0; i < h.length; i++) { bas.push(y); y -= h[i]; }

  const yDe = v => {
    const w = Math.max(d.min, Math.min(d.max, v));
    for (let i = 0; i < d.b.length; i++) {
      const [a, z] = d.b[i];
      if (w <= z || i === d.b.length - 1) return bas[i] - (w - a) / (z - a) * h[i];
    }
  };

  /* Les bandes, en aplat plein : à 55 % d'opacité, le chiffre d'une cote
     n'atteint le contraste requis sur aucune des quatre teintes. */
  let bandes = "", cotes = "", active = "";
  d.b.forEach(([a, z, cote], i) => {
    /* Sur le maximum réel du segment — celui que la fiche emploie pour son
       en-tête — sinon la couleur du dessin contredit celle du titre. Pour les
       jambes, la bande dit une majoration : elle s'ajoute à la base de l'appui. */
    const sev = severite(cote + decal, maxCote);
    const yb = bas[i], yt = bas[i] - h[i];
    bandes += `<path d="M${RX},${f(yb)}H${RX + RW}V${f(yt)}H${RX}Z" fill="${COULEURS[sev]}"/>`;
    if (i === iActive)
      active = `<path d="M${RX},${f(yb)}H${RX + RW}V${f(yt)}H${RX}Z" fill="none"
          stroke="var(--texte)" stroke-width="2"/>`;
    /* Chiffre sombre sur vert, jaune, orange (5,9 à 10,1:1) ; blanc sur rouge
       (4,9:1) — le seul cas où le texte sombre échoue le seuil 4,5:1. */
    cotes += `<text x="${RX + RW / 2 - 2}" y="${f((yb + yt) / 2)}" text-anchor="middle"
        dominant-baseline="central" font-size="13" font-weight="700"
        fill="${sev === 3 ? "#ffffff" : "#0a0e17"}">${d.majoration ? "+" + (cote - 1) : cote}</text>`;
  });
  bandes += `<path d="M${RX},${RY1}H${RX + RW}V${RY2}H${RX}Z" fill="none"
      stroke="var(--fond)" stroke-width="1"/>`;
  for (let i = 1; i < d.b.length; i++)
    bandes += `<path d="M${RX},${f(bas[i])}H${RX + RW}" stroke="var(--fond)" stroke-width="1.4"/>`;

  /* Les bornes de plage, toutes : la première et la dernière disent l'étendue
     du domaine, les autres le point de bascule. Deux bornes voisines sont
     séparées d'au moins 24 u de haut, un texte de 10,5 en fait 14 : elles ne
     peuvent pas se rencontrer. */
  const bornes = [d.b[0][0], ...d.b.map(([, z]) => z)];
  const ys = [bas[0], ...bas.map((v, i) => v - h[i])];
  let etiq = bornes.map((v, i) =>
    `<text x="${XBORNE}" y="${f(ys[i])}" text-anchor="end" dominant-baseline="central"
       font-size="10.5" fill="var(--texte-2)">${v < 0 ? "−" + -v : v}°</text>
     <path d="M${XBORNE + 3},${f(ys[i])}H${RX}" stroke="var(--sourd)" stroke-width="1" opacity=".5"/>`).join("");

  /* Le 0° quand il tombe à l'intérieur d'une bande : un cran, sans texte —
     le fantôme de la scène le nomme déjà, et deux « 0° » à 10 u l'un de
     l'autre ne se lisent pas. */
  if (!bornes.includes(0) && d.min < 0 && d.max > 0) {
    etiq += `<path d="M${RX},${f(yDe(0))}h6 M${RX + RW - 6},${f(yDe(0))}h6"
        stroke="var(--texte-2)" stroke-width="1.6" opacity=".9"/>`;
    /* Et son nom, si la bande est assez haute pour qu'il ne touche pas ses
       voisines : deux tirets que rien ne nomme ne disent pas « zéro ». */
    const i0 = d.b.findIndex(([a, z]) => 0 >= a && 0 <= z);
    if (i0 >= 0 && h[i0] >= 36)
      etiq += `<text x="${XBORNE}" y="${f(yDe(0))}" text-anchor="end" dominant-baseline="central"
         font-size="10.5" fill="var(--texte-2)">0°</text>`;
  }

  /* Le repère de la mesure : un trait plein en travers de la bande, une
     pointe, et le cartouche au bout — dans sa colonne réservée. */
  const ym = yDe(vb);
  const hors = valeur > d.max + 0.5 ? 1 : valeur < d.min - 0.5 ? -1 : 0;
  const txt = hors > 0 ? `≥${d.max}°` : hors < 0 ? `≤${d.min < 0 ? "−" + -d.min : d.min}°`
            : `${Math.round(valeur) < 0 ? "−" + -Math.round(valeur) : Math.round(valeur)}°`;
  const lw = Math.min(70, Math.max(40, largeurTexte(txt, 15) + 22));
  const yc = Math.max(14, Math.min(210, ym));
  /* Une pointe qui entre dans la bande, et rien de plus : le repère ne
     traverse pas la réglette, donc il ne peut ni barrer le chiffre de la cote
     ni mordre sur l'étiquette de borne, où que tombe la mesure. */
  const repere = `<path d="M${RX + RW - 4},${f(ym)}h15" stroke="var(--fond)" stroke-width="6"/>
    <path d="M${RX + RW + 9},${f(ym)}L${f(XCART - lw / 2)},${f(yc)}" stroke="var(--texte)" stroke-width="1.4"/>
    <path d="M${RX + RW - 3},${f(ym)}L${RX + RW + 9},${f(ym - 5.5)}L${RX + RW + 9},${f(ym + 5.5)}Z" fill="var(--texte)"/>
    <rect x="${f(XCART - lw / 2)}" y="${f(yc - 12)}" width="${f(lw)}" height="24" rx="5"
          fill="var(--carte)" stroke="var(--texte)" stroke-width="1.6"/>
    <text x="${XCART}" y="${f(yc)}" text-anchor="middle" dominant-baseline="central"
          font-size="15" font-weight="700" fill="var(--texte)">${txt}</text>`;

  /* La butée : quand la mesure sort du domaine coté, le dessin s'arrête à la
     borne — il faut que ça se voie plutôt que d'écrire un chiffre que la
     silhouette dément. */
  const butee = hors ? `<path d="M${RX + 3},${f(ym + hors * 7)}L${RX + RW / 2},${f(ym + hors * 2)}L${RX + RW - 3},${f(ym + hors * 7)}"
      fill="none" stroke="var(--texte)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : "";

  return bandes + active + cotes + etiq + repere + butee;
}

/* ---------------------------------------------------------------------------
   7. LE PICTOGRAMME
   --------------------------------------------------------------------------- */

/**
 * Le pictogramme d'un segment : le mannequin dans la posture mesurée, la
 * référence en fantôme, et la réglette des plages de cotation avec la mesure
 * repérée dessus. Rend une chaîne SVG suivie de la légende de la vue.
 */
export function pictogramme(cle, methode, valeur, maxCote, { base, cote } = {}) {
  const d = BANDES[methode]?.[cle];
  const pl = PLANCHES[cle];
  if (!d || !pl || !Number.isFinite(valeur)) return "";

  const vb = Math.max(d.min, Math.min(d.max, valeur));

  /* La fiche est l'autorité sur le score : elle passe la base que la fonction
     de cotation a donnée, et le pictogramme cherche la bande qui la porte. Il
     ne re-dérive rien — sur un seuil exact, les fonctions de cotation ne sont
     pas toutes strictes du même côté (RULA donne 2 à 5° pile), et le dessin
     contredisait la fiche à un degré près.
     Sans base (le banc d'essai), on retient la plus petite cote des bandes qui
     contiennent la mesure. Pour les jambes, la bande dit une majoration sur
     la base de l'appui : c'est l'angle seul qui la choisit. */
  const parAngle = () => {
    let i = d.b.reduce((m, [a, z, c], k) =>
      (vb >= a && vb <= z && (m < 0 || c < d.b[m][2])) ? k : m, -1);
    return i < 0 ? (vb <= d.b[0][1] ? 0 : d.b.length - 1) : i;
  };
  let iBande;
  if (d.majoration || !Number.isFinite(base)) iBande = parAngle();
  else {
    iBande = d.b.findIndex(([a, z, c]) => vb >= a && vb <= z && c === base);
    /* Aucune bande ne porte cette base — le « tronc droit » de REBA vaut 1 en
       un point que la feuille ne dessine pas : on n'en cercle aucune. */
  }
  const decal = d.majoration && Number.isFinite(base) ? base - 1 : 0;
  /* La figure prend la couleur du score entier de la fiche — majorations
     comprises — c'est lui que l'en-tête affiche juste au-dessus. */
  const coteFig = Number.isFinite(cote) ? cote
                : iBande >= 0 ? d.b[iBande][2] + decal : base;
  const coul = COULEURS[severite(coteFig, maxCote)];

  return `<svg class="picto" viewBox="0 0 ${L} ${H}" role="img"
      aria-label="Le corps dans la posture mesurée, ${Math.round(valeur)} degrés, et les plages de score du segment">
    ${scene(cle, methode, vb, coul)}
    ${reglette(d, maxCote, valeur, vb, iBande, decal)}
  </svg>
  <p class="picto-vue">${pl.vue}</p>`;
}
