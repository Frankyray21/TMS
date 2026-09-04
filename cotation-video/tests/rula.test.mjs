/* Vérification du moteur RULA. `node tests/rula.test.mjs`
   Même protocole que pour REBA : cotations élémentaires, cas complets cotés à
   la main, puis monotonie des tables — c'est ce dernier contrôle qui attrape
   une coquille de recopie qu'aucun cas isolé ne révélerait. */

import { calculerRULA, coteBras, coteAvantBras, cotePoignet, cotePronosupination,
         coteCou, coteTronc, coteJambes, coteForce, coteMuscle, TABLES } from "../js/rula.js";

let ok = 0, ko = 0;
const eq = (nom, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) ok++;
  else { ko++; console.error(`  ÉCHEC  ${nom} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`); }
};
const vrai = (nom, cond) => cond ? ok++ : (ko++, console.error(`  ÉCHEC  ${nom}`));

console.log("Cotations par segment");
eq("bras neutre",            coteBras({ flexion: 10 }).cote, 1);
eq("bras 30°",               coteBras({ flexion: 30 }).cote, 2);
eq("bras 60°",               coteBras({ flexion: 60 }).cote, 3);
eq("bras 120°",              coteBras({ flexion: 120 }).cote, 4);
eq("bras 120° + épaule haussée + abduction", coteBras({ flexion: 120, epauleHaussee: true, abduction: true }).cote, 6);
eq("bras soutenu : −1",      coteBras({ flexion: 60, brasSoutenu: true }).cote, 2);

eq("coude 80°",              coteAvantBras({ flexion: 80 }).cote, 1);
eq("coude 30°",              coteAvantBras({ flexion: 30 }).cote, 2);
eq("coude 80° hors axe",     coteAvantBras({ flexion: 80, horsAxe: true }).cote, 2);
eq("coude 30° hors axe",     coteAvantBras({ flexion: 30, horsAxe: true }).cote, 3);

eq("poignet neutre",         cotePoignet({ flexion: 0 }).cote, 1);
eq("poignet 10°",            cotePoignet({ flexion: 10 }).cote, 2);
eq("poignet 25°",            cotePoignet({ flexion: 25 }).cote, 3);
eq("poignet −25°",           cotePoignet({ flexion: -25 }).cote, 3);
eq("poignet 25° + déviation", cotePoignet({ flexion: 25, deviation: true }).cote, 4);

eq("pronosupination milieu", cotePronosupination({}).cote, 1);
eq("pronosupination fin",    cotePronosupination({ finDeCourse: true }).cote, 2);

eq("cou 5°",                 coteCou({ flexion: 5 }).cote, 1);
eq("cou 15°",                coteCou({ flexion: 15 }).cote, 2);
eq("cou 30°",                coteCou({ flexion: 30 }).cote, 3);
eq("cou en extension",       coteCou({ flexion: -5 }).cote, 4);
eq("cou 30° + torsion + inclinaison", coteCou({ flexion: 30, torsion: true, inclinaison: true }).cote, 5);

eq("tronc droit",            coteTronc({ flexion: 0 }).cote, 1);
eq("tronc assis soutenu",    coteTronc({ flexion: 12, assisSoutenu: true }).cote, 1);
eq("tronc 12° debout",       coteTronc({ flexion: 12 }).cote, 2);
eq("tronc 40°",              coteTronc({ flexion: 40 }).cote, 3);
eq("tronc 70°",              coteTronc({ flexion: 70 }).cote, 4);
eq("tronc 70° + torsion",    coteTronc({ flexion: 70, torsion: true }).cote, 5);
eq("extension cotée par amplitude", coteTronc({ flexion: -40 }).cote, 3);

eq("jambes équilibrées",     coteJambes({ appuiEquilibre: true }).cote, 1);
eq("jambes non équilibrées", coteJambes({ appuiEquilibre: false }).cote, 2);

console.log("Majorations");
eq("muscle : ni statique ni répété", coteMuscle({}).cote, 0);
eq("muscle : statique",      coteMuscle({ statique: true }).cote, 1);
eq("muscle : répété",        coteMuscle({ repete: true }).cote, 1);
eq("force < 2 kg ponctuel",  coteForce({ chargeKg: 1 }).cote, 0);
eq("force < 2 kg soutenu",   coteForce({ chargeKg: 1, statique: true }).cote, 1);
eq("force 5 kg ponctuel",    coteForce({ chargeKg: 5 }).cote, 1);
eq("force 5 kg soutenu",     coteForce({ chargeKg: 5, repete: true }).cote, 2);
eq("force > 10 kg",          coteForce({ chargeKg: 15 }).cote, 3);
eq("force brusque",          coteForce({ chargeKg: 0, effortBrusque: true }).cote, 3);

console.log("Cas complets");
const neutre = calculerRULA({
  bras: { flexion: 0 }, avantBras: { flexion: 90 }, poignet: { flexion: 0 },
  cou: { flexion: 0 }, tronc: { flexion: 0 }
});
eq("neutre → posture A", neutre.postureA, 1);
eq("neutre → posture B", neutre.postureB, 1);
eq("neutre → RULA", neutre.rula, 1);
eq("neutre → niveau", neutre.risque.niveau, 1);

/* Manutention contraignante, cotée pas à pas :
   bras 60° + abduction = 4 · coude 80° hors axe = 2 · poignet 20° + déviation = 4
   · pronosupination en fin de course = 2 → table A[4][2][4][2] = 5
   muscle (répété) +1, force (5 kg soutenu) +2 → C = 8
   cou 25° = 3 · tronc 30° = 3 · jambes équilibrées = 1 → table B[3][3][1] = 4
   +1 +2 → D = 7  →  table C[8][7] = 7 */
