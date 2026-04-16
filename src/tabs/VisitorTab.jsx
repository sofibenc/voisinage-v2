import { useState, useCallback, useMemo } from 'react';
import { useReservations } from '../hooks/useReservations.js';
import { useMembers }      from '../hooks/useMembers.js';
import { useUsageStats }   from '../hooks/useUsageStats.js';
import AgendaView          from '../components/AgendaView/AgendaView.jsx';
import { MONTHS } from '../constants.js';
import { SLOTS_PER_DAY }   from '../utils/slots.js';

function fmtStart(s) { return `${String(Math.floor(s/2)).padStart(2,'0')}h${s%2?'30':'00'}`; }
function fmtEnd(s)   { return s === 47 ? '24h00' : fmtStart(s + 1); }

export default function VisitorTab({ member, operationalMode = false }) {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { assignments, claimRange, releaseRange } = useReservations(member?.uid, year, month);
  const { members, colorOf } = useMembers();
  // Stats always anchored to today, not the selected month
  const { stats } = useUsageStats(members, now.getFullYear(), now.getMonth());

  const myColor = colorOf(member?.uid);
  const nameOf  = useMemo(() => {
    const map = Object.fromEntries(members.map(m => [m.uid, m.name || '?']));
    return uid => map[uid] ?? '?';
  }, [members]);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDay = (year === now.getFullYear() && month === now.getMonth()) ? now.getDate() : 1;

  // Range form state
  const [showStats, setShowStats] = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [rangeMode, setRangeMode] = useState('add'); // 'add' | 'remove'
  const [qDay,      setQDay]      = useState(todayDay);
  const [qDayEnd,   setQDayEnd]   = useState(todayDay);
  const [qStart,    setQStart]    = useState(0);
  const [qEnd,      setQEnd]      = useState(47);
  const [formError,  setFormError]  = useState(null);

  // Agenda state
  const [agendaView,      setAgendaView]      = useState('Mois');
  const [agendaDay,       setAgendaDay]       = useState(todayDay);
  const [agendaWeekStart, setAgendaWeekStart] = useState(null);

  // Click-to-book / click-to-cancel modals
  const [clickedSlotRange, setClickedSlotRange] = useState(null); // { day, startSlot, endSlot }
  const [cancelSlotRange,  setCancelSlotRange]  = useState(null); // { day, startSlot, endSlot }
  const [clickError,       setClickError]       = useState(null);

  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const canGoNext = new Date(year, month + 1) < maxDate;
  const canGoPrev = new Date(year, month) > new Date(2026, 0); // limit: January 2026

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
    if (isInactive) { setFormError('Compte inactif — contactez un administrateur.'); return; }
    const endDay  = Math.max(qDay, qDayEnd);
    const fromSlot = (qDay - 1) * SLOTS_PER_DAY + qStart;
    const toSlot   = (endDay - 1) * SLOTS_PER_DAY + qEnd;

    if (operationalMode && !member?.isAdmin) {
      const cur = currentDaySlotOffset();
      if (cur >= 0 && fromSlot < cur) {
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


  const isInactive = member && member.isActive === false && !member.isAdmin;

  return (
    <div>
      {/* Inactive account banner */}
      {isInactive && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10,
                      padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400E' }}>
          <strong>Compte inactif</strong> — Votre compte n'est pas encore activé. Contactez un administrateur pour pouvoir effectuer des réservations.
        </div>
      )}
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prevMonth} disabled={!canGoPrev}
          style={{ border: 'none', background: '#F1F5F9', borderRadius: 8,
                   padding: '8px 14px', fontSize: 22, lineHeight: 1,
                   color: canGoPrev ? '#1E293B' : '#CBD5E1' }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} disabled={!canGoNext}
          style={{ border: 'none', background: '#F1F5F9', borderRadius: 8,
                   padding: '8px 14px', fontSize: 22, lineHeight: 1,
                   color: canGoNext ? '#1E293B' : '#CBD5E1' }}>›</button>
      </div>

      {/* Usage stats table — collapsible, always anchored to today */}
      {stats.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, marginBottom: 12,
                      boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <button onClick={() => setShowStats(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                     padding: '10px 12px', border: 'none', background: 'none',
                     fontSize: 13, fontWeight: 700, color: '#1E293B', cursor: 'pointer' }}>
            <span>📊 Consommation des voisins</span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{showStats ? '▲' : '▼'}</span>
          </button>
          {showStats && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px',
                            fontSize: 11, fontWeight: 700, color: '#94A3B8',
                            padding: '6px 12px', borderTop: '1px solid #F1F5F9',
                            textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <span>Voisin</span>
                <span style={{ textAlign: 'right' }}>M</span>
                <span style={{ textAlign: 'right' }}>M-1</span>
                <span style={{ textAlign: 'right' }}>+7J</span>
              </div>
              {stats.filter(s => s.isActive).map(s => (
                <div key={s.uid} style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px',
                                          padding: '8px 12px', fontSize: 13,
                                          borderTop: '1px solid #F8FAFC',
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
                  <span style={{ textAlign: 'right', color: s.monthPastHours > 0 ? '#475569' : '#CBD5E1',
                                 fontWeight: s.monthPastHours > 0 ? 600 : 400, fontSize: 12 }}>
                    {s.monthPastHours > 0 ? `${s.monthPastHours % 1 === 0 ? s.monthPastHours : s.monthPastHours.toFixed(1)}h` : '—'}
                  </span>
                  <span style={{ textAlign: 'right', color: s.lastMonthHours > 0 ? '#475569' : '#CBD5E1',
                                 fontWeight: s.lastMonthHours > 0 ? 600 : 400, fontSize: 12 }}>
                    {s.lastMonthHours > 0 ? `${s.lastMonthHours % 1 === 0 ? s.lastMonthHours : s.lastMonthHours.toFixed(1)}h` : '—'}
                  </span>
                  <span style={{ textAlign: 'right', color: s.next7Hours > 0 ? s.color.text : '#CBD5E1',
                                 fontWeight: s.next7Hours > 0 ? 700 : 400, fontSize: 12 }}>
                    {s.next7Hours > 0 ? `${s.next7Hours % 1 === 0 ? s.next7Hours : s.next7Hours.toFixed(1)}h` : '—'}
                  </span>
                </div>
              ))}
              {/* Legend */}
              <div style={{ display: 'flex', gap: 12, padding: '8px 12px',
                            borderTop: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
                {[
                  { label: 'M', desc: 'Ce mois-ci (passé)' },
                  { label: 'M-1', desc: 'Mois dernier' },
                  { label: '+7J', desc: '7 prochains jours' },
                ].map(({ label, desc }) => (
                  <span key={label} style={{ fontSize: 11, color: '#94A3B8' }}>
                    <strong style={{ color: '#64748B' }}>{label}</strong> = {desc}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Add/Remove range form */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setShowForm(v => {
          if (!v) {
            const weekStart = agendaWeekStart ?? agendaDay;
            const weekEnd   = Math.min(daysInMonth, weekStart + 6);
            const d  = agendaView === 'Semaine' ? weekStart : agendaDay;
            const d2 = agendaView === 'Semaine' ? weekEnd   : agendaDay;
            setQDay(d); setQDayEnd(d2); setFormError(null);
          }
          return !v;
        })}
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
                           background: rangeMode === mode ? (mode === 'add' ? '#10B981' : '#EF4444') : '#F1F5F9',
                           color: rangeMode === mode ? 'white' : '#64748B' }}>
                  {mode === 'add' ? '+ Réservation' : '− Annulation'}
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
            <button onClick={applyForm} disabled={qDayEnd === qDay && qStart > qEnd}
              style={{ background: qDayEnd === qDay && qStart > qEnd ? '#94A3B8' : rangeMode === 'remove' ? '#EF4444' : '#10B981',
                       color: 'white', border: 'none', borderRadius: 8,
                       padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
              {rangeMode === 'remove' ? 'Annuler la réservation' : 'Réserver'}
            </button>
          </div>
        )}
      </div>


      {/* Calendar */}
      <div style={{ background: 'white', borderRadius: 14, padding: 8,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <AgendaView
          year={year} month={month}
          getSlotState={getSlotState}
          controlledView={agendaView} onViewChange={setAgendaView}
          controlledDay={agendaDay}   onDayChange={setAgendaDay}
          onWeekStartChange={setAgendaWeekStart}
          onSlotClick={sid => {
            const owner = assignments[String(sid)];
            const day   = Math.floor(sid / SLOTS_PER_DAY) + 1;
            const base  = (day - 1) * SLOTS_PER_DAY;
            const s     = sid % SLOTS_PER_DAY;
            setClickError(null);
            if (!owner) {
              // Free slot → book
              let startSlot = s;
              while (startSlot > 0 && !assignments[String(base + startSlot - 1)]) startSlot--;
              let endSlot = s;
              while (endSlot < SLOTS_PER_DAY - 1 && !assignments[String(base + endSlot + 1)]) endSlot++;
              setClickedSlotRange({ day, startSlot, endSlot });
            } else if (owner === member?.uid) {
              // My slot → cancel
              let startSlot = s;
              while (startSlot > 0 && assignments[String(base + startSlot - 1)] === member?.uid) startSlot--;
              let endSlot = s;
              while (endSlot < SLOTS_PER_DAY - 1 && assignments[String(base + endSlot + 1)] === member?.uid) endSlot++;
              setCancelSlotRange({ day, startSlot, endSlot });
            }
          }}
        />
      </div>

      {/* Month legend */}
      {agendaView === 'Mois' && (() => {
        const uids = [...new Set(Object.values(assignments))];
        if (uids.length === 0) return null;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '10px 4px 2px' }}>
            {uids.map(uid => (
              <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                               background: colorOf(uid)?.bg }} />
                {nameOf(uid)}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Click-to-book modal */}
      {clickedSlotRange !== null && (() => {
        const { day, startSlot, endSlot } = clickedSlotRange;
        return (
          <ClickModal
            day={day} month={month} startSlot={startSlot} endSlot={endSlot}
            accentBg={myColor.bg} error={clickError}
            onClose={() => { setClickedSlotRange(null); setClickError(null); }}
            onApply={async (fromSlot, toSlot) => {
              setClickError(null);
              if (isInactive) { setClickError('Compte inactif — contactez un administrateur.'); return; }
              if (operationalMode && !member?.isAdmin) {
                const cur = currentDaySlotOffset();
                if (cur >= 0 && fromSlot < cur) {
                  setClickError('Mode opérationnel : impossible de modifier des créneaux passés.');
                  return;
                }
              }
              try {
                await claimRange(fromSlot, toSlot);
                setAgendaDay(day);
                setClickedSlotRange(null);
              } catch (e) {
                if (e.message === 'OVERLAP') setClickError("Cette plage est déjà réservée par quelqu'un d'autre.");
                else if (e.message === 'MAX_CONSECUTIVE_DAYS') setClickError('Vous ne pouvez pas réserver plus de 2 jours consécutifs.');
                else setClickError('Erreur : ' + e.message);
              }
            }}
          />
        );
      })()}

      {/* Click-to-cancel modal */}
      {cancelSlotRange !== null && (() => {
        const { day, startSlot, endSlot } = cancelSlotRange;
        return (
          <ClickModal
            day={day} month={month} startSlot={startSlot} endSlot={endSlot}
            accentBg="#EF4444" cancelMode error={clickError}
            onClose={() => { setCancelSlotRange(null); setClickError(null); }}
            onApply={async (fromSlot, toSlot) => {
              setClickError(null);
              if (isInactive) { setClickError('Compte inactif — contactez un administrateur.'); return; }
              if (operationalMode && !member?.isAdmin) {
                const cur = currentDaySlotOffset();
                if (cur >= 0 && fromSlot < cur) {
                  setClickError('Mode opérationnel : impossible de modifier des créneaux passés.');
                  return;
                }
              }
              try {
                await releaseRange(fromSlot, toSlot);
                setAgendaDay(day);
                setCancelSlotRange(null);
              } catch (e) {
                setClickError('Erreur : ' + e.message);
              }
            }}
          />
        );
      })()}
    </div>
  );
}

function ClickModal({ day, month, startSlot, endSlot, accentBg, cancelMode = false, error, onClose, onApply }) {
  const [mStart, setMStart] = useState(startSlot);
  const [mEnd,   setMEnd]   = useState(endSlot);
  const base = (day - 1) * SLOTS_PER_DAY;
  const disabled = mStart > mEnd;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                  zIndex: 50, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, padding: 20, maxWidth: 360, width: '100%' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {cancelMode ? 'Annuler' : 'Réserver'} — {day} {MONTHS[month]}
          </div>
          <button onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {/* Time range */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#64748B', width: 24 }}>De</label>
          <select value={mStart} onChange={e => setMStart(Number(e.target.value))}
            style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
            {Array.from({ length: 48 }, (_, s) => <option key={s} value={s}>{fmtStart(s)}</option>)}
          </select>
          <label style={{ fontSize: 12, color: '#64748B' }}>à</label>
          <select value={mEnd} onChange={e => setMEnd(Number(e.target.value))}
            style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
            {Array.from({ length: 48 }, (_, s) => <option key={s} value={s}>{fmtEnd(s)}</option>)}
          </select>
        </div>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                        padding: '8px 10px', fontSize: 12, color: '#DC2626', marginBottom: 10 }}>
            {error}
          </div>
        )}
        <button onClick={() => onApply(base + mStart, base + mEnd)} disabled={disabled}
          style={{ width: '100%', background: disabled ? '#94A3B8' : accentBg,
                   color: 'white', border: 'none', borderRadius: 8,
                   padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
          {cancelMode ? '− Annuler la réservation' : '+ Réserver'}
        </button>
      </div>
    </div>
  );
}
