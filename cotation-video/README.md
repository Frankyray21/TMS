# Cotation ergonomique vidéo

Coter une posture de travail en **REBA**, en **RULA** ou selon l'**équation
révisée du NIOSH**, à partir d'une vidéo, automatiquement, sans que la vidéo
quitte le poste.

Une vidéo entre, une cote par image en sort, plus la synthèse de la séquence :
posture habituelle, pire instant, temps passé dans chaque niveau de risque,
segment qui pèse le plus lourd.

| Méthode | Portée | Échelle | Pour quoi |
|---|---|---|---|
| **REBA** | corps entier | 1–15, 5 niveaux | Manutention, efforts, postures debout |
| **RULA** | membre supérieur | 1–7, 4 niveaux | Postes assis, travail de précision, gestes répétés |
| **NIOSH** | levage | poids admissible et indice | Soulever une charge : quel poids la tâche autorise |

Les deux sont calculées à chaque image : basculer de l'une à l'autre ne relance
rien. RULA plafonne sa cote de force à 10 kg — un avis le signale quand la
charge déclarée dépasse ce seuil.

**Un module du site de formation TMS.** Il est publié avec le site
(`.github/workflows/deploy-pages.yml`), lié depuis son pied de page
(« Évaluation ergonomique vidéo · bêta ») et couvert par le même service
worker : il s'ouvre et analyse sans réseau, comme le reste du site — voir
« Mode hors ligne » plus bas.

---

## Faire tourner

Il faut un serveur HTTP : le navigateur refuse de charger des modules et du
WebAssembly depuis `file://`.

```bash
npx http-server -p 8080        # ou : python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080/`. L'outil s'ouvre sur une **démonstration**
— un cycle de levage fabriqué — pour montrer ce qu'il produit avant même de
charger un fichier. Les postures y sont simulées, l'interface le dit.

### Le squelette est cliquable

Cliquer un segment ouvre sa fiche : l'angle mesuré, la cote et sa décomposition
(base, puis chaque majoration avec sa cause chiffrée — « torsion 28° (+1) »), et
la règle publiée qui s'applique. L'os cliqué reçoit un halo, pour que la fiche
se rattache à quelque chose plutôt que de flotter.

La fiche porte aussi une **échelle des bandes d'angle** : chaque plage colorée
avec sa cote, les seuils chiffrés, et un repère sur la valeur mesurée. Une règle
écrite dit « au-delà de 20° » ; l'échelle montre où tombe le 28° relevé. Les
bandes sont celles que les fonctions de cotation appliquent réellement, pas une
paraphrase — et chaque bande porte son chiffre, la couleur ne voyageant jamais
seule.

Un membre du côté non coté le dit explicitement : REBA et RULA s'appliquent à un
côté à la fois, et afficher une valeur pour l'autre reviendrait à inventer une
mesure.

C'est là que l'outil cesse d'être une boîte noire : chaque chiffre affiché se
remonte jusqu'à sa règle.

### Le rapport

Le bouton **Rapport PDF** remplit un document et lance l'impression : le
navigateur sait produire un PDF, inutile d'embarquer une bibliothèque pour
refaire ça moins bien. Le document contient l'identification du poste, l'image
du pire instant avec son squelette, les trois lectures, la synthèse de la
séquence, la décomposition segment par segment, le bloc NIOSH quand un levage
est repéré, et un pied qui rappelle les paramètres déclarés, les limites de la
méthode et les trois références.

L'image est reconstruite en pleine résolution : on se replace sur le pire
instant, on dessine la vidéo puis le squelette sur un canevas hors écran, et la
lecture reprend là où elle était.

### Combien de temps dure une analyse

L'outil relève une image tous les `1/échantillonnage` de seconde de vidéo, et
chaque relevé coûte un déplacement plus une inférence :

    images = durée de la vidéo × échantillonnage (6/s par défaut)
    temps  = images × coût par image

Le coût par image dépend de la machine, et du délégué que l'outil choisit
(voir « Mode hors ligne ») : le GPU quand il est matériel et complet, le
processeur sinon. Mesuré sur une machine **sans GPU** (quatre cœurs, rendu
graphique logiciel), où l'outil calcule sur le processeur : **114 ms par
image**, déplacement compris. Le même poste passait auparavant par un GPU
émulé : 605 ms par image. Sur une machine avec accélération graphique,
comptez plutôt 60 à 150 ms.

