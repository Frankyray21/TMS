/* ============================================================================
   angles.js — Des points du squelette aux angles articulaires

   Entrée  : les 33 repères 3D de MediaPipe Pose (worldLandmarks, en mètres,
             origine au milieu des hanches, y vers le bas).
   Sortie  : les angles dont reba.js a besoin, plus un indice de fiabilité.

   Deux principes tiennent tout le fichier :
   1. Les angles sont mesurés dans le repère du corps, pas dans celui de la
      caméra. Un tronc penché reste penché même si la caméra est de biais.
   2. Le sens « avant » n'est jamais supposé : il est déduit de l'orientation
      du visage. Le sujet peut donc être filmé de face, de dos ou de profil.
   ============================================================================ */

/* Indices des repères MediaPipe Pose. */
export const P = {
  NEZ: 0, OREILLE_G: 7, OREILLE_D: 8,
  EPAULE_G: 11, EPAULE_D: 12, COUDE_G: 13, COUDE_D: 14,
  POIGNET_G: 15, POIGNET_D: 16, AURICULAIRE_G: 17, AURICULAIRE_D: 18,
  INDEX_G: 19, INDEX_D: 20,
  HANCHE_G: 23, HANCHE_D: 24, GENOU_G: 25, GENOU_D: 26,
  CHEVILLE_G: 27, CHEVILLE_D: 28, TALON_G: 29, TALON_D: 30, PIED_G: 31, PIED_D: 32
};

/* ---------- Algèbre vectorielle minimale ---------- */
const v  = p => ({ x: p.x, y: p.y, z: p.z ?? 0 });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const milieu = (a, b) => mul(add(a, b), 0.5);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const norme = a => Math.hypot(a.x, a.y, a.z);
const unite = a => { const n = norme(a); return n < 1e-9 ? { x: 0, y: 0, z: 0 } : mul(a, 1 / n); };
/* Composante de `a` orthogonale à `n` (n unitaire). */
const projPlan = (a, n) => sub(a, mul(n, dot(a, n)));

const DEG = 180 / Math.PI;
const enDeg = rad => rad * DEG;

/** Angle non signé entre deux vecteurs, en degrés (0–180). */
export function angleEntre(a, b) {
  const na = norme(a), nb = norme(b);
  if (na < 1e-9 || nb < 1e-9) return 0;
  return enDeg(Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (na * nb)))));
}

/**
 * Angle signé de `vec` autour de l'axe `ref`, mesuré vers `sens`.
 * Positif quand `vec` penche du côté de `sens`.
 */
function angleSigne(vec, ref, sens) {
  return enDeg(Math.atan2(dot(vec, sens), dot(vec, ref)));
}

/** Angle intérieur en B dans la chaîne A–B–C (180° = segment tendu). */
export function angleArticulaire(a, b, c) {
  return angleEntre(sub(a, b), sub(c, b));
}

/* ---------- Repère du corps -------------------------------------------------
   On construit un trièdre attaché au tronc : haut (hanches → épaules),
   droite (épaule gauche → épaule droite) et avant (produit vectoriel, dont le
   signe est fixé par la direction du visage). Tous les angles s'y rapportent.
---------------------------------------------------------------------------- */
export function repereDuCorps(pts) {
  const epauleG = v(pts[P.EPAULE_G]), epauleD = v(pts[P.EPAULE_D]);
  const hancheG = v(pts[P.HANCHE_G]), hancheD = v(pts[P.HANCHE_D]);
  const midEpaules = milieu(epauleG, epauleD);
  const midHanches = milieu(hancheG, hancheD);

  const haut = unite(sub(midEpaules, midHanches));       // axe du tronc
  const axeEpaules = sub(epauleD, epauleG);
  const droite = unite(projPlan(axeEpaules, haut));      // orthogonal au tronc

  /* Deux « avant » possibles ; on garde celui vers lequel regarde la tête. */
  let avant = unite(cross(droite, haut));
  const tete = sub(milieu(v(pts[P.OREILLE_G]), v(pts[P.OREILLE_D])), midEpaules);
  const nez = sub(v(pts[P.NEZ]), midEpaules);
  const versage = projPlan(sub(nez, mul(unite(tete), dot(nez, unite(tete)))), haut);
  if (dot(versage, avant) < 0) avant = mul(avant, -1);

  /* Verticale gravitaire : dans le repère MediaPipe, y croît vers le bas. */
  const vertical = { x: 0, y: -1, z: 0 };

  return { haut, droite, avant, vertical, midEpaules, midHanches, axeEpaules,
           axeHanches: sub(hancheD, hancheG) };
}

/* ---------- Tronc ---------- */
export function anglesTronc(pts, R) {
  const T = sub(R.midEpaules, R.midHanches);

  /* Flexion mesurée par rapport à la verticale, dans le plan sagittal. */
  const avantH = unite(projPlan(R.avant, R.vertical));
  const flexion = angleSigne(T, R.vertical, avantH);

  /* Inclinaison latérale : même mesure, mais dans le plan frontal. */
  const droiteH = unite(projPlan(R.droite, R.vertical));
  const inclinaisonDeg = Math.abs(angleSigne(T, R.vertical, droiteH));

  /* Torsion : décalage entre la ligne des épaules et celle des hanches,
     vues du dessus. */
  const epaulesH = projPlan(R.axeEpaules, R.vertical);
  const hanchesH = projPlan(R.axeHanches, R.vertical);
  const torsionDeg = angleEntre(epaulesH, hanchesH);

  return { flexion, inclinaisonDeg, torsionDeg };
}

