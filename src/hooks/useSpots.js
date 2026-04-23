import { useState, useEffect } from 'react';
import { onSnapshot, setDoc, updateDoc, addDoc } from 'firebase/firestore';
import { spotsCol, spotAvailDoc, claimSpotSlot, claimSpotSlotRange, releaseSpotSlotRange } from '../firebase.js';
import { monthKey } from '../constants.js';

export function useSpots(uid, year, month) {
  const mk = monthKey(year, month);
  const [spots, setSpots] = useState([]);
  const [availability, setAvailability] = useState({}); // spotId → { slots, taken }
  const [loading, setLoading] = useState(true);
  const [availLoading, setAvailLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(spotsCol(), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSpots(list);
      if (list.length === 0) setAvailLoading(false);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!spots.length) return;
    setAvailLoading(true);
    let received = 0;
    const unsubs = spots.map(spot =>
      onSnapshot(spotAvailDoc(spot.id, mk), snap => {
        setAvailability(prev => ({
          ...prev,
          [spot.id]: snap.exists() ? snap.data() : { slots: [], taken: {} },
        }));
        received++;
        if (received >= spots.length) setAvailLoading(false);
      })
    );
    return () => unsubs.forEach(u => u());
  }, [spots, mk]);

  const mySpots    = spots.filter(s => s.ownerUid === uid);
  const mySpot     = mySpots[0] ?? null;
  const ghostSpots = mySpots.slice(1); // spots supplémentaires avec le même ownerUid
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

  return { spots, mySpot, ghostSpots, otherSpots, availability, loading: loading || availLoading, ensureMySpot, mergeMySlots, clearMyRange, claimSlot, claimNeighborRange, releaseNeighborRange };
}
