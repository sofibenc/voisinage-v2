import { useState } from 'react';
import { SLOTS_PER_DAY } from '../../utils/slots.js';
import { DAYS_FR } from '../../constants.js';

/**
 * Props: same as DayView but no `day` prop
 *   year, month
 *   getSlotState — fn(slotId) → { state, color, label }
 *   onSlotPointerDown / onSlotPointerEnter / onSlotPointerUp / onSlotClick
 */
export default function WeekView({
  year, month,
  getSlotState,
  onSlotPointerDown, onSlotPointerEnter, onSlotPointerUp, onSlotClick,
  interactive = false,
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = isCurrentMonth ? today.getDate() : 1;
  const dow = (new Date(year, month, todayDay).getDay() + 6) % 7; // 0=Mon
  const initialStart = Math.max(1, todayDay - dow);

  const [startDay, setStartDay] = useState(initialStart);

  const weekDays = Array.from({ length: 7 }, (_, i) => startDay + i)
    .filter(d => d >= 1 && d <= daysInMonth);

  const prevWeek = () => setStartDay(d => Math.max(1, d - 7));
  const nextWeek = () => setStartDay(d => {
    const next = d + 7;
    return next > daysInMonth ? d : next;
  });
  const canPrev = startDay > 1;
  const canNext = startDay + 7 <= daysInMonth;

  return (
    <div>
      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <button onClick={prevWeek} disabled={!canPrev}
          style={{ border: 'none', background: '#F1F5F9', borderRadius: 6,
                   padding: '4px 8px', fontSize: 14,
                   color: canPrev ? '#1E293B' : '#CBD5E1' }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 12,
                       fontWeight: 600, color: '#64748B' }}>
          {weekDays[0]}–{weekDays[weekDays.length - 1]}{' '}
          {new Date(year, month).toLocaleString('fr-FR', { month: 'long' })}
        </span>
        <button onClick={nextWeek} disabled={!canNext}
          style={{ border: 'none', background: '#F1F5F9', borderRadius: 6,
                   padding: '4px 8px', fontSize: 14,
                   color: canNext ? '#1E293B' : '#CBD5E1' }}>›</button>
      </div>

      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
        {/* Header row */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, background: 'white',
                      zIndex: 1, borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ width: 32, flexShrink: 0 }} />
          {weekDays.map(d => {
            const d_dow = (new Date(year, month, d).getDay() + 6) % 7;
            return (
              <div key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11,
                                    fontWeight: 600, padding: '4px 0', color: '#64748B' }}>
                {DAYS_FR[d_dow]}<br />{d}
              </div>
            );
          })}
        </div>

        {/* Slot rows */}
        {Array.from({ length: SLOTS_PER_DAY }, (_, s) => (
          <div key={s} style={{ display: 'flex',
                                borderBottom: s % 2 === 1 ? '1px solid #E2E8F0' : 'none' }}>
            {/* Hour label gutter */}
            <div style={{ width: 32, flexShrink: 0, fontSize: 9, color: '#94A3B8',
                          display: 'flex', alignItems: 'center', paddingLeft: 2 }}>
              {s % 2 === 0 ? `${String(s / 2).padStart(2, '0')}h` : ''}
            </div>
            {weekDays.map(d => {
              const sid = (d - 1) * SLOTS_PER_DAY + s;
              const { state, color } = getSlotState(sid);
              const bg = state === 'mine'      ? color?.bg    :
                         state === 'other'     ? color?.light  :
                         state === 'available' ? '#DCFCE7'     : 'transparent';
              return (
                <div key={d}
                  onPointerDown={onSlotPointerDown ? e => onSlotPointerDown(sid, e) : undefined}
                  onPointerEnter={onSlotPointerEnter ? () => onSlotPointerEnter(sid) : undefined}
                  onPointerUp={onSlotPointerUp}
                  onClick={onSlotClick ? () => onSlotClick(sid) : undefined}
                  style={{
                    flex: 1, height: 14, background: bg,
                    cursor: (onSlotClick || onSlotPointerDown) ? 'pointer' : 'default',
                    userSelect: 'none', touchAction: interactive ? 'none' : 'auto',
                    borderLeft: '1px solid #F1F5F9',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
