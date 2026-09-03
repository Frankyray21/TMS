/* Vérification de la géométrie. `node tests/angles.test.mjs`
   On fabrique des squelettes dont on connaît les angles d'avance, puis on
   vérifie que le calcul les retrouve. C'est le seul moyen de contrôler les
   conventions de signe sans ouvrir un navigateur. */

import { extraireAngles, anglesTronc, anglesCou, anglesJambes, anglesBras,
         repereDuCorps, angleArticulaire, P } from "../js/angles.js";

let ok = 0, ko = 0;
const proche = (nom, obtenu, attendu, tol = 1.5) => {
  if (Math.abs(obtenu - attendu) <= tol) ok++;
  else { ko++; console.error(`  ÉCHEC  ${nom} : obtenu ${obtenu.toFixed(2)}, attendu ${attendu} (±${tol})`); }
};
const vrai = (nom, cond) => cond ? ok++ : (ko++, console.error(`  ÉCHEC  ${nom}`));

const rad = d => d * Math.PI / 180;
/* Rotation autour de l'axe x (bascule avant/arrière), y vers le bas, z vers la caméra. */
const rotX = (p, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  /* deg > 0 = bascule vers l'avant : un point au-dessus des hanches (y < 0)
     part vers +z, du côté où regarde le visage. */
  return { ...p, y: p.y * c + p.z * s, z: -p.y * s + p.z * c };
};
/* Rotation autour de l'axe y (torsion vue du dessus). */
const rotY = (p, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return { ...p, x: p.x * c + p.z * s, z: -p.x * s + p.z * c };
};

/**
 * Sujet debout face à la caméra (+z). Repères MediaPipe : la gauche du sujet
 * est du côté +x, sa droite du côté −x.
 * @param o.troncDeg      bascule du tronc vers l'avant
 * @param o.brasDDeg      élévation du bras droit vers l'avant
 * @param o.brasDAbdDeg   abduction latérale du bras droit
 * @param o.coudeDDeg     flexion du coude droit
 * @param o.genouDeg      flexion des deux genoux
 * @param o.torsionDeg    torsion des épaules par rapport aux hanches
 * @param o.couDeg        flexion du cou par rapport au tronc
 */
