# Push Notification — Nouveau Voisin en Attente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envoyer une notification push à l'admin quand un nouveau voisin se connecte pour la première fois et attend d'être activé.

**Architecture:** Un champ `needsActivation: true` est posé sur le document `members/{uid}` lors du premier login. Une Cloud Function Firebase (v2) se déclenche sur cette transition Firestore et envoie une notification FCM aux admins. Le client stocke son token FCM dans `members/{uid}.fcmToken` ; le service worker FCM affiche la notification quand l'app est en arrière-plan.

**Tech Stack:** Firebase Functions v2 (Node 20), Firebase Admin SDK, Firebase Cloud Messaging (FCM), `firebase/messaging` côté client, `vite-plugin-pwa` (SW existant non modifié), Vitest.

**Contrainte de déploiement :** Ce plan ne contient aucune commande `firebase deploy`. Le déploiement se fait séparément.

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `functions/package.json` | Créer | Dépendances Cloud Functions |
| `functions/index.js` | Créer | Entry point Cloud Function `onNewMember` |
| `functions/lib/notif.js` | Créer | Helpers purs testables (payload, filtrage tokens) |
| `tests/functions/notif.test.js` | Créer | Tests unitaires des helpers |
| `public/firebase-messaging-sw.js` | Créer | SW FCM pour push en arrière-plan |
| `src/firebase.js` | Modifier | Ajout init FCM + `requestAndSaveFcmToken` + `setMemberActive` (nettoyer `needsActivation`) |
| `src/hooks/useAuth.js` | Modifier | Écrire `needsActivation: true` au premier login + appel `requestAndSaveFcmToken` |
| `firebase.json` | Modifier | Ajout section `functions` |
| `.firebaserc` | Créer | Association projet Firebase (requis pour émulateurs) |

---

## Task 1 : Firebase Functions — setup répertoire

**Files:**
- Create: `functions/package.json`
- Create: `functions/index.js` (stub)
- Modify: `firebase.json`
- Create: `.firebaserc`

- [ ] **Step 1 : Créer `functions/package.json`**

```json
{
  "name": "voisinage-functions",
  "type": "module",
  "engines": { "node": "20" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

- [ ] **Step 2 : Créer `functions/index.js` (stub vide pour vérifier l'install)**

```js
// Entry point — implémenté en Task 3
export {};
```

- [ ] **Step 3 : Mettre à jour `firebase.json`**

Remplacer le contenu actuel par :

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}
```

- [ ] **Step 4 : Créer `.firebaserc`**

```json
{
  "projects": {
    "default": "voisinage-v2"
  }
}
```

- [ ] **Step 5 : Installer les dépendances Functions**

```bash
cd functions && npm install && cd ..
```

Expected: `node_modules/` créé dans `functions/`, pas d'erreur.

- [ ] **Step 6 : Commit**

```bash
git add functions/package.json functions/package-lock.json functions/index.js firebase.json .firebaserc
git commit -m "chore: init Firebase Functions directory"
```

---

## Task 2 : Helpers purs + tests (TDD)

**Files:**
- Create: `functions/lib/notif.js`
- Create: `tests/functions/notif.test.js`

- [ ] **Step 1 : Créer `tests/functions/notif.test.js` (test en échec)**

```js
import { describe, it, expect } from 'vitest';
import { buildNotifPayload, adminsWithTokens } from '../../functions/lib/notif.js';

describe('buildNotifPayload', () => {
  it('title is always "Voisinage"', () => {
    expect(buildNotifPayload('Alice').notification.title).toBe('Voisinage');
  });

  it('body includes name', () => {
    expect(buildNotifPayload('Alice').notification.body)
      .toBe('Nouveau voisin en attente — Alice demande à rejoindre');
  });

  it('webpush notification has icon', () => {
    expect(buildNotifPayload('Bob').webpush.notification.icon).toBe('/icon-192.png');
  });

  it('uses fallback name when empty string', () => {
    expect(buildNotifPayload('').notification.body)
      .toBe('Nouveau voisin en attente — Nouveau voisin demande à rejoindre');
  });
});

describe('adminsWithTokens', () => {
  it('keeps only members with a truthy fcmToken', () => {
    const docs = [
      { ref: 'r1', fcmToken: 'tok-a' },
      { ref: 'r2', fcmToken: null },
      { ref: 'r3' },
      { ref: 'r4', fcmToken: 'tok-d' },
    ];
    const result = adminsWithTokens(docs);
    expect(result).toEqual([
      { ref: 'r1', fcmToken: 'tok-a' },
      { ref: 'r4', fcmToken: 'tok-d' },
    ]);
  });

  it('returns empty array when no tokens', () => {
    expect(adminsWithTokens([{ ref: 'r1' }])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(adminsWithTokens([])).toEqual([]);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../../functions/lib/notif.js'`

