---
description: Intègre une maquette « Claude Design » (*-design.html, runtime dc/support.js) dans la page de production du site TMS — portage fidèle en HTML/JS vanilla + styles.css, FR puis EN, avec bump version + cache SW.
argument-hint: "[fichier-design.html | nom-de-page] [--page-separee] [--no-en]"
---

# /design-sync — Synchroniser une maquette Claude Design vers la production

Ton rôle : prendre une **maquette « Claude Design »** (un export brut du Design
Canvas) et l'**intégrer fidèlement dans la page de production** du site (site
statique bilingue de prévention des TMS — Machines Roger International).

C'est le geste récurrent du repo, visible dans l'historique git :
« maquette Claude Design brute (page séparée) » → « **intègre le design** ».

Cible de cette exécution : **$ARGUMENTS**
(si vide, détecte automatiquement le ou les fichiers `*-design.html` modifiés
le plus récemment et confirme la cible avant de continuer).

---

## Reconnaître les deux mondes

**Maquette Claude Design** (la SOURCE — à NE PAS livrer telle quelle) :
- Fichier nommé `*-design.html` (ex. `formation-guidee-design.html`).
- Charge le runtime `support.js` (`GENERATED from dc-runtime`, React/ReactDOM).
- Balises de prototypage : `<x-dc>`, `<helmet>`, `<sc-if value="{{ … }}">`,
  `<sc-for …>`, `<x-import>`, `data-screen-label`, `hint-placeholder-val`.
- Liaisons `{{ expression }}` dans le template.
- Logique dans `<script type="text/x-dc" data-dc-script data-props="…">` :
  un composant façon classe React (`this.state`, méthodes, `render()` qui
  retourne l'objet de props injecté dans le template).
- Souvent un CDN externe (`unpkg.com/@google/model-viewer`).

**Production** (la CIBLE) :
- HTML propre (`<div id="app"></div>`) + un JS **vanilla** (`*.js`) qui construit
  l'UI en chaînes/DOM, OU du HTML statique complet selon la page.
- **Réutilise `styles.css`** (classes existantes : `.lead`, `.alert`, `.icards`,
  `.corps-3d`, `.evo3`, `.fg-*`, …) + un petit `<style>` local si besoin.
- Chrome maison conservé : header collant + nav, sélecteur de langue FR/EN,
  badge de version, service worker, model-viewer **local** (`vendor/`).
- Endpoints réels (Worker Cloudflare / Airtable), assets réels (`images/`,
  `models/`).

Règle d'appariement par défaut : `X-design.html` → `X.html` (+ `X.js` si la page
est en `#app`) → puis miroir `X.en.html`.

---

## Déroulé

### 0. Préparer
- Vérifie la branche de travail courante ; reste dessus.
- Identifie la **source** (`*-design.html`) et la **cible de prod**. Si la page
  de prod n'existe pas encore, demande s'il faut la créer (cas « première
  intégration ») ou utiliser la variante `--page-separee`.

### 1. Lire et cartographier la maquette
- Lis le template `<x-dc>`, le `<style>` inline, le `<helmet>` et surtout le
  `<script data-dc-script>`.
- Recense : les **écrans/états** (`<sc-if>`), les **boucles** (`<sc-for>`), les
  **interactions** (méthodes/handlers), les **données** et la **structure
  visuelle** (couleurs `#0a0e17`/`#0d1320`/rouges `#e23a3c`/`#d22325`, dégradés,
  rayons, ombres, typo Barlow / Barlow Condensed, animations).
- Note ce qui est **nouveau** par rapport à la prod actuelle (c'est le delta à
  porter).

### 2. Lire la production existante
- Lis le HTML + le JS de prod + les sections pertinentes de `styles.css`.
- Comprends le pattern vanilla déjà en place (fonctions `render*`, état en
  `localStorage`, helpers) pour t'y conformer au lieu d'inventer.
- Repère les classes `styles.css` réutilisables (ne duplique pas le CSS).

