import { SLOTS_PER_DAY } from '../../utils/slots.js';
import { DAYS_FR } from '../../constants.js';

/**
 * MonthView: calendar grid. Each DayCell shows the dominant color for that day.
 * In wish mode: shows how many hours the user selected.
 * In planning mode: shows which member is assigned most that day.
 *
 * Props:
 *   year, month
 *   getSlotState — fn(slotId) → { state, color, label }
 */
export default function MonthView({ year, month, getSlotState, onDayClick }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon

  function daySummary(day) {
    const base = (day - 1) * SLOTS_PER_DAY;
    const seen = {}; // colorBg → { color, label }
    let availableCount = 0;
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      const { state, color } = getSlotState(base + s);
      if (state === 'available') { availableCount++; continue; }
      if (state !== 'empty' && color?.bg) {
        if (!seen[color.bg]) seen[color.bg] = { color };
      }
    }
    const occupants = Object.values(seen);
    return { occupants, availableCount };
  }

  const cells = [];
  // Empty cells before the first day
  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const { occupants, availableCount } = daySummary(d);
    const hasAvailable = availableCount > 0;
    const borderColor = occupants.length > 0 ? (occupants.length === 1 ? occupants[0].color.bg : '#94A3B8')
                      : hasAvailable ? '#22C55E' : '#E2E8F0';
    const bgColor     = occupants.length > 0 ? (occupants.length === 1 ? `${occupants[0].color.bg}22` : '#F1F5F9')
                      : hasAvailable ? '#F0FDF4' : '#F8FAFC';
    cells.push(
      <div key={d} onClick={() => onDayClick?.(d)} style={{
        aspectRatio: '1', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', borderRadius: 8,
        background: bgColor, border: `1px solid ${borderColor}`,
        cursor: onDayClick ? 'pointer' : 'default', overflow: 'hidden',
        padding: '2px 1px', gap: 1,
      }}>
        <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 11, lineHeight: 1.1 }}>{d}</span>
        {occupants.length === 1 && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: occupants[0].color.bg }} />
        )}
        {occupants.length > 1 && (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {occupants.map(o => (
              <span key={o.color.bg} style={{
                width: 6, height: 6, borderRadius: '50%', background: o.color.bg, flexShrink: 0,
              }} />
            ))}
          </div>
        )}
        {occupants.length === 0 && hasAvailable && (
          <span style={{ fontSize: 8, color: '#16A34A', fontWeight: 700, lineHeight: 1.1 }}>
            {availableCount / 2}h
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 2, marginBottom: 4 }}>
        {DAYS_FR.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10,
                                fontWeight: 700, color: '#94A3B8', padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>
      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells}
      </div>
    </div>
  );
}
