# Push notification — Nouveau voisin en attente de validation

**Date :** 2026-05-12
**Périmètre :** Notification push à l'admin quand un nouvel utilisateur se connecte pour la première fois et attend son activation.

---

## Contexte

Le système d'activation des membres est déjà en place :
- Premier login → `upsertMember` crée le document `members/{uid}` avec `isActive: false`
- L'admin voit un badge rouge sur son bouton ⚙️ (via `useNotificationBadges`)
- L'admin peut activer/désactiver depuis l'onglet Admin

Ce qui manque : l'admin ne reçoit aucune notification push quand l'app est fermée ou le téléphone verrouillé.

---

## Objectif

Envoyer une notification push à tous les membres `isAdmin: true` dès qu'un nouveau document `members/{uid}` est créé avec `isActive: false`.

Contenu de la notification :
- Titre : `Voisinage`
- Corps : `Nouveau voisin en attente — {name} demande à rejoindre`

---

## Architecture

### 1. Stockage des tokens FCM (client)

Après authentification, le client :
1. Demande la permission de notification (`Notification.requestPermission()`)
2. Récupère le token FCM (`getToken(messaging, { vapidKey })`)
3. Stocke le token dans `members/{uid}.fcmToken: string` (un token par document, le plus récent)

Si la permission est refusée ou non supportée, on passe silencieusement — aucune erreur bloquante.

Le token est rafraîchi via `onTokenRefresh` et réécrit dans Firestore automatiquement.

### 2. Cloud Function

**Déclencheur :** `onDocumentCreated('members/{uid}')`

**Logique :**
1. Si `data.isActive !== false` → ignorer (ne concerne pas les nouveaux membres en attente)
2. Récupérer tous les documents `members` où `isAdmin === true`
3. Collecter leurs `fcmToken` (ignorer ceux qui n'en ont pas)
4. Envoyer via FCM `sendEachForMulticast` avec les tokens collectés
5. Supprimer les tokens invalides retournés par FCM (codes `registration-token-not-registered` ou `invalid-registration-token`)

**Compatibilité Spark :** l'appel va vers `fcm.googleapis.com` (Google API) — compatible plan Spark.

### 3. Service Worker FCM

Fichier `public/firebase-messaging-sw.js` : initialise Firebase Messaging dans le service worker pour intercepter les push en arrière-plan et afficher la notification système.

Le service worker existant (généré par VitePWA/Workbox) n'est pas modifié — le SW FCM est un fichier séparé, enregistré automatiquement par le SDK Firebase.

---

## Schéma Firestore

### Champ ajouté à `members/{uid}`

```
fcmToken: string | null   // token FCM du dernier appareil connecté
```

Pas de tableau multi-appareils : pour une app entre voisins, un token par membre est suffisant et simplifie le nettoyage.

---

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/firebase.js` | Ajout init FCM + helper `saveFcmToken(uid, token)` |
| `src/hooks/useAuth.js` | Demande permission + sauvegarde token après auth |
| `public/firebase-messaging-sw.js` | Nouveau — SW FCM pour background push |
| `functions/index.js` | Nouveau — Cloud Function `onNewMember` |
| `functions/package.json` | Nouveau — dépendances Functions |
| `firebase.json` | Ajout section `functions` |
| `.env` / `.env.example` | Ajout `VITE_FCM_VAPID_KEY` (à récupérer dans Firebase Console → Cloud Messaging → Web Push Certificates) |
| `firestore.rules` | Autoriser l'écriture de `fcmToken` par le propriétaire |

---

## Hors périmètre

- Notifications pour créneaux libérés (écarté)
- Notifications pour d'autres événements (écarté)
- Multi-appareils par utilisateur (un token suffit)
- Notification à l'utilisateur que son compte est activé (peut être ajouté plus tard)
