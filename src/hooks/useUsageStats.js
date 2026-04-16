import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { reservationDoc } from '../firebase.js';
import { monthKey } from '../constants.js';

const SLOTS_PER_DAY = 48;

export function useUsageStats(members, year, month) {
  const mk     = monthKey(year, month);
  const prevM  = month === 0 ? 11 : month - 1;
  const prevY  = month === 0 ? year - 1 : year;
  const mkPrev = monthKey(prevY, prevM);

  const [assignments,     setAssignments]     = useState({}); // current month
  const [assignmentsPrev, setAssignmentsPrev] = useState({}); // previous month

  useEffect(() => {
    return onSnapshot(reservationDoc(mk), snap => {
      setAssignments(snap.exists() ? (snap.data().assignments ?? {}) : {});
    });
  }, [mk]);

  useEffect(() => {
    return onSnapshot(reservationDoc(mkPrev), snap => {
      setAssignmentsPrev(snap.exists() ? (snap.data().assignments ?? {}) : {});
    });
  }, [mkPrev]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayDay = isCurrentMonth ? now.getDate() : 1;
  const nowSlot  = isCurrentMonth
    ? (now.getDate() - 1) * SLOTS_PER_DAY + now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0)
    : 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const endDay  = Math.min(todayDay + 6, daysInMonth);
  const next7To = endDay * SLOTS_PER_DAY - 1;

  const monthPastByUid = {};
  const next7ByUid     = {};

  for (const [sid, uid] of Object.entries(assignments)) {
    const s = Number(sid);
    if (s < nowSlot) {
      monthPastByUid[uid] = (monthPastByUid[uid] ?? 0) + 1;
    }
    if (s >= nowSlot && s <= next7To) {
      next7ByUid[uid] = (next7ByUid[uid] ?? 0) + 1;
    }
  }

  // Previous month: all slots are past
  const lastMonthByUid = {};
  for (const uid of Object.values(assignmentsPrev)) {
    lastMonthByUid[uid] = (lastMonthByUid[uid] ?? 0) + 1;
  }

  const stats = members.map(m => ({
    uid:           m.uid,
    name:          m.name,
    color:         m.color,
    isActive:      m.isActive,
    monthPastHours:  (monthPastByUid[m.uid] ?? 0) / 2,
    lastMonthHours:  (lastMonthByUid[m.uid] ?? 0) / 2,
    next7Hours:      (next7ByUid[m.uid] ?? 0) / 2,
  }));

  return { stats };
}
