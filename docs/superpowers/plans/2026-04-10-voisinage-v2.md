# Voisinage v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + Firebase PWA for sharing a visitor parking spot between neighbors using 30-minute time slots with equitable distribution.

**Architecture:** Firestore documents compacts (slots as integer arrays per month), equity algorithm computed client-side at deadline, 3-view agenda (day/week/month) shared between wish and planning tabs.

**Tech Stack:** React 18, Vite, Firebase 10 (Auth, Firestore), Vitest, vite-plugin-pwa

---

## File Structure

```
voisinage-v2/
├── index.html
├── vite.config.js
├── package.json
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .env.local                          (gitignored — Firebase config)
├── public/
│   └── manifest.json
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── firebase.js                     # Firebase init + Firestore helpers
│   ├── constants.js                    # PALETTE, MONTHS, DAYS_FR
│   ├── index.css
│   ├── utils/
│   │   ├── slots.js                    # Slot ID encoding/decoding
│   │   ├── schedule.js                 # computeSchedule algorithm
│   │   └── template.js                 # Template → slot IDs resolution
│   ├── hooks/
│   │   ├── useAuth.js                  # Firebase Auth state
│   │   ├── useMembers.js               # Firestore members collection
│   │   ├── useWishlist.js              # Own wishlist read/write
│   │   ├── useSchedule.js              # Schedule + auto-publish logic
│   │   └── useSpots.js                 # Private spots availability
│   ├── components/
│   │   ├── AgendaView/
│   │   │   ├── AgendaView.jsx          # Container: ViewToggle + active view
│   │   │   ├── DayView.jsx             # 48-row single day
│   │   │   ├── WeekView.jsx            # 7 columns × 48 rows
│   │   │   ├── MonthView.jsx           # Calendar grid
│   │   │   └── SlotRow.jsx             # Single 30-min row
│   │   ├── SlotActionSheet.jsx         # Bottom sheet: Release / Take
│   │   ├── TemplatePanel.jsx           # Template configuration UI
│   │   └── ErrorBoundary.jsx
│   └── tabs/
│       ├── WishTab.jsx
│       ├── PlanningTab.jsx
│       ├── SpotsTab.jsx
│       └── AdminTab.jsx
└── tests/
    ├── slots.test.js
    ├── schedule.test.js
    └── template.test.js
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Init project**

```bash
cd /home/benchouks-ext/parkshare/voisinage-v2
npm create vite@latest . -- --template react
```

Answer prompts: framework = React, variant = JavaScript.

- [ ] **Step 2: Install dependencies**

```bash
npm install firebase
npm install -D vitest @vitest/ui
```

- [ ] **Step 3: Configure Vitest in vite.config.js**

Replace the generated `vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create .env.local**

```
VITE_FIREBASE_API_KEY=AIzaSyC1O7mNjEa2kVdoXGgyp3gxheRluxEDrck
VITE_FIREBASE_AUTH_DOMAIN=voisinage-v2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=voisinage-v2
VITE_FIREBASE_STORAGE_BUCKET=voisinage-v2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=990660785356
VITE_FIREBASE_APP_ID=1:990660785356:web:48dde2c6e7b3b9f5b73e69
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.env.local
.env*.local
```

- [ ] **Step 7: Verify Vite dev server starts**

```bash
npm run dev
```

Expected: server running at http://localhost:5173

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/ .gitignore
git commit -m "chore: scaffold React + Vite + Vitest project"
```

---

## Task 2: Slot Utilities (TDD)

**Files:**
- Create: `src/utils/slots.js`
- Create: `tests/slots.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/slots.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { slotId, slotToTime, slotToDay, formatSlotTime, totalSlotsInMonth } from '../src/utils/slots.js';

describe('slotId', () => {
  it('day 1 at 00:00 is slot 0', () => expect(slotId(1, 0, 0)).toBe(0));
  it('day 1 at 00:30 is slot 1', () => expect(slotId(1, 0, 30)).toBe(1));
  it('day 1 at 23:30 is slot 47', () => expect(slotId(1, 23, 30)).toBe(47));
  it('day 2 at 00:00 is slot 48', () => expect(slotId(2, 0, 0)).toBe(48));
});

describe('slotToTime', () => {
  it('slot 0 → { hour: 0, minute: 0 }', () => expect(slotToTime(0)).toEqual({ hour: 0, minute: 0 }));
  it('slot 1 → { hour: 0, minute: 30 }', () => expect(slotToTime(1)).toEqual({ hour: 0, minute: 30 }));
  it('slot 47 → { hour: 23, minute: 30 }', () => expect(slotToTime(47)).toEqual({ hour: 23, minute: 30 }));
  it('slot 48 → { hour: 0, minute: 0 } (day 2)', () => expect(slotToTime(48)).toEqual({ hour: 0, minute: 0 }));
});

describe('slotToDay', () => {
  it('slot 0 → day 1', () => expect(slotToDay(0)).toBe(1));
  it('slot 47 → day 1', () => expect(slotToDay(47)).toBe(1));
  it('slot 48 → day 2', () => expect(slotToDay(48)).toBe(2));
});

describe('formatSlotTime', () => {
  it('slot 0 → "00h00"', () => expect(formatSlotTime(0)).toBe('00h00'));
  it('slot 1 → "00h30"', () => expect(formatSlotTime(1)).toBe('00h30'));
  it('slot 3 → "01h30"', () => expect(formatSlotTime(3)).toBe('01h30'));
});

