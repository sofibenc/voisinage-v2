import { describe, it, expect } from 'vitest';
import { exceedsConsecutiveHoursLimit, MAX_CONSECUTIVE_SLOTS } from '../src/utils/reservationRules.js';
import { SLOTS_PER_DAY } from '../src/utils/slots.js';

const uid = 'u1';
const day = (d, startSlot, endSlot) => [(d - 1) * SLOTS_PER_DAY + startSlot, (d - 1) * SLOTS_PER_DAY + endSlot];

describe('exceedsConsecutiveHoursLimit', () => {
  it('allows a 3rd consecutive day when total hours stay well under 48h', () => {
    // Reported bug: 1h on day J, 1h on day J+1 already reserved — booking
    // 1h on day J+2 must NOT be blocked just because it's a 3rd calendar day.
    const assignments = {};
    let [f, t] = day(10, 0, 1); for (let s = f; s <= t; s++) assignments[String(s)] = uid; // day 10, 1h
    [f, t] = day(11, 0, 1);     for (let s = f; s <= t; s++) assignments[String(s)] = uid; // day 11, 1h

    const [from, to] = day(12, 0, 1); // day 12, 1h
    expect(exceedsConsecutiveHoursLimit(assignments, uid, from, to)).toBe(false);
  });

  it('allows a lone isolated day regardless of gaps to other reservations', () => {
    const assignments = {};
    const [f, t] = day(5, 0, 1); for (let s = f; s <= t; s++) assignments[String(s)] = uid;
    const [from, to] = day(20, 0, 1);
    expect(exceedsConsecutiveHoursLimit(assignments, uid, from, to)).toBe(false);
  });

  it('blocks when cumulative hours on a consecutive streak would exceed 48h', () => {
    const assignments = {};
    // Day 1: full day already reserved (48 slots = 24h)
    const [f, t] = day(1, 0, 47); for (let s = f; s <= t; s++) assignments[String(s)] = uid;
    // Day 2: another full day (24h) -> total would be 48h exactly, still OK
    const [from2, to2] = day(2, 0, 47);
    expect(exceedsConsecutiveHoursLimit(assignments, uid, from2, to2)).toBe(false);

    // Adding day 2 for real, then day 3 (even 1 slot) pushes total past 48h -> blocked
    for (let s = from2; s <= to2; s++) assignments[String(s)] = uid;
    const [from3, to3] = day(3, 0, 0); // 30 min
    expect(exceedsConsecutiveHoursLimit(assignments, uid, from3, to3)).toBe(true);
  });

  it('does not count a pre-existing streak that the new request does not touch', () => {
    const assignments = {};
    // Days 1-3 already sum to more than 48h (unrelated legacy/edge-case data)
    const [f, t] = day(1, 0, 47); for (let s = f; s <= t; s++) assignments[String(s)] = uid;
    const [f2, t2] = day(2, 0, 47); for (let s = f2; s <= t2; s++) assignments[String(s)] = uid;
    const [f3, t3] = day(3, 0, 47); for (let s = f3; s <= t3; s++) assignments[String(s)] = uid;

    // A completely unrelated, isolated day must still be bookable
    const [from, to] = day(20, 0, 1);
    expect(exceedsConsecutiveHoursLimit(assignments, uid, from, to)).toBe(false);
  });

  it('allows exactly 48h on a consecutive streak but not 48h + 30min', () => {
    expect(MAX_CONSECUTIVE_SLOTS).toBe(96);
    const assignments = {};
    const [f, t] = day(1, 0, 47); for (let s = f; s <= t; s++) assignments[String(s)] = uid; // 24h
    const [from, to] = day(2, 0, 46); // 23h30 more -> total 47h30, still ok
    expect(exceedsConsecutiveHoursLimit(assignments, uid, from, to)).toBe(false);

    const [from2, to2] = day(2, 0, 47); // 24h more -> total 48h exactly, ok
    expect(exceedsConsecutiveHoursLimit(assignments, uid, from2, to2)).toBe(false);

    for (let s = from2; s <= to2; s++) assignments[String(s)] = uid;
    const [from3, to3] = day(3, 0, 0); // +30min -> 48h30, blocked
    expect(exceedsConsecutiveHoursLimit(assignments, uid, from3, to3)).toBe(true);
  });
});
