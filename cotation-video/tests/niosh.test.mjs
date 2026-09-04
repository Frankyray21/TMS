/* Vérification de l'équation révisée du NIOSH. `node tests/niosh.test.mjs`
   Les multiplicateurs sont des formules : on les vérifie aux bornes du domaine,
   là où la méthode bascule à zéro. La table des fréquences, elle, est recopiée
   à la main : on la contrôle par ses paliers et sa décroissance. */

import { calculerNIOSH, calculerPLR, CONSTANTE_CHARGE,
         multiplicateurH, multiplicateurV, multiplicateurD, multiplicateurA,
         multiplicateurF, multiplicateurC, niveauDeRisque } from "../js/niosh.js";

let ok = 0, ko = 0;
const proche = (nom, obtenu, attendu, tol = 0.005) => {
  if (Math.abs(obtenu - attendu) <= tol) ok++;
  else { ko++; console.error(`  ÉCHEC  ${nom} : obtenu ${obtenu}, attendu ${attendu}`); }
};
const eq = (nom, o, a) => o === a ? ok++ : (ko++, console.error(`  ÉCHEC  ${nom} : ${o} ≠ ${a}`));
const vrai = (nom, c) => c ? ok++ : (ko++, console.error(`  ÉCHEC  ${nom}`));

console.log("Multiplicateur horizontal");
proche("H = 20 cm (dans la zone)", multiplicateurH(20).valeur, 1);
proche("H = 25 cm (limite basse)", multiplicateurH(25).valeur, 1);
proche("H = 50 cm",                multiplicateurH(50).valeur, 0.5);
proche("H = 63 cm (limite haute)", multiplicateurH(63).valeur, 25 / 63);
proche("H = 64 cm : hors domaine", multiplicateurH(64).valeur, 0);
vrai("hors domaine motivé", !!multiplicateurH(70).motif);

console.log("Multiplicateur vertical");
proche("V = 75 cm (optimum)", multiplicateurV(75).valeur, 1);
proche("V = 0 cm (au sol)",   multiplicateurV(0).valeur, 0.775);
proche("V = 30 cm",           multiplicateurV(30).valeur, 0.865);
proche("V = 175 cm",          multiplicateurV(175).valeur, 0.70);
proche("V = 176 : hors domaine", multiplicateurV(176).valeur, 0);

console.log("Multiplicateur de déplacement");
proche("D = 10 cm (sous le seuil)", multiplicateurD(10).valeur, 1);
proche("D = 25 cm (continuité)",    multiplicateurD(25).valeur, 1);
proche("D = 55 cm",                 multiplicateurD(55).valeur, 0.82 + 4.5 / 55);
proche("D = 175 cm",                multiplicateurD(175).valeur, 0.82 + 4.5 / 175);
proche("D = 176 : hors domaine",    multiplicateurD(176).valeur, 0);

console.log("Multiplicateur d'asymétrie");
proche("A = 0°",   multiplicateurA(0).valeur, 1);
proche("A = 45°",  multiplicateurA(45).valeur, 0.856);
proche("A = 135°", multiplicateurA(135).valeur, 0.568);
proche("A = 136° : hors domaine", multiplicateurA(136).valeur, 0);

console.log("Multiplicateur de fréquence");
proche("0,2/min · ≤1 h",        multiplicateurF(0.2, "courte", 50).valeur, 1.00);
proche("3/min · >2–8 h · bas",  multiplicateurF(3, "longue", 20).valeur, 0.55);
proche("3/min · ≤1 h",          multiplicateurF(3, "courte", 20).valeur, 0.88);
proche("9/min · >2–8 h · bas",  multiplicateurF(9, "longue", 20).valeur, 0.00);
proche("9/min · >2–8 h · haut", multiplicateurF(9, "longue", 100).valeur, 0.15);
proche("13/min · ≤1 h · haut",  multiplicateurF(13, "courte", 100).valeur, 0.34);
proche("13/min · ≤1 h · bas",   multiplicateurF(13, "courte", 40).valeur, 0.00);
proche("16/min : hors domaine", multiplicateurF(16, "courte", 75).valeur, 0);
eq("palier retenu pour 2,5/min", multiplicateurF(2.5, "courte", 50).palier, 3);
eq("palier retenu pour 3/min",   multiplicateurF(3, "courte", 50).palier, 3);
proche("fréquence nulle → 1",    multiplicateurF(0, "courte", 50).valeur, 1);

