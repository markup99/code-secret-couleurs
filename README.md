# Code secret en couleurs

Projet universitaire de jeu de déduction inspiré de Mastermind : retrouver une combinaison secrète de couleurs.

## État et références

Le moteur JavaScript est implémenté et testé sous Node.js. Aucune interface jouable ni aucun adaptateur d'API navigateur n'est encore disponible.
L'énoncé mentionne un modèle fourni en cours. Son rôle et sa disponibilité restent à clarifier.

Sources faisant autorité : « Projet — Code secret en couleurs », édition 2.1 (annexe `code-couleurs-1.0`), et « API commune de test — Code secret en couleurs », contrat 0.2, tous deux mis à jour le 28 octobre 2026. Les PDF joints à la demande ont été consultés ; ils ne sont pas copiés dans le dépôt. Toute ambiguïté doit être signalée.

## Règles officielles

- Le secret comporte **4 couleurs ordonnées**, choisies parmi **rouge, bleu, vert, jaune, orange, violet**. Les répétitions sont autorisées.
- Le joueur dispose de **10 tentatives au maximum** pour retrouver le secret.
- Une proposition invalide ou incomplète ne consomme aucune tentative.
- Le retour indique le nombre de couleurs **bien placées** et **mal placées** (présentes dans le secret, mais à une autre position). Les correspondances bien placées sont comptées en premier ; chaque occurrence du secret et de la proposition ne peut être comptée qu'une fois.

## Organisation et choix avec Codex

- `js/engine.js` : exporte `createGame()`, qui garde le secret et l'état privés. `getConfig()` et `getState()` sont synchrones ; `startGame(options?)` et `submitGuess(guess)` retournent des promesses. Un démarrage invalide rejette avec une `Error` portant `code` ; une proposition refusée retourne l'état avec `lastError`. Les données entrantes et sortantes sont copiées.
- `tests/engine.test.js` : tests automatisés du moteur, avec les résultats attendus définis avant exécution.
- `package.json` : active les modules JavaScript et fournit `npm test`, sans dépendance à installer.

Décision prise avec Codex : utiliser un seul moteur indépendant du DOM. La future interface et l'API devront partager **la même instance** créée par `createGame()`. La couche d'application devra aussi attendre la mise à jour de l'écran avant de résoudre les appels publics. Aucun objet `window.codeSecretTest` n'est encore exposé.

## Vérifications du moteur : attendu et obtenu

Depuis la racine du dépôt, avec Node.js 20 ou plus récent :

```sh
npm test
```

Exécution réalisée le 5 novembre 2026 avec Node.js 24.19.0 : **48 tests réussis, 0 échec, 0 ignoré**. Il s'agit de tests locaux du moteur, pas d'une validation de l'API navigateur complète.

Exemples officiels du contrat 0.2, section 5. Chaque ligne démarre une partie imposée :

| Cas | Attendu bien/mal placées | Obtenu | État obtenu |
| --- | --- | --- | --- |
| T01 | 1 / 2 | 1 / 2 | playing |
| T02 | 0 / 2 | 0 / 2 | playing |
| T03 | 0 / 4 | 0 / 4 | playing |
| T04 | 2 / 2 | 2 / 2 | playing |
| T05 | 4 / 0 | 4 / 0 | won |
| T06 | 2 / 0 | 2 / 0 | playing |
| T07 | 2 / 2 | 2 / 2 | playing |
| T08 | 4 / 0 | 4 / 0 | won |
| T09 | 1 / 2 | 1 / 2 | playing |

Les neuf tests vérifient aussi un seul essai, une entrée d'historique, les champs `lastGuess` / `lastResult` et `lastError` nul.

| Autres contrôles exécutés | Attendu | Obtenu |
| --- | --- | --- |
| Propositions invalides et priorités | Code normalisé ; seul `lastError` change | Conforme |
| Démarrages invalides | Promesse rejetée ; état entier et secret précédent conservés | Conforme |
| Neuf échecs, proposition invalide, puis proposition exacte | Refus sans essai ; victoire au dixième essai | Conforme |
| Dix échecs valides | `lost`, 10 essais, dernier résultat 0 / 0 | Conforme |
| Propositions après victoire ou défaite | `game-finished`, données de partie inchangées | Conforme |
| Redémarrage depuis playing, won ou lost | `playing`, zéro essai, historique vide, champs last… nuls | Conforme |
| Modification des entrées et résultats | Aucun effet sur l'état interne | Conforme |
| Démarrages aléatoires avec tirages contrôlés | Six couleurs accessibles, répétitions possibles, aucun ancien secret imposé conservé | Conforme |

Les tirages contrôlés vérifient le mécanisme de génération, pas une distribution statistique. Aucun exemple de correction avant/après n'est revendiqué pour cette première implémentation.

## Interface et point à vérifier

- Décision : afficher les noms français des couleurs avec les pions colorés pour faciliter leur identification.
- Limitation : l'utilisabilité sur mobile n'a pas encore été vérifiée.
- Restent à vérifier : modèle du cours, interface, synchronisation interface/API, exposition conditionnelle de l'API 0.2, navigateurs et publication GitHub Pages.
- Comment vérifier l'accessibilité du jeu sur différents appareils ?
