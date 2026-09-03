/* Vérification du moteur REBA. `node tests/reba.test.mjs`
   Deux familles de tests :
   - des cas cotés à la main, du neutre au cas chargé ;
   - des propriétés structurelles des tables (monotonie), qui attrapent les
     coquilles de recopie qu'un cas isolé laisserait passer. */

import {
  calculerREBA, coteTronc, coteCou, coteJambes, coteCharge,
  coteBras, coteAvantBras, cotePoignet, severiteSegment, synthetiser, TABLES
} from "../js/reba.js";

let ok = 0, ko = 0;
const eq = (nom, obtenu, attendu) => {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a === b) { ok++; }
  else { ko++; console.error(`  ÉCHEC  ${nom}\n          obtenu ${a}, attendu ${b}`); }
};
const vrai = (nom, cond) => cond ? ok++ : (ko++, console.error(`  ÉCHEC  ${nom}`));

/* ---------- Cotations élémentaires ---------- */
console.log("Cotations par segment");
eq("tronc droit",                coteTronc({ flexion: 0 }).cote, 1);
eq("tronc fléchi 15°",           coteTronc({ flexion: 15 }).cote, 2);
eq("tronc en extension 10°",     coteTronc({ flexion: -10 }).cote, 2);
eq("tronc fléchi 45°",           coteTronc({ flexion: 45 }).cote, 3);
eq("tronc fléchi 70°",           coteTronc({ flexion: 70 }).cote, 4);
eq("tronc fléchi 70° + torsion", coteTronc({ flexion: 70, torsion: true }).cote, 5);
eq("tronc plafonné à 5",         coteTronc({ flexion: 90, torsion: true, inclinaison: true }).cote, 5);

eq("cou neutre",                 coteCou({ flexion: 10 }).cote, 1);
eq("cou fléchi 30°",             coteCou({ flexion: 30 }).cote, 2);
eq("cou en extension",           coteCou({ flexion: -5 }).cote, 2);
eq("cou fléchi + torsion",       coteCou({ flexion: 30, torsion: true }).cote, 3);

eq("appui bilatéral",            coteJambes({ appuiBilateral: true }).cote, 1);
eq("appui unilatéral",           coteJambes({ appuiBilateral: false }).cote, 2);
eq("genou 45°",                  coteJambes({ flexionGenou: 45 }).cote, 2);
eq("genou 75°",                  coteJambes({ flexionGenou: 75 }).cote, 3);
eq("assis : genou ignoré",       coteJambes({ flexionGenou: 90, assis: true }).cote, 1);

eq("charge 3 kg",                coteCharge({ chargeKg: 3 }).cote, 0);
eq("charge 7 kg",                coteCharge({ chargeKg: 7 }).cote, 1);
eq("charge 15 kg",               coteCharge({ chargeKg: 15 }).cote, 2);
eq("charge 15 kg brusque",       coteCharge({ chargeKg: 15, effortBrusque: true }).cote, 3);

eq("bras neutre",                coteBras({ flexion: 10 }).cote, 1);
eq("bras 30°",                   coteBras({ flexion: 30 }).cote, 2);
eq("bras 60°",                   coteBras({ flexion: 60 }).cote, 3);
eq("bras 120°",                  coteBras({ flexion: 120 }).cote, 4);
eq("bras 120° + abduction",      coteBras({ flexion: 120, abduction: true }).cote, 5);
eq("bras soutenu : −1",          coteBras({ flexion: 60, brasSoutenu: true }).cote, 2);
eq("bras jamais sous 1",         coteBras({ flexion: 0, brasSoutenu: true }).cote, 1);

eq("coude 80°",                  coteAvantBras({ flexion: 80 }).cote, 1);
eq("coude 30°",                  coteAvantBras({ flexion: 30 }).cote, 2);
eq("coude 140°",                 coteAvantBras({ flexion: 140 }).cote, 2);

eq("poignet 10°",                cotePoignet({ flexion: 10 }).cote, 1);
eq("poignet 25°",                cotePoignet({ flexion: 25 }).cote, 2);
eq("poignet −25°",               cotePoignet({ flexion: -25 }).cote, 2);
eq("poignet 25° + déviation",    cotePoignet({ flexion: 25, deviation: true }).cote, 3);

/* ---------- Cas complets cotés à la main ---------- */
console.log("Cas complets");

const neutre = calculerREBA({
  tronc: { flexion: 0 }, cou: { flexion: 0 }, jambes: { appuiBilateral: true },
  bras: { flexion: 0 }, avantBras: { flexion: 90 }, poignet: { flexion: 0 }
});
eq("neutre → A", neutre.scoreA, 1);
eq("neutre → B", neutre.scoreB, 1);
eq("neutre → REBA", neutre.reba, 1);
eq("neutre → niveau", neutre.risque.niveau, 0);

/* Manutention chargée, cotée pas à pas :
   tronc 45° + torsion = 4 · cou 25° = 2 · jambes bilatérales genou 45° = 2
   → table A[2][4][2] = 6, charge 8 kg (+1) → A = 7
   bras 60° + abduction = 4 · coude 80° = 1 · poignet 20° + déviation = 3
   → table B[1][4][3] = 5, prise correcte (+1) → B = 6
   → table C[7][6] = 9, gestes répétés (+1) → REBA 10 */