- [ ] **Step 3 : Créer `functions/lib/notif.js`**

```js
export function buildNotifPayload(name) {
  const displayName = name || 'Nouveau voisin';
  return {
    notification: {
      title: 'Voisinage',
      body: `Nouveau voisin en attente — ${displayName} demande à rejoindre`,
    },
    webpush: {
      notification: { icon: '/icon-192.png' },
    },
  };
}

// memberDocs: Array<{ ref, fcmToken?: string, ... }>
// Retourne uniquement les éléments ayant un fcmToken valide (index-stable pour cleanup FCM)
export function adminsWithTokens(memberDocs) {
  return memberDocs.filter(m => m.fcmToken);
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test
```

Expected: tous les tests PASS (slots + notif).

- [ ] **Step 5 : Commit**

```bash
git add functions/lib/notif.js tests/functions/notif.test.js
git commit -m "feat: add FCM notification helpers with tests"
```

---

## Task 3 : Cloud Function `onNewMember`

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1 : Implémenter la Cloud Function dans `functions/index.js`**

```js
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp }     from 'firebase-admin/app';
import { getFirestore }      from 'firebase-admin/firestore';
import { getMessaging }      from 'firebase-admin/messaging';
import { buildNotifPayload, adminsWithTokens } from './lib/notif.js';

initializeApp();

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export const onNewMember = onDocumentWritten('members/{uid}', async event => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();

  // Agir uniquement quand needsActivation passe à true (premier login)
  if (!after?.needsActivation || before?.needsActivation === true) return;

  const db = getFirestore();
  const snapshot = await db.collection('members').where('isAdmin', '==', true).get();
  const allAdmins = snapshot.docs.map(d => ({ ref: d.ref, ...d.data() }));
  const eligible  = adminsWithTokens(allAdmins);

  if (eligible.length === 0) return;

  const payload = {
    ...buildNotifPayload(after.name ?? ''),
    tokens: eligible.map(a => a.fcmToken),
  };

  const response = await getMessaging().sendEachForMulticast(payload);

  // Supprimer les tokens invalides de Firestore
  const cleanup = [];
  response.responses.forEach((r, i) => {
    if (!r.success && INVALID_TOKEN_CODES.has(r.error?.code)) {
      cleanup.push(eligible[i].ref.update({ fcmToken: null }));
    }
  });
  if (cleanup.length) await Promise.all(cleanup);
});
```

- [ ] **Step 2 : Vérifier que les tests existants passent toujours**

```bash
npm test
```

Expected: PASS (pas de régression).

- [ ] **Step 3 : Commit**

```bash
git add functions/index.js
git commit -m "feat: Cloud Function onNewMember — push FCM aux admins"
```

---

## Task 4 : Client — FCM init + token dans `firebase.js`

**Files:**
- Modify: `src/firebase.js`

- [ ] **Step 1 : Ajouter l'import FCM et init en haut de `src/firebase.js`**

Après les imports existants, ajouter :

```js
import { getMessaging, getToken } from 'firebase/messaging';
```

Après `export const db = getFirestore(app);`, ajouter :

```js
let messaging = null;
if (typeof window !== 'undefined') {
  try { messaging = getMessaging(app); } catch { /* navigateur sans support push */ }
}
```

- [ ] **Step 2 : Ajouter `requestAndSaveFcmToken` à la fin de la section Members**

Après la fonction `setMemberActive`, ajouter :

```js
export async function requestAndSaveFcmToken(uid) {
  if (!messaging || !('Notification' in window)) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
    });
    if (token) await setDoc(memberDoc(uid), { fcmToken: token }, { merge: true });
  } catch {
    // Notifications optionnelles — échec silencieux
  }
}
```

- [ ] **Step 3 : Mettre à jour `setMemberActive` pour effacer `needsActivation` lors de l'activation**

Remplacer la fonction existante :

```js
export async function setMemberActive(uid, isActive) {
  await setDoc(memberDoc(uid), { isActive }, { merge: true });
}
```

Par :

```js
export async function setMemberActive(uid, isActive) {
  const data = isActive
    ? { isActive, needsActivation: deleteField() }
    : { isActive };
  await setDoc(memberDoc(uid), data, { merge: true });
}
```