| Vidéo | Images à 6/s | Machine ordinaire (estimation) | Sans GPU (mesuré) |
|---|---|---|---|
| 15 s | 90 | ~10 s | ~10 s |
| 30 s | 180 | ~20 s | ~20 s |
| 60 s | 360 | ~40 s | ~40 s |

Ajouter, à la première utilisation seulement, le téléchargement du moteur et du
modèle (22 Mo en standard, 26 Mo avec les deux modèles) et une à trois
secondes d'initialisation.

**Le levier, c'est l'échantillonnage** (réglages d'analyse, 2 à 15 images/s).
Le diviser par deux divise le temps par deux. Six images par seconde conviennent
à un cycle de levage ; deux suffisent pour une tâche statique.

### Ce que montre l'analyse pendant qu'elle tourne

Quatre étapes affichées en permanence — moteur, modèle, analyse, cotation — avec
la barre d'avancement de l'étape en cours. Quand l'avancement n'est pas mesurable
(chargement du moteur, préparation du détecteur), la barre défile au lieu de
rester à zéro : une barre figée donne l'impression d'un blocage.

Le **téléchargement du modèle** est le plus long à la première utilisation,
9 Mo. MediaPipe sait le charger depuis une URL mais sans rien rapporter ; on lit
donc le flux nous-mêmes pour afficher les octets reçus, et on passe le résultat
en `modelAssetBuffer`. Le fichier est ensuite **conservé dans le cache du
navigateur** : les analyses suivantes affichent « Modèle chargé depuis le
cache » et démarrent aussitôt.

Pendant le parcours de la vidéo : position dans la vidéo, images cotées, images
sans détection, et temps restant estimé.

### Mode hors ligne

Sous terre, il n'y a pas de réseau. Voici ce qui fait que l'outil y fonctionne,
et ce que chaque pièce protège.

1. **La coquille de l'outil** — page, styles, polices, modules — est mise en
   cache par le service worker du site (`../sw.js`) dès la première visite de
   n'importe quelle page du site. L'outil s'enregistre aussi lui-même auprès de
   ce service worker, pour le poste qui n'a ouvert que lui. Les polices
   (Barlow, Barlow Condensed, licence OFL) sont servies par l'outil
   (`polices/`, `css/polices.css`) : plus de Google Fonts, donc le même rendu
   hors ligne sur un poste qui n'a jamais ouvert l'outil.
2. **Le moteur de pose et ses modèles sont embarqués dans le site publié.** Le
   déploiement exécute `outils/telecharger-modeles.sh`, qui dépose ~37 Mo dans
   `vendor/<version>/` : moteur MediaPipe, ses deux variantes WebAssembly (SIMD
   ou non, le navigateur choisit), modèles standard et rapide. L'outil détecte
   le dossier et ne sort plus sur aucun CDN. Ces fichiers ne sont pas
   préchargés avec le site — trop lourds pour qui ne fait que suivre la
   formation — mais le service worker les garde à la première demande, dans
   leur propre magasin, qui survit aux versions du site.
3. **« Préparer le mode hors ligne »**, sur l'accueil de l'outil, charge le
   moteur et garde les deux modèles, une fois, en ligne (≈ 26 Mo), et demande
   au navigateur un stockage persistant. La ligne d'état dit ensuite « Prêt
   hors ligne », et conseille d'installer le site comme application si le
   navigateur n'a pas accordé ce stockage (Safari efface les données d'un site
   non visité depuis sept jours). Une analyse faite en ligne prépare aussi le
   poste, avec le seul modèle utilisé : l'outil le dit, et propose de compléter.
4. **Un modèle manquant n'arrête rien.** Hors ligne, si le modèle choisi dans
   les réglages n'est pas conservé mais l'autre l'est, l'analyse se fait avec
   l'autre, et un message le signale. Même chose sur un réseau local sans
   Internet, que le navigateur prend pour une connexion.
5. **Une mise à jour du moteur ne « dé-prépare » pas un poste.** La version du
   moteur est définie une seule fois, dans `js/config.js` (`MEDIAPIPE`,
   `MODELE_POSE`) ; elle entre dans toutes les adresses (`vendor/<version>/`)
   et dans le nom du magasin (`cotation-video-moteur-<version>`). `sw.js` la
   recopie, un test vérifie qu'elles concordent. Quand elle change, le service
   worker, à sa prochaine installation, télécharge l'équivalent de ce que le
   poste avait gardé, puis purge l'ancien magasin. Si le réseau lâche pendant
   ce renouvellement, l'installation échoue et l'ancien service worker reste en
   place avec l'ancien moteur, cohérent ; le navigateur retente à la visite
   suivante sans reprendre les fichiers déjà rangés.
