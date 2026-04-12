import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { reservationDoc, claimReservationRange, releaseReservationRange } from '../firebase.js';
import { monthKey } from '../constants.js';

export function useReservations(uid, year, month) {
  const mk = monthKey(year, month);
  const [assignments, setAssignments] = useState({}); // slotId (string) → uid

  useEffect(() => {
    return onSnapshot(reservationDoc(mk), snap => {
      setAssignments(snap.exists() ? (snap.data().assignments ?? {}) : {});
    });
  }, [mk]);

  async function claimRange(fromSlot, toSlot) {
    await claimReservationRange(mk, fromSlot, toSlot, uid);
  }

  async function releaseRange(fromSlot, toSlot) {
    await releaseReservationRange(mk, fromSlot, toSlot, uid);
  }

  return { assignments, claimRange, releaseRange };
}
