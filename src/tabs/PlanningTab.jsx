import { useState, useCallback } from 'react';
import { useSchedule } from '../hooks/useSchedule.js';
import { useMembers }  from '../hooks/useMembers.js';
import AgendaView      from '../components/AgendaView/AgendaView.jsx';
import SlotActionSheet from '../components/SlotActionSheet.jsx';
import { MONTHS } from '../constants.js';

export default function PlanningTab({ member }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { schedule, deadline, isDeadlinePassed, publishing, release, claim } = useSchedule(year, month);
  const { members, colorOf } = useMembers();

  const [selectedSlot, setSelectedSlot] = useState(null);

  const getSlotState = useCallback((sid) => {
    if (!schedule) return { state: 'empty', color: null, label: '' };
    const assignedUid = schedule.assignments?.[String(sid)];
    const isAvailable = schedule.available?.includes(sid);
    if (isAvailable) return { state: 'available', color: null, label: '✦' };
    if (assignedUid) {
      const color = colorOf(assignedUid);
      const m = members.find(m => m.uid === assignedUid);
      return { state: assignedUid === member?.uid ? 'mine' : 'other', color, label: m?.name ?? '' };
    }
    return { state: 'empty', color: null, label: '' };
  }, [schedule, member, colorOf, members]);

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div style={{ padding: 16 }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>›</button>
      </div>

      {publishing && (
        <div style={{ background: '#EFF6FF', borderRadius: 10, padding: 10,
                      marginBottom: 12, fontSize: 13, color: '#1D4ED8' }}>
          ⚡ Publication du planning en cours…
        </div>
      )}

      {!schedule && !publishing && (
        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 20,
                      textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          {isDeadlinePassed
            ? 'Calcul du planning en cours…'
            : `Planning disponible après la deadline${deadline ? ` (${deadline})` : ''}`}
        </div>
      )}

      {schedule && (
        <>
          <div style={{ background: '#F0FDF4', borderRadius: 10, padding: 10,
                        marginBottom: 12, fontSize: 12, color: '#166534' }}>
            ✓ Planning publié · {schedule.quotaHours}h/voisin
          </div>
          <div style={{ background: 'white', borderRadius: 14,
                        padding: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <AgendaView year={year} month={month}
              getSlotState={getSlotState}
              onSlotClick={setSelectedSlot} />
          </div>
        </>
      )}

      <SlotActionSheet
        slotId={selectedSlot}
        schedule={schedule}
        member={member}
        members={members}
        colorOf={colorOf}
        onRelease={sid => release(sid, member.uid)}
        onClaim={sid => claim(sid, member.uid)}
        onClose={() => setSelectedSlot(null)}
      />
    </div>
  );
}
