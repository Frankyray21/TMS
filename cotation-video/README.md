# Cotation ergonomique vidéo

Coter une posture de travail en REBA à partir d'une vidéo, automatiquement,
sans que la vidéo quitte le poste.

Une vidéo entre, une cote REBA par image en sort, plus la synthèse de la
séquence : posture habituelle, pire instant, temps passé dans chaque niveau de
risque, segment qui pèse le plus lourd.

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
vidéo → estimation de pose → angles articulaires → cotation REBA → synthèse
        (MediaPipe)          (angles.js)           (reba.js)       (reba.js)
```

| Fichier | Rôle |
|---|---|
| `js/reba.js` | **Le modèle.** Tables A, B, C de la méthode publiée, cotation par segment, niveaux de risque, synthèse de séquence. Aucune dépendance, aucun DOM. |
| `js/angles.js` | Géométrie : des 33 repères 3D aux angles du tronc, du cou, des genoux, du bras, du coude et du poignet. |
| `js/pose.js` | La seule dépendance à MediaPipe. Changer de détecteur ne toucherait que ce fichier. |
| `js/analyse.js` | Parcours de la vidéo, lissage, cotation, recotation. |
| `js/rendu.js` | Squelette coloré, jauge, chronologie. |
| `js/demo.js` | Le cycle de levage simulé de l'écran d'accueil. |
| `js/app.js` | Interface. Ne contient aucune règle de cotation. |

### Le lissage porte sur les angles, jamais sur les cotes

Les tables REBA ne sont pas linéaires : moyenner des cotes produirait un
chiffre qui ne correspond à aucune posture réelle. La médiane glissante
s'applique donc aux angles, avant cotation, et les seuils booléens (torsion,
inclinaison) sont réévalués ensuite.

---

## Les tests

```bash
node tests/reba.test.mjs      # 69 vérifications
node tests/angles.test.mjs    # 39 vérifications
```

`reba.test.mjs` vérifie chaque cotation élémentaire, deux cas complets cotés à
la main, et la **monotonie des trois tables** — c'est ce qui attrape une
coquille de recopie qu'un cas isolé laisserait passer.

`angles.test.mjs` fabrique des squelettes dont les angles sont connus d'avance
et vérifie que le calcul les retrouve, y compris que **tourner le sujet devant
la caméra ne change pas ses angles**.

---

## Ce que la cote couvre, et ce qu'elle ne couvre pas

**Mesuré depuis l'image** — angles du tronc, du cou, des genoux ; élévation et
abduction du bras, flexion du coude ; torsion et inclinaison, par seuil.

**Saisi par l'opérateur** — la charge, la qualité de la prise, le caractère
statique / répété / instable de l'activité. REBA en a besoin, aucune image ne
les contient. L'interface les demande explicitement plutôt que de les supposer :
elles peuvent à elles seules faire passer une cote de 7 à 13.

**Hors de portée de la méthode** — vibrations, froid, état du sol, fatigue,
sommeil, douleur déjà présente, expérience au poste, organisation du travail.
Une cotation posturale ne remplace pas une analyse de poste.

### Limites connues

- **Le poignet est la cote la moins fiable.** Trois repères de main ne suffisent
  pas à mesurer une flexion au degré près. À corriger à l'œil quand elle compte.
- **Un seul sujet à la fois.** S'il y a deux personnes dans le cadre, seule la
  plus proéminente est suivie.
- **Une seule caméra.** Les angles hors du plan de la caméra sont les moins
  précis. Filmer de trois quarts plutôt que de face ou de dos.
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

Hignett, S. et McAtamney, L. (2000). *Rapid Entire Body Assessment (REBA)*.
Applied Ergonomics, 31(2), 201–205.

Estimation de pose : MediaPipe Pose Landmarker (Google), 33 repères 3D.
