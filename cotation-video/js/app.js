/* ============================================================================
   app.js — Orchestration de l'interface

   Ne contient aucune règle de cotation : tout vient de reba.js et angles.js.
   Son travail est de brancher un fichier, une timeline et des champs de
   saisie sur ces modules, puis d'afficher le résultat.
   ============================================================================ */

import { analyserVideo, analyserImage, coter, recoter } from "./analyse.js";
import { sequenceDemo, PARAMS_DEMO } from "./demo.js";
import { NIVEAUX, ETIQUETTES_SEVERITE, severiteSegment } from "./reba.js";
import { dessinerSquelette, dessinerJauge, dessinerChronologie,
         imageALInstant, COULEURS, COULEURS_NIVEAU } from "./rendu.js";
import { sourceActive } from "./pose.js";

const $ = s => document.querySelector(s);
const el = {
  fichier: $("#fichier"), video: $("#video"), photo: $("#photo"), calque: $("#calque"),
  scene: $("#scene"), etatVide: $("#etatVide"),
  progres: $("#progres"), progresJauge: $("#progresJauge"), progresTexte: $("#progresTexte"),
  annuler: $("#annuler"), lecture: $("#lecture"), allerPire: $("#allerPire"), tCourant: $("#tCourant"),
  chrono: $("#chrono"), chronoLegende: $("#chronoLegende"), noteChrono: $("#noteChrono"),
  jauge: $(".jauge"), niveauLibelle: $("#niveauLibelle"), niveauAction: $("#niveauAction"),
  corpsSegments: $("#corpsSegments"), calcul: $("#calcul"),
  stats: $("#stats"), barres: $("#barres"), conclusion: $("#conclusion"),
  badgeMoteur: $("#badgeMoteur"),
  exportJson: $("#exportJson"), imprimer: $("#imprimer")
};

const etat = {
  analyse: null,
  mode: "demo",            // 'demo' | 'video' | 'image'
  t: 0,
  lecture: false,
  abandon: null,
  horlogeDemo: null
};

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
  $("#fpsVal").textContent = $("#fps").value;
  $("#lissageVal").textContent = $("#lissage").value === "0" ? "aucun" : $("#lissage").value;
}

/* ---------- Rendu ---------- */

