/* ============================================================================
   rendu.js — Dessin du squelette, de la jauge et de la chronologie

   Règle qui traverse tout le fichier : la couleur ne voyage jamais seule.
   L'échelle vert-jaune-orange-rouge est indiscernable pour une partie des
   daltoniens (l'écart orange/jaune tombe à ΔE 0,6 en deutéranopie), donc
   chaque élément coloré porte aussi son chiffre ou son nom.
   ============================================================================ */

import { severiteSegment, ETIQUETTES_SEVERITE, NIVEAUX } from "./reba.js";
import { P } from "./angles.js";

/* Les quatre teintes de sévérité, et les cinq du niveau REBA. */
export const COULEURS = ["#16a34a", "#eab308", "#f97316", "#dc2626"];
export const COULEURS_NIVEAU = { vert: "#16a34a", jaune: "#eab308", orange: "#f97316", rouge: "#dc2626" };

/* Les os dessinés, chacun rattaché au segment REBA qui le cote. */
const OS = [
  [P.EPAULE_G, P.EPAULE_D, "tronc"], [P.HANCHE_G, P.HANCHE_D, "tronc"],
  [P.EPAULE_G, P.HANCHE_G, "tronc"], [P.EPAULE_D, P.HANCHE_D, "tronc"],
  [P.EPAULE_G, P.COUDE_G, "brasG"], [P.COUDE_G, P.POIGNET_G, "avantBrasG"],
  [P.EPAULE_D, P.COUDE_D, "brasD"], [P.COUDE_D, P.POIGNET_D, "avantBrasD"],
  [P.POIGNET_G, P.INDEX_G, "poignetG"], [P.POIGNET_D, P.INDEX_D, "poignetD"],
  [P.HANCHE_G, P.GENOU_G, "jambes"], [P.GENOU_G, P.CHEVILLE_G, "jambes"],
  [P.HANCHE_D, P.GENOU_D, "jambes"], [P.GENOU_D, P.CHEVILLE_D, "jambes"],
  [P.CHEVILLE_G, P.PIED_G, "jambes"], [P.CHEVILLE_D, P.PIED_D, "jambes"]
];

/** Le segment REBA qui donne sa couleur à chaque os. */
function severiteDesOs(image) {
  const s = image.resultat.segments;
  const cote = image.angles.cote;                 // côté effectivement coté
  const sev = (nom, c) => severiteSegment(nom, c);
  const brasSev = sev("bras", s.bras.cote);
  const avantSev = sev("avantBras", s.avantBras.cote);
  const poignetSev = sev("poignet", s.poignet.cote);
  /* Le côté non coté est dessiné en gris : REBA ne le note pas, l'afficher
     coloré laisserait croire à une mesure qui n'a pas été faite. */
  const autre = null;
  return {
    tronc: sev("tronc", s.tronc.cote),
    jambes: sev("jambes", s.jambes.cote),
    cou: sev("cou", s.cou.cote),
    brasG: cote === "G" ? brasSev : autre, brasD: cote === "D" ? brasSev : autre,
    avantBrasG: cote === "G" ? avantSev : autre, avantBrasD: cote === "D" ? avantSev : autre,
    poignetG: cote === "G" ? poignetSev : autre, poignetD: cote === "D" ? poignetSev : autre
  };
}

/**
 * Dessine le squelette sur un canvas déjà dimensionné à la vidéo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} image — une entrée de analyse.images
 */
