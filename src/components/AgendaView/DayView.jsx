import { useRef, useEffect } from 'react';
import { SLOTS_PER_DAY } from '../../utils/slots.js';
import SlotRow from './SlotRow.jsx';

/**
 * Props:
 *   year, month, day   — which day to render (day is 1-based)
 *   getSlotState       — fn(slotId) → { state, color, label }
 *   onSlotPointerDown  — fn(slotId, e) — optional
 *   onSlotPointerEnter — fn(slotId)    — optional
 *   onSlotPointerUp    — fn()          — optional
 *   onSlotClick        — fn(slotId)   — optional
 */
export default function DayView({
  year, month, day,
  getSlotState,
  onSlotPointerDown, onSlotPointerEnter, onSlotPointerUp, onSlotClick,
  interactive = false,
}) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 24 * 20; // 12h = slot 24, hauteur 20px
  }, [day]);

  const base = (day - 1) * SLOTS_PER_DAY;
  const rows = [];

  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    const sid = base + s;
    const { state, color, label } = getSlotState(sid);
    rows.push(
      <SlotRow
        key={sid}
        slotId={sid}
        state={state}
        color={color}
        label={label}
        showTime={true}
        isHalfHour={s % 2 === 1}
        interactive={interactive}
        onPointerDown={onSlotPointerDown ? e => onSlotPointerDown(sid, e) : undefined}
        onPointerEnter={onSlotPointerEnter ? () => onSlotPointerEnter(sid) : undefined}
        onPointerUp={onSlotPointerUp}
        onClick={onSlotClick ? () => onSlotClick(sid) : undefined}
      />
    );
  }

  return (
    <div ref={scrollRef} style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      {rows}
    </div>
  );
}
