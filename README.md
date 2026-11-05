# Code secret en couleurs

Projet universitaire de jeu de déduction inspiré de Mastermind : retrouver une combinaison secrète de couleurs.

## État et références

Le moteur JavaScript, l'interface web jouable en français et l'API commune de test 0.2 sont implémentés. L'API est accessible uniquement avec le paramètre d'URL `test=1`.
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
- `package.json` : active les modules JavaScript et fournit `npm test` (moteur, sans dépendance à installer) et `npm run test:api` (navigateur, Playwright en dépendance de développement).
- `index.html`, `css/styles.css`, `js/ui.js` : interface responsive, quatre sélecteurs ordonnés, couleurs nommées, historique, indices, essais restants et messages de partie.
- `js/app.js` : crée une seule instance du moteur et la transmet à l'interface ; expose conditionnellement l'API 0.2. Aucun calcul de score n'est dupliqué.
- `tests/api.test.js` : tests de conformité de l'API et de synchronisation avec la véritable interface, servis localement sous `/code-secret-couleurs/` dans Chromium.
- `package-lock.json` : fixe les versions des outils de test ; `.gitignore` exclut `node_modules/`.

Décision prise avec Codex : utiliser un seul moteur indépendant du DOM. L'interface et l'API partagent **la même instance** créée par `createGame()`. Les méthodes de mutation communes de `js/ui.js` attendent le moteur, mettent à jour le DOM et les commandes, puis résolvent leur promesse avec l'état. Un démarrage invalide rejette avant toute modification de l'écran. Les erreurs inattendues de l'API restent des rejets ; les gestionnaires des boutons affichent un message et les signalent dans la console.

## Jouer en local

Depuis la racine du dépôt :

```sh
python3 -m http.server 8000
```

Ouvrir `http://localhost:8000` dans un navigateur moderne. Choisir les quatre couleurs puis valider ; le compteur indique le nombre de positions remplies, y compris les couleurs répétées. Une proposition acceptée efface les sélections et remet le compteur à 0/4 ; une proposition refusée conserve les sélections. Les sélecteurs et boutons natifs fonctionnent au clavier (Tab, flèches, Entrée), à la souris et au toucher. « Nouvelle partie » efface la partie en cours et démarre un nouveau secret.

Le site est statique, utilise des chemins relatifs et ne nécessite ni compilation ni service distant : il est prévu pour GitHub Pages. Les modules JavaScript nécessitent un serveur HTTP ; ne pas ouvrir directement `index.html` via `file://`.

## Utiliser l'API commune 0.2

Ouvrir `http://localhost:8000/?test=1` en local, ou ajouter `test=1` aux paramètres de l'URL GitHub Pages en conservant les autres paramètres. Attendre l'apparition de `window.codeSecretTest` avant le premier appel. En mode test, le jeu est initialement `not-started` : aucune partie automatique ni aucun ancien secret imposé. Sans `test=1`, l'objet n'est pas exposé et le jeu démarre normalement.

```js
const api = window.codeSecretTest;
api.version; // "0.2"
api.getConfig(); // synchrone, configuration du contrat
api.getState(); // synchrone, copie de l'état courant
await api.startGame({ secret: ["rouge", "rouge", "bleu", "vert"] });
await api.submitGuess(["rouge", "bleu", "rouge", "rouge"]); // 1 bien placée, 2 mal placées
await api.startGame(); // nouveau secret aléatoire ; {} et undefined sont aussi acceptés
```

Les appels de mutation doivent être attendus successivement. `startGame(options?)` renvoie une `Promise<State>` ou rejette avec une `Error` portant `code` et `message` si les options sont invalides ; l'état et l'interface restent alors identiques. `submitGuess(guess)` renvoie une `Promise<State>`, y compris en cas de refus prévu, décrit par `lastError` sans consommation d'essai. Le moteur applique les priorités du contrat et fournit les copies défensives. Aucun champ de secret ni révélation séparée n'est ajouté, et l'API n'utilise aucun serveur applicatif ou service d'IA.

Pour exécuter les tests de navigateur (Node.js 20 ou plus récent) :

```sh
npm ci
npx playwright install chromium
npm run test:api
```

Les tests lancent et arrêtent leur propre serveur HTTP local ; aucun serveur préalable n'est nécessaire. Avec un Chromium déjà installé, on peut utiliser `CHROMIUM_PATH=/chemin/vers/chromium npm run test:api` au lieu d'installer le navigateur Playwright. Ces outils de développement ne sont pas chargés par le site et ne changent pas son hébergement statique.

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

## Vérifications de l'interface et limites

