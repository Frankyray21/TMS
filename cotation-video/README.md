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

**Projet distinct du site de formation TMS.** Il vit dans ce dépôt pour ne pas
être perdu, mais il est exclu du déploiement (voir `.github/workflows/deploy-pages.yml`)
et n'est lié depuis aucune page du site.

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

### Mode hors ligne

Par défaut le moteur de pose est chargé depuis un CDN public. Pour un site sans
réseau — ce qui est le cas courant sous terre :

```bash
bash outils/telecharger-modeles.sh        # ~18 Mo dans vendor/
```

L'outil détecte `vendor/` au chargement et bascule tout seul. Plus aucune
requête ne sort. Le dossier n'est pas versionné : chaque poste le régénère.

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
node tests/reba.test.mjs      # 69 vérifications
node tests/rula.test.mjs      # 68 vérifications
node tests/niosh.test.mjs     # 61 vérifications
node tests/angles.test.mjs    # 39 vérifications
```

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
modèle tourne en local, aucune image ne sort du poste. En mode hors ligne il
n'y a même plus de requête réseau du tout. C'est ce qui rend l'outil utilisable
sur des enregistrements de travailleurs identifiables.

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
