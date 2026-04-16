# Notifications in-app (badges) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher un badge rouge sur l'onglet "Place Voisin" quand un voisin réserve ta place privée, et sur le bouton admin quand un nouveau membre attend l'activation.

**Architecture:** Champ `unreadClaims` incrémenté dans les transactions Firestore existantes lors d'une réservation par un tiers. Hook `useNotificationBadges` centralisé pour App.jsx via `onSnapshot`. Badges rendus comme des points rouges positionnés en absolu sur les boutons de navigation.

**Tech Stack:** React 19, Firebase Firestore (transactions, increment, onSnapshot), Vite PWA

---

## Fichiers touchés

| Action | Fichier | Responsabilité |
|--------|---------|----------------|
| Modifier | `src/firebase.js` | Ajouter imports, modifier transactions, ajouter `clearSpotUnread` |
| Créer | `src/hooks/useNotificationBadges.js` | Souscriptions Firestore + logique badges |
| Modifier | `src/App.jsx` | Appel hook + rendu badges sur boutons nav |

---

### Task 1 : Mise à jour des imports et ajout de `clearSpotUnread` dans firebase.js

**Files:**
- Modify: `src/firebase.js:6-9` (imports Firestore)
- Modify: `src/firebase.js:174` (fin du fichier, ajout fonction)

- [ ] **Step 1 : Ajouter `increment` et `updateDoc` aux imports Firestore**

Remplacer dans `src/firebase.js` :
```js
import {
  getFirestore, doc, collection,
  setDoc, deleteDoc,
  runTransaction, deleteField,
} from 'firebase/firestore';
```
Par :
```js
import {
  getFirestore, doc, collection,
  setDoc, updateDoc, deleteDoc,
  runTransaction, deleteField, increment,
} from 'firebase/firestore';
```

- [ ] **Step 2 : Ajouter la fonction `clearSpotUnread` en fin de fichier**

Ajouter après la dernière ligne de `src/firebase.js` :
```js

export async function clearSpotUnread(spotId) {
  await updateDoc(spotDoc(spotId), { unreadClaims: 0 });
}
```

- [ ] **Step 3 : Vérifier que le build passe**

```bash
npm run build 2>&1 | tail -5
```
Résultat attendu : `✓ built in`

- [ ] **Step 4 : Commit**

```bash
git add src/firebase.js
git commit -m "feat: ajouter clearSpotUnread et imports increment/updateDoc"
```

---

### Task 2 : Incrémenter `unreadClaims` dans `claimSpotSlot`

**Files:**
- Modify: `src/firebase.js:133-143`

- [ ] **Step 1 : Modifier `claimSpotSlot` pour incrémenter si réservé par un tiers**

Remplacer la fonction complète dans `src/firebase.js` :
```js
export async function claimSpotSlot(spotId, mk, slotId, uid) {
  await runTransaction(db, async tx => {
    const ref = spotAvailDoc(spotId, mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No availability');
    const data = snap.data();
    if (!data.slots.includes(slotId)) throw new Error('Slot not available');
    if (data.taken?.[String(slotId)]) throw new Error('Already taken');
    tx.update(ref, { [`taken.${slotId}`]: uid });
  });
}
```
Par :
```js
export async function claimSpotSlot(spotId, mk, slotId, uid) {
  await runTransaction(db, async tx => {
    const ref = spotAvailDoc(spotId, mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No availability');
    const data = snap.data();
    if (!data.slots.includes(slotId)) throw new Error('Slot not available');
    if (data.taken?.[String(slotId)]) throw new Error('Already taken');
    tx.update(ref, { [`taken.${slotId}`]: uid });
    if (data.ownerUid && uid !== data.ownerUid) {
      tx.update(spotDoc(spotId), { unreadClaims: increment(1) });
    }
  });
}
```

- [ ] **Step 2 : Vérifier que le build passe**

```bash
npm run build 2>&1 | tail -5
```
Résultat attendu : `✓ built in`

- [ ] **Step 3 : Commit**

```bash
git add src/firebase.js
git commit -m "feat: incrémenter unreadClaims lors d'une réservation par un voisin (slot unique)"
```

