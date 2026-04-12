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
    const base   = (day - 1) * SLOTS_PER_DAY;
    const seen   = {}; // colorBg → { color, label }
    let mineCount = 0;
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      const { state, color, label } = getSlotState(base + s);
      if (state === 'mine') mineCount++;
      if (state !== 'empty' && color?.bg) {
        if (!seen[color.bg]) seen[color.bg] = { color, label };
      }
    }
    const occupants = Object.values(seen); // all distinct occupants
    return { occupants, mineCount };
  }

  const cells = [];
  // Empty cells before the first day
  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const { occupants, mineCount } = daySummary(d);
    const borderColor = occupants.length === 1 ? occupants[0].color.bg : occupants.length > 1 ? '#94A3B8' : '#E2E8F0';
    const bgColor     = occupants.length === 1 ? `${occupants[0].color.bg}22` : occupants.length > 1 ? '#F1F5F9' : '#F8FAFC';
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
          <span style={{ fontSize: 8, color: occupants[0].color.bg, fontWeight: 700,
                         maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                         whiteSpace: 'nowrap', lineHeight: 1.1 }}>
            {occupants[0].label.split(' ')[0]}
          </span>
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