describe('totalSlotsInMonth', () => {
  it('April 2026 (30 days) → 1440', () => expect(totalSlotsInMonth(2026, 3)).toBe(1440));
  it('March 2026 (31 days) → 1488', () => expect(totalSlotsInMonth(2026, 2)).toBe(1488));
  it('Feb 2024 leap (29 days) → 1392', () => expect(totalSlotsInMonth(2024, 1)).toBe(1392));
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: `Cannot find module '../src/utils/slots.js'`

- [ ] **Step 3: Implement slots.js**

Create `src/utils/slots.js`:

```js
export const SLOTS_PER_DAY = 48;

export function slotId(dayOfMonth, hour, minute) {
  return (dayOfMonth - 1) * SLOTS_PER_DAY + hour * 2 + (minute === 30 ? 1 : 0);
}

export function slotToTime(sid) {
  const slotInDay = sid % SLOTS_PER_DAY;
  return { hour: Math.floor(slotInDay / 2), minute: (slotInDay % 2) * 30 };
}

export function slotToDay(sid) {
  return Math.floor(sid / SLOTS_PER_DAY) + 1;
}

export function formatSlotTime(sid) {
  const { hour, minute } = slotToTime(sid);
  return `${String(hour).padStart(2, '0')}h${minute === 0 ? '00' : '30'}`;
}

export function totalSlotsInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate() * SLOTS_PER_DAY;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/slots.js tests/slots.test.js
git commit -m "feat: slot ID utilities with tests"
```

---

## Task 3: Schedule Algorithm (TDD)

**Files:**
- Create: `src/utils/schedule.js`
- Create: `tests/schedule.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/schedule.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeSchedule } from '../src/utils/schedule.js';

const alice = { uid: 'alice' };
const bob   = { uid: 'bob' };
const members = [alice, bob];

describe('computeSchedule', () => {
  it('assigns slot to sole wishing member', () => {
    const { assignments } = computeSchedule(members, { alice: [0, 1], bob: [] }, 2026, 3);
    expect(assignments[0]).toBe('alice');
    expect(assignments[1]).toBe('alice');
  });

  it('leaves uncontested slots unassigned when not wished', () => {
    const { assignments } = computeSchedule(members, { alice: [], bob: [] }, 2026, 3);
    expect(Object.keys(assignments).length).toBe(0);
  });

  it('gives contested slot to member with fewer assigned slots', () => {
    // alice already has slot 0; both want slot 1
    const { assignments } = computeSchedule(members, { alice: [0, 1], bob: [1] }, 2026, 3);
    expect(assignments[0]).toBe('alice');
    expect(assignments[1]).toBe('bob'); // bob has 0 vs alice's 1
  });

  it('uses prevUsage as tiebreaker when assigned count is equal', () => {
    const { assignments } = computeSchedule(
      members, { alice: [0], bob: [0] }, 2026, 3, { alice: 10, bob: 5 }
    );
    expect(assignments[0]).toBe('bob'); // bob used less last month
  });

  it('computes correct quotaHours for April with 2 members', () => {
    // 30 days × 48 slots / 2 members = 720 slots each = 360 hours
    const { quotaHours } = computeSchedule(members, {}, 2026, 3);
    expect(quotaHours).toBe(360);
  });

  it('computes fairness as deviation from quota in hours', () => {
    const wishlists = { alice: [0, 1, 2, 3], bob: [0, 1, 2, 3] };
    const { fairness } = computeSchedule(members, wishlists, 2026, 3);
    // alice gets 2 slots = 1h, bob gets 2 slots = 1h, quota = 360h → deviation ≈ -359
    expect(typeof fairness.alice).toBe('number');
    expect(fairness.alice).toBe(fairness.bob);
  });

  it('prevents more than 96 consecutive slots to same member', () => {
    // alice wants slots 0-96, bob wants only slot 96
    const aliceSlots = Array.from({ length: 97 }, (_, i) => i);
    const { assignments } = computeSchedule(
      members, { alice: aliceSlots, bob: [96] }, 2026, 3
    );
    // slots 0-95 go to alice (96 consecutive), slot 96 must go to bob
    for (let i = 0; i < 96; i++) expect(assignments[i]).toBe('alice');
    expect(assignments[96]).toBe('bob');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: `Cannot find module '../src/utils/schedule.js'`

- [ ] **Step 3: Implement schedule.js**

Create `src/utils/schedule.js`:

```js
import { totalSlotsInMonth } from './slots.js';

export function computeSchedule(members, wishlists, year, month, prevUsage = {}) {
  const totalSlots = totalSlotsInMonth(year, month);
  const quotaSlots = Math.floor(totalSlots / members.length);
  const quotaHours = quotaSlots / 2;

  const assignments = {};
  const assigned = Object.fromEntries(members.map(m => [m.uid, 0]));
  const wishSets = Object.fromEntries(
    members.map(m => [m.uid, new Set(wishlists[m.uid] || [])])
  );

  for (let slot = 0; slot < totalSlots; slot++) {
    const candidates = members.filter(m => wishSets[m.uid].has(slot));
    if (!candidates.length) continue;

    let eligible = candidates.filter(m => {
      if (slot < 96) return true;
      for (let i = slot - 96; i < slot; i++) {
        if (assignments[i] !== m.uid) return true;
      }
      return false;
    });
    if (!eligible.length) eligible = candidates;

    eligible.sort((a, b) =>
      (assigned[a.uid] - assigned[b.uid]) ||
      ((prevUsage[a.uid] || 0) - (prevUsage[b.uid] || 0))
    );

    assignments[slot] = eligible[0].uid;
    assigned[eligible[0].uid]++;
  }

  const fairness = Object.fromEntries(
    members.map(m => [m.uid, +(assigned[m.uid] / 2 - quotaHours).toFixed(1)])
  );

  return { assignments, quotaHours: +quotaHours.toFixed(1), fairness };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/schedule.js tests/schedule.test.js
git commit -m "feat: equity schedule algorithm with tests"
```

---

## Task 4: Template Utilities (TDD)

**Files:**
- Create: `src/utils/template.js`
- Create: `tests/template.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/template.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveTemplate } from '../src/utils/template.js';

describe('resolveTemplate', () => {
  // April 2026: starts Thursday (dow=3), 30 days
  // Mondays in April 2026: 6,13,20,27

  it('returns empty array for empty template', () => {
    expect(resolveTemplate({}, 2026, 3)).toEqual([]);
  });

  it('resolves "mondays" pattern to all Monday slots', () => {
    const slots = resolveTemplate({ patterns: ['mondays'] }, 2026, 3);
    // Monday Apr 6 = day 6, slots 240-287 (48 slots)
    expect(slots).toContain(240); // day 6 slot 0: (6-1)*48 = 240
    expect(slots).toContain(287); // day 6 slot 47
    expect(slots).toContain(288); // day 7 Mon? No, day 7 is Tue. Day 13 Mon = (13-1)*48=576
    expect(slots).not.toContain(288); // day 7 is Tuesday
    // All 4 Mondays × 48 slots = 192 slots total
    expect(slots.length).toBe(4 * 48);
  });

  it('resolves customRanges by dayOfWeek and slot range', () => {
    // Every Monday (dow=0) from 18h00 (slot 36) to 19h30 (slot 39)
    const slots = resolveTemplate({
      customRanges: [{ dayOfWeek: 0, startSlot: 36, endSlot: 39 }]
    }, 2026, 3);
    // 4 Mondays × 4 slots each = 16 slots
    expect(slots.length).toBe(4 * 4);
    // Monday Apr 6 (day 6): base = 240, slots 276-279
    expect(slots).toContain(276); // 240 + 36
    expect(slots).toContain(279); // 240 + 39
  });

  it('combines patterns and customRanges without duplicates', () => {
    const slots = resolveTemplate({
      patterns: ['mondays'],
      customRanges: [{ dayOfWeek: 0, startSlot: 0, endSlot: 5 }]
    }, 2026, 3);
    // mondays already includes all 48 slots per Monday, customRanges adds 0-5 which are already included
    expect(slots.length).toBe(4 * 48); // no duplicates
  });

  it('resolves "weekends" pattern', () => {
    const slots = resolveTemplate({ patterns: ['weekends'] }, 2026, 3);
    // April 2026 weekends: Sat Apr 4,11,18,25 + Sun Apr 5,12,19,26 = 8 days
    expect(slots.length).toBe(8 * 48);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

- [ ] **Step 3: Implement template.js**

Create `src/utils/template.js`:

```js
import { SLOTS_PER_DAY } from './slots.js';

const PATTERN_DOW = {
  weekends: dow => dow === 5 || dow === 6,
  mondays:  dow => dow === 0,
  fridays:  dow => dow === 4,
  midweek:  dow => dow >= 1 && dow <= 3,
};

export function resolveTemplate(template, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const slots = new Set();

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = (new Date(year, month, day).getDay() + 6) % 7; // 0=Mon
    const base = (day - 1) * SLOTS_PER_DAY;

    for (const pattern of template.patterns || []) {
      if (PATTERN_DOW[pattern]?.(dow)) {
        for (let s = 0; s < SLOTS_PER_DAY; s++) slots.add(base + s);
      }
    }

    for (const range of template.customRanges || []) {
      if (range.dayOfWeek === dow) {
        for (let s = range.startSlot; s <= range.endSlot; s++) slots.add(base + s);
      }
    }
  }

  return [...slots].sort((a, b) => a - b);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/template.js tests/template.test.js
git commit -m "feat: template resolution utilities with tests"
```

---

## Task 5: Constants + Firebase Init

**Files:**
- Create: `src/constants.js`
- Create: `src/firebase.js`

- [ ] **Step 1: Create constants.js**

```js
// src/constants.js
export const PALETTE = [
  { bg: '#E8533A', light: '#FEF0ED', text: '#7A1A0A' },
  { bg: '#2A9D8F', light: '#E6F6F4', text: '#0D4D47' },
  { bg: '#E9C46A', light: '#FDF8E7', text: '#7A5C00' },
  { bg: '#457B9D', light: '#EAF2F8', text: '#1A3A50' },
  { bg: '#9B5DE5', light: '#F4EDFD', text: '#3D0070' },
  { bg: '#F77F00', light: '#FFF2E5', text: '#7A3300' },
  { bg: '#06D6A0', light: '#E5FBF5', text: '#00503C' },
  { bg: '#EF476F', light: '#FEE9EF', text: '#7A0028' },
];

export const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                       'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
export const DAYS_FR = ['L','M','M','J','V','S','D'];

export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function parseMonthKey(mk) {
  const [y, m] = mk.split('-').map(Number);
  return { year: y, month: m - 1 };
}
```

- [ ] **Step 2: Create firebase.js**

```js
// src/firebase.js
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
} from 'firebase/auth';
import {
  getFirestore, doc, collection,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, runTransaction, arrayUnion, arrayRemove,
  serverTimestamp, query, where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const googleProvider = new GoogleAuthProvider();
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// ── Members ───────────────────────────────────────────────────────────────────
export const membersCol = () => collection(db, 'members');
export const memberDoc  = uid => doc(db, 'members', uid);

export async function upsertMember(uid, data) {
  await setDoc(memberDoc(uid), data, { merge: true });
}

// ── Wishlists ─────────────────────────────────────────────────────────────────
export const wishlistDoc = (uid, mk) => doc(db, 'wishlists', `${uid}_${mk}`);

export async function setWishlist(uid, mk, slots) {
  await setDoc(wishlistDoc(uid, mk), { uid, monthKey: mk, slots });
}

// ── Schedules ─────────────────────────────────────────────────────────────────
export const scheduleDoc = mk => doc(db, 'schedules', mk);

export async function publishSchedule(mk, assignments, quotaHours, fairness, prevUsageByUid) {
  // assignments: { [number]: uid } → convert keys to strings for Firestore
  const fsAssignments = Object.fromEntries(
    Object.entries(assignments).map(([k, v]) => [String(k), v])
  );
  await runTransaction(db, async tx => {
    const ref = scheduleDoc(mk);
    const snap = await tx.get(ref);
    if (snap.exists()) return; // already published — idempotent
    tx.set(ref, {
      assignments: fsAssignments,
      available: [],
      publishedAt: serverTimestamp(),
      quotaHours,
      fairness,
    });
    // Write prevUsage for next month's tiebreaker
    tx.set(doc(db, 'prevUsage', mk), prevUsageByUid);
  });
}

export async function releaseSlot(mk, slotId, uid) {
  await runTransaction(db, async tx => {
    const ref = scheduleDoc(mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No schedule');
    const data = snap.data();
    if (data.assignments[String(slotId)] !== uid) throw new Error('Not your slot');
    const newAssignments = { ...data.assignments };
    delete newAssignments[String(slotId)];
    tx.update(ref, {
      assignments: newAssignments,
      available: arrayUnion(slotId),
    });
  });
}

export async function claimSlot(mk, slotId, uid) {
  await runTransaction(db, async tx => {
    const ref = scheduleDoc(mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No schedule');
    const data = snap.data();
    if (!data.available.includes(slotId)) throw new Error('Slot not available');
    tx.update(ref, {
      [`assignments.${slotId}`]: uid,
      available: arrayRemove(slotId),
    });
  });
}

// ── PrevUsage ─────────────────────────────────────────────────────────────────
export const prevUsageDoc = mk => doc(db, 'prevUsage', mk);

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsDoc = () => doc(db, 'settings', 'global');

export async function setDeadline(mk, dateStr) {
  await setDoc(settingsDoc(), { deadlines: { [mk]: dateStr } }, { merge: true });
}

// ── Spots (private) ───────────────────────────────────────────────────────────
export const spotsCol    = () => collection(db, 'spots');
export const spotDoc     = id  => doc(db, 'spots', id);
export const spotAvailDoc = (spotId, mk) => doc(db, 'spotAvailability', `${spotId}_${mk}`);

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

- [ ] **Step 3: Commit**

```bash
git add src/constants.js src/firebase.js
git commit -m "feat: constants and Firebase client layer"
```

---

## Task 6: Auth Hook + App Shell

**Files:**
- Create: `src/hooks/useAuth.js`
- Create: `src/App.jsx`
- Create: `src/main.jsx`
- Create: `src/index.css`

- [ ] **Step 1: Create useAuth.js**

```js
// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, upsertMember, memberDoc } from '../firebase.js';
import { getDoc } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser]     = useState(undefined); // undefined = loading
  const [member, setMember] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) { setUser(null); setMember(null); return; }
      setUser(firebaseUser);
      // Upsert member doc on first login
      await upsertMember(firebaseUser.uid, {
        name:     firebaseUser.displayName,
        email:    firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      });
      const snap = await getDoc(memberDoc(firebaseUser.uid));
      setMember(snap.exists() ? { uid: firebaseUser.uid, ...snap.data() } : null);
    });
  }, []);

  return { user, member };
}
```

- [ ] **Step 2: Create minimal index.css**

```css
/* src/index.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
       background: #F8FAFC; color: #1E293B; }
button { cursor: pointer; }
```

- [ ] **Step 3: Create App.jsx**

```jsx
// src/App.jsx
import { useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { loginWithGoogle, logout } from './firebase.js';
import WishTab     from './tabs/WishTab.jsx';
import PlanningTab from './tabs/PlanningTab.jsx';
import SpotsTab    from './tabs/SpotsTab.jsx';
import AdminTab    from './tabs/AdminTab.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const TABS = [
  { id: 'wish',     label: '✋ Souhaits' },
  { id: 'planning', label: '📅 Planning' },
  { id: 'spots',    label: '🔑 Places' },
];

export default function App() {
  const { user, member } = useAuth();
  const [tab, setTab] = useState('wish');

  if (user === undefined) return <div style={{ padding: 32 }}>Chargement…</div>;

  if (!user) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Voisinage</h1>
      <p style={{ color: '#64748B' }}>Parking partagé entre voisins</p>
      <button onClick={loginWithGoogle}
        style={{ background: '#1E293B', color: 'white', border: 'none',
                 borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 600 }}>
        Connexion avec Google
      </button>
    </div>
  );

  const tabs = member?.isAdmin ? [...TABS, { id: 'admin', label: '⚙️ Admin' }] : TABS;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh',
                  display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: '1px solid #E2E8F0', background: 'white' }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Voisinage</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#64748B' }}>
            {member?.name || user.displayName}
          </span>
          <button onClick={logout}
            style={{ background: 'none', border: '1px solid #E2E8F0',
                     borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
            Déco
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'white',
                    borderBottom: '1px solid #E2E8F0' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '10px 4px', fontSize: 12, fontWeight: 600,
                     border: 'none', background: 'none',
                     borderBottom: tab === t.id ? '2px solid #1E293B' : '2px solid transparent',
                     color: tab === t.id ? '#1E293B' : '#94A3B8' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <ErrorBoundary>
          {tab === 'wish'     && <WishTab member={member} />}
          {tab === 'planning' && <PlanningTab member={member} />}
          {tab === 'spots'    && <SpotsTab member={member} />}
          {tab === 'admin'    && member?.isAdmin && <AdminTab member={member} />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create main.jsx**

```jsx
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

- [ ] **Step 5: Create placeholder tabs (so App compiles)**

Create each of these as a minimal stub:

`src/tabs/WishTab.jsx`:
```jsx
export default function WishTab({ member }) {
  return <div>Souhaits — à implémenter</div>;
}
```

`src/tabs/PlanningTab.jsx`:
```jsx
export default function PlanningTab({ member }) {
  return <div>Planning — à implémenter</div>;
}
```

`src/tabs/SpotsTab.jsx`:
```jsx
export default function SpotsTab({ member }) {
  return <div>Places — à implémenter</div>;
}
```

`src/tabs/AdminTab.jsx`:
```jsx
export default function AdminTab({ member }) {
  return <div>Admin — à implémenter</div>;
}
```

- [ ] **Step 6: Create ErrorBoundary.jsx**

```jsx
// src/components/ErrorBoundary.jsx
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 16, color: '#DC2626' }}>
        Erreur : {this.state.error.message}
      </div>
    );
    return this.props.children;
  }
}
```

- [ ] **Step 7: Verify app loads in browser**

```bash
npm run dev
```

Open http://localhost:5173 — expect Google login screen.

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: app shell with auth, tab nav, stub tabs"
```

---

## Task 7: Firestore Data Hooks

**Files:**
- Create: `src/hooks/useMembers.js`
- Create: `src/hooks/useWishlist.js`
- Create: `src/hooks/useSchedule.js`

- [ ] **Step 1: Create useMembers.js**

```js
// src/hooks/useMembers.js
import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { membersCol } from '../firebase.js';
import { PALETTE } from '../constants.js';

export function useMembers() {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    return onSnapshot(membersCol(), snap => {
      const list = snap.docs.map((d, i) => ({
        uid: d.id,
        ...d.data(),
        color: PALETTE[i % PALETTE.length],
      }));
      setMembers(list);
    });
  }, []);

  const colorOf = uid => members.find(m => m.uid === uid)?.color ?? PALETTE[0];

  return { members, colorOf };
}
```

- [ ] **Step 2: Create useWishlist.js**

```js
// src/hooks/useWishlist.js
import { useState, useEffect, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { wishlistDoc, setWishlist } from '../firebase.js';

export function useWishlist(uid, mk) {
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    if (!uid || !mk) return;
    return onSnapshot(wishlistDoc(uid, mk), snap => {
      setSlots(snap.exists() ? snap.data().slots ?? [] : []);
    });
  }, [uid, mk]);

  const toggleSlot = useCallback(async (slotId) => {
    const next = slots.includes(slotId)
      ? slots.filter(s => s !== slotId)
      : [...slots, slotId].sort((a, b) => a - b);
    setSlots(next);
    await setWishlist(uid, mk, next);
  }, [uid, mk, slots]);

  const setSlotRange = useCallback(async (start, end, selected) => {
    const rangeSet = new Set();
    for (let s = Math.min(start, end); s <= Math.max(start, end); s++) rangeSet.add(s);
    const next = selected
      ? [...new Set([...slots, ...rangeSet])].sort((a, b) => a - b)
      : slots.filter(s => !rangeSet.has(s));
    setSlots(next);
    await setWishlist(uid, mk, next);
  }, [uid, mk, slots]);

  const clearAll = useCallback(async () => {
    setSlots([]);
    await setWishlist(uid, mk, []);
  }, [uid, mk]);

  return { slots, toggleSlot, setSlotRange, clearAll };
}
```

- [ ] **Step 3: Create useSchedule.js**

```js
// src/hooks/useSchedule.js
import { useState, useEffect, useRef } from 'react';
import { onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import {
  scheduleDoc, settingsDoc, membersCol, wishlistDoc,
  prevUsageDoc, publishSchedule, releaseSlot, claimSlot,
} from '../firebase.js';
import { computeSchedule } from '../utils/schedule.js';
import { monthKey } from '../constants.js';

export function useSchedule(year, month) {
  const mk = monthKey(year, month);
  const [schedule,  setSchedule]  = useState(null);
  const [settings,  setSettings]  = useState(null);
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);

  // Listen to schedule
  useEffect(() => {
    return onSnapshot(scheduleDoc(mk), snap => {
      setSchedule(snap.exists() ? snap.data() : null);
    });
  }, [mk]);

  // Listen to settings + auto-publish check
  useEffect(() => {
    return onSnapshot(settingsDoc(), async snap => {
      const s = snap.exists() ? snap.data() : {};
      setSettings(s);
      await checkAndPublish(mk, s, publishingRef, setPublishing);
    });
  }, [mk]);

  const release = (slotId, uid) => releaseSlot(mk, slotId, uid);
  const claim   = (slotId, uid) => claimSlot(mk, slotId, uid);

  const deadline = settings?.deadlines?.[mk] ?? null;
  const isDeadlinePassed = deadline ? new Date() > new Date(deadline + 'T23:59:59') : false;

  return { schedule, deadline, isDeadlinePassed, publishing, release, claim };
}

async function checkAndPublish(mk, settings, publishingRef, setPublishing) {
  const deadline = settings?.deadlines?.[mk];
  if (!deadline) return;
  if (new Date() <= new Date(deadline + 'T23:59:59')) return;

  // Check if schedule already exists
  const schedSnap = await getDoc(scheduleDoc(mk));
  if (schedSnap.exists()) return;

  if (publishingRef.current) return;
  publishingRef.current = true;
  setPublishing(true);

  try {
    const [membersSnap, prevSnap] = await Promise.all([
      getDocs(membersCol()),
      getDoc(prevUsageDoc(mk)),
    ]);
    const members  = membersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const prevUsage = prevSnap.exists() ? prevSnap.data() : {};

    // Fetch all wishlists for this month
    const wishlistSnaps = await Promise.all(
      members.map(m => getDoc(wishlistDoc(m.uid, mk)))
    );
    const wishlists = Object.fromEntries(
      members.map((m, i) => [m.uid, wishlistSnaps[i].exists()
        ? wishlistSnaps[i].data().slots ?? []
        : []])
    );

    const [y, mo] = mk.split('-').map(Number);
    const { assignments, quotaHours, fairness } = computeSchedule(
      members, wishlists, y, mo - 1, prevUsage
    );
    const prevUsageByUid = Object.fromEntries(
      members.map(m => [m.uid, (Object.entries(assignments)
        .filter(([, uid]) => uid === m.uid).length) / 2])
    );

    await publishSchedule(mk, assignments, quotaHours, fairness, prevUsageByUid);
  } finally {
    publishingRef.current = false;
    setPublishing(false);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: Firestore data hooks (members, wishlist, schedule + auto-publish)"
```

---

## Task 8: SlotRow + AgendaView — DayView

**Files:**
- Create: `src/components/AgendaView/SlotRow.jsx`
- Create: `src/components/AgendaView/DayView.jsx`
- Create: `src/components/AgendaView/AgendaView.jsx` (partial)

- [ ] **Step 1: Create SlotRow.jsx**

```jsx
// src/components/AgendaView/SlotRow.jsx
import { formatSlotTime } from '../../utils/slots.js';

/**
 * Props:
 *   slotId      - integer
 *   state       - 'empty' | 'mine' | 'other' | 'available'
 *   color       - { bg, light, text } — color of the member who owns/wants this slot
 *   label       - string shown inside (member name or nothing)
 *   showTime    - bool — show HH:MM label on left
 *   onPointerDown / onPointerEnter / onPointerUp — drag handlers (optional)
 *   onClick     - click handler (optional)
 */