---

### Task 3 : Incrémenter `unreadClaims` dans `claimSpotSlotRange`

**Files:**
- Modify: `src/firebase.js:145-159`

- [ ] **Step 1 : Modifier `claimSpotSlotRange` pour incrémenter si réservé par un tiers**

Remplacer la fonction complète :
```js
export async function claimSpotSlotRange(spotId, mk, fromSlot, toSlot, uid) {
  await runTransaction(db, async tx => {
    const ref = spotAvailDoc(spotId, mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('UNAVAILABLE');
    const data = snap.data();
    const updates = {};
    for (let s = fromSlot; s <= toSlot; s++) {
      if (!data.slots.includes(s)) throw new Error('UNAVAILABLE');
      if (data.taken?.[String(s)] && data.taken[String(s)] !== uid) throw new Error('OVERLAP');
      if (!data.taken?.[String(s)]) updates[`taken.${s}`] = uid;
    }
    if (Object.keys(updates).length > 0) tx.update(ref, updates);
  });
}
```
Par :
```js
export async function claimSpotSlotRange(spotId, mk, fromSlot, toSlot, uid) {
  await runTransaction(db, async tx => {
    const ref = spotAvailDoc(spotId, mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('UNAVAILABLE');
    const data = snap.data();
    const updates = {};
    for (let s = fromSlot; s <= toSlot; s++) {
      if (!data.slots.includes(s)) throw new Error('UNAVAILABLE');
      if (data.taken?.[String(s)] && data.taken[String(s)] !== uid) throw new Error('OVERLAP');
      if (!data.taken?.[String(s)]) updates[`taken.${s}`] = uid;
    }
    if (Object.keys(updates).length > 0) {
      tx.update(ref, updates);
      if (data.ownerUid && uid !== data.ownerUid) {
        tx.update(spotDoc(spotId), { unreadClaims: increment(1) });
      }
    }
  });
}
```

- [ ] **Step 2 : Vérifier que le build passe**

```bash
npm run build 2>&1 | tail -5
```
Résultat attendu : `✓ built in`

- [ ] **Step 3 : Commit**

```bash
git add src/firebase.js
git commit -m "feat: incrémenter unreadClaims lors d'une réservation par un voisin (plage)"
```

---

### Task 4 : Créer le hook `useNotificationBadges`

**Files:**
- Create: `src/hooks/useNotificationBadges.js`

- [ ] **Step 1 : Créer le fichier `src/hooks/useNotificationBadges.js`**

```js
import { useState, useEffect, useRef } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { spotsCol, membersCol, clearSpotUnread } from '../firebase.js';

export function useNotificationBadges(uid, isAdmin) {
  const [spotsBadge, setSpotsBadge] = useState(0);
  const [adminBadge, setAdminBadge]  = useState(0);
  const mySpotIdRef = useRef(null);

  // Badge "Place Voisin" : unreadClaims sur ma place
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(spotsCol(), snap => {
      const mySpot = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                              .find(s => s.ownerUid === uid);
      mySpotIdRef.current = mySpot?.id ?? null;
      setSpotsBadge(mySpot?.unreadClaims ?? 0);
    });
  }, [uid]);

  // Badge admin : membres inactifs en attente d'activation
  useEffect(() => {
    if (!uid || !isAdmin) return;
    return onSnapshot(membersCol(), snap => {
      const pending = snap.docs.filter(d => d.data().isActive === false).length;
      setAdminBadge(pending);
    });
  }, [uid, isAdmin]);

  function clearSpotBadge() {
    if (mySpotIdRef.current) clearSpotUnread(mySpotIdRef.current);
  }

  return { spotsBadge, adminBadge, clearSpotBadge };
}
```

- [ ] **Step 2 : Vérifier que le build passe**

```bash
npm run build 2>&1 | tail -5
```
Résultat attendu : `✓ built in`

- [ ] **Step 3 : Commit**

```bash
git add src/hooks/useNotificationBadges.js
git commit -m "feat: hook useNotificationBadges pour les badges de navigation"
```

---

### Task 5 : Intégrer les badges dans App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1 : Importer `useNotificationBadges` dans App.jsx**

