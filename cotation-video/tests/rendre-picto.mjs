/* Rend les pictogrammes en PNG pour qu'on puisse les regarder. Un pictogramme
   ne se relit pas dans le code : il se juge à l'œil.

   node tests/rendre-picto.mjs [module] [dossier]
   Le module par défaut est ../js/picto.js ; en passer un autre permet de
   comparer une variante sans toucher à l'application. */

/* playwright est en CommonJS : import par défaut, pas d'export nommé. */
const { default: playwright } = await import(
  process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.js");
const { chromium } = playwright;
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const module_ = process.argv[2] || "../js/picto.js";
const dossier = resolve(process.argv[3] || "/tmp/picto");
const { pictogramme, BANDES } = await import(module_.startsWith(".")
  ? new URL(module_, import.meta.url).href : module_);

import { casDeBandes } from "./cas-picto.mjs";
const CAS = casDeBandes(BANDES);

const css = await (await import("node:fs/promises")).readFile(
  new URL("../css/app.css", import.meta.url), "utf-8");

const page = (svg, titre) => `<!doctype html><meta charset="utf-8"><style>${css}
  body{margin:0;background:var(--carte);display:flex;flex-direction:column;align-items:center;
       width:340px;font-family:system-ui,sans-serif}
  .t{color:var(--texte);font-size:12px;padding:6px 0 0}
  .picto{max-width:19rem}</style>
  <div class="t">${titre}</div>${svg}`;

await mkdir(dossier, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 340, height: 300 }, deviceScaleFactor: 2 });
const index = [];
for (const c of CAS) {
  const svg = pictogramme(c.cle, c.methode, c.v, c.max, { base: c.base, cote: c.cote });
  if (!svg) { console.log("VIDE", c); continue; }
  const nom = `${c.methode}-${c.cle}-${String(c.v).replace("-", "m")}.png`;
  await p.setContent(page(svg, `${c.methode.toUpperCase()} · ${c.cle} · ${c.v}°`));
  await p.waitForTimeout(20);
  const el = await p.$("body");
  await el.screenshot({ path: `${dossier}/${nom}` });
  index.push(nom);
}
/* Une planche de contact : tout voir d'un coup vaut mieux que cent fichiers. */
await writeFile(`${dossier}/planche.html`,
  `<!doctype html><meta charset="utf-8"><title>Planche des pictogrammes</title>
   <style>body{background:#0a0e17;margin:0;padding:8px;display:flex;flex-wrap:wrap;gap:6px}
   img{width:220px}</style>` + index.map(n => `<img src="${n}">`).join(""));
await b.close();
console.log(`${index.length} pictogrammes → ${dossier}  (planche.html pour tout voir)`);