- Décision : afficher les noms français des couleurs avec les pions colorés pour faciliter leur identification.
- Après l'implémentation de l'interface, le 5 novembre 2026 : `npm test` a de nouveau réussi les **48 tests existants**, sans modification du moteur ni des tests. Les contrôles de syntaxe de `js/ui.js` et `js/app.js` ont aussi réussi.
- Un script de contrôle temporaire avec Playwright et Chromium headless a réellement vérifié : six couleurs affichées, quatre sélecteurs, proposition incomplète sans essai consommé, focus sur la première position vide, ordre des couleurs dans l'historique et absence de `window.codeSecretTest`.
- Avec le secret contrôlé `[rouge, rouge, bleu, vert]` : `[rouge, rouge, rouge, rouge]` devait afficher 2 bien placées / 0 mal placée, et `[bleu, vert, rouge, rouge]` devait afficher 0 / 4. Les résultats affichés étaient conformes. Ont aussi réussi : soumission au clavier, victoire au dixième essai, défaite après dix échecs, verrouillage des sélecteurs en fin de partie et redémarrage depuis chaque état.
- Aucun débordement horizontal observé aux largeurs 320, 390, 768 et 1280 pixels ; hauteur des sélecteurs d'au moins 44 pixels. Les boutons de redémarrage et de validation ont répondu aux taps en émulation tactile Chromium. Ces contrôles ne constituent pas une validation sur téléphone réel.
- Restent à vérifier manuellement : Safari et Firefox, menus de sélection sur iOS/Android réels, lecteur d'écran et annonces dynamiques, zoom et contraste renforcé, ergonomie mobile, ainsi que le chargement sur GitHub Pages après une publication autorisée. Le modèle du cours et l'énoncé officiel 2.1 ne sont pas disponibles dans cet espace de travail. Le contrat 0.2 complet a été fourni et relu pour l'implémentation de l'API ci-dessous.

## Vérifications de l'API 0.2 : attendu et obtenu

Source lue intégralement : PDF « API commune de test — Code secret en couleurs », contrat 0.2, édition Google 1.5 du 28 octobre 2026, **six pages**, dont les cas T01–T09 et les contrôles de cycle de vie et d'intégration.

Exécution locale le 5 novembre 2026 avec Node.js 24.19.0, Playwright 1.64.1 et Chromium headless 154.0.8037.57 : `npm test` donne **48 réussites, 0 échec, 0 ignoré** ; `CHROMIUM_PATH=/usr/bin/chromium npm run test:api` donne **58 réussites, 0 échec, 0 ignoré**. Le moteur et les 48 tests existants n'ont pas été modifiés.

Les neuf cas T01–T09 ont été rejoués via `window.codeSecretTest` dans le véritable navigateur : **les neuf résultats attendus et obtenus correspondent exactement au tableau du moteur ci-dessus**, ainsi que les états `won` pour T05/T08 et `playing` pour les autres. Chaque cas vérifie un essai, une entrée d'historique, `lastGuess`, `lastResult` et `lastError` nul, ainsi que les couleurs ordonnées et les indices effectivement affichés.

| Contrôles API exécutés | Résultat attendu | Résultat observé |
| --- | --- | --- |
| Exposition et état initial | API 0.2 avec `test=1`, `not-started`, écran prêt ; absence sans ce paramètre exact | Conforme, y compris autres paramètres, clés répétées et rechargement |
| Signatures et getters | Getters synchrones sans effet sur l'écran ; mutations renvoyant des promesses ; résultats JSON | Conforme |
| Propositions invalides | Priorités état → type → longueur → couleur ; seul `lastError` change ; refus visible pendant playing | Conforme pour 15 formes, dont trous, undefined, casse, espace et traduction |
| Démarrages invalides | `Error` rejetée avec code/message ; état, écran, sélections, focus et erreur précédente inchangés | Conforme pour 15 formes d'options/secrets ; contrôle aussi depuis not-started, won et lost |
| Neuvième essai puis victoire | Refus sans essai consommé ; code exact ensuite : won à 10 | Conforme |
| Défaite et appels après la fin | lost après dix échecs à 0/0 ; game-finished prioritaire ; historique conservé | Conforme pour propositions valides et invalides après won/lost |
| Redémarrages | playing, zéro essai, historique/indices/erreurs/sélections effacés | Conforme depuis l'API et le bouton de l'interface |
| Copies défensives et getters purs | Modifier entrées, états, historique, indices, configuration ou erreurs renvoyés n'affecte pas la partie | Conforme, y compris modification des entrées avant résolution de la promesse |
| Tirages aléatoires contrôlés | Omission, undefined et {} abandonnent l'ancien secret ; six couleurs et répétitions possibles | Conforme ; ne constitue pas une preuve de distribution statistique |
| Synchronisation écran/API | À chaque résolution, essais, historique, indices, messages et commandes correspondent à l'état ; actions du joueur lisibles par getState | Conforme, sans délai ni polling ajouté après résolution des appels API |
| Exceptions inattendues | Rejet de la promesse, sans conversion en refus de saisie | Conforme pour erreurs de getters de test |
| Régression du jeu visible | Clavier, souris, mode normal sans API, absence de débordement à 320/390/768/1280 px et taps émulés | Conforme |

