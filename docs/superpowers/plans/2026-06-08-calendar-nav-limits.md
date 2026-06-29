# Calendar Navigation Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the calendar navigation window (future/past months) configurable from the admin panel, stored in Firestore `settings/global`.

**Architecture:** Two new Firestore fields (`maxFutureMonths`, `maxPastMonths`) are read via the existing `onSnapshot` subscription in both `App.jsx` and `AdminTab.jsx`. `App.jsx` passes the values as props to `VisitorTab`. `AdminTab` uses them for its own calendar and exposes a settings card to change them.

**Tech Stack:** React 19, Firebase Firestore, Vite, Vitest

---

## Files touched

- Modify: `src/firebase.js` — add `setMaxFutureMonths` and `setMaxPastMonths`
- Modify: `src/App.jsx` — read new fields from settings, pass props to `VisitorTab`
- Modify: `src/tabs/VisitorTab.jsx` — accept `maxFutureMonths` / `maxPastMonths` props
- Modify: `src/tabs/AdminTab.jsx` — read settings, apply to calendar, add UI card

---

## Task 1: Add write functions to `firebase.js`

**Files:**
- Modify: `src/firebase.js`

- [ ] **Step 1: Add the two setter functions after `setMinBuildTime`**

  In `src/firebase.js`, after line 152 (`await setDoc(settingsDoc(), { minBuildTime: time }, { merge: true });`), add:

  ```js
  export async function setMaxFutureMonths(n) {
    await setDoc(settingsDoc(), { maxFutureMonths: n }, { merge: true });
  }

  export async function setMaxPastMonths(n) {
    await setDoc(settingsDoc(), { maxPastMonths: n }, { merge: true });
  }
  ```

- [ ] **Step 2: Run existing tests to confirm no regression**

  ```bash
  npm test
  ```
  Expected: all tests pass (slots tests unaffected).

- [ ] **Step 3: Commit**

  ```bash
  git add src/firebase.js
  git commit -m "feat: setMaxFutureMonths + setMaxPastMonths dans firebase.js"
  ```

---

## Task 2: Read settings and pass props in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add state for the two new settings**

  In `src/App.jsx`, after the `minBuildTime` state (line 32):

  ```jsx
  const [maxFutureMonths,  setMaxFutureMonthsState] = useState(6);
  const [maxPastMonths,    setMaxPastMonthsState]   = useState(3);
  ```

- [ ] **Step 2: Read from the existing `onSnapshot`**

  In the `onSnapshot` callback (currently lines 44–48), add two lines:

  ```jsx
  return onSnapshot(settingsDoc(), snap => {
    const data = snap.exists() ? snap.data() : {};
    setSubtitle(data.subtitle ?? '');
    setOperationalModeState(data.operationalMode ?? false);
    setMinBuildTimeState(data.minBuildTime ?? 0);
    setMaxFutureMonthsState(data.maxFutureMonths ?? 6);
    setMaxPastMonthsState(data.maxPastMonths ?? 3);
  });
  ```

- [ ] **Step 3: Pass props to `VisitorTab`**

  On line 204, replace:

  ```jsx
  {section === 'visitor'  && <VisitorTab member={member} operationalMode={operationalMode} />}
  ```

  With:

  ```jsx
  {section === 'visitor'  && <VisitorTab member={member} operationalMode={operationalMode} maxFutureMonths={maxFutureMonths} maxPastMonths={maxPastMonths} />}
  ```