export function dessinerSquelette(ctx, image, { largeur, hauteur, epaisseur = 1 } = {}) {
  if (!image?.ecran) return;
  const pts = image.ecran;
  const sev = severiteDesOs(image);
  const X = i => pts[i].x * largeur;
  const Y = i => pts[i].y * hauteur;
  const ep = Math.max(3, Math.min(largeur, hauteur) * 0.008) * epaisseur;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /* Cou : du milieu des épaules au milieu des oreilles. */
  const mx = (X(P.EPAULE_G) + X(P.EPAULE_D)) / 2, my = (Y(P.EPAULE_G) + Y(P.EPAULE_D)) / 2;
  const tx = (X(P.OREILLE_G) + X(P.OREILLE_D)) / 2, ty = (Y(P.OREILLE_G) + Y(P.OREILLE_D)) / 2;
  trait(ctx, mx, my, tx, ty, sev.cou, ep);

  for (const [a, b, nom] of OS) {
    if ((pts[a]?.visibility ?? 1) < 0.3 || (pts[b]?.visibility ?? 1) < 0.3) continue;
    trait(ctx, X(a), Y(a), X(b), Y(b), sev[nom], ep);
  }

  /* Articulations : un point blanc cerclé, lisible sur n'importe quel fond. */
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0,0,0,.55)";
  ctx.lineWidth = Math.max(1, ep * 0.22);
  for (const i of [P.EPAULE_G, P.EPAULE_D, P.COUDE_G, P.COUDE_D, P.POIGNET_G, P.POIGNET_D,
                   P.HANCHE_G, P.HANCHE_D, P.GENOU_G, P.GENOU_D, P.CHEVILLE_G, P.CHEVILLE_D]) {
    if ((pts[i]?.visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(X(i), Y(i), ep * 0.42, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
}

function trait(ctx, x1, y1, x2, y2, severite, ep) {
  /* Contour sombre : garde le trait lisible sur un fond clair comme sur un
     fond sombre, sans dépendre de la seule teinte. */
  ctx.strokeStyle = "rgba(0,0,0,.45)";
  ctx.lineWidth = ep + Math.max(2, ep * 0.5);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

  ctx.strokeStyle = severite === null ? "rgba(226,232,240,.55)" : COULEURS[severite];
  ctx.lineWidth = ep;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

/* ---------- Jauge ---------- */

/** Arc de progression + chiffre. Le chiffre est l'information ; l'arc l'illustre. */
export function dessinerJauge(svg, reba, risque) {
  const pct = Math.max(0, Math.min(1, (reba - 1) / 14));
  const arc = svg.querySelector(".jauge-arc");
  const val = svg.querySelector(".jauge-valeur");
  const circonference = 2 * Math.PI * 42;
  arc.style.strokeDasharray = `${pct * circonference} ${circonference}`;
  arc.style.stroke = COULEURS_NIVEAU[risque.couleur];
  val.textContent = reba;
  val.style.fill = COULEURS_NIVEAU[risque.couleur];
}

/* ---------- Chronologie ----------
   Une courbe du score dans le temps, sur les bandes des cinq niveaux REBA.
   C'est là que se lit ce qu'une cote isolée ne dit pas : combien de temps la
   posture reste en zone rouge, et où se situe le pire instant du cycle.
---------------------------------------------------------------------------- */

export function dessinerChronologie(canvas, analyse, { curseur = null } = {}) {
  const ctx = canvas.getContext("2d");
  const r = window.devicePixelRatio || 1;
  const L = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = L * r; canvas.height = H * r;
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, L, H);

  const images = analyse.images;
  if (!images.length) return;
  const tMax = Math.max(...images.map(i => i.t)) || 1;
  const x = t => (t / tMax) * (L - 2) + 1;
  const y = v => H - ((v - 1) / 14) * (H - 10) - 5;

  /* Bandes de niveau en fond, très discrètes. */
  for (const n of NIVEAUX) {
    ctx.fillStyle = COULEURS_NIVEAU[n.couleur] + "1f";
    const y1 = y(n.max + (n.max === 15 ? 0 : 0.5)), y2 = y(n.min - 0.5);
    ctx.fillRect(0, y1, L, Math.max(1, y2 - y1));
  }

  /* Aire sous la courbe, puis la courbe. */
  ctx.beginPath();
  ctx.moveTo(x(images[0].t), H);
  images.forEach(i => ctx.lineTo(x(i.t), y(i.resultat.reba)));
  ctx.lineTo(x(images[images.length - 1].t), H);
  ctx.closePath();
  ctx.fillStyle = "rgba(148,163,184,.18)";
  ctx.fill();

  ctx.beginPath();
  images.forEach((i, k) => k ? ctx.lineTo(x(i.t), y(i.resultat.reba)) : ctx.moveTo(x(i.t), y(i.resultat.reba)));
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 2;
  ctx.stroke();

  /* Les images écartées : marquées, jamais silencieusement effacées. */
  ctx.fillStyle = "rgba(100,116,139,.5)";
  images.forEach(i => { if (!i.fiable) ctx.fillRect(x(i.t) - 1, H - 4, 2, 4); });

  /* Le pire instant. */
  const pire = analyse.synthese?.pire;
  if (pire) {
    const px = x(pire.t), py = y(pire.reba);
    ctx.strokeStyle = COULEURS_NIVEAU[NIVEAUX.find(n => pire.reba >= n.min && pire.reba <= n.max).couleur];
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, H); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  /* Curseur de lecture. */
  if (curseur != null) {
    ctx.strokeStyle = "rgba(15,23,42,.85)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x(curseur), 0); ctx.lineTo(x(curseur), H); ctx.stroke();
  }
}

/** L'image analysée la plus proche d'un instant donné. */
export function imageALInstant(analyse, t) {
  if (!analyse?.images?.length) return null;
  let meilleure = analyse.images[0], ecart = Infinity;
  for (const i of analyse.images) {
    const d = Math.abs(i.t - t);
    if (d < ecart) { ecart = d; meilleure = i; }
  }
  return meilleure;
}

export { ETIQUETTES_SEVERITE };
