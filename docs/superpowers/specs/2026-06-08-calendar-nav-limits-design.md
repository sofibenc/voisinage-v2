# Calendar Navigation Limits — Configurable from Admin Panel

**Date:** 2026-06-08

## Problem

`VisitorTab` and `AdminTab` hardcode the calendar navigation window (`+6` months future, `-3` months past). Changing this requires a code deploy.

## Goal

Allow admins to configure the future and past navigation limits from the admin panel, persisted in Firestore.

## Data

Two new fields added to the existing `settings/global` Firestore document:

| Field | Type | Default | Description |
|---|---|---|---|
| `maxFutureMonths` | number | 6 | How many months ahead members can navigate |
| `maxPastMonths` | number | 3 | How many months back members can navigate |

## Changes

### `firebase.js`

Add two write functions following the existing pattern:

```js
export async function setMaxFutureMonths(n) {
  await setDoc(settingsDoc(), { maxFutureMonths: n }, { merge: true });
}
export async function setMaxPastMonths(n) {
  await setDoc(settingsDoc(), { maxPastMonths: n }, { merge: true });
}
```

### `App.jsx`

In the existing `onSnapshot` for `settingsDoc()`, read the two new fields and store them in state. Pass them as props to `VisitorTab`:

```jsx
const [maxFutureMonths, setMaxFutureMonths] = useState(6);
const [maxPastMonths,   setMaxPastMonths]   = useState(3);
// in onSnapshot:
setMaxFutureMonths(data.maxFutureMonths ?? 6);
setMaxPastMonths(data.maxPastMonths ?? 3);
// in render:
<VisitorTab ... maxFutureMonths={maxFutureMonths} maxPastMonths={maxPastMonths} />
```

### `VisitorTab.jsx`

Accept two new props (with defaults) and replace hardcoded constants:

```jsx
export default function VisitorTab({ member, operationalMode = false, maxFutureMonths = 6, maxPastMonths = 3 }) {
  const maxDate = new Date(now.getFullYear(), now.getMonth() + maxFutureMonths, 1);
  const minDate = new Date(now.getFullYear(), now.getMonth() - maxPastMonths, 1);
```

### `AdminTab.jsx`

- Read `maxFutureMonths` and `maxPastMonths` from the existing `onSnapshot` (same as other settings).
- Use them for the admin's own calendar `maxDate` / `minDate`.
- Add two `<input type="number" min="1" max="24">` fields in the settings section (côte à côte), with a single "Enregistrer" button that calls both setters if changed. Style follows the existing `subtitle` input pattern.

## Defaults

All defaults are applied at read time (`?? 6`, `?? 3`), so existing deployments with no Firestore value behave identically to today.

## Out of scope

- No validation on the server side (Firestore rules already restrict writes to admins).
- No impact on `SpotsTab`.
