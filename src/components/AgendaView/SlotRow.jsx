import { formatSlotTime } from '../../utils/slots.js';

/**
 * Props:
 *   slotId      - integer slot ID
 *   state       - 'empty' | 'mine' | 'other' | 'available'
 *   color       - { bg, light, text } color of the member who owns/wants this slot
 *   label       - string shown inside (member name or empty)
 *   showTime    - bool — show HH:MM label on left (show every 2 slots = every hour)
 *   onPointerDown / onPointerEnter / onPointerUp — drag handlers (optional)
 *   onClick     - click handler (optional)
 */
export default function SlotRow({
  slotId, state = 'empty', color, label = '',
  showTime = false, isHalfHour = false,
  onPointerDown, onPointerEnter, onPointerUp, onClick,
  interactive = false,
}) {
  const bg = state === 'mine'      ? color?.bg    :
             state === 'other'     ? color?.light  :
             state === 'available' ? '#DCFCE7'     : 'transparent';

  const textColor = state === 'mine'      ? 'white'       :
                    state === 'other'     ? color?.text    :
                    state === 'available' ? '#166534'      : '#94A3B8';

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerUp={onPointerUp}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', height: 20,
        background: bg, borderBottom: '1px solid #F1F5F9',
        cursor: (onClick || onPointerDown) ? 'pointer' : 'default',
        userSelect: 'none', touchAction: interactive ? 'none' : 'auto',
        paddingLeft: 4, paddingRight: 4,
      }}
    >
      {showTime && (
        <span style={{ fontSize: isHalfHour ? 9 : 11,
                       color: isHalfHour ? '#94A3B8' : '#475569',
                       width: 32, flexShrink: 0 }}>
          {formatSlotTime(slotId)}
        </span>
      )}
      <span style={{ fontSize: 10, color: textColor, overflow: 'hidden',
                     textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {state === 'available' ? '✦ libre' : label}
      </span>
    </div>
  );
}