function corps(o = {}) {
  const { troncDeg = 0, brasDDeg = 0, brasDAbdDeg = 0, coudeDDeg = 0,
          genouDeg = 0, torsionDeg = 0, couDeg = 0 } = o;

  const pt = (x, y, z) => ({ x, y, z, visibility: 0.95 });
  const L = {};

  /* Bas du corps : fixe, origine au milieu des hanches. */
  L[P.HANCHE_G] = pt( 0.10, 0, 0);
  L[P.HANCHE_D] = pt(-0.10, 0, 0);
  for (const [g, h, gn, ch, ta, pi] of [
    ["G", P.HANCHE_G, P.GENOU_G, P.CHEVILLE_G, P.TALON_G, P.PIED_G],
    ["D", P.HANCHE_D, P.GENOU_D, P.CHEVILLE_D, P.TALON_D, P.PIED_D]]) {
    const x = L[h].x;
    L[gn] = pt(x, 0.45, 0);
    /* Le tibia part du genou, incliné vers l'arrière selon la flexion. */
    L[ch] = pt(x, 0.45 + 0.42 * Math.cos(rad(genouDeg)), -0.42 * Math.sin(rad(genouDeg)));
    L[ta] = pt(x, L[ch].y + 0.05, L[ch].z - 0.04);
    L[pi] = pt(x, L[ch].y + 0.05, L[ch].z + 0.12);
  }

  /* Haut du corps, construit droit puis basculé en bloc. */
  const haut = {};
  haut[P.EPAULE_G] = pt( 0.18, -0.50, 0);
  haut[P.EPAULE_D] = pt(-0.18, -0.50, 0);

  /* Tête : le cou fléchit par rapport au tronc. */
  const hy = -0.50 - 0.14 * Math.cos(rad(couDeg));
  const hz =  0.14 * Math.sin(rad(couDeg));
  haut[P.OREILLE_G] = pt( 0.08, hy, hz);
  haut[P.OREILLE_D] = pt(-0.08, hy, hz);
  haut[P.NEZ]       = pt(0, hy - 0.02, hz + 0.11);

  /* Bras droit : élévation avant + abduction, coude fléchi dans le plan. */
  const ep = haut[P.EPAULE_D];
  const dirBras = {
    x: -Math.sin(rad(brasDAbdDeg)),                          // vers l'extérieur (−x = droite du sujet)
    y:  Math.cos(rad(brasDDeg)) * Math.cos(rad(brasDAbdDeg)),
    z:  Math.sin(rad(brasDDeg)) * Math.cos(rad(brasDAbdDeg))
  };
  haut[P.COUDE_D] = pt(ep.x + 0.28 * dirBras.x, ep.y + 0.28 * dirBras.y, ep.z + 0.28 * dirBras.z);
  /* L'avant-bras repart du coude en tournant de `coudeDDeg` dans le plan sagittal. */
  const a = rad(brasDDeg + coudeDDeg);
  haut[P.POIGNET_D] = pt(
    haut[P.COUDE_D].x + 0.25 * dirBras.x * 0.2,
    haut[P.COUDE_D].y + 0.25 * Math.cos(a),
    haut[P.COUDE_D].z + 0.25 * Math.sin(a));
  haut[P.INDEX_D]       = pt(haut[P.POIGNET_D].x, haut[P.POIGNET_D].y + 0.08 * Math.cos(a) + 0.02, haut[P.POIGNET_D].z + 0.08 * Math.sin(a));
  haut[P.AURICULAIRE_D] = pt(haut[P.POIGNET_D].x - 0.04, haut[P.POIGNET_D].y + 0.08 * Math.cos(a) - 0.01, haut[P.POIGNET_D].z + 0.08 * Math.sin(a));

  /* Bras gauche au repos. */
  haut[P.COUDE_G]       = pt( 0.20, -0.22, 0);
  haut[P.POIGNET_G]     = pt( 0.21,  0.02, 0);
  haut[P.INDEX_G]       = pt( 0.21,  0.10, 0.02);
  haut[P.AURICULAIRE_G] = pt( 0.25,  0.10, 0.01);

  for (const k of Object.keys(haut)) {
    let p = haut[k];
    if (torsionDeg) {                                   // torsion autour de l'axe du tronc
      const centre = -0.50;
      p = { ...rotY({ ...p, y: p.y - centre }, torsionDeg), y: 0 };
      p.y = haut[k].y;
    }
    L[k] = troncDeg ? { ...rotX(p, troncDeg), visibility: 0.95 } : p;
  }
  return Array.from({ length: 33 }, (_, i) => L[i] || pt(0, 0, 0));
}

/* ---------- Repère du corps ---------- */
console.log("Repère du corps");
{
  const R = repereDuCorps(corps());
  proche("haut = vertical (y)", R.haut.y, -1, 0.02);
  proche("droite du sujet = −x", R.droite.x, -1, 0.02);
  proche("avant = +z (vers la caméra)", R.avant.z, 1, 0.02);
}
{
  /* Sujet de dos : le nez pointe en −z, l'avant doit basculer avec lui. */
  const pts = corps().map(p => ({ ...p, z: -p.z }));
  const R = repereDuCorps(pts);
  vrai("sujet de dos : l'avant suit le visage", R.avant.z < -0.9);
}

/* ---------- Tronc ---------- */
console.log("Tronc");
for (const deg of [0, 15, 30, 45, 60, 75]) {
  const R = corps({ troncDeg: deg });
  proche(`flexion ${deg}°`, anglesTronc(R, repereDuCorps(R)).flexion, deg, 2);
}
{
  const pts = corps({ troncDeg: -20 });
  proche("extension 20° → négatif", anglesTronc(pts, repereDuCorps(pts)).flexion, -20, 2);
}
{
  const pts = corps({ torsionDeg: 35 });
  proche("torsion 35°", anglesTronc(pts, repereDuCorps(pts)).torsionDeg, 35, 3);
  proche("torsion seule : pas de flexion", anglesTronc(pts, repereDuCorps(pts)).flexion, 0, 2);
}

