# Design

## Theme

Sombre industriel. Fond bleu-nuit quasi noir (pas de gris neutre) ; le rouge signature Machines Roger porte l'identité ; grain de film léger sur toute la page (opacité .035).

## Color Palette

| Rôle | Token | Valeur |
|---|---|---|
| Fond | `--bg` | `#0a0e17` |
| Fond 2 / panneau | `--bg-2` | `#0d1320` |
| Carte | `--card` / `--card-2` | `#111827` / `#1a2332` |
| Rouge signature | `--brand` / `--accent` | `#d22325` |
| Rouge sombre | `--brand-d` | `#a81a1c` |
| Rouge clair (focus, liens actifs) | `--accent-l` | `#ef5a5c` |
| Texte | `--text` | `#f1f5f9` |
| Texte secondaire | `--muted` / `--dim` | `#9aa7bd` / `#8694ad` |
| Bordure | `--border` | `#1e293b` |
| Dégradé signature | `--g-red` | `linear-gradient(135deg,#e23a3c,#a81a1c)` |
| Sémantiques | `--danger/--success/--info` | `#ef4444` / `#10b981` / `#3b82f6` |

Le noir pur `#000` est réservé aux socles du logo (plaque du mot-symbole). Contraste : texte courant ≥ 4.5:1 sur `--bg`/`--card` (audit axe 0 violation, maintenir).

## Typography

- **Display** : `Barlow Condensed` 600–800 — capitales condensées lourdes, écho direct du mot-symbole ROGER. Titres h1/h2 en majuscules, letter-spacing léger (≤ .04em), jamais sous −0.04em.
- **Body** : `Barlow` 400–800, 17px base, line-height 1.7 (thème sombre → interligne généreux).
- `text-wrap: balance` sur h1–h4, `pretty` sur la prose. Google Fonts via `<link>` préconnecté (pas d'@import).

## Signature Motifs (hérités du logo)

- **Points de forage** : cercles rouges pleins avec halo (`box-shadow` rouge diffus), utilisés pour les pastilles de zones du corps, jalons de progression et marqueurs de points d'intérêt. Fonctionnels, jamais décoratifs gratuits.
- **Barre rouge** : trait horizontal rouge court (dégradé `--g-red`), sous les titres de section majeurs — écho de la barre sous ROGER.

## Components

- **Boutons** `.btn` : condensés majuscules, fond `--g-red` (primaire) ou bordure `--border` (fantôme), radius 10–12px, survol : levée 2px + ombre rouge.
- **Cartes** : fond `--card`, bordure 1px `--border`, radius 14px, ombre `--shadow-card` ; jamais de bordure latérale colorée épaisse.
- **Modales / fiches** : verre sombre (`backdrop-filter: blur`), piège de focus, Échap, restitution du focus.
- **Badges de version, toasts, infobulle** : pilule sombre translucide, bordure fine.

## Motion

Langage « précision mécanique » : mouvements courts, décélération franche (`cubic-bezier(.22,.61,.36,1)` ≈ ease-out-quart), pas de rebond.

- Révélations au scroll `.reveal` : translation 24–38px + fondu, une fois.
- Hero 3D : rotation continue lente + zoom piloté au scroll (gros plan → corps entier) ; révélation des systèmes anatomiques en fondu linéaire lent (~7 s/couche en auto).
- Pastilles de forage : pulsation lente (opacité), jamais d'échelle élastique.
- `prefers-reduced-motion: reduce` : tout en fondu instantané / pose fixe. Contenu jamais gated par une animation.

## Layout

Sidebar TOC fixe 268px (verre sombre) + contenu `wrap` max ~1100px. Sections en `100vh` pour l'intro immersive, ensuite rythme éditorial. Mobile < 980px : TOC devient barre, hero raccourci (82vh), 3D remplacé par poster.
