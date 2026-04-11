import { useState, useCallback } from 'react';
import { useSchedule } from '../hooks/useSchedule.js';
import { useMembers }  from '../hooks/useMembers.js';
import AgendaView      from '../components/AgendaView/AgendaView.jsx';
import SlotActionSheet from '../components/SlotActionSheet.jsx';
import { MONTHS, monthKey } from '../constants.js';
import { SLOTS_PER_DAY } from '../utils/slots.js';

function fmtStart(s) { return `${String(Math.floor(s/2)).padStart(2,'0')}h${s%2?'30':'00'}`; }
function fmtEnd(s)   { return s === 47 ? '24h00' : fmtStart(s + 1); }

export default function PlanningTab({ member }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const mk = monthKey(year, month);

  const { schedule, deadline, isDeadlinePassed, publishing, release, releaseRange, claim, claimRange } = useSchedule(year, month);
  const { members, colorOf } = useMembers();

  const [selectedSlot, setSelectedSlot] = useState(null);

  // Claim range form
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDay = (year === now.getFullYear() && month === now.getMonth()) ? now.getDate() : 1;
  const [showClaimRange, setShowClaimRange] = useState(false);
  const [rangeMode,      setRangeMode]      = useState('claim'); // 'claim' | 'release'
  const [qDay,    setQDay]    = useState(todayDay);
  const [qDayEnd, setQDayEnd] = useState(todayDay);
  const [qStart,  setQStart]  = useState(0);
  const [qEnd,    setQEnd]    = useState(47);
  const [claimError, setClaimError] = useState(null);

  async function applyClaimRange() {
    setClaimError(null);
    const endDay   = Math.max(qDay, qDayEnd);
    const fromSlot = (qDay - 1) * SLOTS_PER_DAY + qStart;
    const toSlot   = (endDay - 1) * SLOTS_PER_DAY + qEnd;
    try {
      if (rangeMode === 'release') {
        if (!window.confirm('Libérer vos créneaux de cette plage ?')) return;
        await releaseRange(fromSlot, toSlot, member.uid);
        setShowClaimRange(false);
      } else {
        await claimRange(fromSlot, toSlot, member.uid);
        setShowClaimRange(false);
      }
    } catch (e) {
      if (e.message === 'OVERLAP') {
        setClaimError('Chevauchement : un créneau de cette plage est déjà pris par quelqu\'un d\'autre.');
      } else {
        setClaimError('Erreur inattendue, réessaie.');
      }
    }
  }

  const getSlotState = useCallback((sid) => {
    if (!schedule) return { state: 'empty', color: null, label: '' };
    const assignedUid = schedule.assignments?.[String(sid)];
    const isAvailable = schedule.available?.includes(sid);
    if (isAvailable || !assignedUid) return { state: 'available', color: null, label: '✦' };
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

          {/* Claim range form */}
          <div style={{ marginBottom: 10 }}>
            <button onClick={() => { setShowClaimRange(v => !v); setClaimError(null); }}
              style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0',
                       borderRadius: showClaimRange ? '10px 10px 0 0' : 10,
                       padding: '9px 12px', fontSize: 13, color: '#475569',
                       display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>± Prendre / Libérer une plage horaire</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{showClaimRange ? '▲' : '▼'}</span>
            </button>
            {showClaimRange && (
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none',
                            borderRadius: '0 0 10px 10px', padding: '12px 12px 14px',
                            display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Mode toggle */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['claim', '+ Prendre'], ['release', '− Libérer']].map(([mode, label]) => (
                    <button key={mode} onClick={() => { setRangeMode(mode); setClaimError(null); }}
                      style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                               border: 'none', borderRadius: 8,
                               background: rangeMode === mode ? (mode === 'claim' ? '#16A34A' : '#EF4444') : '#F1F5F9',
                               color: rangeMode === mode ? 'white' : '#64748B' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* Day range */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 12, color: '#64748B', width: 36 }}>Du</label>
                  <select value={qDay} onChange={e => { const d = Number(e.target.value); setQDay(d); if (qDayEnd < d) setQDayEnd(d); }}
                    style={{ flex: 1, padding: '7px 8px', borderRadius: 8,
                             border: '1px solid #E2E8F0', fontSize: 13 }}>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d} {MONTHS[month]}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: 12, color: '#64748B' }}>au</label>
                  <select value={qDayEnd} onChange={e => setQDayEnd(Number(e.target.value))}
                    style={{ flex: 1, padding: '7px 8px', borderRadius: 8,
                             border: '1px solid #E2E8F0', fontSize: 13 }}>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => d >= qDay).map(d => (
                      <option key={d} value={d}>{d} {MONTHS[month]}</option>
                    ))}
                  </select>
                </div>
                {/* Time range */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 12, color: '#64748B', width: 36 }}>De</label>
                  <select value={qStart} onChange={e => setQStart(Number(e.target.value))}
                    style={{ flex: 1, padding: '7px 8px', borderRadius: 8,
                             border: '1px solid #E2E8F0', fontSize: 13 }}>
                    {Array.from({ length: 48 }, (_, s) => (
                      <option key={s} value={s}>{fmtStart(s)}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: 12, color: '#64748B' }}>à</label>
                  <select value={qEnd} onChange={e => setQEnd(Number(e.target.value))}
                    style={{ flex: 1, padding: '7px 8px', borderRadius: 8,
                             border: '1px solid #E2E8F0', fontSize: 13 }}>
                    {Array.from({ length: 48 }, (_, s) => (
                      <option key={s} value={s}>{fmtEnd(s)}</option>
                    ))}
                  </select>
                </div>
                {claimError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                                padding: '8px 10px', fontSize: 12, color: '#DC2626' }}>
                    ⚠️ {claimError}
                  </div>
                )}
                <button onClick={applyClaimRange} disabled={qStart > qEnd}
                  style={{ background: qStart > qEnd ? '#94A3B8' : rangeMode === 'release' ? '#EF4444' : '#16A34A',
                           color: 'white', border: 'none', borderRadius: 8,
                           padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
                  {rangeMode === 'release' ? 'Libérer' : 'Prendre'}
                </button>
              </div>
            )}
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
