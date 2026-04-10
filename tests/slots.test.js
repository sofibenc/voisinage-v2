import { describe, it, expect } from 'vitest';
import { slotId, slotToTime, slotToDay, formatSlotTime, totalSlotsInMonth } from '../src/utils/slots.js';

describe('slotId', () => {
  it('day 1 at 00:00 is slot 0', () => expect(slotId(1, 0, 0)).toBe(0));
  it('day 1 at 00:30 is slot 1', () => expect(slotId(1, 0, 30)).toBe(1));
  it('day 1 at 23:30 is slot 47', () => expect(slotId(1, 23, 30)).toBe(47));
  it('day 2 at 00:00 is slot 48', () => expect(slotId(2, 0, 0)).toBe(48));
});

describe('slotToTime', () => {
  it('slot 0 → { hour: 0, minute: 0 }', () => expect(slotToTime(0)).toEqual({ hour: 0, minute: 0 }));
  it('slot 1 → { hour: 0, minute: 30 }', () => expect(slotToTime(1)).toEqual({ hour: 0, minute: 30 }));
  it('slot 47 → { hour: 23, minute: 30 }', () => expect(slotToTime(47)).toEqual({ hour: 23, minute: 30 }));
  it('slot 48 → { hour: 0, minute: 0 } (day 2)', () => expect(slotToTime(48)).toEqual({ hour: 0, minute: 0 }));
});

describe('slotToDay', () => {
  it('slot 0 → day 1', () => expect(slotToDay(0)).toBe(1));
  it('slot 47 → day 1', () => expect(slotToDay(47)).toBe(1));
  it('slot 48 → day 2', () => expect(slotToDay(48)).toBe(2));
});

describe('formatSlotTime', () => {
  it('slot 0 → "00h00"', () => expect(formatSlotTime(0)).toBe('00h00'));
  it('slot 1 → "00h30"', () => expect(formatSlotTime(1)).toBe('00h30'));
  it('slot 3 → "01h30"', () => expect(formatSlotTime(3)).toBe('01h30'));
});

describe('totalSlotsInMonth', () => {
  it('April 2026 (30 days) → 1440', () => expect(totalSlotsInMonth(2026, 3)).toBe(1440));
  it('March 2026 (31 days) → 1488', () => expect(totalSlotsInMonth(2026, 2)).toBe(1488));
  it('Feb 2024 leap (29 days) → 1392', () => expect(totalSlotsInMonth(2024, 1)).toBe(1392));
});