/* ---------- Cou ---------- */
console.log("Cou");
for (const deg of [0, 25, 40]) {
  const pts = corps({ couDeg: deg });
  proche(`cou ${deg}°`, anglesCou(pts, repereDuCorps(pts)).flexion, deg, 3);
}
{
  /* Le cou se mesure par rapport au tronc : tronc basculé, cou droit → 0°. */
  const pts = corps({ troncDeg: 40, couDeg: 0 });
  proche("cou droit sur tronc penché", anglesCou(pts, repereDuCorps(pts)).flexion, 0, 3);
}

/* ---------- Jambes ---------- */
console.log("Jambes");
for (const deg of [0, 35, 70]) {
  const pts = corps({ genouDeg: deg });
  proche(`genou ${deg}°`, anglesJambes(pts, repereDuCorps(pts)).flexionGenou, deg, 2);
}
{
  const pts = corps();
  vrai("appui bilatéral détecté", anglesJambes(pts, repereDuCorps(pts)).appuiBilateral);
  const boiteux = corps();
  boiteux[P.CHEVILLE_D] = { ...boiteux[P.CHEVILLE_D], y: boiteux[P.CHEVILLE_D].y - 0.30 };
  vrai("pied levé → appui unilatéral", !anglesJambes(boiteux, repereDuCorps(boiteux)).appuiBilateral);
}

/* ---------- Membre supérieur ---------- */
console.log("Membre supérieur");
for (const deg of [0, 30, 60, 100]) {
  const pts = corps({ brasDDeg: deg });
  proche(`bras ${deg}° avant`, anglesBras(pts, repereDuCorps(pts), "D").flexionBras, deg, 3);
}
{
  const pts = corps({ brasDAbdDeg: 60 });
  proche("abduction 60°", anglesBras(pts, repereDuCorps(pts), "D").abductionDeg, 60, 4);
}
for (const deg of [0, 60, 90]) {
  const pts = corps({ coudeDDeg: deg });
  proche(`coude ${deg}°`, anglesBras(pts, repereDuCorps(pts), "D").flexionCoude, deg, 4);
}
{
  /* Un bras levé alors que le tronc est penché reste mesuré par rapport au tronc. */
  const pts = corps({ troncDeg: 45, brasDDeg: 0 });
  proche("bras au repos, tronc penché", anglesBras(pts, repereDuCorps(pts), "D").flexionBras, 0, 4);
}

/* ---------- Chaîne complète ---------- */
console.log("Chaîne complète");
{
  const pts = corps({ troncDeg: 50, genouDeg: 40, brasDDeg: 35, coudeDDeg: 70 });
  const a = extraireAngles(pts);
  proche("tronc",  a.versREBA.tronc.flexion, 50, 2);
  proche("genou",  a.versREBA.jambes.flexionGenou, 40, 2);
  proche("bras",   a.versREBA.bras.flexion, 35, 4);
  vrai("côté droit retenu automatiquement", a.cote === "D");
  vrai("pose jugée fiable", a.fiabilite.fiable);
}
{
  const masque = corps().map((p, i) =>
    [P.EPAULE_G, P.EPAULE_D, P.HANCHE_G].includes(i) ? { ...p, visibility: 0.1 } : p);
  vrai("repères masqués → pose écartée", !extraireAngles(masque).fiabilite.fiable);
}
{
  /* L'invariance à la caméra : tourner le sujet ne change pas ses angles. */
  const droit = corps({ troncDeg: 40, brasDDeg: 50 });
  const tourne = droit.map(p => ({ ...p, ...rotY(p, 55) }));
  const a = extraireAngles(droit).versREBA, b = extraireAngles(tourne).versREBA;
  proche("tronc invariant à l'orientation caméra", b.tronc.flexion, a.tronc.flexion, 2);
  proche("bras invariant à l'orientation caméra", b.bras.flexion, a.bras.flexion, 3);
}

console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
