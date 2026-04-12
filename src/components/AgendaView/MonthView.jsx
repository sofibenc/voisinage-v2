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
    const base  = (day - 1) * SLOTS_PER_DAY;
    const counts = {};   // colorBg → { count, label, color }
    let mineCount = 0;
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      const { state, color, label } = getSlotState(base + s);
      if (state === 'mine') mineCount++;
      if (state !== 'empty') {
        const key = color?.bg ?? '#ccc';
        if (!counts[key]) counts[key] = { count: 0, label, color };
        counts[key].count++;
      }
    }
    const dominant = Object.values(counts).sort((a, b) => b.count - a.count)[0];
    return { color: dominant?.color?.bg ?? null, label: dominant?.label ?? null, mineCount };
  }

  const cells = [];
  // Empty cells before the first day
  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const { color, label, mineCount } = daySummary(d);
    cells.push(
      <div key={d} onClick={() => onDayClick?.(d)} style={{
        aspectRatio: '1', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', borderRadius: 8,
        background: color ? `${color}22` : '#F8FAFC',
        border: `1px solid ${color ?? '#E2E8F0'}`, fontSize: 11,
        cursor: onDayClick ? 'pointer' : 'default', overflow: 'hidden',
        padding: '2px 1px',
      }}>
        <span style={{ fontWeight: 700, color: '#1E293B', lineHeight: 1.2 }}>{d}</span>
        {label && (
          <span style={{ fontSize: 8, color: color ?? '#64748B', fontWeight: 600,
                         maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                         whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            {label.split(' ')[0]}
          </span>
        )}
        {mineCount > 0 && !label && (
          <span style={{ fontSize: 9, color: '#64748B' }}>{mineCount / 2}h</span>
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
