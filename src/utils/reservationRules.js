import { SLOTS_PER_DAY } from './slots.js';

export const MAX_CONSECUTIVE_HOURS = 48;
export const MAX_CONSECUTIVE_SLOTS = MAX_CONSECUTIVE_HOURS * 2; // 30-min slots

// Rule: on a streak of consecutive calendar days (no gap day in between) where
// the user holds at least one slot, their cumulative reserved hours on that
// streak must not exceed 48h — the number of days in the streak is unbounded.
export function exceedsConsecutiveHoursLimit(assignments, uid, fromSlot, toSlot) {
  const dayCounts = new Map(); // day -> slot count owned by uid (existing + new)
  for (const [sid, owner] of Object.entries(assignments)) {
    if (owner === uid) {
      const d = Math.floor(Number(sid) / SLOTS_PER_DAY) + 1;
      dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
    }
  }
  for (let s = fromSlot; s <= toSlot; s++) {
    if (assignments[String(s)] !== uid) {
      const d = Math.floor(s / SLOTS_PER_DAY) + 1;
      dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
    }
  }

  const fromDay = Math.floor(fromSlot / SLOTS_PER_DAY) + 1;
  const toDay   = Math.floor(toSlot   / SLOTS_PER_DAY) + 1;
  const sortedDays = [...dayCounts.keys()].sort((a, b) => a - b);

  let i = 0;
  while (i < sortedDays.length) {
    let j = i;
    let sum = dayCounts.get(sortedDays[i]);
    while (j + 1 < sortedDays.length && sortedDays[j + 1] === sortedDays[j] + 1) {
      j++;
      sum += dayCounts.get(sortedDays[j]);
    }
    // Only the streak touched by this request can trigger a block.
    const touchesRequest = sortedDays[i] <= toDay && sortedDays[j] >= fromDay;
    if (touchesRequest && sum > MAX_CONSECUTIVE_SLOTS) return true;
    i = j + 1;
  }
  return false;
}
