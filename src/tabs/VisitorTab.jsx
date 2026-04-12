import { useState, useCallback, useMemo } from 'react';
import { useReservations } from '../hooks/useReservations.js';
import { useMembers }      from '../hooks/useMembers.js';
import { useUsageStats }   from '../hooks/useUsageStats.js';
import AgendaView          from '../components/AgendaView/AgendaView.jsx';
import { MONTHS, monthKey } from '../constants.js';
import { SLOTS_PER_DAY }   from '../utils/slots.js';

function fmtStart(s) { return `${String(Math.floor(s/2)).padStart(2,'0')}h${s%2?'30':'00'}`; }
function fmtEnd(s)   { return s === 47 ? '24h00' : fmtStart(s + 1); }

export default function VisitorTab({ member, operationalMode = false }) {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { assignments, claimRange, releaseRange } = useReservations(member?.uid, year, month);
  const { members, colorOf } = useMembers();
  const { stats } = useUsageStats(members, year, month);

  const myColor = colorOf(member?.uid);
  const nameOf  = useMemo(() => {
    const map = Object.fromEntries(members.map(m => [m.uid, m.name || '?']));
    return uid => map[uid] ?? '?';
  }, [members]);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDay = (year === now.getFullYear() && month === now.getMonth()) ? now.getDate() : 1;

  // Range form state
  const [showForm,  setShowForm]  = useState(false);
  const [rangeMode, setRangeMode] = useState('add'); // 'add' | 'remove'
  const [qDay,      setQDay]      = useState(todayDay);
  const [qDayEnd,   setQDayEnd]   = useState(todayDay);
  const [qStart,    setQStart]    = useState(0);
  const [qEnd,      setQEnd]      = useState(47);
  const [formError,  setFormError]  = useState(null);
  const [clearError, setClearError] = useState(null);

  // Agenda state
  const [agendaView,      setAgendaView]      = useState('Semaine');
  const [agendaDay,       setAgendaDay]       = useState(todayDay);
  const [agendaWeekStart, setAgendaWeekStart] = useState(null);

  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const canGoNext = new Date(year, month + 1) < maxDate;
  const canGoPrev = new Date(year, month) > new Date(now.getFullYear(), now.getMonth());

  function prevMonth() {
    const nm = month === 0 ? 11 : month - 1;
    const ny = month === 0 ? year - 1 : year;
    if (month === 0) setYear(y => y - 1);
    setMonth(nm);
    const d = (ny === now.getFullYear() && nm === now.getMonth()) ? now.getDate() : 1;
    setQDay(d); setQDayEnd(d); setAgendaDay(d);
  }
  function nextMonth() {
    if (!canGoNext) return;
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    if (month === 11) setYear(y => y + 1);
    setMonth(nm);
    const d = (ny === now.getFullYear() && nm === now.getMonth()) ? now.getDate() : 1;
    setQDay(d); setQDayEnd(d); setAgendaDay(d);
  }

  // Current half-hour slot index
  function nowSlot() {
    const n = new Date();
    return (n.getHours() * 2) + (n.getMinutes() >= 30 ? 1 : 0);
  }
  function currentDaySlotOffset() {
    // absolute slot index for "now" within the month
    const n = new Date();
    if (n.getFullYear() !== year || n.getMonth() !== month) return -1;
    return (n.getDate() - 1) * SLOTS_PER_DAY + nowSlot();
  }

  async function applyForm() {
    setFormError(null);
    const endDay  = Math.max(qDay, qDayEnd);
    const fromSlot = (qDay - 1) * SLOTS_PER_DAY + qStart;
    const toSlot   = (endDay - 1) * SLOTS_PER_DAY + qEnd;

    if (operationalMode && !member?.isAdmin) {
      const cur = currentDaySlotOffset();
      if (cur >= 0 && fromSlot <= cur) {
        setFormError('Mode opérationnel : impossible de modifier des créneaux passés.');
        return;
      }
    }
    try {
      if (rangeMode === 'remove') {
        if (!window.confirm('Annuler les réservations de cette plage ?')) return;
        await releaseRange(fromSlot, toSlot);
      } else {
        await claimRange(fromSlot, toSlot);
      }
      setAgendaDay(qDay);
      setShowForm(false);
    } catch (e) {
      if (e.message === 'OVERLAP') {
        setFormError("Cette plage est déjà réservée par quelqu'un d'autre.");
      } else if (e.message === 'MAX_CONSECUTIVE_DAYS') {
        setFormError('Vous ne pouvez pas réserver plus de 2 jours consécutifs.');
      } else {
        setFormError('Erreur : ' + e.message);
      }
    }
  }

  // Slot coloring
  const getSlotState = useCallback(sid => {
    const owner = assignments[String(sid)];
    if (!owner) return { state: 'empty', color: null, label: '' };
    const color = colorOf(owner);
    const isMe  = owner === member?.uid;
    return { state: isMe ? 'mine' : 'other', color, label: nameOf(owner) };
  }, [assignments, colorOf, nameOf, member?.uid]);

  // Clear scope (for current view)
  function getClearScope() {
    if (agendaView === 'Jour') {
      const from = (agendaDay - 1) * SLOTS_PER_DAY;
      const to   = from + SLOTS_PER_DAY - 1;
      const has  = Object.entries(assignments).some(([sid, uid]) => {
        const s = Number(sid); return uid === member?.uid && s >= from && s <= to;
      });
      return { label: `Annuler mes réservations du ${agendaDay} ${MONTHS[month]}`, action: () => releaseRange(from, to), has, from };
    }
    if (agendaView === 'Semaine') {
      const startDay = agendaWeekStart ?? (() => { const dow = (new Date(year, month, agendaDay).getDay() + 6) % 7; return Math.max(1, agendaDay - dow); })();
      const endDay   = Math.min(daysInMonth, startDay + 6);
      const from     = (startDay - 1) * SLOTS_PER_DAY;
      const to       = (endDay - 1) * SLOTS_PER_DAY + SLOTS_PER_DAY - 1;
      const has      = Object.entries(assignments).some(([sid, uid]) => {
        const s = Number(sid); return uid === member?.uid && s >= from && s <= to;
      });
      return { label: `Annuler sem. du ${startDay} au ${endDay} ${MONTHS[month]}`, action: () => releaseRange(from, to), has, from };
    }
    const hasAny = Object.values(assignments).some(uid => uid === member?.uid);
    return hasAny ? { label: `Annuler toutes mes réservations de ${MONTHS[month]}`, action: () => releaseRange(0, daysInMonth * SLOTS_PER_DAY - 1), has: true, from: 0 } : null;
  }

  const clearScope = getClearScope();

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

      {/* Usage stats table */}
      {stats.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, marginBottom: 12,
                      boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px',
                        fontSize: 11, fontWeight: 700, color: '#94A3B8',
                        padding: '8px 12px', borderBottom: '1px solid #F1F5F9',
                        textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Voisin</span>
            <span style={{ textAlign: 'right' }}>Total consommé</span>
            <span style={{ textAlign: 'right' }}>7 prochains jours</span>
          </div>
          {stats.map(s => (
            <div key={s.uid} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px',
                                      padding: '8px 12px', fontSize: 13,
                                      borderBottom: '1px solid #F8FAFC',
                                      background: s.uid === member?.uid ? s.color.light : 'white' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%',
                               background: s.color.bg, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontWeight: s.uid === member?.uid ? 700 : 400,
                               color: s.uid === member?.uid ? s.color.text : '#1E293B' }}>
                  {s.name || s.uid.slice(0, 6)}
                  {s.uid === member?.uid && ' (moi)'}
                </span>
              </span>
              <span style={{ textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                {s.pastHours % 1 === 0 ? s.pastHours : s.pastHours.toFixed(1)}h
              </span>
              <span style={{ textAlign: 'right', color: s.next7Hours > 0 ? s.color.text : '#CBD5E1',
                             fontWeight: s.next7Hours > 0 ? 700 : 400 }}>
                {s.next7Hours > 0 ? `${s.next7Hours % 1 === 0 ? s.next7Hours : s.next7Hours.toFixed(1)}h` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add/Remove range form */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setShowForm(v => { if (!v) { setQDay(agendaDay); setQDayEnd(agendaDay); setFormError(null); } return !v; })}
          style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0',
                   borderRadius: showForm ? '10px 10px 0 0' : 10,
                   padding: '9px 12px', fontSize: 13, color: '#475569',
                   display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>± Réserver / Annuler une plage horaire</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{showForm ? '▲' : '▼'}</span>
        </button>
        {showForm && (
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none',
                        borderRadius: '0 0 10px 10px', padding: '12px 12px 14px',
                        display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
              {['add', 'remove'].map(mode => (
                <button key={mode} onClick={() => { setRangeMode(mode); setFormError(null); }}
                  style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                           border: 'none', borderRadius: 8,
                           background: rangeMode === mode ? (mode === 'add' ? myColor.bg : '#EF4444') : '#F1F5F9',
                           color: rangeMode === mode ? 'white' : '#64748B' }}>
                  {mode === 'add' ? '+ Réserver' : '− Annuler'}
                </button>
              ))}
            </div>
            {/* Day range */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#64748B', width: 36 }}>Du</label>
              <select value={qDay} onChange={e => { const d = Number(e.target.value); setQDay(d); if (qDayEnd < d) setQDayEnd(d); setFormError(null); }}
                style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d} {MONTHS[month]}</option>
                ))}
              </select>
              <label style={{ fontSize: 12, color: '#64748B' }}>au</label>
              <select value={qDayEnd} onChange={e => { setQDayEnd(Number(e.target.value)); setFormError(null); }}
                style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => d >= qDay).map(d => (
                  <option key={d} value={d}>{d} {MONTHS[month]}</option>
                ))}
              </select>
            </div>
            {/* Time range */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#64748B', width: 36 }}>De</label>
              <select value={qStart} onChange={e => { setQStart(Number(e.target.value)); setFormError(null); }}
                style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
                {Array.from({ length: 48 }, (_, s) => (
                  <option key={s} value={s}>{fmtStart(s)}</option>
                ))}
              </select>
              <label style={{ fontSize: 12, color: '#64748B' }}>à</label>
              <select value={qEnd} onChange={e => { setQEnd(Number(e.target.value)); setFormError(null); }}
                style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
                {Array.from({ length: 48 }, (_, s) => (
                  <option key={s} value={s}>{fmtEnd(s)}</option>
                ))}
              </select>
            </div>
            {formError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                            padding: '8px 10px', fontSize: 12, color: '#DC2626' }}>
                {formError}
              </div>
            )}
            <button onClick={applyForm} disabled={qStart > qEnd}
              style={{ background: qStart > qEnd ? '#94A3B8' : rangeMode === 'remove' ? '#EF4444' : myColor.bg,
                       color: 'white', border: 'none', borderRadius: 8,
                       padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
              {rangeMode === 'remove' ? 'Annuler la réservation' : 'Réserver'}
            </button>
          </div>
        )}
      </div>

      {/* Clear scope button */}
      {clearError && (
        <div style={{ marginBottom: 8, background: '#FEF2F2', border: '1px solid #FECACA',
                      borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#DC2626' }}>
          {clearError}
        </div>
      )}
      {clearScope && (
        <button
          disabled={!clearScope.has}
          onClick={async () => {
            if (operationalMode && !member?.isAdmin) {
              const cur = currentDaySlotOffset();
              if (cur >= 0 && clearScope.from <= cur) {
                setClearError('Mode opérationnel : impossible de modifier des créneaux passés.');
                return;
              }
            }
            if (!window.confirm(clearScope.label + ' ?')) return;
            setClearError(null);
            try { await clearScope.action(); }
            catch (e) { setClearError('Erreur : ' + e.message); }
          }}
          style={{ marginBottom: 10, width: '100%', background: 'white',
                   border: `1px solid ${clearScope.has ? '#FECACA' : '#E2E8F0'}`,
                   borderRadius: 10, padding: '9px 12px', fontSize: 13,
                   color: clearScope.has ? '#DC2626' : '#CBD5E1',
                   fontWeight: 600, cursor: clearScope.has ? 'pointer' : 'default' }}>
          🗑 {clearScope.label}
        </button>
      )}

      {/* Calendar */}
      <div style={{ background: 'white', borderRadius: 14, padding: 8,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <AgendaView
          year={year} month={month}
          getSlotState={getSlotState}
          controlledView={agendaView} onViewChange={setAgendaView}
          controlledDay={agendaDay}   onDayChange={setAgendaDay}
          onWeekStartChange={setAgendaWeekStart}
        />
      </div>
    </div>
  );
}
