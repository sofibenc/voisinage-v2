# Design — Popup avertissement numéro de place manquant

**Date :** 2026-04-23

## Contexte

Quand un voisin propose sa place sans avoir renseigné son numéro de place (`spotNumber`), les autres résidents ne peuvent pas l'identifier physiquement. Une popup d'avertissement non-bloquante doit les inciter à compléter leur profil.

## Déclencheur

Dans `handleRangeApply` (SpotsTab.jsx), quand :
- `mode === 'add'`
- `!member?.spotNumber?.trim()`

Au lieu d'exécuter la plage immédiatement, stocker les paramètres dans `pendingRange` et afficher la popup.

## Popup

- **Style :** modale centrée, même pattern que les modales existantes (fond semi-transparent, carte blanche, borderRadius 16)
- **Titre :** "Tu n'as pas de N° de place"
- **Corps :** "Les voisins ne verront pas ton numéro de place. Ils auront du mal à te trouver."
- **Bouton primaire :** "Renseigner mon N°" → appelle `onOpenProfile()` + vide `pendingRange` (l'utilisateur doit revenir ajouter sa plage après)
- **Bouton secondaire :** "Continuer quand même" → exécute la plage en attente, ferme la popup

## Fichiers modifiés

### App.jsx
- Passer `onOpenProfile={() => setShowProfile(true)}` en prop à `<SpotsTab>`

### SpotsTab.jsx
- Accepter `onOpenProfile` en prop
- Ajouter state : `const [pendingRange, setPendingRange] = useState(null)`
- Modifier `handleRangeApply` : si `mode === 'add'` et `spotNumber` absent → `setPendingRange({ mode, fromSlot, toSlot, qDay })` au lieu d'exécuter
- Ajouter la modale de la popup dans le JSX de la vue myspot
- Le bouton "Continuer quand même" appelle directement la logique d'ajout avec `pendingRange`

## Ce qui ne change pas

- Le mode `remove` n'est pas concerné (supprimer une dispo ne nécessite pas de numéro)
- Les modales click-to-add/remove sur l'agenda ne sont pas concernées (même raison : le clic ajoute un slot, mais le warning ne s'applique qu'au formulaire principal)
- Aucun blocage : l'utilisateur peut toujours continuer sans numéro
