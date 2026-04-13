import { useState, useEffect, useRef } from 'react';
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

  const [now, setNow] = useState(() => new Date());

  // Refresh every 30 minutes so past/future boundary stays accurate
  useEffect(() => {
    const ms = 30 * 60 * 1000;
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, []);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayDay   = isCurrentMonth ? now.getDate() : 1;
  const nowSlot    = isCurrentMonth
    ? (now.getDate() - 1) * SLOTS_PER_DAY + now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0)
    : 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const endDay  = Math.min(todayDay + 6, daysInMonth);
  const next7To = endDay * SLOTS_PER_DAY - 1;

  const next7ByUid      = {}; // slots in next 7 days
  const futureByUid     = {}; // slots strictly after now (to subtract from all-time total)
  const monthTotalByUid = {}; // all slots in current month

  for (const [sid, uid] of Object.entries(assignments)) {
    const s = Number(sid);
    monthTotalByUid[uid] = (monthTotalByUid[uid] ?? 0) + 1;
    // next-7-days: from now slot to end of 7th day
    if (s >= nowSlot && s <= next7To) {
      next7ByUid[uid] = (next7ByUid[uid] ?? 0) + 1;
    }
    // future slots in current month (to subtract from all-time total)
    if (isCurrentMonth && s >= nowSlot) {
      futureByUid[uid] = (futureByUid[uid] ?? 0) + 1;
    }
  }

  // Build stats array
  const stats = members.map(m => ({
    uid:            m.uid,
    name:           m.name,
    color:          m.color,
    pastHours:      Math.max(0, (totalByUid[m.uid] ?? 0) - (futureByUid[m.uid] ?? 0)) / 2,
    monthPastHours: Math.max(0, (monthTotalByUid[m.uid] ?? 0) - (futureByUid[m.uid] ?? 0)) / 2,
    next7Hours:     (next7ByUid[m.uid] ?? 0) / 2,
  }));

  return { stats };
}
