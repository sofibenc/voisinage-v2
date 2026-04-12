import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
} from 'firebase/auth';
import {
  getFirestore, doc, collection,
  setDoc, deleteDoc,
  runTransaction, arrayUnion, arrayRemove,
  serverTimestamp, deleteField,
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

export async function unpublishSchedule(mk) {
  await deleteDoc(scheduleDoc(mk));
}

export async function publishSchedule(mk, assignments, quotaHours, fairness, prevUsageByUid) {
  // Convert numeric keys to strings for Firestore
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
    tx.set(doc(db, 'prevUsage', mk), prevUsageByUid);
  });
}

export async function releaseSlotRange(mk, fromSlot, toSlot, uid) {
  await runTransaction(db, async tx => {
    const ref = scheduleDoc(mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No schedule');
    const data = snap.data();
    const newAssignments = { ...data.assignments };
    const toRelease = [];
    for (let s = fromSlot; s <= toSlot; s++) {
      if (data.assignments[String(s)] === uid) {
        delete newAssignments[String(s)];
        toRelease.push(s);
      }
    }
    if (toRelease.length === 0) return;
    const newAvailable = [...new Set([...data.available, ...toRelease])];
    tx.update(ref, { assignments: newAssignments, available: newAvailable });
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

export async function claimSlotRange(mk, fromSlot, toSlot, uid) {
  await runTransaction(db, async tx => {
    const ref = scheduleDoc(mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No schedule');
    const data = snap.data();

    // Check for overlap: any slot in range assigned to someone else
    const conflicts = [];
    for (let s = fromSlot; s <= toSlot; s++) {
      const owner = data.assignments[String(s)];
      if (owner && owner !== uid) conflicts.push(s);
    }
    if (conflicts.length > 0) throw new Error('OVERLAP');

    // Claim all slots in range
    const updates = {};
    for (let s = fromSlot; s <= toSlot; s++) {
      const isReleased = data.available.includes(s);
      const isEmpty    = !data.assignments[String(s)];
      if (isReleased || isEmpty) updates[`assignments.${s}`] = uid;
    }
    let newAvailable = data.available.filter(s => s < fromSlot || s > toSlot);
    tx.update(ref, { ...updates, available: newAvailable });
  });
}

export async function claimSlot(mk, slotId, uid) {
  await runTransaction(db, async tx => {
    const ref = scheduleDoc(mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No schedule');
    const data = snap.data();
    const isReleased = data.available.includes(slotId);
    const isEmpty    = !data.assignments[String(slotId)];
    if (!isReleased && !isEmpty) throw new Error('Slot not available');
    tx.update(ref, {
      [`assignments.${slotId}`]: uid,
      ...(isReleased ? { available: arrayRemove(slotId) } : {}),
    });
  });
}

// ── Reservations (visitor spot — premier arrivé premier servi) ────────────────
export const reservationDoc = mk  => doc(db, 'reservations', mk);
export const usageStatDoc   = uid => doc(db, 'usageStats',   uid);

const SLOTS_PER_DAY_R = 48;

export async function claimReservationRange(mk, fromSlot, toSlot, uid) {
  await runTransaction(db, async tx => {
    const ref     = reservationDoc(mk);
    const statRef = usageStatDoc(uid);
    const [snap, statSnap] = await Promise.all([tx.get(ref), tx.get(statRef)]);
    const assignments = snap.exists() ? { ...(snap.data().assignments ?? {}) } : {};

    // Conflict check: slot already taken by someone else
    for (let s = fromSlot; s <= toSlot; s++) {
      const owner = assignments[String(s)];
      if (owner && owner !== uid) throw new Error('OVERLAP');
    }

    // Consecutive-days check: merge existing days + new days, look for 3+ in a row
    const userDays = new Set();
    for (const [sid, owner] of Object.entries(assignments)) {
      if (owner === uid) userDays.add(Math.floor(Number(sid) / SLOTS_PER_DAY_R) + 1);
    }
    for (let s = fromSlot; s <= toSlot; s++) {
      userDays.add(Math.floor(s / SLOTS_PER_DAY_R) + 1);
    }
    const sorted = [...userDays].sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) { run++; if (run > 2) throw new Error('MAX_CONSECUTIVE_DAYS'); }
      else run = 1;
    }

    // Apply
    let newCount = 0;
    for (let s = fromSlot; s <= toSlot; s++) {
      if (!assignments[String(s)]) newCount++;
      assignments[String(s)] = uid;
    }
    tx.set(ref, { assignments }, { merge: true });
    const prev = statSnap.exists() ? (statSnap.data().totalSlots ?? 0) : 0;
    tx.set(statRef, { totalSlots: prev + newCount }, { merge: true });
  });
}

export async function releaseReservationRange(mk, fromSlot, toSlot, uid) {
  await runTransaction(db, async tx => {
    const ref     = reservationDoc(mk);
    const statRef = usageStatDoc(uid);
    const [snap, statSnap] = await Promise.all([tx.get(ref), tx.get(statRef)]);
    if (!snap.exists()) return;
    const data = snap.data().assignments ?? {};
    const updates = {};
    let removed = 0;
    for (let s = fromSlot; s <= toSlot; s++) {
      if (data[String(s)] === uid) {
        updates[`assignments.${s}`] = deleteField();
        removed++;
      }
    }
    if (removed === 0) return;
    tx.update(ref, updates);
    const prev = statSnap.exists() ? (statSnap.data().totalSlots ?? 0) : 0;
    tx.set(statRef, { totalSlots: Math.max(0, prev - removed) }, { merge: true });
  });
}

// ── PrevUsage ─────────────────────────────────────────────────────────────────
export const prevUsageDoc = mk => doc(db, 'prevUsage', mk);

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsDoc = () => doc(db, 'settings', 'global');

export async function setDeadline(mk, dateStr) {
  await setDoc(settingsDoc(), { deadlines: { [mk]: dateStr } }, { merge: true });
}

export async function setSubtitle(text) {
  await setDoc(settingsDoc(), { subtitle: text }, { merge: true });
}

export async function setOperationalMode(enabled) {
  await setDoc(settingsDoc(), { operationalMode: enabled }, { merge: true });
}

// ── Spots (private) ───────────────────────────────────────────────────────────
export const spotsCol     = () => collection(db, 'spots');
export const spotDoc      = id  => doc(db, 'spots', id);
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

export async function releaseSpotSlotRange(spotId, mk, fromSlot, toSlot, uid) {
  await runTransaction(db, async tx => {
    const ref = spotAvailDoc(spotId, mk);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const updates = {};
    for (let s = fromSlot; s <= toSlot; s++) {
      if (data.taken?.[String(s)] === uid) updates[`taken.${s}`] = null;
    }
    if (Object.keys(updates).length > 0) tx.update(ref, updates);
  });
}
