import { useState, useCallback, useRef } from 'react';
import { useWishlist }  from '../hooks/useWishlist.js';
import { useSchedule }  from '../hooks/useSchedule.js';
import { useMembers }   from '../hooks/useMembers.js';
import AgendaView       from '../components/AgendaView/AgendaView.jsx';
import { MONTHS, monthKey } from '../constants.js';

export default function WishTab({ member }) {
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const mk = monthKey(year, month);

  const { slots, toggleSlot, setSlotRange, clearAll } = useWishlist(member?.uid, mk);
  const { schedule, deadline, isDeadlinePassed }      = useSchedule(year, month);
  const { colorOf } = useMembers();
  const myColor = colorOf(member?.uid);

  const [showTemplate, setShowTemplate] = useState(false);

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
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
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
      <div style={{ background: 'white', borderRadius: 14, padding: 8,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <AgendaView
          year={year} month={month}
          getSlotState={getSlotState}
          onSlotPointerDown={locked ? undefined : handlePointerDown}
          onSlotPointerEnter={locked ? undefined : handlePointerEnter}
          onSlotPointerUp={locked ? undefined : handlePointerUp}
        />
      </div>

      {/* Template modal placeholder — implemented in Task 11 */}
      {showTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                      zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0',
                        padding: 20, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Template</h2>
              <button onClick={() => setShowTemplate(false)}
                style={{ background: 'none', border: 'none', fontSize: 22 }}>×</button>
            </div>
            <p style={{ color: '#94A3B8', fontSize: 13 }}>
              Template panel — à implémenter en Task 11
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
