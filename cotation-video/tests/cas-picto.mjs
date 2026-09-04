/* Les cas d'épreuve des pictogrammes, partagés par le rendu et le contrôle.

   Chaque cas porte le maximum, la base et le score que la fonction de cotation
   RÉELLE donne pour cet angle — pas des valeurs posées à la main. Avec des
   maxima écrits en dur, le banc rendait des couleurs que l'application
   n'affiche jamais, et c'est ce qui avait laissé passer la couleur fausse
   des jambes. */

import * as reba from "../js/reba.js";
import * as rula from "../js/rula.js";

const COTE = {
  reba: {
    tronc:     v => reba.coteTronc({ flexion: v }),
    cou:       v => reba.coteCou({ flexion: v }),
    jambes:    v => reba.coteJambes({ flexionGenou: v }),
    bras:      v => reba.coteBras({ flexion: v }),
    avantBras: v => reba.coteAvantBras({ flexion: v }),
    poignet:   v => reba.cotePoignet({ flexion: v })
  },
  rula: {
    tronc:     v => rula.coteTronc({ flexion: v }),
    cou:       v => rula.coteCou({ flexion: v }),
    bras:      v => rula.coteBras({ flexion: v }),
    avantBras: v => rula.coteAvantBras({ flexion: v }),
    poignet:   v => rula.cotePoignet({ flexion: v })
  }
};

/** Les bornes de chaque bande, un degré de part et d'autre de chaque seuil,
    les milieux de bande, et le zéro. */
export function casDeBandes(BANDES) {
  const cas = [];
  for (const methode of ["reba", "rula"]) {
    for (const [cle, d] of Object.entries(BANDES[methode])) {
      const vals = new Set([d.min, d.max, 0]);
      for (const [a, b] of d.b) {
        for (const s of [a, b]) { vals.add(s - 1); vals.add(s); vals.add(s + 1); vals.add(s + 9); }
        vals.add(Math.round((a + b) / 2));
      }
      for (const v of [...vals].filter(v => v >= d.min && v <= d.max).sort((x, y) => x - y)) {
        const r = COTE[methode][cle](v);
        cas.push({ methode, cle, v, max: r.max, base: r.base, cote: r.cote });
      }
    }
  }
  return cas;
}