6. **Le délégué est choisi, pas imposé.** MediaPipe calcule sur le GPU ou sur
   le processeur. L'outil prend le processeur quand le rendu graphique est
   logiciel (poste sans carte graphique, machine virtuelle : 5 fois plus
   rapide, voir plus haut) ou quand le GPU n'a pas de tampons de couleur
   flottants — MediaPipe n'y lèverait aucune erreur, il ne détecterait
   simplement plus personne. Si le GPU échoue malgré tout, à la création ou au
   premier passage (le détecteur est amorcé sur une image vide), l'outil
   bascule sur le processeur. WebGL 2 reste indispensable : MediaPipe y prépare
   l'image même quand il calcule sur le processeur ; sans lui, l'outil le dit.
   Le pied de page et l'export JSON nomment le moteur, le modèle et le délégué
   réellement utilisés.
7. **Sans préparation**, l'outil s'ouvre quand même hors ligne, la
   démonstration fonctionne, et l'importation explique que l'analyse attend le
   retour du réseau — plutôt qu'une erreur brute du navigateur.

En développement, `vendor/` s'obtient de la même façon :

```bash
bash outils/telecharger-modeles.sh        # les deux modèles, ~37 Mo dans vendor/<version>/
bash outils/telecharger-modeles.sh lite   # le modèle rapide seulement
```

Le dossier n'est pas versionné. Sans lui, l'outil retombe sur le CDN public
(`js/config.js`) — seulement si le serveur répond qu'il n'existe pas : une
coupure réseau ne renvoie jamais vers un tiers. Le service worker garde alors
ces fichiers-là de la même manière, mais un poste qui ne les a jamais chargés
reste tributaire du réseau.