let decroit = true;
for (const d of ["courte", "moyenne", "longue"])
  for (const v of [40, 100]) {
    let prec = Infinity;
    for (const f of [0.2, 0.5, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const x = multiplicateurF(f, d, v).valeur;
      if (x > prec) decroit = false;
      prec = x;
    }
  }
vrai("table des fréquences décroissante", decroit);

console.log("Multiplicateur de prise");
proche("bonne, en bas",     multiplicateurC("bonne", 40).valeur, 1.00);
proche("correcte, en bas",  multiplicateurC("correcte", 40).valeur, 0.95);
proche("correcte, en haut", multiplicateurC("correcte", 100).valeur, 1.00);
proche("mauvaise, en bas",  multiplicateurC("mauvaise", 40).valeur, 0.90);
proche("mauvaise, en haut", multiplicateurC("mauvaise", 100).valeur, 0.90);

console.log("Cas complets");
const ideal = calculerNIOSH({
  origine: { H: 25, V: 75, A: 0 }, destination: { H: 25, V: 75, A: 0 },
  poids: 23, frequence: 0.2, duree: "courte", prise: "bonne"
});
proche("cas idéal → PLR = constante", ideal.plr, CONSTANTE_CHARGE);
proche("cas idéal → IL = 1", ideal.il, 1);
eq("cas idéal → niveau", ideal.risque.niveau, 1);

/* Levage au sol, loin du corps, en torsion, répété toute la journée, sans prise :
   HM 25/50 = 0,5 · VM 1−0,003×55 = 0,835 · DM 0,82+4,5/55 = 0,9018
   AM 1−0,0032×45 = 0,856 · FM (3/min, >2–8 h, V<75) = 0,55 · CM (mauvaise) = 0,90
   → PLR = 23 × 0,5 × 0,835 × 0,9018 × 0,856 × 0,55 × 0,90 ≈ 3,67 kg */
const penible = calculerNIOSH({
  origine: { H: 50, V: 20, A: 45 }, destination: { H: 40, V: 75, A: 45 },
  poids: 15, frequence: 3, duree: "longue", prise: "mauvaise"
});
proche("levage pénible → D", penible.D, 55);
proche("levage pénible → PLR", penible.plr, 3.669, 0.02);
proche("levage pénible → IL", penible.il, 15 / 3.669, 0.02);
eq("levage pénible → niveau", penible.risque.niveau, 4);
eq("multiplicateur le plus pénalisant", penible.pire.nom, "HM");

/* Hors domaine : la charge est trop loin du corps, la méthode ne s'applique plus. */
const loin = calculerNIOSH({
  origine: { H: 70, V: 40, A: 0 }, poids: 10, frequence: 1, duree: "courte", prise: "bonne"
});
proche("hors domaine → PLR nul", loin.plr, 0);
vrai("hors domaine → IL infini", !Number.isFinite(loin.il));
vrai("hors domaine → motif rapporté", loin.horsDomaine.some(x => x.nom === "HM"));
eq("hors domaine → niveau maximal", loin.risque.niveau, 4);

/* Quand la dépose est plus contraignante que la saisie, c'est elle qui gouverne. */
const depose = calculerNIOSH({
  origine: { H: 30, V: 75, A: 0 },
  destination: { H: 60, V: 160, A: 60 },
  controleDestination: true,
  poids: 10, frequence: 1, duree: "courte", prise: "bonne"
});
eq("la destination gouverne", depose.gouverne, "destination");
vrai("IL destination > IL origine", depose.destination.il > depose.origine.il);

const sansControle = calculerNIOSH({
  origine: { H: 30, V: 75, A: 0 }, destination: { H: 60, V: 160, A: 60 },
  poids: 10, frequence: 1, duree: "courte", prise: "bonne"
});
eq("sans contrôle à la dépose, l'origine gouverne", sansControle.gouverne, "origine");
vrai("destination non calculée", sansControle.destination === null);

console.log("Niveaux");
eq("IL 0,8 → acceptable",     niveauDeRisque(0.8).niveau, 1);
eq("IL 1,0 → acceptable",     niveauDeRisque(1.0).niveau, 1);
eq("IL 1,5 → risque accru",   niveauDeRisque(1.5).niveau, 2);
eq("IL 2,5 → risque élevé",   niveauDeRisque(2.5).niveau, 3);
eq("IL 6 → très élevé",       niveauDeRisque(6).niveau, 4);
eq("IL infini → très élevé",  niveauDeRisque(Infinity).niveau, 4);

console.log("Monotonie de la PLR");
const base = { V: 75, A: 0, D: 30, frequence: 1, duree: "courte", prise: "bonne" };
let m = true, prec = Infinity;
for (const H of [25, 30, 40, 50, 60, 63]) {
  const p = calculerPLR({ ...base, H }).plr;
  if (p > prec + 1e-9) m = false;
  prec = p;
}
vrai("la PLR décroît quand la charge s'éloigne", m);

m = true; prec = -Infinity;
for (const A of [135, 90, 45, 0]) {
  const p = calculerPLR({ ...base, H: 30, A }).plr;
  if (p < prec - 1e-9) m = false;
  prec = p;
}
vrai("la PLR croît quand la torsion diminue", m);

console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