Ajouter l'import après les imports existants (ligne ~11) :
```js
import { useNotificationBadges } from './hooks/useNotificationBadges.js';
```

- [ ] **Step 2 : Appeler le hook dans le composant App**

Ajouter après les useState existants en haut de la fonction `App()` (vers ligne 23) :
```js
const { spotsBadge, adminBadge, clearSpotBadge } = useNotificationBadges(
  user?.uid ?? null,
  member?.isAdmin ?? false,
);
```

- [ ] **Step 3 : Remplacer le bouton admin pour y ajouter le badge**

Remplacer :
```jsx
{member?.isAdmin && (
  <button onClick={() => setSection('admin')}
    style={{ background: section === 'admin' ? '#1E293B' : '#F1F5F9',
             color: section === 'admin' ? 'white' : '#64748B',
             border: 'none', borderRadius: 8, padding: '5px 10px',
             fontSize: 12, fontWeight: 600 }}>
    ⚙️
  </button>
)}
```
Par :
```jsx
{member?.isAdmin && (
  <div style={{ position: 'relative', display: 'inline-flex' }}>
    <button onClick={() => setSection('admin')}
      style={{ background: section === 'admin' ? '#1E293B' : '#F1F5F9',
               color: section === 'admin' ? 'white' : '#64748B',
               border: 'none', borderRadius: 8, padding: '5px 10px',
               fontSize: 12, fontWeight: 600 }}>
      ⚙️
    </button>
    {adminBadge > 0 && (
      <span style={{
        position: 'absolute', top: -3, right: -3,
        width: 10, height: 10, borderRadius: '50%',
        background: '#DC2626', border: '2px solid white',
        pointerEvents: 'none',
      }} />
    )}
  </div>
)}
```

- [ ] **Step 4 : Remplacer le bouton "Place Voisin" pour y ajouter le badge**

Remplacer :
```jsx
<button onClick={() => setSection('myspots')}
  style={{ flex: 1, padding: '10px 8px', fontSize: 13, fontWeight: 700,
           border: 'none', borderRadius: 10,
           background: section === 'myspots' ? MYSPOTS.bg : MYSPOTS.light,
           color: section === 'myspots' ? 'white' : MYSPOTS.text }}>
  🔑 Place Voisin
</button>
```
Par :
```jsx
<div style={{ flex: 1, position: 'relative', display: 'inline-flex' }}>
  <button onClick={() => { setSection('myspots'); clearSpotBadge(); }}
    style={{ flex: 1, width: '100%', padding: '10px 8px', fontSize: 13, fontWeight: 700,
             border: 'none', borderRadius: 10,
             background: section === 'myspots' ? MYSPOTS.bg : MYSPOTS.light,
             color: section === 'myspots' ? 'white' : MYSPOTS.text }}>
    🔑 Place Voisin
  </button>
  {spotsBadge > 0 && (
    <span style={{
      position: 'absolute', top: -3, right: -3,
      width: 10, height: 10, borderRadius: '50%',
      background: '#DC2626', border: '2px solid white',
      pointerEvents: 'none',
    }} />
  )}
</div>
```

- [ ] **Step 5 : Vérifier que le build passe**

```bash
npm run build 2>&1 | tail -5
```
Résultat attendu : `✓ built in`

- [ ] **Step 6 : Commit**

```bash
git add src/App.jsx
git commit -m "feat: afficher badges de notification sur les onglets de navigation"
```

---

## Test manuel final

Après implémentation, vérifier dans le navigateur :

1. **Badge Place Voisin :**
   - Se connecter avec le compte d'un voisin (pas le proprio)
   - Réserver un créneau sur la place privée du proprio
   - Se connecter avec le compte proprio → le point rouge doit apparaître sur "🔑 Place Voisin"
   - Cliquer sur "🔑 Place Voisin" → le point rouge doit disparaître

2. **Badge admin :**
   - Créer un nouveau compte Google (non activé par défaut)
   - Se connecter avec le compte admin → le point rouge doit apparaître sur "⚙️"
   - Aller dans l'admin et activer le membre → le point rouge doit disparaître