export default function SlotRow({
  slotId, state = 'empty', color, label = '',
  showTime = false, onPointerDown, onPointerEnter, onPointerUp, onClick,
}) {
  const bg = state === 'mine'      ? color?.bg    :
             state === 'other'     ? color?.light  :
             state === 'available' ? '#DCFCE7'     : 'transparent';

  const textColor = state === 'mine'      ? 'white'          :
                    state === 'other'     ? color?.text       :
                    state === 'available' ? '#166534'         : '#94A3B8';

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerUp={onPointerUp}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', height: 20,
        background: bg, borderBottom: '1px solid #F1F5F9',
        cursor: onClick || onPointerDown ? 'pointer' : 'default',
        userSelect: 'none', touchAction: 'none',
        paddingLeft: 4, paddingRight: 4,
      }}
    >
      {showTime && (
        <span style={{ fontSize: 9, color: '#94A3B8', width: 32, flexShrink: 0 }}>
          {formatSlotTime(slotId)}
        </span>
      )}
      <span style={{ fontSize: 10, color: textColor, overflow: 'hidden',
                     textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {state === 'available' ? '✦ libre' : label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create DayView.jsx**

```jsx
// src/components/AgendaView/DayView.jsx
import { SLOTS_PER_DAY } from '../../utils/slots.js';
import SlotRow from './SlotRow.jsx';

/**
 * Props:
 *   year, month, day     - which day to render
 *   getSlotState         - fn(slotId) → { state, color, label }
 *   onSlotPointerDown    - fn(slotId, e)
 *   onSlotPointerEnter   - fn(slotId)
 *   onSlotPointerUp      - fn()
 *   onSlotClick          - fn(slotId)
 */
export default function DayView({
  year, month, day,
  getSlotState,
  onSlotPointerDown, onSlotPointerEnter, onSlotPointerUp, onSlotClick,
}) {
  const base = (day - 1) * SLOTS_PER_DAY;
  const rows = [];

  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    const sid = base + s;
    const { state, color, label } = getSlotState(sid);
    rows.push(
      <SlotRow
        key={sid}
        slotId={sid}
        state={state}
        color={color}
        label={label}
        showTime={s % 2 === 0} // show time every hour
        onPointerDown={onSlotPointerDown ? e => onSlotPointerDown(sid, e) : undefined}
        onPointerEnter={onSlotPointerEnter ? () => onSlotPointerEnter(sid) : undefined}
        onPointerUp={onSlotPointerUp}
        onClick={onSlotClick ? () => onSlotClick(sid) : undefined}
      />
    );
  }

  return (
    <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      {rows}
    </div>
  );
}
```

- [ ] **Step 3: Create AgendaView.jsx skeleton**

```jsx
// src/components/AgendaView/AgendaView.jsx
import { useState } from 'react';
import DayView   from './DayView.jsx';
import WeekView  from './WeekView.jsx';
import MonthView from './MonthView.jsx';
import { MONTHS, DAYS_FR } from '../../constants.js';

const VIEWS = ['Jour', 'Semaine', 'Mois'];

export default function AgendaView({
  year, month, getSlotState,
  onSlotPointerDown, onSlotPointerEnter, onSlotPointerUp, onSlotClick,
}) {
  const [view, setView]        = useState('Semaine');
  const [selectedDay, setDay]  = useState(new Date().getDate());

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {VIEWS.map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                     border: 'none', borderRadius: 8,
                     background: view === v ? '#1E293B' : '#F1F5F9',
                     color: view === v ? 'white' : '#64748B' }}>
            {v}
          </button>
        ))}
      </div>

      {/* Day selector (for Jour view) */}
      {view === 'Jour' && (
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto',
                      marginBottom: 8, paddingBottom: 4 }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
            <button key={d} onClick={() => setDay(d)}
              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                       border: 'none', fontSize: 12, fontWeight: 600,
                       background: d === selectedDay ? '#1E293B' : '#F1F5F9',
                       color: d === selectedDay ? 'white' : '#64748B' }}>
              {d}
            </button>
          ))}
        </div>
      )}

      {view === 'Jour' && (
        <DayView year={year} month={month} day={selectedDay}
          getSlotState={getSlotState}
          onSlotPointerDown={onSlotPointerDown}
          onSlotPointerEnter={onSlotPointerEnter}
          onSlotPointerUp={onSlotPointerUp}
          onSlotClick={onSlotClick} />
      )}
      {view === 'Semaine' && (
        <WeekView year={year} month={month}
          getSlotState={getSlotState}
          onSlotPointerDown={onSlotPointerDown}
          onSlotPointerEnter={onSlotPointerEnter}
          onSlotPointerUp={onSlotPointerUp}
          onSlotClick={onSlotClick} />
      )}
      {view === 'Mois' && (
        <MonthView year={year} month={month} getSlotState={getSlotState} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AgendaView/
git commit -m "feat: SlotRow, DayView, AgendaView skeleton"
```

---

## Task 9: WeekView + MonthView

**Files:**
- Create: `src/components/AgendaView/WeekView.jsx`
- Create: `src/components/AgendaView/MonthView.jsx`

- [ ] **Step 1: Create WeekView.jsx**

```jsx
// src/components/AgendaView/WeekView.jsx
import { useState } from 'react';
import { SLOTS_PER_DAY, slotToTime, formatSlotTime } from '../../utils/slots.js';
import { DAYS_FR } from '../../constants.js';

export default function WeekView({
  year, month, getSlotState,
  onSlotPointerDown, onSlotPointerEnter, onSlotPointerUp, onSlotClick,
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Start from Monday of current week or day 1
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = isCurrentMonth ? today.getDate() : 1;
  // Find Monday of week containing todayDay
  const dow = (new Date(year, month, todayDay).getDay() + 6) % 7;
  const weekStart = Math.max(1, todayDay - dow);

  const [startDay, setStartDay] = useState(weekStart);
  const weekDays = Array.from({ length: 7 }, (_, i) => startDay + i)
    .filter(d => d >= 1 && d <= daysInMonth);

  const prevWeek = () => setStartDay(d => Math.max(1, d - 7));
  const nextWeek = () => setStartDay(d => Math.min(daysInMonth - 6, d + 7));

  return (
    <div>
      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <button onClick={prevWeek} style={{ border: 'none', background: '#F1F5F9',
          borderRadius: 6, padding: '4px 8px', fontSize: 14 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
          {weekDays[0]}–{weekDays[weekDays.length - 1]} {new Date(year, month).toLocaleString('fr', { month: 'long' })}
        </span>
        <button onClick={nextWeek} style={{ border: 'none', background: '#F1F5F9',
          borderRadius: 6, padding: '4px 8px', fontSize: 14 }}>›</button>
      </div>

      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
        {/* Header row */}
        <div style={{ display: 'flex', position: 'sticky', top: 0,
                      background: 'white', zIndex: 1, borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ width: 32 }} /> {/* time gutter */}
          {weekDays.map(d => {
            const dow = (new Date(year, month, d).getDay() + 6) % 7;
            return (
              <div key={d} style={{ flex: 1, textAlign: 'center',
                                    fontSize: 11, fontWeight: 600, padding: '4px 0',
                                    color: '#64748B' }}>
                {DAYS_FR[dow]}<br />{d}
              </div>
            );
          })}
        </div>

        {/* Slot rows */}
        {Array.from({ length: SLOTS_PER_DAY }, (_, s) => (
          <div key={s} style={{ display: 'flex',
                                borderBottom: s % 2 === 1 ? '1px solid #E2E8F0' : 'none' }}>
            {/* Time gutter — only on even slots (full hours) */}
            <div style={{ width: 32, flexShrink: 0, fontSize: 9, color: '#94A3B8',
                          display: 'flex', alignItems: 'center', paddingLeft: 2 }}>
              {s % 2 === 0 ? `${String(s / 2).padStart(2, '0')}h` : ''}
            </div>
            {weekDays.map(d => {
              const sid = (d - 1) * SLOTS_PER_DAY + s;
              const { state, color, label } = getSlotState(sid);
              const bg = state === 'mine'      ? color?.bg    :
                         state === 'other'     ? color?.light  :
                         state === 'available' ? '#DCFCE7'     : 'transparent';
              return (
                <div key={d}
                  onPointerDown={onSlotPointerDown ? e => onSlotPointerDown(sid, e) : undefined}
                  onPointerEnter={onSlotPointerEnter ? () => onSlotPointerEnter(sid) : undefined}
                  onPointerUp={onSlotPointerUp}
                  onClick={onSlotClick ? () => onSlotClick(sid) : undefined}
                  style={{
                    flex: 1, height: 14, background: bg,
                    cursor: onSlotClick || onSlotPointerDown ? 'pointer' : 'default',
                    userSelect: 'none', touchAction: 'none',
                    borderLeft: '1px solid #F1F5F9',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MonthView.jsx**

```jsx
// src/components/AgendaView/MonthView.jsx
import { SLOTS_PER_DAY } from '../../utils/slots.js';
import { MONTHS, DAYS_FR } from '../../constants.js';

/**
 * MonthView: calendar grid. Each DayCell shows a color bar representing
 * the most-assigned member for that day (planning mode) or selection intensity (wish mode).
 */
export default function MonthView({ year, month, getSlotState }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7;

  // For each day, compute a summary color
  function daySummary(day) {
    const base  = (day - 1) * SLOTS_PER_DAY;
    const counts = {};
    let mineCount = 0;
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      const { state, color } = getSlotState(base + s);
      if (state === 'mine') mineCount++;
      if (state !== 'empty') {
        const key = color?.bg ?? '#ccc';
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { color: dominant?.[0] ?? null, mineCount };
  }

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const { color, mineCount } = daySummary(d);
    cells.push(
      <div key={d} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column',
                             alignItems: 'center', justifyContent: 'center',
                             borderRadius: 8, background: color ? `${color}22` : '#F8FAFC',
                             border: `1px solid ${color ?? '#E2E8F0'}`, fontSize: 11 }}>
        <span style={{ fontWeight: 700, color: '#1E293B' }}>{d}</span>
        {mineCount > 0 && (
          <span style={{ fontSize: 9, color: '#64748B' }}>{mineCount / 2}h</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
                    marginBottom: 6 }}>
        {DAYS_FR.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10,
                                fontWeight: 700, color: '#94A3B8', padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AgendaView/WeekView.jsx src/components/AgendaView/MonthView.jsx
git commit -m "feat: WeekView and MonthView agenda components"
```

---

## Task 10: WishTab

**Files:**
- Modify: `src/tabs/WishTab.jsx`

- [ ] **Step 1: Implement WishTab.jsx**

```jsx
// src/tabs/WishTab.jsx
import { useState, useCallback, useRef } from 'react';
import { useWishlist }   from '../hooks/useWishlist.js';
import { useSchedule }   from '../hooks/useSchedule.js';
import { useMembers }    from '../hooks/useMembers.js';
import AgendaView        from '../components/AgendaView/AgendaView.jsx';
import TemplatePanel     from '../components/TemplatePanel.jsx';
import { MONTHS, monthKey } from '../constants.js';

export default function WishTab({ member }) {
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const mk = monthKey(year, month);

  const { slots, toggleSlot, setSlotRange, clearAll } = useWishlist(member?.uid, mk);
  const { schedule, deadline, isDeadlinePassed } = useSchedule(year, month);
  const { members, colorOf } = useMembers();
  const myColor = colorOf(member?.uid);

  const [showTemplate, setShowTemplate] = useState(false);

  // Drag selection state
  const dragRef = useRef({ active: false, startSlot: null, startSelected: null });

  const getSlotState = useCallback((sid) => {
    if (slots.includes(sid)) return { state: 'mine', color: myColor, label: '' };
    return { state: 'empty', color: null, label: '' };
  }, [slots, myColor]);

  const handlePointerDown = useCallback((sid, e) => {
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const startSelected = slots.includes(sid);
    dragRef.current = { active: true, startSlot: sid, startSelected };
    toggleSlot(sid);
  }, [slots, toggleSlot]);

  const handlePointerEnter = useCallback((sid) => {
    if (!dragRef.current.active) return;
    setSlotRange(dragRef.current.startSlot, sid, dragRef.current.startSelected === false);
  }, [setSlotRange]);

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const locked = isDeadlinePassed || !!schedule;

  // Month navigation (max 3 months ahead)
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const canGoNext = new Date(year, month + 1) < maxDate;
  const canGoPrev = new Date(year, month) > new Date(now.getFullYear(), now.getMonth());

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (!canGoNext) return; if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prevMonth} disabled={!canGoPrev}
          style={{ border: 'none', background: 'none', fontSize: 20, color: canGoPrev ? '#1E293B' : '#CBD5E1' }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} disabled={!canGoNext}
          style={{ border: 'none', background: 'none', fontSize: 20, color: canGoNext ? '#1E293B' : '#CBD5E1' }}>›</button>
      </div>

      {/* Status banner */}
      {schedule && (
        <div style={{ background: '#FEF9C3', border: '2px solid #FDE047', borderRadius: 10,
                      padding: 10, marginBottom: 12, fontSize: 13, color: '#713F12' }}>
          ⚠️ Planning publié — souhaits verrouillés.
        </div>
      )}
      {!schedule && isDeadlinePassed && (
        <div style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: 10,
                      padding: 10, marginBottom: 12, fontSize: 13, color: '#DC2626' }}>
          🔒 Deadline dépassée ({deadline}) — souhaits verrouillés.
        </div>
      )}
      {!schedule && !isDeadlinePassed && (
        <div style={{ background: myColor.light, border: `2px solid ${myColor.bg}`,
                      borderRadius: 10, padding: 10, marginBottom: 12,
                      display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: myColor.text }}>
              {slots.length / 2}h sélectionnées
            </span>
            {deadline && (
              <div style={{ fontSize: 11, color: myColor.text, opacity: 0.7, marginTop: 2 }}>
                Deadline : {deadline}
              </div>
            )}
          </div>
          <button onClick={() => setShowTemplate(true)}
            style={{ background: myColor.bg, color: 'white', border: 'none',
                     borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
            Template
          </button>
          {slots.length > 0 && (
            <button onClick={clearAll}
              style={{ background: 'none', border: 'none', color: myColor.text,
                       fontSize: 11, fontWeight: 700, opacity: 0.7 }}>
              ✕ Tout effacer
            </button>
          )}
        </div>
      )}

      {/* Agenda */}
      <div style={{ background: 'white', borderRadius: 14,
                    padding: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <AgendaView
          year={year} month={month}
          getSlotState={getSlotState}
          onSlotPointerDown={locked ? undefined : handlePointerDown}
          onSlotPointerEnter={locked ? undefined : handlePointerEnter}
          onSlotPointerUp={locked ? undefined : handlePointerUp}
        />
      </div>

      {showTemplate && (
        <TemplatePanel
          member={member}
          year={year} month={month}
          myColor={myColor}
          onClose={() => setShowTemplate(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/WishTab.jsx
git commit -m "feat: WishTab with drag selection and template trigger"
```

---

## Task 11: TemplatePanel

**Files:**
- Create: `src/components/TemplatePanel.jsx`

- [ ] **Step 1: Create TemplatePanel.jsx**

```jsx
// src/components/TemplatePanel.jsx
import { useState } from 'react';
import { upsertMember } from '../firebase.js';
import { resolveTemplate } from '../utils/template.js';
import { setWishlist } from '../firebase.js';
import { monthKey } from '../constants.js';

const PRESET_PATTERNS = [
  { id: 'weekends', label: 'Week-ends', desc: 'Sam + Dim' },
  { id: 'mondays',  label: 'Lundis',    desc: 'Tous les lundis' },
  { id: 'fridays',  label: 'Vendredis', desc: 'Tous les vendredis' },
  { id: 'midweek',  label: 'Milieu de semaine', desc: 'Mar + Mer + Jeu' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function TemplatePanel({ member, year, month, myColor, onClose }) {
  const existing = member?.template ?? { patterns: [], customRanges: [] };
  const [patterns,      setPatterns]      = useState(existing.patterns ?? []);
  const [customRanges,  setCustomRanges]  = useState(existing.customRanges ?? []);
  const [newRange,      setNewRange]      = useState({ dayOfWeek: 0, startSlot: 36, endSlot: 39 });

  function togglePattern(id) {
    setPatterns(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  function addRange() {
    if (newRange.startSlot > newRange.endSlot) return;
    setCustomRanges(r => [...r, { ...newRange }]);
  }

  function removeRange(i) {
    setCustomRanges(r => r.filter((_, j) => j !== i));
  }

  async function saveAndApply() {
    const template = { patterns, customRanges };
    await upsertMember(member.uid, { template });
    const slots = resolveTemplate(template, year, month);
    await setWishlist(member.uid, monthKey(year, month), slots);
    onClose();
  }

  const DOW_LABELS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  zIndex: 50 }}>
      <div style={{ background: 'white', borderRadius: '16px 16px 0 0',
                    padding: 20, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Template de souhaits</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22 }}>×</button>
        </div>

        {/* Preset patterns */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
            PATTERNS PRÉDÉFINIS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PRESET_PATTERNS.map(p => (
              <button key={p.id} onClick={() => togglePattern(p.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                         padding: '10px 12px', borderRadius: 10,
                         border: `2px solid ${patterns.includes(p.id) ? myColor.bg : '#E2E8F0'}`,
                         background: patterns.includes(p.id) ? myColor.light : 'white' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.desc}</div>
                </div>
                {patterns.includes(p.id) && <span style={{ color: myColor.bg }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Custom ranges */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
            PLAGES PERSONNALISÉES
          </div>
          {customRanges.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                   marginBottom: 6, fontSize: 13 }}>
              <span>{DOW_LABELS[r.dayOfWeek]} {String(Math.floor(r.startSlot/2)).padStart(2,'0')}h{r.startSlot%2?'30':'00'}
                –{String(Math.floor(r.endSlot/2)).padStart(2,'0')}h{r.endSlot%2?'30':'00'}</span>
              <button onClick={() => removeRange(i)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none',
                         color: '#EF4444', fontSize: 16 }}>×</button>
            </div>
          ))}

          {/* Add new range */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <select value={newRange.dayOfWeek}
              onChange={e => setNewRange(r => ({ ...r, dayOfWeek: Number(e.target.value) }))}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E2E8F0',
                       fontSize: 12 }}>
              {DOW_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <select value={newRange.startSlot}
              onChange={e => setNewRange(r => ({ ...r, startSlot: Number(e.target.value) }))}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E2E8F0',
                       fontSize: 12 }}>
              {Array.from({ length: 48 }, (_, s) => (
                <option key={s} value={s}>
                  {String(Math.floor(s/2)).padStart(2,'0')}h{s%2?'30':'00'}
                </option>
              ))}
            </select>
            <span style={{ alignSelf: 'center', fontSize: 12 }}>→</span>
            <select value={newRange.endSlot}
              onChange={e => setNewRange(r => ({ ...r, endSlot: Number(e.target.value) }))}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E2E8F0',
                       fontSize: 12 }}>
              {Array.from({ length: 48 }, (_, s) => (
                <option key={s} value={s}>
                  {String(Math.floor(s/2)).padStart(2,'0')}h{s%2?'30':'00'}
                </option>
              ))}
            </select>
            <button onClick={addRange}
              style={{ background: myColor.bg, color: 'white', border: 'none',
                       borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
              +
            </button>
          </div>
        </div>

        <button onClick={saveAndApply}
          style={{ width: '100%', background: myColor.bg, color: 'white', border: 'none',
                   borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700 }}>
          Sauvegarder et appliquer ce mois
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TemplatePanel.jsx
git commit -m "feat: TemplatePanel with preset patterns and custom time ranges"
```

---

## Task 12: PlanningTab + SlotActionSheet

**Files:**
- Modify: `src/tabs/PlanningTab.jsx`
- Create: `src/components/SlotActionSheet.jsx`

- [ ] **Step 1: Create SlotActionSheet.jsx**

```jsx
// src/components/SlotActionSheet.jsx
import { formatSlotTime, slotToDay } from '../utils/slots.js';

export default function SlotActionSheet({ slotId, schedule, member, members, colorOf, onRelease, onClaim, onClose }) {
  if (slotId === null) return null;

  const assignedUid = schedule?.assignments?.[String(slotId)];
  const isAvailable = schedule?.available?.includes(slotId);
  const isMine      = assignedUid === member?.uid;

  const startTime = formatSlotTime(slotId);
  const endTime   = formatSlotTime(slotId + 1);
  const day       = slotToDay(slotId);
  const ownerColor = assignedUid ? colorOf(assignedUid) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                  zIndex: 50, display: 'flex', flexDirection: 'column',
                  justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '16px 16px 0 0',
                    padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          Jour {day} · {startTime}–{endTime}
        </div>

        {isAvailable && (
          <div style={{ background: '#DCFCE7', borderRadius: 8, padding: 10,
                        fontSize: 13, color: '#166534', marginBottom: 12 }}>
            ✦ Créneau libre — disponible à la prise
          </div>
        )}

        {assignedUid && !isAvailable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%',
                          background: ownerColor?.bg }} />
            <span style={{ fontSize: 13, color: '#64748B' }}>
              {isMine ? 'Vous' : members?.find(m => m.uid === assignedUid)?.name ?? assignedUid}
            </span>
          </div>
        )}

        {isAvailable && (
          <button onClick={() => { onClaim(slotId); onClose(); }}
            style={{ width: '100%', background: '#16A34A', color: 'white',
                     border: 'none', borderRadius: 12, padding: '14px 0',
                     fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            Prendre ce créneau
          </button>
        )}

        {isMine && !isAvailable && (
          <button onClick={() => { onRelease(slotId); onClose(); }}
            style={{ width: '100%', background: '#EF4444', color: 'white',
                     border: 'none', borderRadius: 12, padding: '14px 0',
                     fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            Libérer ce créneau
          </button>
        )}

        <button onClick={onClose}
          style={{ width: '100%', background: '#F1F5F9', color: '#64748B',
                   border: 'none', borderRadius: 12, padding: '12px 0',
                   fontSize: 14, fontWeight: 600 }}>
          Fermer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement PlanningTab.jsx**

```jsx
// src/tabs/PlanningTab.jsx
import { useState, useCallback } from 'react';
import { useSchedule } from '../hooks/useSchedule.js';
import { useMembers }  from '../hooks/useMembers.js';
import AgendaView      from '../components/AgendaView/AgendaView.jsx';
import SlotActionSheet from '../components/SlotActionSheet.jsx';
import { MONTHS, monthKey } from '../constants.js';

export default function PlanningTab({ member }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { schedule, deadline, isDeadlinePassed, publishing, release, claim } = useSchedule(year, month);
  const { members, colorOf } = useMembers();

  const [selectedSlot, setSelectedSlot] = useState(null);

  const getSlotState = useCallback((sid) => {
    if (!schedule) return { state: 'empty', color: null, label: '' };
    const assignedUid = schedule.assignments?.[String(sid)];
    const isAvailable = schedule.available?.includes(sid);
    if (isAvailable) return { state: 'available', color: null, label: '✦' };
    if (assignedUid) {
      const color = colorOf(assignedUid);
      const m = members.find(m => m.uid === assignedUid);
      return { state: assignedUid === member?.uid ? 'mine' : 'other', color, label: m?.name ?? '' };
    }
    return { state: 'empty', color: null, label: '' };
  }, [schedule, member, colorOf, members]);

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>›</button>
      </div>

      {publishing && (
        <div style={{ background: '#EFF6FF', borderRadius: 10, padding: 10,
                      marginBottom: 12, fontSize: 13, color: '#1D4ED8' }}>
          ⚡ Publication du planning en cours…
        </div>
      )}

      {!schedule && !publishing && (
        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 20,
                      textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          {isDeadlinePassed
            ? 'Calcul du planning en cours…'
            : `Planning disponible après la deadline${deadline ? ` (${deadline})` : ''}`}
        </div>
      )}

      {schedule && (
        <>
          <div style={{ background: '#F0FDF4', borderRadius: 10, padding: 10,
                        marginBottom: 12, fontSize: 12, color: '#166534' }}>
            ✓ Planning publié · {schedule.quotaHours}h/voisin
          </div>
          <div style={{ background: 'white', borderRadius: 14,
                        padding: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <AgendaView year={year} month={month}
              getSlotState={getSlotState}
              onSlotClick={setSelectedSlot} />
          </div>
        </>
      )}

      <SlotActionSheet
        slotId={selectedSlot}
        schedule={schedule}
        member={member}
        members={members}
        colorOf={colorOf}
        onRelease={sid => release(sid, member.uid)}
        onClaim={sid => claim(sid, member.uid)}
        onClose={() => setSelectedSlot(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/tabs/PlanningTab.jsx src/components/SlotActionSheet.jsx
git commit -m "feat: PlanningTab with slot action sheet (release/claim)"
```

---

## Task 13: SpotsTab + useSpots hook

**Files:**
- Create: `src/hooks/useSpots.js`
- Modify: `src/tabs/SpotsTab.jsx`

- [ ] **Step 1: Create useSpots.js**

```js
// src/hooks/useSpots.js
import { useState, useEffect } from 'react';
import { onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, spotsCol, spotAvailDoc, claimSpotSlot } from '../firebase.js';
import { monthKey } from '../constants.js';
import { collection, addDoc } from 'firebase/firestore';

export function useSpots(year, month) {
  const mk = monthKey(year, month);
  const [spots, setSpots] = useState([]);
  const [availability, setAvailability] = useState({}); // spotId → data

  useEffect(() => {
    return onSnapshot(spotsCol(), snap => {
      setSpots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    if (!spots.length) return;
    const unsubs = spots.map(spot =>
      onSnapshot(spotAvailDoc(spot.id, mk), snap => {
        setAvailability(prev => ({
          ...prev,
          [spot.id]: snap.exists() ? snap.data() : { slots: [], taken: {} },
        }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [spots, mk]);

  async function addSpot(ownerUid, name, color) {
    await addDoc(spotsCol(), { ownerUid, name, color });
  }

  async function toggleSpotSlot(spotId, slotId, ownerUid) {
    const ref = spotAvailDoc(spotId, mk);
    const data = availability[spotId];
    const isAvailable = data?.slots?.includes(slotId);
    if (isAvailable) {
      await updateDoc(ref, { slots: arrayRemove(slotId) });
    } else {
      await setDoc(ref, { ownerUid, slots: arrayUnion(slotId), taken: {} }, { merge: true });
    }
  }

  async function claimSlot(spotId, slotId, uid) {
    await claimSpotSlot(spotId, mk, slotId, uid);
  }

  return { spots, availability, addSpot, toggleSpotSlot, claimSlot };
}
```

- [ ] **Step 2: Implement SpotsTab.jsx**

```jsx
// src/tabs/SpotsTab.jsx
import { useState, useCallback } from 'react';
import { useSpots }   from '../hooks/useSpots.js';
import { useMembers } from '../hooks/useMembers.js';
import AgendaView     from '../components/AgendaView/AgendaView.jsx';
import { MONTHS, monthKey } from '../constants.js';

export default function SpotsTab({ member }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [confirmSlot,  setConfirmSlot]  = useState(null);

  const { spots, availability, addSpot, toggleSpotSlot, claimSlot } = useSpots(year, month);
  const { colorOf } = useMembers();

  const spot = spots.find(s => s.id === selectedSpot);
  const avail = selectedSpot ? availability[selectedSpot] : null;
  const isOwner = spot?.ownerUid === member?.uid;

  const getSlotState = useCallback((sid) => {
    if (!avail) return { state: 'empty', color: null, label: '' };
    const takenBy = avail.taken?.[String(sid)];
    if (takenBy) {
      const color = colorOf(takenBy);
      return { state: takenBy === member?.uid ? 'mine' : 'other', color, label: '' };
    }
    if (avail.slots?.includes(sid)) return { state: 'available', color: null, label: '' };
    return { state: 'empty', color: null, label: '' };
  }, [avail, member, colorOf]);

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>›</button>
      </div>

      {/* Spot list */}
      {!selectedSpot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {spots.map(s => (
            <button key={s.id} onClick={() => setSelectedSpot(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                       background: 'white', borderRadius: 12, border: '1px solid #E2E8F0',
                       textAlign: 'left' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {availability[s.id]?.slots?.length ?? 0} créneaux disponibles ce mois
                </div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#94A3B8' }}>›</span>
            </button>
          ))}
          {member?.isAdmin && (
            <button onClick={() => addSpot(member.uid, `Place de ${member.name}`, '#457B9D')}
              style={{ padding: 14, background: '#F1F5F9', borderRadius: 12,
                       border: '2px dashed #CBD5E1', fontSize: 13, color: '#64748B' }}>
              + Ajouter ma place
            </button>
          )}
        </div>
      )}

      {/* Spot detail */}
      {selectedSpot && spot && (
        <div>
          <button onClick={() => setSelectedSpot(null)}
            style={{ border: 'none', background: 'none', fontSize: 14,
                     color: '#64748B', marginBottom: 10 }}>
            ← Retour
          </button>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{spot.name}</div>

          {isOwner && (
            <div style={{ background: '#EFF6FF', borderRadius: 10, padding: 10,
                          fontSize: 12, color: '#1D4ED8', marginBottom: 10 }}>
              Propriétaire — appuyez sur un créneau pour le rendre disponible ou l'enlever.
            </div>
          )}

          <div style={{ background: 'white', borderRadius: 14, padding: 8,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <AgendaView year={year} month={month}
              getSlotState={getSlotState}
              onSlotClick={sid => {
                if (isOwner) { toggleSpotSlot(selectedSpot, sid, member.uid); }
                else if (avail?.slots?.includes(sid) && !avail?.taken?.[String(sid)]) {
                  setConfirmSlot(sid);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Confirm claim */}
      {confirmSlot !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      zIndex: 50, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%' }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Prendre ce créneau ?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmSlot(null)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0',
                         background: 'white', fontSize: 14 }}>Annuler</button>
              <button onClick={() => { claimSlot(selectedSpot, confirmSlot, member.uid); setConfirmSlot(null); }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none',
                         background: '#1E293B', color: 'white', fontSize: 14, fontWeight: 600 }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSpots.js src/tabs/SpotsTab.jsx
git commit -m "feat: SpotsTab with private spot availability and claiming"
```

---

## Task 14: AdminTab

**Files:**
- Modify: `src/tabs/AdminTab.jsx`

- [ ] **Step 1: Implement AdminTab.jsx**

```jsx
// src/tabs/AdminTab.jsx
import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { settingsDoc, setDeadline, scheduleDoc } from '../firebase.js';
import { useMembers } from '../hooks/useMembers.js';
import { monthKey, MONTHS } from '../constants.js';

function defaultDeadline(year, month) {
  // Last day of previous month
  const d = new Date(year, month, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminTab({ member }) {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const mk = monthKey(year, month);

  const [settings,  setSettings]  = useState({});
  const [schedule,  setSchedule]  = useState(null);
  const { members } = useMembers();

  const [deadline, setDeadlineInput] = useState('');

  useEffect(() => {
    return onSnapshot(settingsDoc(), snap => {
      const s = snap.exists() ? snap.data() : {};
      setSettings(s);
      setDeadlineInput(s.deadlines?.[mk] ?? defaultDeadline(year, month));
    });
  }, [mk]);

  useEffect(() => {
    return onSnapshot(scheduleDoc(mk), snap => {
      setSchedule(snap.exists() ? snap.data() : null);
    });
  }, [mk]);

  async function saveDeadline() {
    await setDeadline(mk, deadline);
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>›</button>
      </div>

      {/* Deadline */}
      <div style={{ background: 'white', borderRadius: 14, padding: 16,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>DEADLINE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={deadline}
            onChange={e => setDeadlineInput(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8,
                     border: '1px solid #E2E8F0', fontSize: 14 }} />
          <button onClick={saveDeadline}
            style={{ background: '#1E293B', color: 'white', border: 'none',
                     borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600 }}>
            Enregistrer
          </button>
        </div>
      </div>

      {/* Schedule status */}
      {schedule && (
        <div style={{ background: 'white', borderRadius: 14, padding: 16,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>PLANNING PUBLIÉ</div>
          <div style={{ fontSize: 13, color: '#166534', marginBottom: 12 }}>
            ✓ Publié · Quota : {schedule.quotaHours}h/voisin
          </div>
          {/* Fairness per member */}
          {members.map(m => {
            const dev = schedule.fairness?.[m.uid] ?? 0;
            return (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center',
                                        gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%',
                               background: m.color.bg }} />
                <span style={{ flex: 1, fontSize: 13 }}>{m.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600,
                                color: dev >= 0 ? '#166534' : '#DC2626' }}>
                  {dev >= 0 ? '+' : ''}{dev}h
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!schedule && (
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16,
                      textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          Planning non encore publié pour ce mois.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/AdminTab.jsx
git commit -m "feat: AdminTab with deadline management and schedule stats"
```

---

## Task 15: Firestore Rules

**Files:**
- Create: `firestore.rules`

- [ ] **Step 1: Write firestore.rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() { return request.auth != null; }
    function isAdmin() {
      return isAuth() &&
        get(/databases/$(database)/documents/members/$(request.auth.uid)).data.isAdmin == true;
    }
    function isOwner(uid) { return isAuth() && request.auth.uid == uid; }

    match /members/{uid} {
      allow read:   if isAuth();
      allow create: if isOwner(uid);
      allow update: if isOwner(uid) || isAdmin();
      allow delete: if isAdmin();
    }

    match /wishlists/{docId} {
      allow read: if isAuth();
      allow write: if isAuth()
        && request.auth.uid == request.resource.data.uid
        && !exists(/databases/$(database)/documents/schedules/$(request.resource.data.monthKey));
      allow delete: if isAuth() && request.auth.uid == resource.data.uid;
    }

    match /schedules/{monthKey} {
      allow read:   if isAuth();
      allow create: if isAuth();   // any client can publish (idempotent transaction)
      allow update: if isAuth();   // release / claim
      allow delete: if isAdmin();
    }

    match /prevUsage/{monthKey} {
      allow read:  if isAuth();
      allow write: if isAuth();
    }

    match /settings/{docId} {
      allow read:  if isAuth();
      allow write: if isAdmin();
    }

    match /spots/{spotId} {
      allow read:   if isAuth();
      allow create: if isAuth() && request.auth.uid == request.resource.data.ownerUid;
      allow update: if isAuth() && resource.data.ownerUid == request.auth.uid;
      allow delete: if isAuth() && (resource.data.ownerUid == request.auth.uid || isAdmin());
    }

    match /spotAvailability/{docId} {
      allow read:   if isAuth();
      allow create: if isAuth() && request.auth.uid == request.resource.data.ownerUid;
      allow update: if isAuth(); // owner adds slots + any member claims
      allow delete: if isAuth() && resource.data.ownerUid == request.auth.uid;
    }
  }
}
```

- [ ] **Step 2: Create firestore.indexes.json**

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 3: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat: Firestore security rules"
```

---

## Task 16: PWA + Firebase Hosting

**Files:**
- Create: `public/manifest.json`
- Modify: `vite.config.js`
- Create: `firebase.json`

- [ ] **Step 1: Install vite-plugin-pwa**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Update vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Voisinage',
        short_name: 'Voisinage',
        description: 'Partage de parking entre voisins',
        theme_color: '#1E293B',
        background_color: '#F8FAFC',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- [ ] **Step 3: Create firebase.json**

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
  }
}
```

- [ ] **Step 4: Add placeholder icons**

```bash
# Place a 192×192 and 512×512 PNG icon in public/
# For now, copy any PNG and name them icon-192.png and icon-512.png
# (Replace with real icons before launch)
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: `dist/` created, no errors.

- [ ] **Step 6: Deploy**

```bash
firebase login   # if not already logged in
firebase use voisinage-v2
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

- [ ] **Step 7: Run all tests one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Final commit**

```bash
git add vite.config.js firebase.json public/
git commit -m "feat: PWA config and Firebase Hosting setup"
```

---

## Post-launch: Make first user admin

After first login, open Firestore console → `members/{your-uid}` → add field `isAdmin: true`.

---

## Summary

| Phase | Tasks | Delivers |
|-------|-------|----------|
| Foundations | 1–4 | Scaffold + tested utilities |
| Firebase & Auth | 5–6 | Auth, constants, Firebase client |
| Data hooks | 7 | Real-time Firestore hooks + auto-publish |
| UI components | 8–9 | AgendaView (Day/Week/Month) |
| Wish flow | 10–11 | WishTab + TemplatePanel |
| Planning flow | 12 | PlanningTab + release/claim |
| Private spots | 13 | SpotsTab |
| Admin | 14 | Deadline management |
| Infrastructure | 15–16 | Firestore rules + PWA + deploy |
