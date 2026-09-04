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
import { dessinerHauteurMains } from "./rendu.js";
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
  el.tCourant.textContent = t.toFixed(1).replace(".", ",");
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
      /* Sans cette remise à zéro, la cote de la démonstration resterait
         affichée par-dessus le fichier de l'utilisateur : un résultat simulé
         passerait pour une mesure. */
      etat.analyse = null;
      const c = dimensionnerCalque();
      c.ctx.clearRect(0, 0, c.largeur, c.hauteur);
      viderPanneau();
      el.progresTexte.textContent =
        "Aucune personne détectée. Cadrage trop serré, sujet coupé ou trop petit dans l'image ?";
      el.annuler.textContent = "Fermer";
      return;
    }
    el.progres.hidden = true;
    etat.t = 0;
    majAvis();
    majSynthese();
    dessinerInstant(0);
  } catch (e) {
    console.error(e);
    /* On efface tout : laisser le squelette et la cote de la démonstration
       par-dessus la photo de l'utilisateur ferait passer un résultat simulé
       pour une mesure. */
    etat.analyse = null;
    const { ctx, largeur, hauteur } = dimensionnerCalque();
    ctx.clearRect(0, 0, largeur, hauteur);
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
  el.lecture.disabled = true;
  majSynthese();
}

/* ---------- Démonstration ---------- */

function chargerDemo() {
  etat.mode = "demo";
  etat.analyse = coter(sequenceDemo(), PARAMS_DEMO);
  appliquerParamsAuFormulaire(PARAMS_DEMO);
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

function majPanneauNiosh() {
  if (!etat.analyse) return;
  const r = lireReperes();
  const res = calculerNIOSH({
    origine: r.origine, destination: r.destination,
    controleDestination: $("#controleDestination").checked,
    poids: +$("#poidsCharge").value,
    frequence: +$("#frequence").value,
    duree: $("#dureeTache").value,
    prise: $("#priseNiosh").value
  });

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
    if (levage && !etat.niosh.origine) proposerLevage();
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

el.video.addEventListener("timeupdate", () => {
  if (etat.mode === "video" && etat.analyse) { etat.t = el.video.currentTime; dessinerInstant(etat.t); }
});
el.video.addEventListener("loadedmetadata", () => dimensionnerCalque());

/* Recotation immédiate quand un paramètre non observable change : c'est la
   réponse à « et si la caisse pesait 15 kg ? », sans relancer la détection. */
for (const id of ["charge", "prise", "statique", "repete", "instable", "brusque",
                  "cote", "jambesManuel", "pronosupination", "lissage"]) {
  $("#" + id).addEventListener("input", () => {
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
  $("#" + id).addEventListener("input", () => { majSorties(); majPanneauNiosh(); });
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

el.imprimer.addEventListener("click", () => window.print());
window.addEventListener("resize", () => etat.analyse && dessinerInstant(etat.t));

majSorties();
choisirMethode("reba");
chargerDemo();