const dur = calculerRULA({
  bras:      { flexion: 60, abduction: true },
  avantBras: { flexion: 80, horsAxe: true },
  poignet:   { flexion: 20, deviation: true },
  pronosupination: { finDeCourse: true },
  cou:       { flexion: 25 },
  tronc:     { flexion: 30 },
  jambes:    { appuiEquilibre: true },
  charge:    { chargeKg: 5 },
  activite:  { repete: true }
});
eq("contraignant → posture A", dur.postureA, 5);
eq("contraignant → C", dur.scoreC, 8);
eq("contraignant → posture B", dur.postureB, 4);
eq("contraignant → D", dur.scoreD, 7);
eq("contraignant → RULA", dur.rula, 7);
eq("contraignant → niveau", dur.risque.niveau, 4);

/* Poste assis prolongé : rien d'extrême, mais tenu.
   bras 15° = 1 · coude 90° = 1 · poignet 5° = 2 · prono milieu = 1 → A[1][1][2][1] = 2
   muscle (statique) +1, force (0 kg soutenu) +1 → C = 4
   cou 15° = 2 · tronc assis soutenu = 1 · jambes = 1 → B[2][1][1] = 2 ; +1 +1 → D = 4
   → table C[4][4] = 4 */
const bureau = calculerRULA({
  bras: { flexion: 15 }, avantBras: { flexion: 90 }, poignet: { flexion: 5 },
  cou: { flexion: 15 }, tronc: { flexion: 10, assisSoutenu: true },
  activite: { statique: true }
});
eq("bureau → posture A", bureau.postureA, 2);
eq("bureau → C", bureau.scoreC, 4);
eq("bureau → posture B", bureau.postureB, 2);
eq("bureau → RULA", bureau.rula, 4);
eq("bureau → niveau", bureau.risque.libelle, "À investiguer");

const pire = calculerRULA({
  bras: { flexion: 150, abduction: true, epauleHaussee: true },
  avantBras: { flexion: 20, horsAxe: true },
  poignet: { flexion: 40, deviation: true },
  pronosupination: { finDeCourse: true },
  cou: { flexion: -10, torsion: true, inclinaison: true },
  tronc: { flexion: 80, torsion: true, inclinaison: true },
  jambes: { appuiEquilibre: false },
  charge: { chargeKg: 25 }, activite: { statique: true, repete: true }
});
eq("pire cas → RULA 7", pire.rula, 7);
eq("pire cas → borné, pas de débordement", Number.isInteger(pire.rula), true);

console.log("Structure des tables");
const { TABLE_A, TABLE_B, TABLE_C } = TABLES;

let m = true;
for (let b = 1; b <= 6; b++) for (let a = 1; a <= 3; a++) for (let p = 1; p <= 4; p++)
  if (TABLE_A[b][a][p][1] > TABLE_A[b][a][p][2]) m = false;
vrai("table A croissante avec la pronosupination", m);

m = true;
for (let b = 1; b <= 6; b++) for (let a = 1; a <= 3; a++) for (let p = 1; p <= 3; p++) for (let t = 1; t <= 2; t++)
  if (TABLE_A[b][a][p][t] > TABLE_A[b][a][p + 1][t]) m = false;
vrai("table A croissante avec le poignet", m);

m = true;
for (let b = 1; b <= 6; b++) for (let a = 1; a <= 2; a++) for (let p = 1; p <= 4; p++) for (let t = 1; t <= 2; t++)
  if (TABLE_A[b][a][p][t] > TABLE_A[b][a + 1][p][t]) m = false;
vrai("table A croissante avec l'avant-bras", m);

m = true;
for (let b = 1; b <= 5; b++) for (let a = 1; a <= 3; a++) for (let p = 1; p <= 4; p++) for (let t = 1; t <= 2; t++)
  if (TABLE_A[b][a][p][t] > TABLE_A[b + 1][a][p][t]) m = false;
vrai("table A croissante avec le bras", m);

m = true;
for (let c = 1; c <= 6; c++) for (let t = 1; t <= 6; t++)
  if (TABLE_B[c][t][1] > TABLE_B[c][t][2]) m = false;
vrai("table B croissante avec les jambes", m);

m = true;
for (let c = 1; c <= 6; c++) for (let t = 1; t <= 5; t++) for (let j = 1; j <= 2; j++)
  if (TABLE_B[c][t][j] > TABLE_B[c][t + 1][j]) m = false;
vrai("table B croissante avec le tronc", m);

m = true;
for (let c = 1; c <= 5; c++) for (let t = 1; t <= 6; t++) for (let j = 1; j <= 2; j++)
  if (TABLE_B[c][t][j] > TABLE_B[c + 1][t][j]) m = false;
vrai("table B croissante avec le cou", m);

m = true;
for (let c = 1; c <= 8; c++) for (let d = 1; d <= 6; d++)
  if (TABLE_C[c][d] > TABLE_C[c][d + 1]) m = false;
vrai("table C croissante avec D", m);

m = true;
for (let c = 1; c <= 7; c++) for (let d = 1; d <= 7; d++)
  if (TABLE_C[c][d] > TABLE_C[c + 1][d]) m = false;
vrai("table C croissante avec C", m);

vrai("table C bornée 1..7", TABLE_C.slice(1).every(r => r.slice(1).every(v => v >= 1 && v <= 7)));
vrai("table A bornée 1..9",
  TABLE_A.slice(1).every(b => b.slice(1).every(a => a.slice(1).every(p => p.slice(1).every(v => v >= 1 && v <= 9)))));

console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
