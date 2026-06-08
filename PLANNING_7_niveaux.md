# Planning — « Les 7 niveaux du design front‑end avec Claude Code »

Analyse de la vidéo (≈ 39 min) + plan d'action pour faire passer le site **Prévention TMS – Machines Roger** au niveau « élite ».

---

## 1. Ce que dit la vidéo (synthèse)

Idée centrale : Claude Code (l'IA) n'est pas bon en design *par défaut* — le résultat est générique (« AI slop », dégradés violets…). Ce n'est pas un problème d'outil mais de **méthode et de vocabulaire**. La vidéo propose une montée en compétence en 7 niveaux. Cas d'étude : un faux SaaS « Argus ».

| # | Niveau | En bref | Compétence à acquérir / Piège |
|---|--------|---------|-------------------------------|
| 1 | **Toi + un prompt** | On demande sans direction artistique → générique | Prompts descriptifs · connaître les frameworks · vocabulaire de design · **plan mode** |
| 2 | **Éducation design (skills)** | On injecte des *skills* (front‑end design, « UI/UX Pro Max ») = check‑lists anti‑slop | Évaluer le rendu avec un œil de designer et transformer les critiques en prompts. Piège : ça reste un « template IA » |
| 3 | **Directeur visuel** | Montrer au lieu de décrire : captures de **références** | Sources : Awwwards, godly.website, Pinterest, Dribbble · combiner plusieurs sites. Piège : le **« vibe gap »** (proche mais pas parfait) |
| 4 | **Le cloneur** | Aller sous le capot : récupérer le **code réel** (Ctrl+U → HTML, + fichiers CSS & JS) et faire expliquer les effets par l'IA | HTML = os · CSS = vêtements · JS = muscles · « site teardown skill ». Piège : le **« clone ceiling »** (copier sans savoir créer) |
| 5 | **Composants + assets custom** | Apporter ses propres composants et créer ses visuels | Composants : 21st.dev, CodePen, Mobbin · images IA (Midjourney) · **vidéo de fond** subtile en boucle + repli image sur mobile · **storytelling visuel** (Argus → tagline « See what's next ») |
| 6 | **Outils visuels externes** | Itérer hors du terminal | Stitch (Google), paper.design, Figma, pencil.dev · détails premium : écran de chargement, **typographie** (Google Fonts), tickers, **glassmorphism**, **compteurs animés**, barre de progression de scroll · demander à l'IA de faire une *web search* des bonnes pratiques |
| 7 | **L'architecte (3D/WebGL)** | Shaders, WebGL, expériences 3D « Site of the Day » | Surtout hors de portée de l'IA aujourd'hui — niveau aspirationnel |

**Le vrai message** : *voir* ce qu'on aime → *déconstruire/cloner* pour apprendre les techniques → *réappliquer dans son propre style*. Il n'y a pas de skill magique ; c'est itératif. « L'IA n'a pas de goût » → en réalité **on a du mal à articuler notre goût** faute de vocabulaire : il faut le construire.

---

## 2. Diagnostic du site TMS (où on en est)

Le site est déjà **autour du niveau 5–6** :
- ✅ Skills / bonnes pratiques appliquées (niv. 2)
- ✅ Système de marque cohérent (rouge/noir/blanc), typo lisible (niv. 2‑3)
- ✅ Composants & micro‑interactions custom : cartes interactives, silhouette cliquable, simulateur d'angles, échelle de Borg, **compteurs animés**, **anneau de note**, transitions glissées (niv. 5‑6)
- ✅ Détails premium : confettis, sons, plein écran, recherche Ctrl+K (niv. 6)

**Ce qui manque pour viser « élite » :**
1. Un **héros à fort impact visuel** (actuellement texte seul) — pas d'asset signature (image concept‑art ou vidéo de fond).
2. Aucune passe **référence‑driven** (on n'a pas cloné de techniques de pros).
3. **Typographie** encore standard (Inter) — pas de couple typographique signature.
4. Cohérence visuelle des sections « faibles » (certaines cartes restent plates).

---

## 3. Plan d'action (5 sprints)

### Sprint 1 — Références (Niveau 3) · ~30 min
- [ ] Constituer un **moodboard** : 6–10 captures de sites sombres/industriels haut de gamme (Awwwards « sites of the day », godly.website, Dribbble « safety / dashboard / mining »).
- [ ] Repérer 3 techniques précises à reproduire (ex. héros plein écran avec dégradé « aurore », ticker animé, cartes glassmorphism).
- [ ] Déposer les captures dans `Prevention_TMS_Site/refs/`.

### Sprint 2 — Cloner pour apprendre (Niveau 4) · ~45 min
- [ ] Choisir 1 site de référence ; récupérer HTML + CSS + JS et demander à Claude **comment** l'effet héros / scroll est fait.
- [ ] Recréer la technique **dans notre style** (couleurs Machines Roger), pas un copier‑coller.
- [ ] Documenter 2‑3 techniques apprises (réutilisables).

### Sprint 3 — Héros signature (Niveau 5) · ~45 min  ⭐ priorité
- [ ] Générer une **image concept‑art** (Midjourney / Nano Banana) : mine souterraine + sécurité + ergonomie ; ambiance sobre, rouge marque.
- [ ] Tagline d'accroche (style « See what's next ») : ex. *« Ton corps, ton premier outil »* déjà fort — l'adosser à l'image.
- [ ] Option : **vidéo de fond** subtile en boucle (~15 s) + repli **image fixe sur mobile**.
- [ ] Intégrer dans le héros de l'accueil (texte à gauche, visuel à droite / plein cadre).

### Sprint 4 — Micro‑détails premium (Niveau 6) · ~30 min
- [ ] **Typographie** signature (Google Fonts : ex. titre « Anton / Archivo » + texte « Inter »).
- [ ] Écran/anim de chargement léger ; **barre de progression de scroll**.
- [ ] Effet **glassmorphism** cohérent sur les cartes clés ; bordures/tickers.
- [ ] Demander à Claude une **web search** « best practices » et trier les idées.

### Sprint 5 — Itération avec outils visuels (Niveau 6) · en continu
- [ ] Passer les sections « plates » dans **Stitch** (Google, gratuit) pour générer des variantes, puis réintégrer via Claude.
- [ ] Boucle *tinker* : capturer ce qu'on aime → prompt → ajuster, jusqu'au rendu voulu.

> Niveau 7 (WebGL/3D) : hors périmètre pour l'instant — à garder en inspiration.

---

## 4. Prochaine action recommandée
**Sprint 3 (héros signature)** = le plus gros gain visuel. Si tu valides, je peux : préparer l'emplacement du héros (mise en page image + texte + repli mobile), te lister les prompts d'image à utiliser, et intégrer l'asset dès que tu l'as généré.
