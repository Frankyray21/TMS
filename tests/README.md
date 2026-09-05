# Tests des parcours TMS

Depuis la racine du dépôt, avec Node.js 22 ou supérieur :

```sh
node --test tests/*.test.cjs tests/*.test.mjs cotation-video/tests/*.test.mjs
```

Les tests des attestations et des sessions utilisent uniquement un stockage et
un transport simulés. Aucun nom, commentaire ou tracé de signature n’est envoyé
au service réel. Les hooks de test des scripts autonomes sont injectés en
mémoire par les tests, jamais exposés par le site.

Couverture : navigation FR/EN et liens historiques, reprise notion/quiz,
seuil de réussite, transmission explicite, absence de signature, incertitude
réseau, reçus, annulation, identité, stockage indisponible et poste partagé.
Les tests existants de calcul et de géométrie restent inchangés.

## Contrôles navigateur avant publication

- FR et EN à 360, 390, 768 et 1440 px, avec un nom long.
- Déplacement au clavier, langue et panneau de session accessibles.
- Notion puis rechargement, reprise exacte et changement de langue.
- Formulaire d’attestation : signature vide refusée ; un changement de nom
  exige un nouveau tracé ; statut reçu conservé après rechargement.
- Réseau simulé : hors ligne sans POST, réponse perdue sans relance automatique,
  signature non confirmée distincte d’un succès complet, double clic et
  changement de travailleur pendant un envoi.
- Tous les POST sont interceptés par le banc d’essai ; ne jamais tester en
  soumettant des données réelles sur le site de production.

## Limites explicites

La reprise automatique a été supprimée : une signature reste uniquement dans
l’onglet courant. Après fermeture, le travailleur signe à nouveau si un envoi
reste nécessaire. Le reçu local contient des métadonnées, pas le tracé.

L’API existante n’offre pas de clé d’idempotence. Une réponse perdue peut donc
correspondre à un enregistrement effectué côté serveur : l’interface avertit
et demande de vérifier auprès du responsable avant toute nouvelle tentative.
Annuler un appel ne retire pas une attestation déjà reçue par le service.

Les anciens parcours restent accessibles avec une notice ; leurs validations
ne sont pas transférées automatiquement vers les quiz de la formation guidée.
