# Design : Notifications in-app (badges)

Date : 2026-04-16

## Contexte

Voisinage est une PWA React + Firebase pour le partage de parkings entre voisins. Aucun système de notification n'existe actuellement. L'objectif est d'ajouter des badges visuels sur les onglets de navigation pour signaler deux événements métier.

## Périmètre

**In-app uniquement** — pas de push PWA, pas d'email. Les badges s'affichent quand l'app est ouverte.

## Événements notifiés

| Événement | Destinataire | Badge sur |
|-----------|-------------|-----------|
| Un voisin réserve un créneau sur ma place privée | Propriétaire de la place | Onglet "Place Voisin" |
| Un nouveau membre est en attente d'activation | Admins | Bouton ⚙️ admin |

## Comportement du badge

- Apparaît dès que l'événement se produit (temps réel via Firestore `onSnapshot`)
- Disparaît automatiquement quand l'utilisateur ouvre l'onglet concerné
- Affiché comme un point rouge `●` sur le bouton de navigation

## Modèle de données

### Place privée — champ `unreadClaims`

Ajout du champ `unreadClaims: number` sur le document `spots/{spotId}` (Firestore).

- Absent ou `0` = aucun badge
- Incrémenté de 1 à chaque fois qu'un voisin (uid ≠ ownerUid) réserve un créneau
- Remis à `0` quand le propriétaire ouvre l'onglet "Place Voisin"

### Membres en attente — champ existant `isActive`

Aucune nouvelle donnée. Le badge admin = nombre de membres avec `isActive: false`.  
Le badge disparaît naturellement quand tous les membres en attente sont activés.

## Architecture

### 1. `src/firebase.js`

**Imports ajoutés :** `increment`, `updateDoc` depuis `firebase/firestore`

**`claimSpotSlot(spotId, mk, slotId, uid)`** — dans la transaction existante, après la vérification de disponibilité :
```js
if (data.ownerUid && uid !== data.ownerUid) {
  tx.update(spotDoc(spotId), { unreadClaims: increment(1) });
}
```

**`claimSpotSlotRange(spotId, mk, fromSlot, toSlot, uid)`** — même ajout dans la transaction existante.

**Nouvelle fonction `clearSpotUnread(spotId)`** :
```js
export async function clearSpotUnread(spotId) {
  await updateDoc(spotDoc(spotId), { unreadClaims: 0 });
}
```

### 2. `src/hooks/useNotificationBadges.js` (nouveau)

Hook centralisé pour App.jsx.

```
useNotificationBadges(uid, isAdmin)
  ├── onSnapshot(spotsCol()) → mySpot = spot où ownerUid === uid
  │     → spotsBadge = mySpot?.unreadClaims ?? 0
  │     → clearSpotBadge() = no-op si mySpot null, sinon clearSpotUnread(mySpot.id)
  └── si isAdmin : onSnapshot(membersCol()) → adminBadge = membres inactifs count
  
Retourne : { spotsBadge, adminBadge, clearSpotBadge }
```

Souscriptions nettoyées au démontage via les unsubscribe Firestore.

### 3. `src/App.jsx`

- Appel de `useNotificationBadges(user.uid, member?.isAdmin)` (uniquement si `user` connecté)
- Clic sur "Place Voisin" → `setSection('myspots')` + `clearSpotBadge()`
- Badge sur bouton "🔑 Place Voisin" : point rouge si `spotsBadge > 0`
- Badge sur bouton "⚙️" admin : point rouge si `adminBadge > 0`

## Rendu du badge

Petit cercle rouge absolu positionné en haut à droite du bouton :

```jsx
<div style={{ position: 'relative', display: 'inline-flex' }}>
  <button ...>🔑 Place Voisin</button>
  {spotsBadge > 0 && (
    <span style={{
      position: 'absolute', top: -4, right: -4,
      width: 10, height: 10, borderRadius: '50%',
      background: '#DC2626', border: '2px solid white',
    }} />
  )}
</div>
```

## Ce qui ne change pas

- `SpotsTab.jsx` — aucune modification
- `AdminTab.jsx` — aucune modification
- Schéma Firestore des autres collections — inchangé

## Hors périmètre

- Push notifications (PWA/FCM)
- Notifications email
- Historique des notifications
- Notification sur la place visiteur partagée
