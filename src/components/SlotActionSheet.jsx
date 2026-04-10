import { formatSlotTime, slotToDay } from '../utils/slots.js';

export default function SlotActionSheet({ slotId, schedule, member, members, colorOf, onRelease, onClaim, onClose }) {
  if (slotId === null) return null;

  const assignedUid = schedule?.assignments?.[String(slotId)];
  const isAvailable = schedule?.available?.includes(slotId);
  const isMine      = assignedUid === member?.uid;

  const startTime = formatSlotTime(slotId);
  const endTime   = formatSlotTime(slotId + 1);
  const day       = slotToDay(slotId);
  const ownerColor = assignedUid ? colorOf(assignedUid) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                  zIndex: 50, display: 'flex', flexDirection: 'column',
                  justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '16px 16px 0 0',
                    padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          Jour {day} · {startTime}–{endTime}
        </div>

        {isAvailable && (
          <div style={{ background: '#DCFCE7', borderRadius: 8, padding: 10,
                        fontSize: 13, color: '#166534', marginBottom: 12 }}>
            ✦ Créneau libre — disponible à la prise
          </div>
        )}

        {assignedUid && !isAvailable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%',
                          background: ownerColor?.bg }} />
            <span style={{ fontSize: 13, color: '#64748B' }}>
              {isMine ? 'Vous' : members?.find(m => m.uid === assignedUid)?.name ?? assignedUid}
            </span>
          </div>
        )}

        {isAvailable && (
          <button onClick={() => { onClaim(slotId); onClose(); }}
            style={{ width: '100%', background: '#16A34A', color: 'white',
                     border: 'none', borderRadius: 12, padding: '14px 0',
                     fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            Prendre ce créneau
          </button>
        )}

        {isMine && !isAvailable && (
          <button onClick={() => { onRelease(slotId); onClose(); }}
            style={{ width: '100%', background: '#EF4444', color: 'white',
                     border: 'none', borderRadius: 12, padding: '14px 0',
                     fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            Libérer ce créneau
          </button>
        )}

        <button onClick={onClose}
          style={{ width: '100%', background: '#F1F5F9', color: '#64748B',
                   border: 'none', borderRadius: 12, padding: '12px 0',
                   fontSize: 14, fontWeight: 600 }}>
          Fermer
        </button>
      </div>
    </div>
  );
}
