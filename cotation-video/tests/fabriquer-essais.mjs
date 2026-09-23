#!/usr/bin/env node
/* ============================================================================
   fabriquer-essais.mjs — Les deux fichiers d'essai de verifier-hors-ligne.mjs

   Ils sont tirés d'une image du site, images/posture_p1.webp : deux travailleurs
   de profil, l'un qui garde la caisse contre lui (« Protège »), l'autre qui la
   porte bras tendus (« À éviter »). Aucun enregistrement de personne réelle.

   - posture-essai.jpg  : le premier travailleur, agrandi trois fois ;
   - levage-essai.webm  : 3 s en VP8 à 12 images/s — le premier travailleur,
     puis le second, puis le premier : un cycle dont le score monte et redescend,
     de quoi vérifier la synthèse d'une vidéo, pas seulement une image.

   Le résultat est versionné : ce script ne sert qu'à le refaire, ou à le
   modifier. Il faut Playwright (Chromium, qui découpe et encode les images) et
   un ffmpeg avec VP8 — celui que Playwright installe avec Chromium convient.

     NODE_PATH="$(npm root -g)" node cotation-video/tests/fabriquer-essais.mjs
   ============================================================================ */
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, writeFileSync, statSync } from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
const SORTIE = fileURLToPath(new URL("./", import.meta.url));
const SOURCE = path.join(RACINE, "images/posture_p1.webp");

/* Les deux silhouettes dans l'image source (960 × 462), en pixels. */
const PROTEGE = { x: 25, y: 55, l: 250, h: 320 };
const A_EVITER = { x: 520, y: 55, l: 250, h: 320 };
const PHOTO = { zone: { x: 35, y: 55, l: 230, h: 320 }, echelle: 3 };
const VIDEO = { echelle: 2, ips: 12, sequence: [[PROTEGE, 12], [A_EVITER, 12], [PROTEGE, 12]] };

function chargerPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require("playwright"); } catch (_) {}
  return require(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"));
}

function trouverFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { execSync("ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libvpx", { stdio: "ignore" }); return "ffmpeg"; } catch (_) {}
  const dossiers = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), ".cache/ms-playwright")].filter(Boolean);
  for (const d of dossiers) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter(n => n.startsWith("ffmpeg")).sort().reverse()) {
      for (const bin of ["ffmpeg-linux", "ffmpeg-mac", "ffmpeg-win64.exe"]) {
        if (existsSync(path.join(d, f, bin))) return path.join(d, f, bin);
      }
    }
  }
  throw new Error("ffmpeg introuvable : installez Chromium avec Playwright, ou indiquez FFMPEG=/chemin/vers/ffmpeg");
}

const { chromium } = chargerPlaywright();
const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto(pathToFileURL(SOURCE).href);
await page.waitForFunction(() => document.querySelector("img")?.complete);

/** Découpe une zone de l'image source, l'agrandit, et la rend en JPEG. */
const decouper = (zone, echelle, qualite = 0.9) => page.evaluate(async ({ zone, echelle, qualite }) => {
  const img = document.querySelector("img"); await img.decode();
  const c = document.createElement("canvas");
  c.width = zone.l * echelle; c.height = zone.h * echelle;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, zone.x, zone.y, zone.l, zone.h, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", qualite).split(",")[1];
}, { zone, echelle, qualite }).then(b64 => Buffer.from(b64, "base64"));

const photo = path.join(SORTIE, "posture-essai.jpg");
writeFileSync(photo, await decouper(PHOTO.zone, PHOTO.echelle));

const images = [];
for (const [zone, nombre] of VIDEO.sequence) {
  const jpeg = await decouper(zone, VIDEO.echelle, 0.95);
  for (let i = 0; i < nombre; i++) images.push(jpeg);
}
await navigateur.close();

const video = path.join(SORTIE, "levage-essai.webm");
const ffmpeg = trouverFfmpeg();
await new Promise((resolve, reject) => {
  const p = spawn(ffmpeg, ["-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(VIDEO.ips), "-c:v", "mjpeg", "-i", "pipe:0",
    "-an", "-c:v", "vp8", "-b:v", "800k", "-crf", "10", "-qmin", "4", "-qmax", "40", "-pix_fmt", "yuv420p",
    video], { stdio: ["pipe", "inherit", "inherit"] });
  p.on("error", reject);
  p.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg a échoué (code ${code})`)));
  for (const img of images) p.stdin.write(img);
  p.stdin.end();
});

console.log(`${path.relative(RACINE, photo)} : ${statSync(photo).size} octets`);
console.log(`${path.relative(RACINE, video)} : ${statSync(video).size} octets, ${images.length} images à ${VIDEO.ips}/s (${ffmpeg})`);
