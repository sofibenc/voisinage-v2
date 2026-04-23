# Spot Number Warning Popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher une popup d'avertissement non-bloquante quand un utilisateur tente d'ajouter une plage de disponibilité sans avoir renseigné son numéro de place.

**Architecture:** `handleRangeApply` intercepte l'ajout si `spotNumber` est absent et stocke les paramètres dans `pendingRange`. Une modale permet soit d'aller renseigner le profil (via `onOpenProfile` passé depuis App.jsx), soit de continuer quand même.

**Tech Stack:** React (useState), JSX inline styles — aucune dépendance nouvelle.

---

### Task 1 : Passer `onOpenProfile` de App.jsx à SpotsTab

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1 : Trouver le rendu de `<SpotsTab>` dans App.jsx**

Ouvrir `src/App.jsx`. Chercher `<SpotsTab`. La ligne ressemble à :

```jsx
<SpotsTab member={member} operationalMode={operationalMode} />
```

- [ ] **Step 2 : Ajouter la prop `onOpenProfile`**

Remplacer cette ligne par :

```jsx
<SpotsTab member={member} operationalMode={operationalMode} onOpenProfile={() => setShowProfile(true)} />
```

`setShowProfile` est déjà le state qui contrôle `<ProfileModal>` dans App.jsx (chercher `showProfile` si le nom diffère).

- [ ] **Step 3 : Commit**

```bash
git add src/App.jsx
git commit -m "feat: passer onOpenProfile à SpotsTab"
```

---

### Task 2 : Intercepter l'ajout dans handleRangeApply

**Files:**
- Modify: `src/tabs/SpotsTab.jsx`

- [ ] **Step 1 : Accepter `onOpenProfile` en prop**

En haut de `SpotsTab`, modifier la signature :

```jsx
export default function SpotsTab({ member, operationalMode = false, onOpenProfile }) {
```

- [ ] **Step 2 : Ajouter le state `pendingRange`**

Juste après les autres `useState` (vers la ligne 131, après `mySpotError`) :

```jsx
const [pendingRange,  setPendingRange]  = useState(null);
```

- [ ] **Step 3 : Modifier `handleRangeApply` pour intercepter si spotNumber absent**

Localiser `handleRangeApply` (vers la ligne 188). La fonction actuelle commence par :

```jsx
async function handleRangeApply(mode, fromSlot, toSlot, qDay) {
  setMySpotError(null);
  if (isPast(fromSlot)) {
    setMySpotError('Impossible de modifier des créneaux passés.');
    return;
  }
  const spotId = mySpot?.id ?? await ensureMySpot(`Place de ${member?.name ?? 'moi'}`);
  if (mode === 'add') await mergeMySlots(spotId, buildSlotList(fromSlot, toSlot));
  else await clearMyRange(spotId, fromSlot, toSlot);
  setAgendaDay(qDay);
  setShowRangeForm(false);
}
```

Remplacer par :

```jsx
async function handleRangeApply(mode, fromSlot, toSlot, qDay) {
  setMySpotError(null);
  if (isPast(fromSlot)) {
    setMySpotError('Impossible de modifier des créneaux passés.');
    return;
  }
  if (mode === 'add' && !member?.spotNumber?.trim()) {
    setPendingRange({ mode, fromSlot, toSlot, qDay });
    return;
  }
  await executeRangeApply(mode, fromSlot, toSlot, qDay);
}

async function executeRangeApply(mode, fromSlot, toSlot, qDay) {
  const spotId = mySpot?.id ?? await ensureMySpot(`Place de ${member?.name ?? 'moi'}`);
  if (mode === 'add') await mergeMySlots(spotId, buildSlotList(fromSlot, toSlot));
  else await clearMyRange(spotId, fromSlot, toSlot);
  setAgendaDay(qDay);
  setShowRangeForm(false);
}
```

- [ ] **Step 4 : Commit**

```bash
git add src/tabs/SpotsTab.jsx
git commit -m "feat: intercepter ajout de plage si spotNumber absent"
```

---

### Task 3 : Ajouter la modale d'avertissement

**Files:**
- Modify: `src/tabs/SpotsTab.jsx`

- [ ] **Step 1 : Ajouter la modale dans le JSX de la vue myspot**

Dans la vue `if (view === 'myspot') return (...)`, avant le `return` final (après les modales `myAddSlotRange` et `myRemoveSlotRange`), ajouter :

```jsx
{/* Popup avertissement numéro de place manquant */}
{pendingRange !== null && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                zIndex: 50, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: 20 }}
    onClick={() => setPendingRange(null)}>
    <div style={{ background: 'white', borderRadius: 16, padding: 20,
                  maxWidth: 340, width: '100%' }}
      onClick={e => e.stopPropagation()}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
        Tu n'as pas de N° de place
      </div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18, lineHeight: 1.5 }}>
        Les voisins ne verront pas ton numéro de place. Ils auront du mal à te trouver.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => { setPendingRange(null); onOpenProfile?.(); }}
          style={{ width: '100%', padding: '11px 0', background: '#0F172A', color: 'white',
                   border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                   cursor: 'pointer' }}>
          Renseigner mon N°
        </button>
        <button
          onClick={async () => {
            const { mode, fromSlot, toSlot, qDay } = pendingRange;
            setPendingRange(null);
            await executeRangeApply(mode, fromSlot, toSlot, qDay);
          }}
          style={{ width: '100%', padding: '10px 0', background: '#F1F5F9', color: '#475569',
                   border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
                   cursor: 'pointer' }}>
          Continuer quand même
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2 : Vérifier manuellement**

Lancer `npm run dev`. Aller dans "Ma place" → ouvrir le panneau "± Ajouter / Supprimer" → sélectionner une plage future → cliquer "Ajouter". Si `spotNumber` est vide dans le profil : la popup doit apparaître. Tester "Continuer quand même" (la plage s'ajoute) et "Renseigner mon N°" (le profil s'ouvre).

Si `spotNumber` est renseigné : la plage s'ajoute directement sans popup.

- [ ] **Step 3 : Commit**

```bash
git add src/tabs/SpotsTab.jsx
git commit -m "feat: popup avertissement si numéro de place absent lors de l'ajout"
```
