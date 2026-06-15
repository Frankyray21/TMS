# refs/ — Héros signature (Sprint 3)

L'**ossature code est déjà en place**. Le hero possède un calque photo (`.hero-photo`)
qui s'active **tout seul** dès qu'un fichier image est présent. Tu n'as plus qu'à
générer l'asset et le déposer dans `images/`.

---

## 1. Ce que tu dois produire

| Fichier | Dimensions conseillées | Usage |
|---|---|---|
| `images/hero.jpg` | **1920 × 1080** (paysage 16:9) | Desktop / tablette |
| `images/hero-mobile.jpg` | **1080 × 1350** (portrait 4:5) — *optionnel* | Mobile (sinon repli auto sur `hero.jpg`) |

- Format **JPG**, qualité ~80 %, viser **< 350 Ko** chacun (compresser via squoosh.app).
- Dépose simplement le(s) fichier(s) dans `images/` → la photo apparaît au prochain chargement.
  Rien d'autre à coder (`app.js` sonde le fichier et ajoute la classe `has-photo`).
- Pour **retirer** la photo : supprime le fichier, le hero revient au dégradé + WebGL.

---

## 2. Direction artistique (à respecter)

- **Sujet décalé à DROITE** : à gauche, un voile sombre (`.hero-scrim`) accueille le
  titre — garde donc la zone gauche calme/sombre et l'intérêt visuel sur le **tiers droit**.
- **Palette marque** : rouge `#d22325` (accent ponctuel), quasi-noir `#0a0e17`, acier/gris froid.
- **Ambiance** : mine souterraine, galerie d'arches, éclairage de casque, sécurité + ergonomie.
  Sobre, premium, cinématographique — **pas** de stock-photo souriante.
- **Aucun texte** dans l'image (le titre est en HTML par-dessus).
- Composition qui laisse respirer le haut-gauche (le `eyebrow` + `h1` s'y posent).

---

## 3. Prompts (Midjourney / Nano Banana / autre)

**A — Galerie de mine, ambiance rouge (recommandé)**
> Underground mining tunnel receding into darkness, concentric rock-support arches,
> a lone miner in safety gear on the right third, dramatic low-key lighting, faint
> red `#d22325` rim light, cold steel and near-black `#0a0e17` tones, cinematic,
> volumetric dust, photoreal, shallow depth of field, copy space on the left ::
> no text --ar 16:9 --style raw

**B — Ergonomie / corps au travail (lien avec le slogan « ton corps, ton 1ᵉ outil »)**
> Close cinematic shot of a miner's shoulder and back under strain, protective
> equipment, dark industrial backdrop, subtle red accent light from the right,
> moody, premium editorial, deep shadows on the left for text overlay
> --ar 16:9 --style raw

**C — Mobile (portrait)**
> Same direction as A but vertical composition, subject lower-right, generous dark
> sky/ceiling space at the top for the headline --ar 4:5 --style raw

> Astuce : génère 2-3 variantes, choisis celle dont la **gauche reste sombre** (meilleure lisibilité du titre).

---

## 4. Option vidéo de fond (drop-in, déjà câblé)

L'ossature vidéo est elle aussi **en place** et suit le même principe que la photo.

| Fichier | Format | Notes |
|---|---|---|
| `videos/hero.webm` | VP9/AV1, muet, **boucle ~10-15 s** | servi en priorité (plus léger) |
| `videos/hero.mp4` | H.264, muet | repli pour Safari/anciens navigateurs |

- Vise **< 3 Mo** au total, ~1280×720, boucle propre, mouvement **subtil** (poussière,
  lumière, lente dérive). Muet obligatoire (autoplay).
- Dépose le(s) fichier(s) → la vidéo s'active **automatiquement sur desktop** ; elle est
  volontairement **désactivée sur mobile et si « mouvement réduit »** est demandé (perf +
  accessibilité), où l'on garde la **photo fixe** comme socle.
- Ordre de repli : **vidéo → photo (`hero.jpg`) → dégradé + WebGL**. Garde donc une
  `images/hero.jpg` cohérente comme image-poster.

---

## 5. Moodboard (Sprint 1)

Dépose ici 6–10 captures de références (sombre/industriel haut de gamme : Awwwards
« sites of the day », godly.website, Dribbble « safety / mining / dashboard »).
Nomme-les `ref-01.jpg`, `ref-02.jpg`, … pour garder une trace des techniques à reproduire.
