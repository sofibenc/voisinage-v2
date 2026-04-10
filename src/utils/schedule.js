import { totalSlotsInMonth } from './slots.js';

export function computeSchedule(members, wishlists, year, month, prevUsage = {}) {
  const totalSlots = totalSlotsInMonth(year, month);
  const quotaSlots = Math.floor(totalSlots / members.length);
  const quotaHours = quotaSlots / 2;

  const assignments = {};
  const assigned = Object.fromEntries(members.map(m => [m.uid, 0]));
  const wishSets = Object.fromEntries(
    members.map(m => [m.uid, new Set(wishlists[m.uid] || [])])
  );

  for (let slot = 0; slot < totalSlots; slot++) {
    const candidates = members.filter(m => wishSets[m.uid].has(slot));
    if (!candidates.length) continue;

    // Anti-monopole: exclude member if they hold all 96 slots immediately before this one
    let eligible = candidates.filter(m => {
      if (slot < 96) return true;
      for (let i = slot - 96; i < slot; i++) {
        if (assignments[i] !== m.uid) return true;
      }
      return false;
    });
    if (!eligible.length) eligible = candidates;

    eligible.sort((a, b) =>
      (assigned[a.uid] - assigned[b.uid]) ||
      ((prevUsage[a.uid] || 0) - (prevUsage[b.uid] || 0))
    );

    assignments[slot] = eligible[0].uid;
    assigned[eligible[0].uid]++;
  }

  const fairness = Object.fromEntries(
    members.map(m => [m.uid, +(assigned[m.uid] / 2 - quotaHours).toFixed(1)])
  );

  return { assignments, quotaHours: +quotaHours.toFixed(1), fairness };
}
