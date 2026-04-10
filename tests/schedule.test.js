import { describe, it, expect } from 'vitest';
import { computeSchedule } from '../src/utils/schedule.js';

const alice = { uid: 'alice' };
const bob   = { uid: 'bob' };
const members = [alice, bob];

describe('computeSchedule', () => {
  it('assigns slot to sole wishing member', () => {
    const { assignments } = computeSchedule(members, { alice: [0, 1], bob: [] }, 2026, 3);
    expect(assignments[0]).toBe('alice');
    expect(assignments[1]).toBe('alice');
  });

  it('leaves slots unassigned when no one wishes them', () => {
    const { assignments } = computeSchedule(members, { alice: [], bob: [] }, 2026, 3);
    expect(Object.keys(assignments).length).toBe(0);
  });

  it('gives contested slot to member with fewer assigned slots', () => {
    // alice gets slot 0 first; both want slot 1 → bob has 0 assigned vs alice's 1
    const { assignments } = computeSchedule(members, { alice: [0, 1], bob: [1] }, 2026, 3);
    expect(assignments[0]).toBe('alice');
    expect(assignments[1]).toBe('bob');
  });

  it('uses prevUsage as tiebreaker when assigned count is equal', () => {
    const { assignments } = computeSchedule(
      members, { alice: [0], bob: [0] }, 2026, 3, { alice: 10, bob: 5 }
    );
    expect(assignments[0]).toBe('bob'); // bob used less last month
  });

  it('computes correct quotaHours for April with 2 members', () => {
    // 30 days × 48 slots / 2 members = 720 slots each = 360 hours
    const { quotaHours } = computeSchedule(members, {}, 2026, 3);
    expect(quotaHours).toBe(360);
  });

  it('prevents more than 96 consecutive slots to same member', () => {
    // alice wants slots 0-96, bob wants only slot 96
    const aliceSlots = Array.from({ length: 97 }, (_, i) => i);
    const { assignments } = computeSchedule(
      members, { alice: aliceSlots, bob: [96] }, 2026, 3
    );
    for (let i = 0; i < 96; i++) expect(assignments[i]).toBe('alice');
    expect(assignments[96]).toBe('bob');
  });
});
