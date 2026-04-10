import { useState, useCallback, useRef } from 'react';
import { useWishlist }  from '../hooks/useWishlist.js';
import { useSchedule }  from '../hooks/useSchedule.js';
import { useMembers }   from '../hooks/useMembers.js';
import AgendaView       from '../components/AgendaView/AgendaView.jsx';
import TemplatePanel    from '../components/TemplatePanel.jsx';
import { MONTHS, monthKey } from '../constants.js';
import { SLOTS_PER_DAY } from '../utils/slots.js';

export default function WishTab({ member }) {
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const mk = monthKey(year, month);

  const { slots, toggleSlot, setSlotRange, mergeSlots, clearAll } = useWishlist(member?.uid, mk);
  const { schedule, deadline, isDeadlinePassed }      = useSchedule(year, month);
  const { colorOf } = useMembers();
  const myColor = colorOf(member?.uid);

  const [showTemplate,   setShowTemplate]   = useState(false);
  const [showAddRange,   setShowAddRange]   = useState(false);
  const [editMode,       setEditMode]       = useState(false);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDay = (year === now.getFullYear() && month === now.getMonth()) ? now.getDate() : 1;
  const [qDay,   setQDay]   = useState(todayDay);
  const [qStart, setQStart] = useState(36); // 18h00
  const [qEnd,   setQEnd]   = useState(43); // 21h30

  // Controlled view/day for AgendaView
  const [agendaView, setAgendaView] = useState('Semaine');
  const [agendaDay,  setAgendaDay]  = useState(todayDay);

  function applyAddRange() {
    const base = (qDay - 1) * SLOTS_PER_DAY;
    const toAdd = [];
    for (let s = qStart; s <= qEnd; s++) toAdd.push(base + s);
    mergeSlots(toAdd);
    setAgendaView('Semaine');
    setAgendaDay(qDay);
    setShowAddRange(false);
  }

  // Drag selection
  const dragRef = useRef({ active: false, startSlot: null, wasSelected: null });

  const getSlotState = useCallback(sid => {
    if (slots.includes(sid)) return { state: 'mine', color: myColor, label: '' };
    return { state: 'empty', color: null, label: '' };
  }, [slots, myColor]);

  const handlePointerDown = useCallback((sid, e) => {
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const wasSelected = slots.includes(sid);
    dragRef.current = { active: true, startSlot: sid, wasSelected };
    // Toggle the clicked slot immediately
    toggleSlot(sid);
  }, [slots, toggleSlot]);

  const handlePointerEnter = useCallback(sid => {
    if (!dragRef.current.active) return;
    // Extend selection from startSlot to current sid
    // If drag started on an unselected slot → we're selecting; else deselecting
    setSlotRange(dragRef.current.startSlot, sid, !dragRef.current.wasSelected);
  }, [setSlotRange]);

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const locked = isDeadlinePassed || !!schedule;

  // Month navigation (max 3 months ahead)
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const canGoNext = new Date(year, month + 1) < maxDate;
  const canGoPrev = new Date(year, month) > new Date(now.getFullYear(), now.getMonth());

  function prevMonth() {
    const newMonth = month === 0 ? 11 : month - 1;
    const newYear  = month === 0 ? year - 1 : year;
    if (month === 0) setYear(y => y - 1);
    setMonth(newMonth);
    const defaultDay = (newYear === now.getFullYear() && newMonth === now.getMonth()) ? now.getDate() : 1;
    setQDay(defaultDay);
    setAgendaDay(defaultDay);
  }
  function nextMonth() {
    if (!canGoNext) return;
    const newMonth = month === 11 ? 0 : month + 1;
    const newYear  = month === 11 ? year + 1 : year;
    if (month === 11) setYear(y => y + 1);
    setMonth(newMonth);
    const defaultDay = (newYear === now.getFullYear() && newMonth === now.getMonth()) ? now.getDate() : 1;
    setQDay(defaultDay);
    setAgendaDay(defaultDay);
  }

  const hoursSelected = slots.length / 2;

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prevMonth} disabled={!canGoPrev}
          style={{ border: 'none', background: 'none', fontSize: 20,
                   color: canGoPrev ? '#1E293B' : '#CBD5E1' }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} disabled={!canGoNext}
          style={{ border: 'none', background: 'none', fontSize: 20,
                   color: canGoNext ? '#1E293B' : '#CBD5E1' }}>›</button>
      </div>

      {/* Status banners */}
      {schedule && (
        <div style={{ background: '#FEF9C3', border: '2px solid #FDE047', borderRadius: 10,
                      padding: 10, marginBottom: 12, fontSize: 13, color: '#713F12' }}>
          ⚠️ Planning publié — souhaits verrouillés.
        </div>
      )}
      {!schedule && isDeadlinePassed && (
        <div style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: 10,
                      padding: 10, marginBottom: 12, fontSize: 13, color: '#DC2626' }}>
          🔒 Deadline dépassée ({deadline}) — souhaits verrouillés.
        </div>
      )}
      {!schedule && !isDeadlinePassed && (
        <div style={{ background: myColor.light, border: `2px solid ${myColor.bg}`,
                      borderRadius: 10, padding: 10, marginBottom: 12,
                      display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: myColor.text }}>
              {hoursSelected}h sélectionnées
            </span>
            {deadline && (
              <div style={{ fontSize: 11, color: myColor.text, opacity: 0.7, marginTop: 2 }}>
                Deadline : {deadline}
              </div>
            )}
          </div>
          <button onClick={() => setShowTemplate(true)}
            style={{ background: myColor.bg, color: 'white', border: 'none',
                     borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
            Template
          </button>
          {slots.length > 0 && (
            <button onClick={clearAll}
              style={{ background: 'none', border: 'none', color: myColor.text,
                       fontSize: 11, fontWeight: 700, opacity: 0.7 }}>
              ✕ Tout effacer
            </button>
          )}
        </div>
      )}

      {/* Agenda */}
      {/* Add time range */}
      {!locked && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setShowAddRange(v => !v)}
            style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0',
                     borderRadius: showAddRange ? '10px 10px 0 0' : 10,
                     padding: '9px 12px', fontSize: 13, color: '#475569',
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>+ Ajouter une plage horaire</span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{showAddRange ? '▲' : '▼'}</span>
          </button>
          {showAddRange && (
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none',
                          borderRadius: '0 0 10px 10px', padding: '12px 12px 14px',
                          display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: '#64748B', width: 36 }}>Jour</label>
                <select value={qDay} onChange={e => setQDay(Number(e.target.value))}
                  style={{ flex: 1, padding: '7px 8px', borderRadius: 8,
                           border: '1px solid #E2E8F0', fontSize: 13 }}>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>
                      {d} {MONTHS[month]}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: '#64748B', width: 36 }}>De</label>
                <select value={qStart} onChange={e => setQStart(Number(e.target.value))}
                  style={{ flex: 1, padding: '7px 8px', borderRadius: 8,
                           border: '1px solid #E2E8F0', fontSize: 13 }}>
                  {Array.from({ length: 48 }, (_, s) => (
                    <option key={s} value={s}>
                      {String(Math.floor(s/2)).padStart(2,'0')}h{s%2?'30':'00'}
                    </option>
                  ))}
                </select>
                <label style={{ fontSize: 12, color: '#64748B' }}>à</label>
                <select value={qEnd} onChange={e => setQEnd(Number(e.target.value))}
                  style={{ flex: 1, padding: '7px 8px', borderRadius: 8,
                           border: '1px solid #E2E8F0', fontSize: 13 }}>
                  {Array.from({ length: 48 }, (_, s) => (
                    <option key={s} value={s}>
                      {String(Math.floor(s/2)).padStart(2,'0')}h{s%2?'30':'00'}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={applyAddRange} disabled={qStart > qEnd}
                style={{ background: qStart > qEnd ? '#94A3B8' : myColor.bg,
                         color: 'white', border: 'none', borderRadius: 8,
                         padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
                Ajouter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit / Scroll toggle */}
      {!locked && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button onClick={() => setEditMode(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
                     background: editMode ? myColor.bg : '#F1F5F9',
                     color: editMode ? 'white' : '#64748B',
                     border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>
            {editMode ? '✏️ Édition' : '☰ Scroll'}
          </button>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 14, padding: 8,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <AgendaView
          year={year} month={month}
          getSlotState={getSlotState}
          onSlotPointerDown={locked || !editMode ? undefined : handlePointerDown}
          onSlotPointerEnter={locked || !editMode ? undefined : handlePointerEnter}
          onSlotPointerUp={locked || !editMode ? undefined : handlePointerUp}
          controlledView={agendaView} onViewChange={setAgendaView}
          controlledDay={agendaDay}   onDayChange={setAgendaDay}
        />
      </div>

      {showTemplate && (
        <TemplatePanel
          member={member}
          year={year} month={month}
          myColor={myColor}
          onClose={() => setShowTemplate(false)}
        />
      )}
    </div>
  );
}
