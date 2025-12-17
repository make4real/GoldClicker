# GoldClicker V0

Prototype jouable en HTML/CSS/JS (sans framework) pour valider le gameplay de GoldClicker. Ouvrez simplement `index.html` dans un navigateur moderne : aucun serveur n'est nécessaire.

## Démarrer

1. Cloner ou télécharger le projet.
2. Ouvrir `index.html` dans votre navigateur (double-clic ou glisser-déposer).  
3. Miner de l'or, acheter des upgrades et observer l'équilibrage.

## Règles principales

- L'or total démarre à `0`.
- Le bouton **Miner** ajoute `goldPerClick`.
- Gains passifs : `gold += goldPerSecond * dt` via `requestAnimationFrame`.
- Affichage en haut : Or (arrondi), Or/clic, Or/sec.
- Boutique :
  - **Pioche** : +1 or/clic par niveau. Coût de départ 15, puis `15 * 1.15^niveau` (arrondi).
  - **Mineur** : +1 or/sec par achat. Coût de départ 100, puis `100 * 1.17^quantité`.
  - **Foreuse** : +10 or/sec par achat. Coût de départ 1200, puis `1200 * 1.22^quantité`.
- Achats : seulement si l'or couvre le coût, sinon petit feedback visuel.
- Paliers (succès) : 100, 1 000, 10 000, 100 000 or. Notification toast + badge.
- Effets : pop "+X" sur le clic, animation sur achat réussi, shake sur achat impossible.

## Sauvegarde & reprise

- Sauvegarde automatique toutes les 10 secondes + bouton **Sauvegarder**.
- Clé : `goldclicker_save_v0` dans `localStorage`.
- Format JSON stable :  
  ```json
  { "gold": 0, "pickaxeLevel": 0, "minerCount": 0, "drillCount": 0, "lastSavedAt": 0 }
  ```
- Bouton **Réinitialiser** avec confirmation.
- Progression hors ligne : au chargement, ajoute `min(temps_absent, 4h) * goldPerSecond`.

## Équilibrage et paramètres

Tous les paramètres sont regroupés dans `game.js` dans la constante `CONFIG` :

- Coûts de base, multiplicateurs, bonus par upgrade.
- Intervalle d’auto-save.
- Paliers de succès.
- Cap de progression hors ligne.

Modifiez `CONFIG` pour ajuster le rythme ou tester d'autres valeurs sans toucher au reste du code ou à l'UI.

## Architecture (préparation iOS)

`game.js` sépare clairement logique et UI pour une migration facile vers une app iOS (ex. UserDefaults à la place de `localStorage`) :

- `CONFIG` : tous les paramètres.
- `computeDerived(state)` : calcule `goldPerClick`, `goldPerSecond`, et les coûts à venir.
- `buyUpgrade(state, type)` : applique un achat, sans DOM.
- `tick(state, dtSeconds)` : avance le temps.
- UI : `render()` + `bindEvents()` utilisent uniquement ces fonctions.

Pour iOS : mappez `localStorage` → `UserDefaults` avec le même JSON ; gardez `CONFIG` et les fonctions pures dans un module partagé, et branchez une vue SwiftUI/UIButton sur `render`/`bind` équivalents.
