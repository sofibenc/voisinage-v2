import { useState, useEffect } from 'react';
import { onSnapshot, setDoc, updateDoc, addDoc } from 'firebase/firestore';
import { spotsCol, spotAvailDoc, claimSpotSlot, claimSpotSlotRange, releaseSpotSlotRange } from '../firebase.js';
import { monthKey } from '../constants.js';

export function useSpots(uid, year, month) {
  const mk = monthKey(year, month);
  const [spots, setSpots] = useState([]);
  const [availability, setAvailability] = useState({}); // spotId → { slots, taken }

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

  const mySpot    = spots.find(s => s.ownerUid === uid) ?? null;
  const otherSpots = spots.filter(s => s.ownerUid !== uid);

  // Ensure my spot exists (called on first "Proposer ma place")
  async function ensureMySpot(name) {
    if (mySpot) return mySpot.id;
    const ref = await addDoc(spotsCol(), { ownerUid: uid, name });
    return ref.id;
  }

  // Add slots to my availability
  async function mergeMySlots(spotId, toAdd) {
    const ref  = spotAvailDoc(spotId, mk);
    const data = availability[spotId] ?? { slots: [], taken: {} };
    const next = [...new Set([...data.slots, ...toAdd])].sort((a, b) => a - b);
    await setDoc(ref, { ownerUid: uid, slots: next, taken: data.taken ?? {} }, { merge: true });
  }

  // Remove slots from my availability (only non-taken ones)
  async function clearMyRange(spotId, fromSlot, toSlot) {
    const ref  = spotAvailDoc(spotId, mk);
    const data = availability[spotId] ?? { slots: [], taken: {} };
    const next = data.slots.filter(s => s < fromSlot || s > toSlot);
    await setDoc(ref, { ownerUid: uid, slots: next, taken: data.taken ?? {} }, { merge: true });
  }

  // Claim a single slot from another neighbor's spot
  async function claimSlot(spotId, slotId) {
    await claimSpotSlot(spotId, mk, slotId, uid);
  }

  // Claim a range of slots from another neighbor's spot
  async function claimNeighborRange(spotId, fromSlot, toSlot) {
    await claimSpotSlotRange(spotId, mk, fromSlot, toSlot, uid);
  }

  // Release a range of slots previously claimed from a neighbor's spot
  async function releaseNeighborRange(spotId, fromSlot, toSlot) {
    await releaseSpotSlotRange(spotId, mk, fromSlot, toSlot, uid);
  }

  return { spots, mySpot, otherSpots, availability, ensureMySpot, mergeMySlots, clearMyRange, claimSlot, claimNeighborRange, releaseNeighborRange };
}