/* ---------- Cou ----------
   REBA mesure le cou par rapport au tronc, pas à la verticale. */
export function anglesCou(pts, R) {
  const tete = sub(milieu(v(pts[P.OREILLE_G]), v(pts[P.OREILLE_D])), R.midEpaules);
  const flexion = angleSigne(tete, R.haut, R.avant);
  const inclinaisonDeg = Math.abs(angleSigne(tete, R.haut, R.droite));

  /* Torsion : le regard part-il de côté par rapport aux épaules ? */
  const axeOreilles = sub(v(pts[P.OREILLE_D]), v(pts[P.OREILLE_G]));
  const torsionDeg = angleEntre(projPlan(axeOreilles, R.haut), projPlan(R.axeEpaules, R.haut));

  return { flexion, inclinaisonDeg, torsionDeg };
}

/* ---------- Jambes ---------- */
export function anglesJambes(pts, R) {
  const flexionG = 180 - angleArticulaire(v(pts[P.HANCHE_G]), v(pts[P.GENOU_G]), v(pts[P.CHEVILLE_G]));
  const flexionD = 180 - angleArticulaire(v(pts[P.HANCHE_D]), v(pts[P.GENOU_D]), v(pts[P.CHEVILLE_D]));

  /* Appui : on compare la hauteur des deux chevilles, rapportée à la longueur
     de la jambe pour rester indépendant de la taille du sujet. */
  const chevilleG = v(pts[P.CHEVILLE_G]), chevilleD = v(pts[P.CHEVILLE_D]);
  const longueurJambe = Math.max(0.15, norme(sub(v(pts[P.HANCHE_G]), chevilleG)));
  const denivele = Math.abs(chevilleG.y - chevilleD.y) / longueurJambe;
  const appuiBilateral = denivele < 0.15;

  /* Position assise : hanches et genoux à peu près à la même hauteur,
     genoux fléchis. */
  const hancheY = milieu(v(pts[P.HANCHE_G]), v(pts[P.HANCHE_D])).y;
  const genouY = milieu(v(pts[P.GENOU_G]), v(pts[P.GENOU_D])).y;
  const assis = (Math.abs(genouY - hancheY) / longueurJambe < 0.25)
             && Math.max(flexionG, flexionD) > 60;

  return {
    flexionGenou: Math.max(flexionG, flexionD),
    flexionGenouG: flexionG, flexionGenouD: flexionD,
    appuiBilateral, assis, denivele
  };
}

/* ---------- Membre supérieur ----------
   Coté séparément à gauche et à droite : REBA s'applique à un côté à la fois. */
export function anglesBras(pts, R, cote /* 'G' | 'D' */) {
  const g = cote === "G";
  const epaule  = v(pts[g ? P.EPAULE_G  : P.EPAULE_D]);
  const coude   = v(pts[g ? P.COUDE_G   : P.COUDE_D]);
  const poignet = v(pts[g ? P.POIGNET_G : P.POIGNET_D]);
  const index   = v(pts[g ? P.INDEX_G   : P.INDEX_D]);
  const auric   = v(pts[g ? P.AURICULAIRE_G : P.AURICULAIRE_D]);

  const bas = mul(R.haut, -1);                       // bras au repos = vers le bas
  const versExterieur = g ? mul(R.droite, -1) : R.droite;

  /* Bras : flexion sagittale (positive vers l'avant) et abduction latérale. */
  const U = sub(coude, epaule);
  const flexionBras = angleSigne(U, bas, R.avant);
  const abductionDeg = Math.abs(angleSigne(U, bas, versExterieur));

  /* Avant-bras : angle du coude, 180° = tendu → on renvoie la flexion. */
  const flexionCoude = 180 - angleArticulaire(epaule, coude, poignet);

  /* Poignet : la main est approchée par le milieu index–auriculaire. */
  const F = sub(poignet, coude);
  const main = sub(milieu(index, auric), poignet);
  const axeMain = sub(index, auric);
  const normalePaume = unite(cross(F, axeMain));
  const flexionPoignet = angleSigne(main, F, unite(cross(normalePaume, F)));
  const deviationDeg = Math.abs(angleSigne(main, F, unite(normalePaume)));

  /* RULA majore l'avant-bras qui travaille en travers du corps ou nettement
     à l'écart. On compare la position latérale du poignet à celle de l'épaule,
     dans le repère du corps : signe opposé = la main a croisé l'axe médian. */
  const latPoignet = dot(sub(poignet, R.midEpaules), R.droite);
  const latEpaule  = dot(sub(epaule,  R.midEpaules), R.droite);
  const croiseAxe  = latEpaule !== 0 && Math.sign(latPoignet) !== Math.sign(latEpaule)
                     && Math.abs(latPoignet) > Math.abs(latEpaule) * 0.3;
  const ecarte     = Math.abs(latPoignet) > Math.abs(latEpaule) * 1.6;
  const horsAxe    = croiseAxe || ecarte;

  return {
    cote,
    flexionBras, abductionDeg,
    flexionCoude, horsAxe,
    flexionPoignet, deviationDeg
  };
}

