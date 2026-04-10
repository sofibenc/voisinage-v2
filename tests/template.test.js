import { describe, it, expect } from 'vitest';
import { resolveTemplate } from '../src/utils/template.js';

describe('resolveTemplate', () => {
  // April 2026: 30 days, starts on Wednesday (dow=2)
  // Mondays in April 2026: 6, 13, 20, 27

  it('returns empty array for empty template', () => {
    expect(resolveTemplate({}, 2026, 3)).toEqual([]);
  });

  it('resolves "mondays" pattern — 4 Mondays × 48 slots = 192 slots', () => {
    const slots = resolveTemplate({ patterns: ['mondays'] }, 2026, 3);
    expect(slots.length).toBe(4 * 48);
    // Monday Apr 6 = day 6, base = (6-1)*48 = 240
    expect(slots).toContain(240); // day 6, slot 0 (00h00)
    expect(slots).toContain(287); // day 6, slot 47 (23h30)
    // Tuesday Apr 7 = NOT included
    expect(slots).not.toContain(288); // day 7, slot 0
  });

  it('resolves "weekends" pattern — 8 days × 48 slots = 384 slots', () => {
    // April 2026 weekends: Sat 4,11,18,25 + Sun 5,12,19,26
    const slots = resolveTemplate({ patterns: ['weekends'] }, 2026, 3);
    expect(slots.length).toBe(8 * 48);
  });

  it('resolves customRanges by dayOfWeek and slot range', () => {
    // Every Monday (dow=0) from slot 36 (18h00) to slot 39 (19h30)
    const slots = resolveTemplate({
      customRanges: [{ dayOfWeek: 0, startSlot: 36, endSlot: 39 }]
    }, 2026, 3);
    // 4 Mondays × 4 slots = 16 slots
    expect(slots.length).toBe(4 * 4);
    // Monday Apr 6 base=240: slots 276 (240+36) to 279 (240+39)
    expect(slots).toContain(276);
    expect(slots).toContain(279);
  });

  it('combines patterns and customRanges without duplicates', () => {
    // mondays (all 48 slots) + customRange Monday slots 0-5 (already included)
    const slots = resolveTemplate({
      patterns: ['mondays'],
      customRanges: [{ dayOfWeek: 0, startSlot: 0, endSlot: 5 }]
    }, 2026, 3);
    expect(slots.length).toBe(4 * 48); // no duplicates
  });

  it('returns slots in sorted order', () => {
    const slots = resolveTemplate({ patterns: ['weekends'] }, 2026, 3);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]).toBeGreaterThan(slots[i - 1]);
    }
  });
});