**Changer de version du moteur :** modifier `MEDIAPIPE` (ou `MODELE_POSE`)
dans `js/config.js`, recopier la nouvelle `VERSION_MOTEUR` dans `../sw.js`
(le test `hors-ligne.test.mjs` donne la valeur attendue s'il y a un écart), et
vérifier que l'adresse de télémétrie bloquée (`pose.js`) est toujours celle du
nouveau bundle — le même test la contrôle quand `vendor/` est présent.

---

## Ce que fait la chaîne

```
                          ┌ angles articulaires → REBA / RULA → synthèse
vidéo → estimation de pose ┤   (angles.js)          (reba, rula)
        (pose.js)          └ distances du levage  → NIOSH
                               (mesures.js)          (niosh.js)
```

| Fichier | Rôle |
|---|---|
| `js/reba.js` | **Le modèle REBA.** Tables A, B, C de la méthode publiée, cotation par segment, niveaux de risque, synthèse de séquence. Aucune dépendance, aucun DOM. |
| `js/rula.js` | **Le modèle RULA.** Même contrat, tables et majorations propres à la méthode. |
| `js/niosh.js` | **L'équation révisée du NIOSH.** Les six multiplicateurs, la table des fréquences, le poids limite recommandé et l'indice de levage. |
| `js/mesures.js` | Les distances du levage — hauteur des mains, éloignement de la charge, angle d'asymétrie — en centimètres, étalonnées sur la taille du travailleur. |
| `js/angles.js` | Géométrie : des 33 repères 3D aux angles du tronc, du cou, des genoux, du bras, du coude et du poignet. |
| `js/pose.js` | La seule dépendance à MediaPipe. Changer de détecteur ne toucherait que ce fichier. |
| `js/analyse.js` | Parcours de la vidéo, lissage, cotation, recotation. |
| `js/rendu.js` | Squelette coloré, jauge, chronologie. |
| `js/demo.js` | Le cycle de levage simulé de l'écran d'accueil. |
| `js/app.js` | Interface. Ne contient aucune règle de cotation. |

### Les trois lectures ensemble — mais pas de score composite

Le panneau ouvre sur les trois verdicts côte à côte, chacun sur **son** échelle,
avec une mention de pertinence. Cliquer une ligne ouvre le détail de la méthode.

Il n'y a délibérément **aucun indice combiné**, pour trois raisons :

- Les échelles ne sont pas commensurables. REBA va de 1 à 15, RULA de 1 à 7, et
  l'indice NIOSH est un *ratio* sans borne supérieure — un 2,4 signifie « 2,4 fois
  la charge admissible », pas « 2,4 sur 10 ».
- REBA et RULA se recouvrent : les deux notent la posture à partir des **mêmes
  angles**. Les additionner compterait le tronc et le bras deux fois.
- Chaque méthode est validée séparément, avec ses propres seuils d'action. Un
  score maison perdrait ce qui fait leur valeur : la traçabilité jusqu'à une
  publication.

Le désaccord entre les trois est l'information utile. RULA qui sature dit « ce
n'est pas ma question » ; NIOSH qui pointe la distance horizontale dit *quoi
corriger*, ce que REBA ne dit pas.

Le poids de la charge est un fait physique unique : les curseurs de REBA et de
NIOSH sont liés, il ne se saisit pas deux fois.

### REBA et RULA sont calculées à chaque image

Ce ne sont que des lectures de tables : basculer de l'une à l'autre ne relance ni
la détection ni le calcul des angles. L'export JSON contient les deux cotes, pour
que le fichier reste exploitable si l'on change d'avis sur la méthode après coup.

Un avis prévient quand la méthode choisie ne convient pas à la tâche : RULA
plafonne sa cote de force au-delà de 10 kg, elle sature donc sur une manutention
de charge et cesse d'y discriminer.

### NIOSH ne cote pas une image, mais un levage

REBA et RULA notent une posture instantanée. NIOSH répond à une autre question :
quel poids cette tâche autorise-t-elle ? Il porte donc sur un levage entier,
entre une saisie et une dépose, et il a besoin de distances en centimètres — à
quelle distance du corps la charge est prise, à quelle hauteur, de combien elle
monte, sous quel angle de torsion.

C'est précisément ce qui se mesure au galon, accroupi à côté du poste, en
interrompant le travail. Le squelette 3D les donne sans rien interrompre :
l'outil propose les deux instants (mains au plus bas, mains au plus haut),
préremplit H, V et A, et laisse tout corriger à la main. La chronologie bascule
alors sur la hauteur des mains, avec le repère des 75 cm — la hauteur où le
multiplicateur vertical vaut 1.

**Étalonnage.** Les repères « monde » de MediaPipe sont métriques mais
approximatifs. Déclarer la taille du travailleur donne un facteur d'échelle,
calculé sur la **somme des segments** (pied, jambe, cuisse, tronc) et non sur une
hauteur mesurée verticalement : cette dernière s'effondre dès que le sujet se
penche, et le facteur se mettrait à varier d'une image à l'autre sur la même
personne.

### Le lissage porte sur les angles, jamais sur les cotes

Les tables REBA ne sont pas linéaires : moyenner des cotes produirait un
chiffre qui ne correspond à aucune posture réelle. La médiane glissante
s'applique donc aux angles, avant cotation, et les seuils booléens (torsion,
inclinaison) sont réévalués ensuite.

---

## Les tests

```bash
node tests/reba.test.mjs        # 69 vérifications
node tests/rula.test.mjs        # 68 vérifications
node tests/niosh.test.mjs       # 61 vérifications
node tests/angles.test.mjs      # 39 vérifications
node tests/hors-ligne.test.mjs  # 24 vérifications
```

`hors-ligne.test.mjs` exécute le service worker du site dans un bac à sable
Node, sans navigateur ni réseau, et lui soumet ce qu'un poste sous terre lui
demanderait : l'installation (chaque fichier de la coquille doit exister —
un seul manquant ferait échouer tout le cache du site), l'ouverture de l'outil,
de ses modules et de ses polices hors ligne, la mise en cache du moteur dans
son magasin versionné. Puis ce qu'une mise à jour du moteur lui fait subir :
reconduire un poste préparé, ignorer un fichier disparu, échouer proprement
sur une coupure et ne reprendre ensuite que le manquant, purger l'ancien
magasin sans toucher aux caches des autres sites. Il vérifie aussi qu'une seule
version du moteur circule (config.js, sw.js, script, adresses), que l'outil ne
charge rien d'un tiers, que la télémétrie de MediaPipe est arrêtée, le choix du
délégué sur des contextes WebGL simulés, et le repli sur le processeur avec
une doublure de MediaPipe qui échoue à la création ou à l'amorçage.

Le parcours complet dans un vrai navigateur tourne dans la CI de chaque pull
request (job « Analyse ergonomique hors ligne ») ; en local :

```bash
NODE_PATH="$(npm root -g)" node cotation-video/tests/verifier-hors-ligne.mjs   # depuis la racine du dépôt
```