/* ---------- Fiabilité ----------
   MediaPipe donne une visibilité par repère. Un angle calculé sur un point
   masqué ne vaut rien : on préfère écarter l'image que coter dans le vide. */
const GROUPES_CRITIQUES = {
  tronc:  [P.EPAULE_G, P.EPAULE_D, P.HANCHE_G, P.HANCHE_D],
  cou:    [P.OREILLE_G, P.OREILLE_D, P.EPAULE_G, P.EPAULE_D],
  jambes: [P.HANCHE_G, P.HANCHE_D, P.GENOU_G, P.GENOU_D, P.CHEVILLE_G, P.CHEVILLE_D],
  brasG:  [P.EPAULE_G, P.COUDE_G, P.POIGNET_G],
  brasD:  [P.EPAULE_D, P.COUDE_D, P.POIGNET_D]
};

export function evaluerFiabilite(pts, seuil = 0.5) {
  const visibilite = {};
  for (const [nom, idx] of Object.entries(GROUPES_CRITIQUES)) {
    visibilite[nom] = Math.min(...idx.map(i => pts[i]?.visibility ?? 0));
  }
  const tronc = visibilite.tronc >= seuil;
  const jambes = visibilite.jambes >= seuil;
  const brasVisible = Math.max(visibilite.brasG, visibilite.brasD) >= seuil;
  return {
    visibilite,
    fiable: tronc && brasVisible,        // le tronc et un bras au minimum
    jambesFiables: jambes,
    global: Math.min(visibilite.tronc, Math.max(visibilite.brasG, visibilite.brasD))
  };
}

/* ---------- Point d'entrée ---------- */

/**
 * Extrait tous les angles d'une pose.
 * @param {Array} pts — worldLandmarks (33 points)
 * @param {object} opts — { cote: 'auto'|'G'|'D', seuilTorsion, seuilInclinaison }
 */
export function extraireAngles(pts, opts = {}) {
  const { seuilTorsion = 20, seuilInclinaison = 12, seuilDeviation = 15 } = opts;
  const R = repereDuCorps(pts);
  const fiabilite = evaluerFiabilite(pts, opts.seuilVisibilite);

  const tronc = anglesTronc(pts, R);
  const cou = anglesCou(pts, R);
  const jambes = anglesJambes(pts, R);
  const brasG = anglesBras(pts, R, "G");
  const brasD = anglesBras(pts, R, "D");

  /* Côté retenu. En automatique, la visibilité prime sur l'amplitude : coter le
     bras le plus levé n'a aucun sens s'il est hors champ, ses angles ne sont
     alors que du bruit d'extrapolation. */
  let choisi = opts.cote;
  if (!choisi || choisi === "auto") {
    const vG = fiabilite.visibilite.brasG, vD = fiabilite.visibilite.brasD;
    if (Math.abs(vG - vD) > 0.25) choisi = vD > vG ? "D" : "G";
    else choisi = Math.abs(brasD.flexionBras) >= Math.abs(brasG.flexionBras) ? "D" : "G";
  }
  const bras = choisi === "G" ? brasG : brasD;

  /* Les jambes sont le segment le plus souvent hors cadre : un plan taille
     coupe genoux et chevilles, et le détecteur les extrapole quand même. Un
     angle de genou inventé fait monter la cote REBA sans que rien ne l'indique,
     donc on marque le cas plutôt que de le laisser passer. */
  const jambesObservables = fiabilite.jambesFiables;

  return {
    repere: R, fiabilite, cote: choisi, jambesObservables,
    tronc, cou, jambes, bras, brasG, brasD,
    /* Traduit en entrées REBA. Les paramètres non observables (charge, prise,
       activité) sont laissés à l'appelant : ils viennent de l'opérateur. */
    versREBA: {
      tronc: {
        flexion: tronc.flexion,
        torsion: tronc.torsionDeg > seuilTorsion,
        inclinaison: tronc.inclinaisonDeg > seuilInclinaison
      },
      cou: {
        flexion: cou.flexion,
        torsion: cou.torsionDeg > seuilTorsion,
        inclinaison: cou.inclinaisonDeg > seuilInclinaison
      },
      jambes: {
        appuiBilateral: jambes.appuiBilateral,
        flexionGenou: jambes.flexionGenou,
        assis: jambes.assis
      },
      bras: {
        flexion: bras.flexionBras,
        abduction: bras.abductionDeg > 45
      },
      avantBras: { flexion: bras.flexionCoude },
      poignet: {
        flexion: bras.flexionPoignet,
        deviation: bras.deviationDeg > seuilDeviation
      }
    }
  };
}
