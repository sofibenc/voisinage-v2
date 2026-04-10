import { SLOTS_PER_DAY } from './slots.js';

const PATTERN_DOW = {
  weekends: dow => dow === 5 || dow === 6,
  mondays:  dow => dow === 0,
  fridays:  dow => dow === 4,
  midweek:  dow => dow >= 1 && dow <= 3,
};

export function resolveTemplate(template, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const slots = new Set();

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = (new Date(year, month, day).getDay() + 6) % 7; // 0=Mon
    const base = (day - 1) * SLOTS_PER_DAY;

    for (const pattern of template.patterns || []) {
      if (PATTERN_DOW[pattern]?.(dow)) {
        for (let s = 0; s < SLOTS_PER_DAY; s++) slots.add(base + s);
      }
    }

    for (const range of template.customRanges || []) {
      if (range.dayOfWeek === dow) {
        for (let s = range.startSlot; s <= range.endSlot; s++) slots.add(base + s);
      }
    }
  }

  return [...slots].sort((a, b) => a - b);
}