Il sert le dépôt en local, puis **arrête le serveur** et passe le navigateur
hors ligne. Cinq postes, chacun dans son propre profil :

| Poste | Situation | Ce qui est vérifié |
|---|---|---|
| A | Préparé, puis photo et vidéo en ligne | Hors ligne : l'outil se rouvre, photo et vidéo donnent les mêmes scores, image par image ; le modèle rapide marche ; tout vient du service worker |
| B | N'a vu que l'accueil du site | L'outil s'ouvre avec ses polices, la démonstration marche, l'importation explique l'attente |
| C | A seulement analysé une photo en ligne | Le réglage « rapide » bascule sur le modèle standard conservé, et le dit |
| D | Préparé, puis le moteur change de version | Le service worker reconduit le moteur, purge l'ancien ; l'analyse hors ligne marche avec le nouveau |
| E | GPU matériel simulé, avec et sans tampons flottants | Calcul sur le GPU dans un cas, sur le processeur dans l'autre, personne détectée dans les deux |

Trente-huit vérifications, dont une sur l'absence de toute requête vers un
tiers ; code de retour 1 si l'une échoue. Les fichiers d'essai,
`tests/posture-essai.jpg` et `tests/levage-essai.webm` (3 s : la charge contre
le corps, puis bras tendus, puis de nouveau contre le corps), sont tirés d'une
image du site par `tests/fabriquer-essais.mjs` : aucun enregistrement réel.
`--photo` et `--video` pour en essayer d'autres.

`niosh.test.mjs` vérifie chaque multiplicateur **aux bornes de son domaine**, là
où la méthode bascule à zéro, plus un levage complet calculé à la main.

`reba.test.mjs` et `rula.test.mjs` vérifient chaque cotation élémentaire, des cas
complets cotés à la main (pour RULA : un poste assis prolongé, un travail au-dessus
de la tête, une manutention), et la **monotonie de toutes les tables** — c'est ce
dernier contrôle qui attrape une coquille de recopie qu'aucun cas isolé ne
révélerait.

`angles.test.mjs` fabrique des squelettes dont les angles sont connus d'avance
et vérifie que le calcul les retrouve, y compris que **tourner le sujet devant
la caméra ne change pas ses angles**.

---

## Ce que la cote couvre, et ce qu'elle ne couvre pas

**Mesuré depuis l'image** — angles du tronc, du cou, des genoux ; élévation et
abduction du bras, flexion du coude ; torsion et inclinaison, par seuil.

**Saisi par l'opérateur** — la charge, la qualité de la prise, la
pronosupination de l'avant-bras (RULA), le caractère statique / répété /
instable de l'activité, la fréquence et la durée de la tâche (NIOSH). Les méthodes en ont besoin, aucune image ne les
contient. L'interface les demande explicitement plutôt que de les supposer :
elles peuvent à elles seules faire passer une cote de 7 à 13.

**Hors de portée de la méthode** — vibrations, froid, état du sol, fatigue,
sommeil, douleur déjà présente, expérience au poste, organisation du travail.
Une cotation posturale ne remplace pas une analyse de poste.

### Mesuré sur cinq photos réelles

