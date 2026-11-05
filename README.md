# Code secret en couleurs

Projet universitaire de jeu de déduction inspiré de Mastermind : retrouver une combinaison secrète de couleurs.

## État et références

Le projet est en préparation : aucun jeu jouable n'est encore disponible et aucun test du jeu n'a été exécuté.
L'énoncé mentionne un modèle fourni en cours. Son rôle et sa disponibilité restent à clarifier.

Le descriptif officiel du projet (édition 2.1) et le contrat d'API commun 0.2 font autorité. Ces documents ne sont pas présents dans le dépôt à ce stade ; ils doivent être consultés avant l'implémentation. Toute ambiguïté doit être signalée.

## Règles officielles

- Le secret comporte **4 couleurs ordonnées**, choisies parmi **rouge, bleu, vert, jaune, orange, violet**. Les répétitions sont autorisées.
- Le joueur dispose de **10 tentatives au maximum** pour retrouver le secret.
- Une proposition invalide ou incomplète ne consomme aucune tentative.
- Le retour indique le nombre de couleurs **bien placées** et **mal placées** (présentes dans le secret, mais à une autre position). Les correspondances bien placées sont comptées en premier ; chaque occurrence du secret et de la proposition ne peut être comptée qu'une fois.

## Tests prévus : résultats attendus

| Secret | Proposition | Bien placées | Mal placées |
| --- | --- | --- | --- |
| [rouge, bleu, vert, jaune] | [rouge, vert, bleu, orange] | 1 | 2 |
| [rouge, rouge, bleu, vert] | [rouge, rouge, rouge, rouge] | 2 | 0 |

Ces valeurs sont des **résultats attendus**, et non des observations d'exécution. **Aucun test n'a encore été exécuté** ; le comportement du jeu reste à vérifier.

## Interface et point à vérifier

- Décision : afficher les noms français des couleurs avec les pions colorés pour faciliter leur identification.
- Limitation : l'utilisabilité sur mobile n'a pas encore été vérifiée.
- Comment vérifier l'accessibilité du jeu sur différents appareils ?
