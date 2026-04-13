import { useState, useCallback } from 'react';
import { useSpots }   from '../hooks/useSpots.js';
import { useMembers } from '../hooks/useMembers.js';
import AgendaView     from '../components/AgendaView/AgendaView.jsx';
import { MONTHS, monthKey } from '../constants.js';
import { SLOTS_PER_DAY } from '../utils/slots.js';

function fmtStart(s) { return `${String(Math.floor(s/2)).padStart(2,'0')}h${s%2?'30':'00'}`; }
function fmtEnd(s)   { return s === 47 ? '24h00' : fmtStart(s + 1); }

const AMBER = { bg: '#B45309', light: '#FEF3C7', text: '#92400E' };

// ── Range form (reusable) ────────────────────────────────────────────────────
function RangeForm({ daysInMonth, month, accentBg, onApply,
                     modes = ['add', 'remove'],
                     modeLabels = ['+ Ajouter', '− Supprimer'] }) {
  const [rangeMode, setRangeMode] = useState(modes[0]);
  const [qDay,    setQDay]    = useState(1);
  const [qDayEnd, setQDayEnd] = useState(1);
  const [qStart,  setQStart]  = useState(0);
  const [qEnd,    setQEnd]    = useState(47);

  function apply() {
    if (rangeMode === 'remove' && !window.confirm('Supprimer les disponibilités de cette plage ?')) return;
    const endDay   = Math.max(qDay, qDayEnd);
    const fromSlot = (qDay - 1) * SLOTS_PER_DAY + qStart;
    const toSlot   = (endDay - 1) * SLOTS_PER_DAY + qEnd;
    onApply(rangeMode, fromSlot, toSlot, qDay);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {modes.map((mode, i) => (
          <button key={mode} onClick={() => setRangeMode(mode)}
            style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                     border: 'none', borderRadius: 8,
                     background: rangeMode === mode ? (mode === modes[0] ? accentBg : '#EF4444') : '#F1F5F9',
                     color: rangeMode === mode ? 'white' : '#64748B' }}>
            {modeLabels[i]}
          </button>
        ))}
      </div>
      {/* Day range */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#64748B', width: 36 }}>Du</label>
        <select value={qDay} onChange={e => { const d = Number(e.target.value); setQDay(d); if (qDayEnd < d) setQDayEnd(d); }}
          style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{d} {MONTHS[month]}</option>
          ))}
        </select>
        <label style={{ fontSize: 12, color: '#64748B' }}>au</label>
        <select value={qDayEnd} onChange={e => setQDayEnd(Number(e.target.value))}
          style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => d >= qDay).map(d => (
            <option key={d} value={d}>{d} {MONTHS[month]}</option>
          ))}
        </select>
      </div>
      {/* Time range */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#64748B', width: 36 }}>De</label>
        <select value={qStart} onChange={e => setQStart(Number(e.target.value))}
          style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
          {Array.from({ length: 48 }, (_, s) => <option key={s} value={s}>{fmtStart(s)}</option>)}
        </select>
        <label style={{ fontSize: 12, color: '#64748B' }}>à</label>
        <select value={qEnd} onChange={e => setQEnd(Number(e.target.value))}
          style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
          {Array.from({ length: 48 }, (_, s) => <option key={s} value={s}>{fmtEnd(s)}</option>)}
        </select>
      </div>
      <button onClick={apply} disabled={qDayEnd === qDay && qStart > qEnd}
        style={{ background: qDayEnd === qDay && qStart > qEnd ? '#94A3B8' : rangeMode === modes[0] ? accentBg : '#EF4444',
                 color: 'white', border: 'none', borderRadius: 8,
                 padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
        {modeLabels[modes.indexOf(rangeMode)]}
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SpotsTab({ member }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const mk = monthKey(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const { mySpot, otherSpots, availability, ensureMySpot, mergeMySlots, clearMyRange, claimSlot, claimNeighborRange, releaseNeighborRange } = useSpots(member?.uid, year, month);
  const { colorOf, members } = useMembers();

  // view: 'main' | 'myspot' | 'neighbor'
  const [view,             setView]             = useState('main');
  const [neighborSpotId,   setNeighborSpotId]   = useState(null);
  const [showRangeForm,    setShowRangeForm]     = useState(false);
  const [agendaView,       setAgendaView]        = useState('Mois');
  const [agendaDay,        setAgendaDay]         = useState(now.getDate());
  const [agendaWeekStart,  setAgendaWeekStart]   = useState(null);
  const [confirmSlot,      setConfirmSlot]       = useState(null);
  const [showNeighborForm, setShowNeighborForm]  = useState(false);
  const [neighborError,    setNeighborError]     = useState(null);

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); }

  // ── My spot availability getSlotState ────────────────────────────────────
  const myAvail = mySpot ? (availability[mySpot.id] ?? { slots: [], taken: {} }) : { slots: [], taken: {} };
  const myColor = colorOf(member?.uid);

  const getMySlotState = useCallback(sid => {
    if (myAvail.taken?.[String(sid)]) {
      const takerColor = colorOf(myAvail.taken[String(sid)]);
      return { state: 'other', color: takerColor, label: '' };
    }
    if (myAvail.slots?.includes(sid)) return { state: 'available', color: null, label: '✦' };
    return { state: 'empty', color: null, label: '' };
  }, [myAvail, colorOf]);

  // ── Neighbor spot getSlotState ───────────────────────────────────────────
  const neighborAvail = neighborSpotId ? (availability[neighborSpotId] ?? { slots: [], taken: {} }) : null;

  const getNeighborSlotState = useCallback(sid => {
    if (!neighborAvail) return { state: 'empty', color: null, label: '' };
    const takenBy = neighborAvail.taken?.[String(sid)];
    if (takenBy) {
      const c = colorOf(takenBy);
      return { state: takenBy === member?.uid ? 'mine' : 'other', color: c, label: '' };
    }
    if (neighborAvail.slots?.includes(sid)) return { state: 'available', color: null, label: '✦' };
    return { state: 'empty', color: null, label: '' };
  }, [neighborAvail, member, colorOf]);

  // ── Handle range apply (my spot) ─────────────────────────────────────────
  async function handleRangeApply(mode, fromSlot, toSlot, qDay) {
    const spotId = mySpot?.id ?? await ensureMySpot(`Place de ${member?.name ?? 'moi'}`);
    if (mode === 'add') await mergeMySlots(spotId, buildSlotList(fromSlot, toSlot));
    else await clearMyRange(spotId, fromSlot, toSlot);
    setAgendaDay(qDay);
    setShowRangeForm(false);
  }

  function buildSlotList(from, to) {
    const arr = [];
    for (let s = from; s <= to; s++) arr.push(s);
    return arr;
  }

  // ── Filter: other spots with availability this month ──────────────────────
  const visibleOtherSpots = otherSpots.filter(s => {
    const avail = availability[s.id];
    return avail && avail.slots && avail.slots.length > 0;
  });

  // ── My spot info ──────────────────────────────────────────────────────────
  const mySlotCount   = myAvail.slots?.length ?? 0;
  const myTakenCount  = Object.keys(myAvail.taken ?? {}).length;

  // ── Back button ───────────────────────────────────────────────────────────
  function goBack() { setView('main'); setNeighborSpotId(null); setShowRangeForm(false); setShowNeighborForm(false); setNeighborError(null); }

  async function handleNeighborRangeApply(mode, fromSlot, toSlot, qDay) {
    setNeighborError(null);
    try {
      if (mode === 'remove') {
        await releaseNeighborRange(neighborSpotId, fromSlot, toSlot);
      } else {
        await claimNeighborRange(neighborSpotId, fromSlot, toSlot);
      }
      setAgendaDay(qDay);
      setShowNeighborForm(false);
    } catch (e) {
      if (e.message === 'OVERLAP') setNeighborError('Chevauchement : un créneau est déjà réservé par quelqu\'un d\'autre.');
      else if (e.message === 'UNAVAILABLE') setNeighborError('Créneau non disponible : le propriétaire n\'a pas ouvert cette plage.');
      else setNeighborError('Erreur inattendue, réessaie.');
    }
  }

  // ── Month nav (shared) ────────────────────────────────────────────────────
  const MonthNav = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
      <button onClick={prevMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
      <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
        {MONTHS[month]} {year}
      </span>
      <button onClick={nextMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>›</button>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: my spot editor
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'myspot') return (
    <div>
      <button onClick={goBack}
        style={{ border: 'none', background: 'none', fontSize: 14, color: '#64748B', marginBottom: 10 }}>
        ← Retour
      </button>
      <MonthNav />

      {/* Range form toggle */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setShowRangeForm(v => !v)}
          style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0',
                   borderRadius: showRangeForm ? '10px 10px 0 0' : 10,
                   padding: '9px 12px', fontSize: 13, color: '#475569',
                   display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>± Ajouter / Supprimer une plage de disponibilité</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{showRangeForm ? '▲' : '▼'}</span>
        </button>
        {showRangeForm && (
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none',
                        borderRadius: '0 0 10px 10px', padding: '12px 12px 14px' }}>
            <RangeForm
              daysInMonth={daysInMonth} month={month}
              accentBg={AMBER.bg}
              onApply={handleRangeApply}
            />
          </div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: 14, padding: 8,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <AgendaView year={year} month={month}
          getSlotState={getMySlotState}
          controlledView={agendaView} onViewChange={setAgendaView}
          controlledDay={agendaDay}   onDayChange={setAgendaDay}
          onWeekStartChange={setAgendaWeekStart}
        />
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: neighbor spot
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'neighbor') {
    const spot = otherSpots.find(s => s.id === neighborSpotId);
    const owner = members.find(m => m.uid === spot?.ownerUid);
    const ownerColor = colorOf(spot?.ownerUid);
    return (
      <div>
        <button onClick={goBack}
          style={{ border: 'none', background: 'none', fontSize: 14, color: '#64748B', marginBottom: 10 }}>
          ← Retour
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: ownerColor?.bg }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Place de {owner?.name ?? '?'}</span>
        </div>
        <MonthNav />

        {/* Range form */}
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => { setShowNeighborForm(v => !v); setNeighborError(null); }}
            style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0',
                     borderRadius: showNeighborForm ? '10px 10px 0 0' : 10,
                     padding: '9px 12px', fontSize: 13, color: '#475569',
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>± Réserver / Annuler une plage horaire</span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{showNeighborForm ? '▲' : '▼'}</span>
          </button>
          {showNeighborForm && (
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none',
                          borderRadius: '0 0 10px 10px', padding: '12px 12px 14px',
                          display: 'flex', flexDirection: 'column', gap: 10 }}>
              <RangeForm
                daysInMonth={daysInMonth} month={month}
                accentBg="#16A34A"
                onApply={handleNeighborRangeApply}
                modeLabels={['+ Réserver', '− Annuler']}
                modes={['add', 'remove']}
              />
              {neighborError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                              padding: '8px 10px', fontSize: 12, color: '#DC2626' }}>
                  ⚠️ {neighborError}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 14, padding: 8,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <AgendaView year={year} month={month}
            getSlotState={getNeighborSlotState}
            controlledView={agendaView} onViewChange={setAgendaView}
            controlledDay={agendaDay}   onDayChange={setAgendaDay}
            onSlotClick={sid => {
              if (neighborAvail?.slots?.includes(sid) && !neighborAvail?.taken?.[String(sid)]) {
                setConfirmSlot(sid);
              }
            }}
          />
        </div>

        {/* Confirm claim */}
        {confirmSlot !== null && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                        zIndex: 50, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Réserver ce créneau ?</div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                Place de {owner?.name} · {fmtStart(confirmSlot % SLOTS_PER_DAY)}–{fmtEnd(confirmSlot % SLOTS_PER_DAY)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmSlot(null)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0',
                           background: 'white', fontSize: 14 }}>Annuler</button>
                <button onClick={() => { claimSlot(neighborSpotId, confirmSlot); setConfirmSlot(null); }}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none',
                           background: '#1E293B', color: 'white', fontSize: 14, fontWeight: 600 }}>
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: main
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <MonthNav />

      {/* Mes propositions */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8',
                    letterSpacing: '0.05em', marginBottom: 8 }}>
        MES PROPOSITIONS
      </div>
      <button onClick={() => setView('myspot')}
        style={{ width: '100%', background: 'white', border: `1px solid ${AMBER.bg}`,
                 borderRadius: 12, padding: '12px 16px', fontSize: 14,
                 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                 marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔑</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, color: AMBER.text }}>Ma place</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>
              {mySlotCount > 0
                ? `${mySlotCount / 2}h disponibles · ${myTakenCount} réservation${myTakenCount > 1 ? 's' : ''}`
                : 'Aucune disponibilité ce mois'}
            </div>
          </div>
        </div>
        <span style={{ color: '#94A3B8' }}>›</span>
      </button>

      {/* Places disponibles */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8',
                    letterSpacing: '0.05em', marginBottom: 8 }}>
        PLACES DISPONIBLES
      </div>

      {visibleOtherSpots.length === 0 ? (
        <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 20,
                      textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          Aucune place disponible ce mois-ci.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleOtherSpots.map(spot => {
            const avail = availability[spot.id] ?? { slots: [], taken: {} };
            const owner = members.find(m => m.uid === spot.ownerUid);
            const ownerColor = colorOf(spot.ownerUid);
            const freeCount  = avail.slots.filter(s => !avail.taken?.[String(s)]).length;
            return (
              <button key={spot.id}
                onClick={() => { setNeighborSpotId(spot.id); setView('neighbor'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                         background: 'white', borderRadius: 12, border: '1px solid #E2E8F0',
                         textAlign: 'left' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                               background: ownerColor?.bg }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    Place de {owner?.name ?? spot.ownerUid}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>
                    {freeCount / 2}h libres ce mois
                  </div>
                </div>
                <span style={{ color: '#94A3B8' }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
