/* Contrôle géométrique des pictogrammes, sur les 228 cas.
   L'œil ne repère pas un débordement de deux unités ni un recouvrement à 30 %
   répété sur cent images. Ces invariants-là se mesurent :

     1. aucune étiquette ne sort du viewBox ;
     2. aucune étiquette n'en recouvre une autre ;
     3. le repère de la mesure reste dans le cadre.

   node tests/verifier-picto.mjs [module]  →  code de sortie 1 si un cas échoue. */

const { default: playwright } = await import(
  process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.js");
const { chromium } = playwright;

const module_ = process.argv[2] || "../js/picto.js";
const { pictogramme, BANDES } = await import(
  module_.startsWith(".") ? new URL(module_, import.meta.url).href : module_);

const MARGE = 1;          // tolérance de débordement, en unités du viewBox
const RECOUVREMENT = 4;   // aire de recouvrement tolérée, en unités²

import { casDeBandes } from "./cas-picto.mjs";
const CAS = casDeBandes(BANDES);

const b = await chromium.launch();
const p = await b.newPage();
await p.setContent("<!doctype html><meta charset='utf-8'><div id='h'></div>");

const echecs = [];
for (const c of CAS) {
  const svg = pictogramme(c.cle, c.methode, c.v, c.max, { base: c.base, cote: c.cote });
  if (!svg) { echecs.push({ ...c, quoi: "vide", detail: "pictogramme() n'a rien rendu" }); continue; }

  const r = await p.evaluate(({ svg, MARGE, RECOUVREMENT }) => {
    document.getElementById("h").innerHTML = svg;
    const s = document.querySelector("#h svg");
    const [, , L, H] = s.getAttribute("viewBox").split(/\s+/).map(Number);

    /* Le cartouche est un couple rect + text : on les fusionne, sinon le rect
       compte comme une étiquette de plus et chaque cartouche se signale comme
       recouvrant son propre texte. */
    const boites = [];
    for (const t of s.querySelectorAll("text")) {
      const g = t.getBBox();
      boites.push({ t: (t.textContent || "").trim(),
                    x1: g.x, y1: g.y, x2: g.x + g.width, y2: g.y + g.height });
    }
    for (const rc of s.querySelectorAll("rect")) {
      const g = rc.getBBox();
      const b = { t: "«cadre»", x1: g.x, y1: g.y, x2: g.x + g.width, y2: g.y + g.height };
      const dedans = boites.find(o => o.x1 >= b.x1 - 2 && o.x2 <= b.x2 + 2 &&
                                      o.y1 >= b.y1 - 2 && o.y2 <= b.y2 + 2);
      if (dedans) { dedans.x1 = Math.min(dedans.x1, b.x1); dedans.y1 = Math.min(dedans.y1, b.y1);
                    dedans.x2 = Math.max(dedans.x2, b.x2); dedans.y2 = Math.max(dedans.y2, b.y2); }
      else boites.push(b);
    }

    const dehors = boites.filter(o =>
      o.x1 < -MARGE || o.y1 < -MARGE || o.x2 > L + MARGE || o.y2 > H + MARGE)
      .map(o => `« ${o.t} » à [${o.x1.toFixed(0)},${o.y1.toFixed(0)}]-[${o.x2.toFixed(0)},${o.y2.toFixed(0)}] hors de ${L}×${H}`);

    /* Un texte posé sur le corps : on échantillonne sa boîte et on demande à
       chaque pièce du corps si elle contient le point, dans son propre repère. */
    const surCorps = [];
    const pieces = [...s.querySelectorAll(".corps path, .corps circle")];
    const svgPt = (x, y) => { const q = s.createSVGPoint(); q.x = x; q.y = y; return q; };
    for (const t of s.querySelectorAll("text")) {
      const g = t.getBBox();
      const ctmT = t.getCTM();
      let touche = 0, total = 0;
      for (let u = 0.1; u <= 0.9; u += 0.2) for (let w = 0.15; w <= 0.85; w += 0.35) {
        const pt = svgPt(g.x + g.width * u, g.y + g.height * w).matrixTransform(ctmT);
        total++;
        for (const el of pieces) {
          const loc = pt.matrixTransform(el.getCTM().inverse());
          const dedans = el.isPointInFill(loc) ||
            (el.getAttribute("stroke") && el.getAttribute("stroke") !== "none" && el.isPointInStroke(loc));
          if (dedans) { touche++; break; }
        }
      }
      if (touche) surCorps.push(`« ${(t.textContent || "").trim()} » sur le corps (${touche}/${total} points)`);
    }

    const chocs = [];
    for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
      const a = boites[i], o = boites[j];
      const w = Math.min(a.x2, o.x2) - Math.max(a.x1, o.x1);
      const h = Math.min(a.y2, o.y2) - Math.max(a.y1, o.y1);
      if (w > 0 && h > 0 && w * h > RECOUVREMENT)
        chocs.push(`« ${a.t} » ∩ « ${o.t} » = ${(w * h).toFixed(0)} u²`);
    }
    return { dehors, chocs, surCorps, n: boites.length };
  }, { svg, MARGE, RECOUVREMENT });

  for (const d of r.dehors) echecs.push({ ...c, quoi: "hors-cadre", detail: d });
  for (const d of r.chocs)  echecs.push({ ...c, quoi: "recouvrement", detail: d });
  for (const d of r.surCorps) echecs.push({ ...c, quoi: "sur-le-corps", detail: d });
}
await b.close();

const parType = {};
for (const e of echecs) parType[e.quoi] = (parType[e.quoi] || 0) + 1;
const casKO = new Set(echecs.map(e => `${e.methode}-${e.cle}-${e.v}`)).size;

console.log(`${CAS.length} cas contrôlés · ${casKO} en défaut · ${echecs.length} manquements`);
for (const [k, n] of Object.entries(parType)) console.log(`  ${k} : ${n}`);
for (const e of echecs.slice(0, 25))
  console.log(`  ${e.methode}/${e.cle} à ${e.v}° — ${e.quoi} : ${e.detail}`);
if (echecs.length > 25) console.log(`  … et ${echecs.length - 25} autres`);
process.exit(echecs.length ? 1 : 0);