### 3. Porter le design (le cœur)
Traduis le prototype en code de production, **fidèlement** :
- `{{ expr }}` → interpolation JS / mise à jour DOM.
- `<sc-if value="{{ x }}">` → rendu conditionnel.
- `<sc-for>` → `map`/boucle.
- `<helmet>` → fusion dans le `<head>` réel (titre, polices, meta) sans casser
  le head de prod.
- état/méthodes React → le pattern vanilla existant (mêmes clés `localStorage`,
  mêmes fonctions de rendu).
- styles inline → garde-les là où la prod le fait, **promeus** dans `styles.css`
  ce qui est partagé/répété.
Et **purge tout le prototypage** :
- supprime `support.js`, `<x-dc>`, `<helmet>`, `<sc-*>`, `{{ }}`, `data-props`,
  `data-screen-label`, `x-import` ;
- `unpkg.com/@google/model-viewer` → `vendor/model-viewer.min.js` ;
- endpoints/chemins de prod réels.
Conserve : header/nav + sélecteur FR/EN, badge de version, enregistrement du
service worker, accessibilité (aria/alt/focus), responsive (héros compact
mobile), `prefers-reduced-motion`, styles `@media print` (attestation).

### 4. Contrôler la fidélité
- Compare maquette ↔ prod : espacements, couleurs, dégradés, rayons, typo,
  animations doivent correspondre. Documente tout écart volontaire.
- Aucune régression sur les fonctionnalités existantes (quiz, progression,
  attestation imprimable, visionneuse 3D…).

### 5. Miroir FR → EN (sauf `--no-en`)
- Reporte le design sur `X.en.html`. Détecte le pattern EN de la page :
  JS partagé avec détection de langue **ou** fichier `*.en.js` séparé
  (le repo a les deux ; ex. `app.js` + `app.en.js`).
- **Ne traduis pas à la volée le contenu existant** : conserve les traductions
  en place, ne synchronise que structure/design. Signale les nouveaux textes
  qui nécessitent une traduction.

### 6. Bump version + cache SW
- Incrémente le badge de version affiché (ex. `v1.45` → `v1.46`) partout où il
  apparaît.
- Mets à jour le cache du service worker selon la convention du repo
  (versionnage du cache dans `sw.js` ; le déploiement peut l'auto-versionner par
  hash de commit — vérifie `sw.js` et suis ce qui est en place).

### 7. Vérifier
- Sers le site en local et parcours les écrans (sommaire, modules, quiz,
  attestation, visionneuse 3D). Capture d'écran si utile.
- Confirme : zéro `{{ }}`/`<x-dc>`/`support.js` résiduel, model-viewer local,
  pas d'erreur console, parité FR/EN.

### 8. Commit & push
- Commit sur la branche de travail, message dans le style du repo :
  `Formation guidée : intègre le design (<résumé du delta>)`.
- `git push -u origin <branche>` (retry x4 backoff 2/4/8/16 s si erreur réseau).
- **N'ouvre pas de PR** sauf demande explicite.

---

## Variante `--page-separee`
Reproduit le geste « déploie la maquette brute en page séparée » (cf. PR #20) :
on **ne porte pas** dans la prod, on rend juste le `*-design.html` consultable en
prod (model-viewer local, assets réels, header/nav, badge version) pour revue
avant intégration complète. Le runtime `support.js` reste, mais pointe les assets
en local.

## Garde-fous
- Jamais de `support.js`, `<x-dc>`, `{{ }}`, `<sc-*>` ni CDN unpkg dans une page
  de production intégrée.
- Réutilise `styles.css` ; évite la duplication de CSS.
- Préserve les traductions EN existantes.
- Demande avant tout écrasement destructif ou refonte de grande ampleur.
- Pour de la **refonte/craft visuel** (au-delà du portage fidèle), appuie-toi
  sur `/impeccable` ; `design-sync` reste un portage + intégration fidèle.