Le raccordement à MediaPipe a été exercé sur cinq images de postes réels
(cadrages serrés, issus d'une vidéo publicitaire). Résultats, à paramètres
neutres — sans charge, bonne prise, activité non majorée :

| Scène | REBA | Ce que ça apprend |
|---|---|---|
| Traction d'un transpalette | **aucune détection** | Sujet coupé au bord du cadre : rien n'est détecté du tout |
| Saisie d'une caisse sur palette | 7 | Le cas le plus contraignant des quatre détectés |
| Port de la caisse contre le corps | 3 | Correctement identifié comme le plus faible |
| Vissage à l'établi | 5 | |
| Chargement d'un coffre à bagages | 5 | Surcoté : le tronc est lu en extension 30°, le poignet à −50° |

Le classement se tient — le port contre le corps ressort le plus bas, la saisie
le plus haut — mais deux choses ont dû être corrigées pour y arriver, et une
troisième reste ouverte (voir ci-dessous).

**Le cadrage décide de tout.** Sur quatre des cinq images, la visibilité des
jambes tombait sous 0,3 : le détecteur extrapolait des genoux fléchis à 74–87°
pour des gens debout, ce qui gonflait chaque cote d'un ou deux points sans que
rien ne le signale. C'est corrigé — les jambes hors cadre ne sont plus cotées
mais laissées à l'opérateur — et ça reste la première cause d'erreur.

### Limites connues

- **Le poignet est la cote la moins fiable.** Trois repères de main ne suffisent
  pas à mesurer une flexion au degré près : sur les images d'essai il a produit
  −50° et −30° là où la main était à peu près droite, et coté 3 dans trois cas
  sur quatre. À corriger à l'œil quand elle compte.
- **Le tronc peut être lu en extension à tort** quand le visage est de trois
  quarts ou partiellement masqué : le sens « avant » est déduit du nez et des
  oreilles, et devient fragile si la tête est tournée.
- **Jambes hors cadre.** Elles ne sont plus cotées depuis des repères
  extrapolés : l'interface bascule sur la position déclarée par l'opérateur et
  l'indique. Filmer le corps entier reste préférable de loin.
- **Un seul sujet à la fois.** S'il y a deux personnes dans le cadre, seule la
  plus proéminente est suivie.
- **Le parcours se fait par déplacements, pas en lecture.** La lecture semblait
  naturelle, mais `requestVideoFrameCallback` ne se déclenche que lorsqu'une
  image est *présentée à l'écran* : il se tait dans un onglet en arrière-plan ou
  quand rien ne compose la vidéo, et l'analyse reste bloquée sans fin. Le
  déplacement est déterministe, fonctionne en arrière-plan, et sa durée ne
  dépend que de la vitesse d'inférence.
- **Une seule caméra.** Les angles hors du plan de la caméra sont les moins
  précis. Filmer de trois quarts plutôt que de face ou de dos.

### Protocole de tournage

C'est la variable qui pèse le plus sur la justesse, avant tout réglage :

1. **Le corps entier dans le cadre**, pieds compris, pendant tout le geste.
2. **De trois quarts**, ni de face ni de profil strict : une flexion du tronc
   est invisible de face, une abduction l'est de profil.
3. **Une seule personne** dans le champ, ou la plus proche nettement détachée.
4. **Caméra fixe**, à hauteur de hanche, à 3–5 m.
5. **Le cycle complet**, du départ au retour : c'est le pic qui compte, et il
   dure souvent moins d'une seconde.
- **L'épaule haussée et le bras soutenu** ne sont pas détectés : ce sont des
  majorations REBA laissées au jugement de l'opérateur.
- Les images où les repères sont masqués sont **écartées et comptées**, jamais
  silencieusement ignorées : le nombre s'affiche sous la chronologie.

### Sur le code couleur

L'échelle vert–jaune–orange–rouge est le code le moins accessible qui soit :
l'écart mesuré entre l'orange et le jaune tombe à ΔE 0,6 en vision deutéranope,
et le rouge et l'orange ne sont séparés que de 6,1 en vision normale. Chaque
élément coloré de l'interface porte donc aussi son chiffre ou son nom. À
conserver si l'interface évolue.

---

## Confidentialité

Rien n'est téléversé. La vidéo est lue par le navigateur depuis le disque, le
modèle tourne en local, aucune image ne sort du poste. Sur le site publié, le
moteur et les polices sont servis depuis la même origine que la page : aucune
requête ne part vers un tiers — et hors ligne, il n'y a plus de requête réseau
du tout. C'est ce qui rend l'outil utilisable sur des enregistrements de
travailleurs identifiables.

MediaPipe envoie de lui-même des statistiques d'usage à Google
(`odml.pa.googleapis.com`), sans option pour s'en passer ; ce ne sont pas des
images, mais c'est une requête vers un tiers. `pose.js` l'arrête avant qu'elle
parte, et le parcours navigateur vérifie qu'aucune ne sort.

Filmer un travailleur reste un traitement de renseignements personnels :
consentement, finalité et durée de conservation se règlent en amont de l'outil.

---

## Référence

Waters, T. R., Putz-Anderson, V., Garg, A. et Fine, L. J. (1993). *Revised NIOSH
equation for the design and evaluation of manual lifting tasks*. Ergonomics,
36(7), 749–776.

Hignett, S. et McAtamney, L. (2000). *Rapid Entire Body Assessment (REBA)*.
Applied Ergonomics, 31(2), 201–205.

McAtamney, L. et Corlett, E. N. (1993). *RULA: a survey method for the
investigation of work-related upper limb disorders*. Applied Ergonomics,
24(2), 91–99.

Estimation de pose : MediaPipe Pose Landmarker (Google), 33 repères 3D.