(`deleteField` est déjà importé en haut du fichier.)

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/firebase.js
git commit -m "feat: FCM client init — requestAndSaveFcmToken + clear needsActivation on activate"
```

---

## Task 5 : `useAuth` — premier login + token FCM

**Files:**
- Modify: `src/hooks/useAuth.js`

- [ ] **Step 1 : Importer `requestAndSaveFcmToken` en haut du fichier**

Modifier la ligne d'import firebase existante pour ajouter la nouvelle fonction :

```js
import { auth, upsertMember, memberDoc, requestAndSaveFcmToken } from '../firebase.js';
```

- [ ] **Step 2 : Ajouter `needsActivation: true` lors du premier login**

Localiser le bloc :

```js
if (!data.name) {
  await upsertMember(firebaseUser.uid, { name: firebaseUser.displayName, isActive: false });
  setIsFirstLogin(true);
}
```

Le remplacer par :

```js
if (!data.name) {
  await upsertMember(firebaseUser.uid, {
    name: firebaseUser.displayName,
    isActive: false,
    needsActivation: true,
  });
  setIsFirstLogin(true);
}
```

- [ ] **Step 3 : Appeler `requestAndSaveFcmToken` après l'établissement du listener**

Localiser la ligne :

```js
unsubMember = onSnapshot(memberDoc(firebaseUser.uid), snap => {
```

Juste après le bloc qui la définit (après la fermeture `}`), ajouter :

```js
requestAndSaveFcmToken(firebaseUser.uid);
```

Le bloc final de `useAuth` doit ressembler à :

```js
unsubMember = onSnapshot(memberDoc(firebaseUser.uid), snap => {
  if (snap.exists()) setMember({ uid: firebaseUser.uid, ...snap.data() });
});
requestAndSaveFcmToken(firebaseUser.uid);
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/hooks/useAuth.js
git commit -m "feat: useAuth — needsActivation au premier login + demande token FCM"
```

---

## Task 6 : Service Worker FCM (push arrière-plan)

**Files:**
- Create: `public/firebase-messaging-sw.js`

- [ ] **Step 1 : Créer `public/firebase-messaging-sw.js`**

Les valeurs Firebase ci-dessous sont des identifiants publics (pas des secrets). Les copier depuis `.env.local`.

```js
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

// Valeurs copiées depuis .env.local — identifiants publics côté client
firebase.initializeApp({
  apiKey:            'REMPLACER_PAR_VITE_FIREBASE_API_KEY',
  authDomain:        'REMPLACER_PAR_VITE_FIREBASE_AUTH_DOMAIN',
  projectId:         'REMPLACER_PAR_VITE_FIREBASE_PROJECT_ID',
  storageBucket:     'REMPLACER_PAR_VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REMPLACER_PAR_VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId:             'REMPLACER_PAR_VITE_FIREBASE_APP_ID',
});

firebase.messaging().onBackgroundMessage(payload => {
  self.registration.showNotification(
    payload.notification?.title ?? 'Voisinage',
    {
      body: payload.notification?.body ?? '',
      icon: '/icon-192.png',
    }
  );
});
```

- [ ] **Step 2 : Remplacer les placeholders par les vraies valeurs**

Ouvrir `.env.local`, copier chaque valeur `VITE_FIREBASE_*` dans le SW.

- [ ] **Step 3 : Ajouter `VITE_FCM_VAPID_KEY` dans `.env.local`**

Dans Firebase Console → ton projet → ⚙️ Paramètres du projet → Cloud Messaging → Web Push certificates → "Generate key pair" (ou utiliser la clé existante). Copier la clé et l'ajouter dans `.env.local` :

```
VITE_FCM_VAPID_KEY=AAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add public/firebase-messaging-sw.js
git commit -m "feat: firebase-messaging-sw pour notifications push en arrière-plan"
```

---

## Vérification manuelle (post-implémentation)

1. `npm run dev` — l'app se lance sans erreur
2. Se connecter avec un compte Google **non encore membre** (ou supprimer le doc `members/{uid}` pour simuler un premier login)
3. Le navigateur demande la permission de notifications → accepter
4. Vérifier dans Firebase Console → Firestore → `members/{uid}` que `fcmToken` et `needsActivation: true` sont présents
5. Sur le compte admin (dans un autre navigateur ou appareil), recevoir la notification push "Nouveau voisin en attente — [Prénom] demande à rejoindre"
6. Activer le membre depuis l'onglet Admin → vérifier que `needsActivation` est supprimé du document Firestore

---

## Notes

- **Déploiement Functions :** `firebase deploy --only functions` (à faire manuellement quand prêt)
- **Plan Spark :** l'appel FCM va vers `fcm.googleapis.com` (API Google) — compatible Spark. Si Firebase retourne une erreur `BillingNotEnabled`, activer le plan Blaze (gratuit jusqu'aux seuils)
- **Token multi-appareils :** actuellement 1 token par membre (dernier appareil connecté). Suffisant pour ce cas d'usage
- **Notifications foreground :** quand l'app est ouverte, le badge rouge existant couvre ce cas — pas de toast supplémentaire ajouté
