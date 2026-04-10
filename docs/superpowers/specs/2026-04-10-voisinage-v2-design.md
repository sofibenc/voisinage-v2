# Voisinage v2 — Design Spec

**Date:** 2026-04-10  
**Projet Firebase:** voisinage-v2  
**Stack:** React + Vite, Firebase (Auth, Firestore, Hosting), PWA

---

## Contexte

Réécriture complète de l'app Voisinage v1 (place de parking partagée entre voisins). La v1 fonctionnait à la granularité journée entière. La v2 passe à des **créneaux de 30 minutes, 24h/24**, ce qui répond au besoin réel des voisins.

Pas de migration : nouveau projet Firebase, nouveau dépôt, départ from scratch.

---

## Périmètre

### Place visiteur
Une seule place visiteur partagée. Flux :
1. Chaque voisin exprime ses souhaits (créneaux voulus) avant une deadline mensuelle
2. À la deadline, le planning est **publié automatiquement** (aucune action admin requise)
3. Après publication : un voisin peut **libérer** un créneau qui lui a été attribué → il redevient disponible pour n'importe qui (premier arrivé, premier servi via transaction Firestore)

### Places privées
Un voisin peut marquer des créneaux de sa place privée comme disponibles. N'importe quel voisin peut les prendre directement (pas de messagerie, pas de validation).

---

## Modèle de données Firestore (Approche A — documents compacts)

### Représentation d'un créneau

Un créneau est un entier : `(dayOfMonth - 1) * 48 + hour * 2 + (minute === 30 ? 1 : 0)`

- Jour 1, 00h00 → slot `0`
- Jour 1, 00h30 → slot `1`
- Jour 1, 23h30 → slot `47`
- Jour 2, 00h00 → slot `48`
- Max par mois : 31 × 48 = **1488 slots**

Les slotIds sont stockés comme **entiers** dans les tableaux, et comme **clés string** dans les maps Firestore.

### Collections

```
members/{uid}
  name: string
  email: string
  photoURL: string
  isAdmin: boolean
  template: {
    patterns: string[]          // ex: ["weekends", "fridays"] — patterns prédéfinis
    customRanges: Array<{       // plages horaires récurrentes par jour de semaine
      dayOfWeek: number         // 0=lun … 6=dim
      startSlot: number         // 0-47 (heure dans la journée)
      endSlot: number           // 0-47, inclusif
    }>
  }
  fcmTokens: string[]

wishlists/{uid}_{monthKey}
  uid: string
  monthKey: string              // ex: "2026-04"
  slots: number[]               // slotIds souhaités

schedules/{monthKey}
  assignments: { [slotId: string]: string }   // slotId → uid
  available: number[]           // créneaux libérés, disponibles à prendre
  publishedAt: timestamp
  quotaHours: number            // heures/mois par voisin (ex: 6.0)
  fairness: { [uid: string]: number }  // écart en heures vs quota

prevUsage/{monthKey}
  [uid: string]: number         // heures réellement utilisées le mois précédent

settings/global
  deadlines: { [monthKey: string]: string }   // ex: { "2026-04": "2026-03-31" }

spots/{spotId}
  ownerUid: string
  name: string
  color: string                 // couleur d'affichage

spotAvailability/{spotId}_{monthKey}
  ownerUid: string
  slots: number[]               // créneaux que le proprio rend disponibles
  taken: { [slotId: string]: string }  // slotId → uid du preneur
```

---

## Algorithme d'équité

Calcul côté client au moment de la deadline. Le résultat est écrit en une seule transaction dans `schedules/{monthKey}`.

```
computeSchedule(members, wishlists, year, month, prevUsage):

  totalSlots = daysInMonth(year, month) * 48
  quotaSlots = floor(totalSlots / members.length)
  quotaHours = quotaSlots / 2

  assignments = {}          // slotId → uid
  assigned    = { uid: 0 } // compteur slots attribués par voisin

  for slotId in 0 .. totalSlots - 1:

    candidates = membres ayant slotId dans leur wishlist

    if candidates vide → skip

    // Règle anti-monopole : éviter plus de 48h consécutives (96 slots)
    // au même voisin
    eligible = candidates.filter(m =>
      NOT (96 derniers assignments consécutifs == m.uid)
    )
    if eligible vide → eligible = candidates   // fallback : règle levée

    // Tri primaire  : moins de slots attribués ce mois
    // Tri secondaire : moins d'heures utilisées le mois précédent
    eligible.sort((a, b) =>
      (assigned[a] - assigned[b]) || (prevUsage[a] || 0) - (prevUsage[b] || 0)
    )

    winner = eligible[0]
    assignments[slotId] = winner.uid
    assigned[winner.uid]++

  fairness = { uid: assigned[uid] / 2 - quotaHours }   // en heures
  return { assignments, quotaHours, fairness }
```

