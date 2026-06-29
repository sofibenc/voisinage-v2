# Voisinage v2

Application PWA de partage de place de parking entre voisins, avec une granularité de créneaux de 30 minutes.

## Fonctionnalités

- **Place visiteur** — réservation de créneaux de 30 min sur une place commune, avec quota horaire mensuel par voisin et publication automatique du planning
- **Place voisin** — les propriétaires proposent des créneaux sur leur place privée, les voisins postulent, l'accord se fait par échange
- **Wishlist & deadline** — chaque voisin exprime ses souhaits, l'admin fixe une deadline, le planning est publié automatiquement à l'échéance
- **3 vues calendrier** — jour / semaine / mois, navigation configurable (mois futurs/passés)
- **Notifications push** (FCM) — alerte admin à chaque nouveau membre, badge de notification sur les onglets
- **PWA installable** — mise à jour automatique via service worker, bannière de rechargement

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + Vite, PWA (vite-plugin-pwa) |
| Auth | Firebase Auth (Google) |
| Base de données | Cloud Firestore |
| Backend | Cloud Functions v2 (Node.js) |
| Hébergement | Firebase Hosting |
| Tests | Vitest |

## Prérequis

- Node.js 18+
- Firebase CLI : `npm install -g firebase-tools`
- Accès au projet Firebase `voisinage-v2`

## Installation

```bash
npm install
```

Créer un fichier `.env.local` à partir de la configuration Firebase :

```env
VITE_API_KEY=your-api-key
VITE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_PROJECT_ID=your-project-id
VITE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_MESSAGING_SENDER_ID=your-sender-id
VITE_APP_ID=your-app-id
VITE_MEASUREMENT_ID=your-measurement-id
VITE_VAPID_KEY=your-vapid-key
```

## Développement

```bash
npm run dev       # serveur de développement (http://localhost:5173)
npm run build     # build de production dans dist/
npm run preview   # prévisualiser le build
npm run lint      # ESLint
npm run test      # tests unitaires (Vitest)
```

## Déploiement

```bash
npm run build
firebase deploy                  # hosting + functions + firestore rules
firebase deploy --only hosting   # hosting uniquement
firebase deploy --only functions # Cloud Functions uniquement
```

## Structure du projet

```
src/
  App.jsx              # Shell principal (auth, routing par section, settings temps réel)
  firebase.js          # Initialisation Firebase et helpers Firestore
  constants.js         # Constantes partagées
  tabs/
    VisitorTab.jsx     # Place visiteur (wishlist, planning, quota)
    SpotsTab.jsx       # Places privées (propriétaire et candidatures)
    AdminTab.jsx       # Panneau admin (membres, settings, deadline)
  components/
    AgendaView/        # Calendrier jour/semaine/mois
    ProfileModal.jsx   # Modification du profil
    WelcomeModal.jsx   # Écran d'accueil premier login
    ErrorBoundary.jsx
  hooks/
    useAuth.js          # Authentification et état membre
    useMembers.js       # Liste des membres
    useReservations.js  # Réservations place visiteur
    useSpots.js         # Places privées
    useUsageStats.js    # Quota horaire
    useNotificationBadges.js
  utils/
    slots.js            # Utilitaires créneaux 30 min
functions/
  index.js             # Cloud Functions (notifications nouveau membre)
  lib/notif.js         # Helpers FCM
tests/
  slots.test.js        # Tests unitaires utilitaires créneaux
```

## Règles Firestore

Les règles (`firestore.rules`) appliquent le principe de moindre privilège :

- **`members`** — lecture par tout membre authentifié, écriture par le propriétaire ou un admin
- **`settings`** — lecture par tout membre, écriture admin uniquement
- **`spots`** — création par le propriétaire, mise à jour par le propriétaire ou pour incrémenter `unreadClaims`
- **`spotAvailability`** — lecture/écriture par tout membre authentifié (gestion des créneaux et des candidatures)
- **`reservations`** — lecture/écriture par tout membre (les transactions Firestore garantissent la cohérence)
- **`usageStats`** — lecture/écriture par tout membre (mis à jour atomiquement lors des réservations)

## Rôles

| Rôle | Accès |
|------|-------|
| Voisin | Réserver, poster des souhaits, gérer ses places privées |
| Admin | Tout voisin + gérer les membres, configurer les paramètres, fixer la deadline |

Un nouveau voisin doit être activé par un admin (`needsActivation → false`) avant de pouvoir utiliser l'app. La Cloud Function `onNewMember` envoie automatiquement une notification push aux admins à chaque inscription.
