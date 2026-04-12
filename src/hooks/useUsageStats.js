import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { usageStatDoc, reservationDoc } from '../firebase.js';
import { monthKey } from '../constants.js';

const SLOTS_PER_DAY = 48;

// Returns for each uid: { totalSlots (all time), next7Slots (from today in current month) }
export function useUsageStats(members, year, month) {
  const mk = monthKey(year, month);
  const [totalByUid, setTotalByUid]   = useState({}); // uid → totalSlots (all time)
  const [assignments, setAssignments] = useState({}); // current month assignments

  // Subscribe to each member's usageStat doc
  useEffect(() => {
    if (!members.length) return;
    const unsubs = members.map(m =>
      onSnapshot(usageStatDoc(m.uid), snap => {
        const total = snap.exists() ? (snap.data().totalSlots ?? 0) : 0;
        setTotalByUid(prev => ({ ...prev, [m.uid]: total }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [members]);

  // Subscribe to current month reservations for the next-7-days column
  useEffect(() => {
    return onSnapshot(reservationDoc(mk), snap => {
      setAssignments(snap.exists() ? (snap.data().assignments ?? {}) : {});
    });
  }, [mk]);

  // Compute next-7-days slots per uid
  const now = new Date();
  const todayDay = (year === now.getFullYear() && month === now.getMonth()) ? now.getDate() : 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const endDay = Math.min(todayDay + 6, daysInMonth);
  const fromSlot = (todayDay - 1) * SLOTS_PER_DAY;
  const toSlot   = endDay * SLOTS_PER_DAY - 1;

  const next7ByUid = {};
  for (const [sid, uid] of Object.entries(assignments)) {
    const s = Number(sid);
    if (s >= fromSlot && s <= toSlot) {
      next7ByUid[uid] = (next7ByUid[uid] ?? 0) + 1;
    }
  }

  // Build stats array
  const stats = members.map(m => ({
    uid:        m.uid,
    name:       m.name,
    color:      m.color,
    totalHours: (totalByUid[m.uid] ?? 0) / 2,
    next7Hours: (next7ByUid[m.uid] ?? 0) / 2,
  }));

  return { stats };
}
