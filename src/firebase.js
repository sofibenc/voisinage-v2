import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
} from 'firebase/auth';
import {
  getFirestore, doc, collection,
  setDoc, deleteDoc,
  runTransaction, arrayUnion, arrayRemove,
  serverTimestamp,
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
