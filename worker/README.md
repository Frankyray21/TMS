# Worker Cloudflare — Attestations TMS (web)

Ce petit serveur (« Worker ») reçoit les attestations de la formation
**Prévention TMS** terminées sur le site et les enregistre **automatiquement
dans Airtable** (base **Formations**, table **Attestations TMS (web)**).

Le fichier à déployer est **[`worker.js`](./worker.js)**.

---

## Pourquoi un Worker (et pas Pages) ?

- **Pages** = héberger un *site* (des pages web). Ce n'est **pas** ce qu'il
  nous faut ici.
- **Worker** = un *mini-serveur* qui exécute du code. C'est lui qui peut parler
  à Airtable **sans exposer la clé secrète** dans le navigateur.

> Si tu as déjà un projet **Pages** nommé `procedures-forage-mri`, laisse-le
> tranquille : c'est un autre projet. On crée ici un **Worker** à part.

---

## Déploiement pas à pas (5 min)

1. **dash.cloudflare.com** → menu **« Workers & Pages »**.
2. Bouton **« Create application »** → onglet **« Workers »** →
   **« Create Worker »**.
3. Nomme-le **`attestations-tms`** → **Deploy** (ça crée un Worker vide).
4. **« Edit code »** → **efface tout** le contenu par défaut →
   **colle tout le contenu de [`worker.js`](./worker.js)** → **Deploy**
   (bouton en haut à droite).
5. Onglet **« Settings »** → **« Variables and Secrets »** → **« Add »** :
   - Type : **Secret**
   - Nom : **`AIRTABLE_TOKEN`**
   - Valeur : *ton jeton Airtable* (Personal Access Token, commence par `pat…`)
   - **Save / Deploy**.
6. Copie l'**URL du Worker** (du type
   `https://attestations-tms.<ton-sous-domaine>.workers.dev`) et **envoie-la**
   pour qu'on la branche au site.

### Le jeton Airtable (`AIRTABLE_TOKEN`)

À créer sur **airtable.com/create/tokens** :
- **Scopes** : `data.records:write`
- **Access** : ajouter la base **« Formations »**

---

## Vérifier que le Worker tourne

Ouvre l'URL du Worker dans le navigateur (requête GET). Tu dois voir :

```json
{ "ok": true, "service": "attestations-tms" }
```

---

## Brancher le site

Une fois l'URL connue, on renseigne la constante `ATTEST_ENDPOINT` en haut de
**`formation.js`** (à la racine du dépôt) avec l'URL du Worker, puis on bumpe la
version du Service Worker (`sw.js`). Tant que cette constante est vide, le site
fonctionne normalement — il n'envoie simplement rien à Airtable.

---

## Deux versions de l'attestation

La formation guidée produit **deux versions** :

- **Version « travailleur »** — l'attestation propre que la personne
  **imprime ou enregistre en PDF** (sans le détail du temps).
- **Version « Airtable »** — une attestation **détaillée** (tableau du temps
  passé par section + score), **téléversée automatiquement** dans le champ
  pièce jointe **« Attestation »**. C'est elle qui sert au suivi.

## Ce qui est envoyé à Airtable

| Colonne Airtable | Exemple                  | Source                               |
|------------------|--------------------------|--------------------------------------|
| Nom              | `Jean Tremblay`          | nom saisi sur l'attestation          |
| Formation        | `Prévention TMS`         | fixe                                 |
| Date             | `2026-06-25`             | date du jour                         |
| Langue           | `FR` / `EN`              | langue de la page                    |
| Score quiz       | `5/5 modules`            | modules réussis (indicatif)          |
| Temps total      | `24 min 30 s`            | temps total mesuré sur le site       |
| Détail du temps  | `01 · … — 5 min 12 s …`  | temps passé par section (module)     |
| Attestation      | *(image PNG détaillée)*  | attestation détaillée (suivi temps)  |
| Source           | `site web formation`     | fixe                                 |
| Statut           | `Reçu`                   | fixe (à passer à `Traité` à la main) |
| Mine             | *(vide)*                 | optionnel (non collecté à ce jour)   |

> **Colonnes « Temps total » et « Détail du temps »** : déjà créées dans la
> table. Si elles venaient à manquer, le Worker **réessaie sans elles** et
> l'attestation est quand même enregistrée (l'image détaillée contient de toute
> façon le suivi du temps).