const charge = calculerREBA({
  tronc:     { flexion: 45, torsion: true },
  cou:       { flexion: 25 },
  jambes:    { appuiBilateral: true, flexionGenou: 45 },
  charge:    { chargeKg: 8 },
  bras:      { flexion: 60, abduction: true },
  avantBras: { flexion: 80 },
  poignet:   { flexion: 20, deviation: true },
  prise:     { prise: 1 },
  activite:  { repete: true }
});
eq("chargé → table A", charge.tableA, 6);
eq("chargé → score A", charge.scoreA, 7);
eq("chargé → table B", charge.tableB, 5);
eq("chargé → score B", charge.scoreB, 6);
eq("chargé → score C", charge.scoreC, 9);
eq("chargé → REBA",    charge.reba, 10);
eq("chargé → niveau",  charge.risque.libelle, "Élevé");
eq("chargé → dominant", charge.dominant.nom, "tronc");

/* Le pire cas possible doit saturer à 15 sans déborder des tables. */
const pire = calculerREBA({
  tronc: { flexion: 90, torsion: true }, cou: { flexion: 40, torsion: true },
  jambes: { appuiBilateral: false, flexionGenou: 90 },
  charge: { chargeKg: 30, effortBrusque: true },
  bras: { flexion: 150, abduction: true, epauleHaussee: true },
  avantBras: { flexion: 20 }, poignet: { flexion: 40, deviation: true },
  prise: { prise: 3 }, activite: { statique: true, repete: true, instable: true }
});
eq("pire cas → REBA 15", pire.reba, 15);
eq("pire cas → niveau 4", pire.risque.niveau, 4);

/* ---------- Propriétés des tables ---------- */
console.log("Structure des tables");
const { TABLE_A, TABLE_B, TABLE_C } = TABLES;

let monotone = true;
for (let cou = 1; cou <= 3; cou++)
  for (let tr = 1; tr <= 5; tr++)
    for (let j = 1; j <= 3; j++)
      if (TABLE_A[cou][tr][j] > TABLE_A[cou][tr][j + 1]) monotone = false;
vrai("table A croissante avec les jambes", monotone);

monotone = true;
for (let cou = 1; cou <= 3; cou++)
  for (let tr = 1; tr <= 4; tr++)
    for (let j = 1; j <= 4; j++)
      if (TABLE_A[cou][tr][j] > TABLE_A[cou][tr + 1][j]) monotone = false;
vrai("table A croissante avec le tronc", monotone);

monotone = true;
for (let cou = 1; cou <= 2; cou++)
  for (let tr = 1; tr <= 5; tr++)
    for (let j = 1; j <= 4; j++)
      if (TABLE_A[cou][tr][j] > TABLE_A[cou + 1][tr][j]) monotone = false;
vrai("table A croissante avec le cou", monotone);

monotone = true;
for (let ab = 1; ab <= 2; ab++)
  for (let br = 1; br <= 6; br++)
    for (let p = 1; p <= 2; p++)
      if (TABLE_B[ab][br][p] > TABLE_B[ab][br][p + 1]) monotone = false;
vrai("table B croissante avec le poignet", monotone);

monotone = true;
for (let br = 1; br <= 6; br++)
  for (let p = 1; p <= 3; p++)
    if (TABLE_B[1][br][p] > TABLE_B[2][br][p]) monotone = false;
vrai("table B croissante avec l'avant-bras", monotone);

monotone = true;
for (let a = 1; a <= 12; a++)
  for (let b = 1; b <= 11; b++)
    if (TABLE_C[a][b] > TABLE_C[a][b + 1]) monotone = false;
vrai("table C croissante avec B", monotone);

monotone = true;
for (let a = 1; a <= 11; a++)
  for (let b = 1; b <= 12; b++)
    if (TABLE_C[a][b] > TABLE_C[a + 1][b]) monotone = false;
vrai("table C croissante avec A", monotone);

vrai("table C symétrique en dimensions", TABLE_C.length === 13 && TABLE_C[1].length === 13);
vrai("table C bornée 1..12", TABLE_C.slice(1).every(r => r.slice(1).every(v => v >= 1 && v <= 12)));

/* ---------- Sévérité par segment ---------- */
console.log("Sévérité");
eq("tronc 1 → vert",       severiteSegment("tronc", 1), 0);
eq("tronc 5 → rouge",      severiteSegment("tronc", 5), 3);
eq("poignet 3 → rouge",    severiteSegment("poignet", 3), 3);
eq("avant-bras 2 → rouge", severiteSegment("avantBras", 2), 3);
eq("bras 3 → orange",      severiteSegment("bras", 3), 2);

/* ---------- Synthèse de séquence ---------- */
console.log("Synthèse d'une séquence");
const faux = reba => ({ reba, risque: { min: 1 }, dominant: { nom: "tronc", ecart: reba } });
const seq = [
  { t: 0, fiable: true,  resultat: faux(2) },
  { t: 1, fiable: true,  resultat: faux(9) },
  { t: 2, fiable: false, resultat: faux(14) },   // image écartée
  { t: 3, fiable: true,  resultat: faux(3) }
];
const s = synthetiser(seq);
eq("images retenues",   s.images, 3);
eq("images écartées",   s.ignorees, 1);
eq("pire retenu",       s.pire.reba, 9);
eq("pire horodaté",     s.pire.t, 1);
eq("max ignore le non fiable", s.max, 9);
vrai("part des niveaux = 100 %",
  Math.abs(s.parNiveau.reduce((t, n) => t + n.part, 0) - 1) < 1e-9);
vrai("séquence vide → null", synthetiser([]) === null);

console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