function dimensionnerCalque() {
  const src = etat.mode === "image" ? el.photo : el.video;
  const boite = el.scene.getBoundingClientRect();
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

function dessinerInstant(t) {
  if (!etat.analyse) return;
  const image = imageALInstant(etat.analyse, t);
  if (!image) return;
  const { ctx, largeur, hauteur } = dimensionnerCalque();
  ctx.clearRect(0, 0, largeur, hauteur);
  dessinerSquelette(ctx, image, { largeur, hauteur });
  majPanneau(image);
  el.tCourant.textContent = t.toFixed(1).replace(".", ",");
  dessinerChronologie(el.chrono, etat.analyse, { curseur: t });
}

const LIGNES = [
  { cle: "tronc",     nom: "Tronc",       angle: a => a.tronc.flexion,        unite: "° flexion" },
  { cle: "cou",       nom: "Cou",         angle: a => a.cou.flexion,          unite: "° flexion" },
  { cle: "jambes",    nom: "Jambes",      angle: a => a.jambes.flexionGenou,  unite: "° genou" },
  { cle: "bras",      nom: "Bras",        angle: a => a.bras.flexionBras,     unite: "° élévation" },
  { cle: "avantBras", nom: "Avant-bras",  angle: a => a.bras.flexionCoude,    unite: "° coude" },
  { cle: "poignet",   nom: "Poignet",     angle: a => a.bras.flexionPoignet,  unite: "° flexion" }
];

function majPanneau(image) {
  const r = image.resultat;
  dessinerJauge(el.jauge, r.reba, r.risque);
  el.niveauLibelle.textContent = `${r.risque.libelle} — niveau ${r.risque.niveau}`;
  el.niveauLibelle.style.color = COULEURS_NIVEAU[r.risque.couleur];
  el.niveauAction.textContent = r.risque.action;

  el.corpsSegments.innerHTML = LIGNES.map(l => {
    const cote = r.segments[l.cle].cote;
    const sev = severiteSegment(l.cle, cote);
    const val = l.angle(image.angles);
    return `<tr>
      <td>${l.nom}</td>
      <td class="num">${Number.isFinite(val) ? Math.round(val) : "—"}${l.unite ? `<span class="discret"> ${l.unite.replace("° ", "° ")}</span>` : ""}</td>
      <td class="cote">${cote}</td>
      <td><span class="etat"><i style="background:${COULEURS[sev]}"></i>${ETIQUETTES_SEVERITE[sev]}</span></td>
    </tr>`;
  }).join("");

  const a = r.segments;
  el.calcul.innerHTML =
    `Table A ${r.tableA} + charge ${a.charge.cote} = <b>A ${r.scoreA}</b> · ` +
    `Table B ${r.tableB} + prise ${a.prise.cote} = <b>B ${r.scoreB}</b> · ` +
    `Table C <b>${r.scoreC}</b> + activité ${r.activite.cote} = <b>REBA ${r.reba}</b>` +
    (image.fiable ? "" : ` · <span style="color:${COULEURS[2]}">repères peu visibles</span>`);
}

function majSynthese() {
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
  el.progresJauge.style.width = "0%";

  const params = lireParams();
  try {
    if (f.type.startsWith("image/")) {
      etat.mode = "image";
      el.video.hidden = true; el.photo.hidden = false; el.photo.src = url;
      await el.photo.decode();
      el.progresTexte.textContent = "Analyse de l'image…";
      etat.analyse = await analyserImage(el.photo, params, { onEtat: t => t && (el.progresTexte.textContent = t) });
    } else {
      etat.mode = "video";
      el.photo.hidden = true; el.video.hidden = false; el.video.src = url;
      etat.analyse = await analyserVideo(el.video, params, {
        signal: etat.abandon.signal,
        onEtat: t => t && (el.progresTexte.textContent = t),
        onProgres: (p, n) => {
          el.progresJauge.style.width = `${Math.round(p * 100)}%`;
          el.progresTexte.textContent = `Analyse… ${Math.round(p * 100)} % · ${n} images`;
        }
      });
      el.video.currentTime = 0;
      el.lecture.disabled = false;
    }
    el.badgeMoteur.textContent = `Moteur : ${sourceActive() || "chargé"}`;
    if (!etat.analyse?.images.length) {
      el.progresTexte.textContent = "Aucune personne détectée dans ce fichier.";
      setTimeout(() => el.progres.hidden = true, 3200);
      return;
    }
    el.progres.hidden = true;
    etat.t = 0;
    majSynthese();
    dessinerInstant(0);
  } catch (e) {
    console.error(e);
    el.progresTexte.textContent = `Échec : ${e.message}`;
    el.annuler.textContent = "Fermer";
  }
}

/* ---------- Démonstration ---------- */

function chargerDemo() {
  etat.mode = "demo";
  etat.analyse = coter(sequenceDemo(), PARAMS_DEMO);
  appliquerParamsAuFormulaire(PARAMS_DEMO);
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

el.video.addEventListener("timeupdate", () => {
  if (etat.mode === "video" && etat.analyse) { etat.t = el.video.currentTime; dessinerInstant(etat.t); }
});
el.video.addEventListener("loadedmetadata", () => dimensionnerCalque());

/* Recotation immédiate quand un paramètre non observable change : c'est la
   réponse à « et si la caisse pesait 15 kg ? », sans relancer la détection. */
for (const id of ["charge", "prise", "statique", "repete", "instable", "brusque", "cote", "lissage"]) {
  $("#" + id).addEventListener("input", () => {
    majSorties();
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
    methode: "REBA — Hignett & McAtamney, Applied Ergonomics 31 (2000)",
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
      t: +i.t.toFixed(3), reba: i.resultat.reba, niveau: i.resultat.risque.niveau,
      A: i.resultat.scoreA, B: i.resultat.scoreB, C: i.resultat.scoreC,
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
  a.download = `cotation-reba-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

el.imprimer.addEventListener("click", () => window.print());
window.addEventListener("resize", () => etat.analyse && dessinerInstant(etat.t));

majSorties();
chargerDemo();