Un premier passage a détecté une régression du focus après un refus de formulaire : le sélecteur était encore désactivé au moment du focus. La correction réactive les commandes pendant le rendu, avant de rendre la main. Le test clavier passe dans l'exécution finale. Les contrôles de syntaxe JavaScript et `git diff --check` ont aussi réussi.

**Non exécutés :** tests de cette nouvelle version depuis l'URL GitHub Pages publiée (aucune publication autorisée), outil de test enseignant, essais sur deux architectures, autres moteurs de navigateur et vérifications manuelles d'accessibilité/appareils listées ci-dessus. Les tests utilisent le véritable DOM et Chromium sur un serveur statique local sous `/code-secret-couleurs/` ; cela vérifie les chemins relatifs, pas une publication distante.

## Petite amélioration : compteur des couleurs sélectionnées

Travail du 5 novembre 2026 à partir de `main`, commit `2e04659f0c8f9c2b42c2a8b0a6bf61352423efa7`. Objectif : rendre visible le nombre de positions remplies, avec un changement limité et des résultats attendus comparés aux observations. Le support de l'atelier enseignant du 4 novembre n'est pas disponible ici ; aucune conformité à son contenu précis n'est revendiquée. Les PDF officiels ne sont pas présents dans cet espace ; les règles, le moteur et les signatures/données de l'API 0.2 restent inchangés.

Le compteur apparaît au-dessus des quatre sélecteurs et utilise une région d'annonce `polite`. Il compte les positions remplies, même si une couleur est répétée. À la demande, une proposition acceptée efface désormais les sélections ; une proposition refusée les conserve. Ce changement de présentation ne modifie ni le score, ni les essais, ni l'historique.

Résultats attendus définis dans les assertions avant exécution, puis réellement observés dans Chromium headless :

| Action / situation | Résultat attendu | Résultat observé |
| --- | --- | --- |
| Chargement normal, état test non démarré ou démarrage d'une partie | `0/4 couleurs sélectionnées.` | Conforme, compteur visible |
| Sélection d'une couleur | `1/4 couleurs sélectionnées.` | Conforme |
| Deux puis trois positions remplies | `2/4`, puis `3/4` | Conforme |
| Quatre positions remplies avec rouge répété quatre fois | `4/4` | Conforme : les occurrences sont comptées séparément |
| Remplacement d'une couleur sans vider la position | Le compteur reste à `4/4` | Conforme |
| Effacement successif des quatre positions | `3/4`, `2/4`, `1/4`, `0/4` | Conforme |
| Validation d'une proposition incomplète à trois couleurs | `3/4`, aucun essai consommé | Conforme |
| Proposition valide `[rouge, rouge, rouge, rouge]`, secret `[rouge, rouge, bleu, vert]` | Compteur `0/4`, sélecteurs/pions vides ; 1 essai, indices 2 / 0, état playing | Conforme, historique et état API synchronisés |
| Refus API d'une proposition trop courte ou d'un démarrage invalide | Sélection et compteur `1/4` conservés ; aucun essai consommé | Conforme |
| Proposition gagnante via l'API | `0/4` dès la résolution de la promesse ; état won | Conforme |
| Nouvelle partie via bouton ou API, depuis une sélection remplie ; bouton après victoire | `0/4` | Conforme |
| Sélection au clavier en mode normal | `1/4`, sans exposition de l'API | Conforme |
| Largeurs 320, 390, 768 et 1280 pixels | Compteur visible et contenu dans l'écran, aucun débordement horizontal | Conforme |

Commandes et résultats de cette modification, avec Node.js 24.19.0, Playwright 1.64.1 et Chromium 154.0.8037.57 :

- `npm test` : **48 réussites, 0 échec, 0 ignoré** ; tests du moteur inchangés.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:api` avant l'ajout des nouveaux tests : **58 réussites, 0 échec, 0 ignoré**, suite existante inchangée.
- Même commande après ajout des quatre tests du compteur dans `tests/api.test.js` : **62 réussites, 0 échec, 0 ignoré**, dont les 58 tests existants. Cela couvre aussi les régressions de score, de cycle de vie, de clavier, de souris et de toucher émulé.
- `node --check js/ui.js`, `node --check tests/api.test.js` et `git diff --check` : réussis.

Fichiers modifiés : `index.html` (compteur visible), `js/ui.js` (décompte et remise à zéro), `tests/api.test.js` (quatre tests de comportement), `README.md` (instructions de jeu et preuves de vérification). Aucun changement de CSS, du moteur, de `js/app.js`, du contrat ou des dépendances.

Non vérifiés pour ce compteur : lecteur d'écran réel et annonces vocales, Firefox/Safari, appareils physiques et outil enseignant. Aucun commit, publication ou fusion effectué pour cette modification ; elle reste à relire.
