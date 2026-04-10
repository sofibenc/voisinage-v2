import { useState, useEffect } from 'react';
import { onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc } from 'firebase/firestore';
import { spotsCol, spotAvailDoc, claimSpotSlot } from '../firebase.js';
import { monthKey } from '../constants.js';

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