**Quota :** calculé en heures (`quotaHours`). Affiché dans l'UI comme "X heures ce mois".

**Publication automatique :** à chaque ouverture de l'app (et après chaque changement de mois détecté via `onSnapshot` sur `settings/global`), le client vérifie : deadline dépassée ET `schedules/{monthKey}` absent. Si les deux conditions sont vraies, il calcule le planning et tente de l'écrire. Une transaction Firestore garantit l'idempotence : si plusieurs clients détectent la condition simultanément, un seul réussira à créer le document, les autres échoueront silencieusement. Si aucun client n'est connecté au moment exact de la deadline, le planning sera publié dès que le premier voisin ouvrira l'app.

**Mise à jour de `prevUsage` :** au moment où `schedules/{monthKey}` est créé, le client écrit simultanément `prevUsage/{monthKey}` avec le nombre d'heures attribuées à chaque voisin ce mois (= `assigned[uid] / 2`). Ce document servira de tiebreaker pour le mois suivant.

---

## Architecture UI

### Onglets

```
App
├── WishTab        — Sélection des créneaux souhaités + gestion du template
├── PlanningTab    — Vue du planning publié (place visiteur)
├── SpotsTab       — Places privées : disponibilités + prise de créneau
└── AdminTab       — Deadline, statistiques (admin uniquement)
```

### Composant central : AgendaView

Partagé entre WishTab et PlanningTab. Supporte 3 vues switchables.

```
AgendaView
├── ViewToggle              — Jour / Semaine / Mois
├── DayView                 — colonne unique, 48 lignes de 30min
│   └── SlotRow             — colorée selon état (souhaité / attribué / libre / vide)
├── WeekView                — 7 colonnes × 48 lignes
│   └── SlotRow × 7
└── MonthView               — grille calendrier
    └── DayCell             — pastille colorée : intensité souhaits ou voisin assigné
```

### Interaction de sélection (WishTab)

- **Tap** sur un créneau → toggle on/off
- **Tap + drag** → sélection d'une plage continue (touch + mouse)
- Les créneaux sélectionnés s'affichent dans la couleur du voisin connecté

### SlotActionSheet (PlanningTab)

Bottom sheet mobile s'ouvrant au tap sur un créneau :
- Si créneau attribué à moi → bouton **Libérer**
- Si créneau dans `available` → bouton **Prendre**
- Sinon → lecture seule (affiche le nom du voisin assigné)

### Templates (WishTab)

Même concept que la v1, adapté aux créneaux :
- Patterns prédéfinis : "Tous les soirs 18h-22h en semaine", "Week-ends", etc.
- Application automatique au début de chaque mois sur les souhaits
- Le voisin peut modifier manuellement après application

### SpotsTab

- Liste des places privées avec leur propriétaire
- Vue mensuelle : créneaux disponibles colorés
- Tap sur un créneau disponible → confirmation → transaction Firestore (taken)
- Le propriétaire voit ses propres créneaux et peut ajouter/retirer des disponibilités

---

## Gestion de la concurrence

Deux opérations nécessitent des transactions Firestore :

1. **Prendre un créneau libéré** (place visiteur) : transaction sur `schedules/{monthKey}` — vérifie que le slot est dans `available`, le retire et met à jour `assignments`
2. **Prendre un créneau privé** : transaction sur `spotAvailability/{spotId}_{monthKey}` — vérifie que le slot est dans `slots` et pas déjà dans `taken`

---

## Règles de sécurité Firestore (grandes lignes)

- `members` : lecture pour tout membre authentifié, écriture pour soi-même ou admin
- `wishlists` : lecture pour tout membre, écriture pour le propriétaire uniquement si pas de planning publié
- `schedules` : lecture pour tout membre, création/suppression pour admin, update pour tout membre (pour libérer/prendre)
- `prevUsage` : lecture pour tout membre, écriture admin + membres (mise à jour lors des transactions)
- `settings` : lecture pour tout membre, écriture admin uniquement
- `spots` : lecture pour tout membre, création/suppression pour le propriétaire
- `spotAvailability` : lecture pour tout membre, écriture propriétaire pour les disponibilités, update pour tout membre (pour prendre)

---

## Ce qui n'est pas dans le périmètre v1

- Notifications push (FCM) — peut être ajouté après
- Historique des échanges
- Statistiques avancées par voisin
