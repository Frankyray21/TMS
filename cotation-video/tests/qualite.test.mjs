import test from "node:test";
import assert from "node:assert/strict";
import { decrireQualite } from "../js/qualite.js";

const observation = (modifications = {}) => ({
  fiable: true,
  avertissements: [],
  angles: {
    cote: "D", jambesObservables: true,
    fiabilite: { visibilite: { tronc: 0.9, cou: 0.9, brasG: 0.9, brasD: 0.9, jambes: 0.9 } }
  },
  ...modifications
});
const segment = (qualite, cle) => qualite.segments.find(s => s.cle === cle);

test("sans observation, aucune qualité de détection n'est annoncée", () => {
  const q = decrireQualite(null);
  assert.equal(q.etat, "attente");
  assert.equal(q.cote, null);
  assert.ok(q.segments.every(s => s.etat === "inconnu"));
});

test("la démonstration reste explicitement simulée même avec des repères visibles", () => {
  const q = decrireQualite(observation(), { demo: true });
  assert.equal(q.etat, "demo");
  assert.equal(q.titre, "Postures simulées");
  assert.ok(q.segments.every(s => s.etat === "simule"));
  assert.match(q.description, /scores sont simulés/);
});

test("le bras choisi est vérifié même quand l'autre suffit au filtre de synthèse", () => {
  const image = observation();
  image.angles.fiabilite.visibilite.brasD = 0.2;
  const q = decrireQualite(image);
  assert.equal(image.fiable, true);
  assert.equal(q.etat, "a_verifier");
  assert.equal(segment(q, "bras").libelle, "Bras droit");
  assert.equal(segment(q, "bras").etat, "a_verifier");
  image.angles.cote = "G";
  assert.equal(segment(decrireQualite(image), "bras").etat, "visible");
});

test("les jambes déclarées ne sont pas présentées comme des mesures", () => {
  const image = observation({ avertissements: ["jambes"] });
  image.angles.jambesObservables = false;
  const q = decrireQualite(image);
  assert.equal(segment(q, "jambes").etat, "declare");
  assert.match(segment(q, "jambes").detail, /déclarée/);
  assert.ok(q.avertissements.some(a => a.includes("position déclarée")));
});

test("une mesure forcée des jambes hors cadre reste à vérifier, pas déclarée", () => {
  const image = observation();
  image.angles.jambesObservables = false;
  assert.equal(segment(decrireQualite(image), "jambes").etat, "a_verifier");
});

test("le poignet reste approximatif et la visibilité n'atteste pas le score", () => {
  const q = decrireQualite(observation());
  assert.equal(q.etat, "visible");
  assert.equal(segment(q, "poignet").etat, "a_verifier");
  assert.match(segment(q, "poignet").detail, /approximatif/);
  assert.match(q.description, /ne garantit/);
  assert.ok(!JSON.stringify(q).includes("%"));
});

test("un côté absent ou un cou masqué restent signalés malgré le filtre global", () => {
  const image = observation();
  image.angles.cote = null;
  image.angles.fiabilite.visibilite.cou = 0.2;
  const q = decrireQualite(image);
  assert.equal(segment(q, "bras").etat, "a_verifier");
  assert.equal(segment(q, "cou").etat, "a_verifier");
});

test("le seuil suit l'option fournie sans modifier l'observation", () => {
  const image = observation();
  const avant = JSON.stringify(image);
  assert.equal(decrireQualite(image, { seuil: 0.95 }).etat, "a_verifier");
  assert.equal(decrireQualite(image, { seuil: 0.9 }).etat, "visible");
  assert.equal(JSON.stringify(image), avant);
});