- [ ] **Step 4: Run existing tests**

  ```bash
  npm test
  ```
  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/App.jsx
  git commit -m "feat: passer maxFutureMonths/maxPastMonths comme props à VisitorTab"
  ```

---

## Task 3: Use props in `VisitorTab.jsx`

**Files:**
- Modify: `src/tabs/VisitorTab.jsx`

- [ ] **Step 1: Accept the two new props with defaults**

  On line 12, replace:

  ```jsx
  export default function VisitorTab({ member, operationalMode = false }) {
  ```

  With:

  ```jsx
  export default function VisitorTab({ member, operationalMode = false, maxFutureMonths = 6, maxPastMonths = 3 }) {
  ```

- [ ] **Step 2: Replace the hardcoded `maxDate` and `minDate`**

  On lines 50–52, replace:

  ```jsx
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  const canGoNext = new Date(year, month + 1) < maxDate;
  const minDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  ```

  With:

  ```jsx
  const maxDate = new Date(now.getFullYear(), now.getMonth() + maxFutureMonths, 1);
  const canGoNext = new Date(year, month + 1) < maxDate;
  const minDate = new Date(now.getFullYear(), now.getMonth() - maxPastMonths, 1);
  ```

- [ ] **Step 3: Run existing tests**

  ```bash
  npm test
  ```
  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/tabs/VisitorTab.jsx
  git commit -m "feat: VisitorTab — maxFutureMonths/maxPastMonths depuis props"
  ```

---

## Task 4: Update `AdminTab.jsx` — settings state, calendar limits, UI card

**Files:**
- Modify: `src/tabs/AdminTab.jsx`

- [ ] **Step 1: Import the two new setter functions**

  On line 3, extend the import from `../firebase.js`:

  ```js
  import { settingsDoc, setSubtitle, setOperationalMode, setMinBuildTime,
           setMaxFutureMonths, setMaxPastMonths,
           claimReservationRange, releaseReservationRange, reservationDoc,
           deleteMember, setMemberAdmin, setMemberActive, upsertMember } from '../firebase.js';
  ```

- [ ] **Step 2: Add state for the two new settings**

  After line 28 (`const [minBuildTime, setMinBuildTimeState] = useState(0);`), add:

  ```jsx
  const [maxFutureMonthsInput, setMaxFutureMonthsInput] = useState(6);
  const [maxPastMonthsInput,   setMaxPastMonthsInput]   = useState(3);
  ```

- [ ] **Step 3: Read the new fields in the existing `onSnapshot`**

  In the `onSnapshot` callback (currently lines 53–58), add two lines:

  ```jsx
  return onSnapshot(settingsDoc(), snap => {
    const data = snap.exists() ? snap.data() : {};
    setSubtitleInput(data.subtitle ?? '');
    setOperationalModeState(data.operationalMode ?? false);
    setMinBuildTimeState(data.minBuildTime ?? 0);
    setMaxFutureMonthsInput(data.maxFutureMonths ?? 6);
    setMaxPastMonthsInput(data.maxPastMonths ?? 3);
  });
  ```

- [ ] **Step 4: Apply to admin calendar `maxDate` / `minDate`**

  On lines 61–64, replace:

  ```jsx
  const minDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  ```

  With:

  ```jsx
  const minDate = new Date(now.getFullYear(), now.getMonth() - maxPastMonthsInput, 1);
  const maxDate = new Date(now.getFullYear(), now.getMonth() + maxFutureMonthsInput, 1);
  ```

- [ ] **Step 5: Add the settings UI card after the "Mode opérationnel" card (after line 237)**

  Insert the following JSX block after the closing `</div>` of the "MODE OPÉRATIONNEL" card (after the `</div>` on line 237), before the visitor calendar comment:

  ```jsx
  {/* Navigation calendrier */}
  <div style={{ background: 'white', borderRadius: 14, padding: 16,
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>NAVIGATION CALENDRIER</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Mois futurs</div>
        <input
          type="number" min="1" max="24"
          value={maxFutureMonthsInput}
          onChange={e => setMaxFutureMonthsInput(Number(e.target.value))}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8,
                   border: '1px solid #E2E8F0', fontSize: 14 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Mois passés</div>
        <input
          type="number" min="0" max="24"
          value={maxPastMonthsInput}
          onChange={e => setMaxPastMonthsInput(Number(e.target.value))}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8,
                   border: '1px solid #E2E8F0', fontSize: 14 }} />
      </div>
      <button
        onClick={async () => {
          await setMaxFutureMonths(maxFutureMonthsInput);
          await setMaxPastMonths(maxPastMonthsInput);
        }}
        style={{ background: '#1E293B', color: 'white', border: 'none',
                 borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600 }}>
        OK
      </button>
    </div>
  </div>
  ```

- [ ] **Step 6: Run existing tests**

  ```bash
  npm test
  ```
  Expected: all tests pass.

- [ ] **Step 7: Commit**

  ```bash
  git add src/tabs/AdminTab.jsx
  git commit -m "feat: AdminTab — navigation calendrier configurable (futur/passé)"
  ```

---

## Task 5: Build and deploy

- [ ] **Step 1: Build**

  ```bash
  npm run build
  ```
  Expected: `✓ built in ~Xs` with no errors (chunk size warning is normal).

- [ ] **Step 2: Deploy**

  ```bash
  firebase deploy --only hosting
  ```
  Expected: `✔  Deploy complete!`

- [ ] **Step 3: Final commit (if anything changed)**

  No extra commit needed if tasks 1–4 are already committed.
