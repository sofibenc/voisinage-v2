export const SLOTS_PER_DAY = 48;

export function slotId(dayOfMonth, hour, minute) {
  return (dayOfMonth - 1) * SLOTS_PER_DAY + hour * 2 + (minute === 30 ? 1 : 0);
}

export function slotToTime(sid) {
  const slotInDay = sid % SLOTS_PER_DAY;
  return { hour: Math.floor(slotInDay / 2), minute: (slotInDay % 2) * 30 };
}

export function slotToDay(sid) {
  return Math.floor(sid / SLOTS_PER_DAY) + 1;
}

export function formatSlotTime(sid) {
  const { hour, minute } = slotToTime(sid);
  return `${String(hour).padStart(2, '0')}h${minute === 0 ? '00' : '30'}`;
}

export function totalSlotsInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate() * SLOTS_PER_DAY;
}
