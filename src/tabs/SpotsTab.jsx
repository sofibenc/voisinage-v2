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
                     modeLabels = ['+ Ajouter', '− Supprimer'],
                     defaultDay = 1, defaultDayEnd = 1,
                     defaultStart = 0, defaultEnd = 47,
                     hideDayRange = false,
                     confirmMessage = 'Supprimer les disponibilités de cette plage ?' }) {
  const [rangeMode, setRangeMode] = useState(modes[0]);
  const [qDay,    setQDay]    = useState(defaultDay);
  const [qDayEnd, setQDayEnd] = useState(defaultDayEnd);
  const [qStart,  setQStart]  = useState(defaultStart);
  const [qEnd,    setQEnd]    = useState(defaultEnd);

  function apply() {
    if (rangeMode === 'remove' && !window.confirm(confirmMessage)) return;
    const endDay   = Math.max(qDay, qDayEnd);
    const fromSlot = (qDay - 1) * SLOTS_PER_DAY + qStart;
    const toSlot   = (endDay - 1) * SLOTS_PER_DAY + qEnd;
    onApply(rangeMode, fromSlot, toSlot, qDay);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Mode toggle — hidden when only one mode */}
      {modes.length > 1 && (
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
      )}
      {/* Day range */}
      {!hideDayRange && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
      </div>}
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

// ── Back button ──────────────────────────────────────────────────────────────
function BackButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      background: 'white', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '12px 16px', marginBottom: 10, cursor: 'pointer',
      fontSize: 14, fontWeight: 600, color: '#475569',
    }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>←</span>
      Retour à la liste
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SpotsTab({ member, operationalMode = false, onOpenProfile }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const mk = monthKey(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const { mySpot, otherSpots, availability, loading: spotsLoading, ensureMySpot, mergeMySlots, clearMyRange, claimNeighborRange, releaseNeighborRange } = useSpots(member?.uid, year, month);
  const { colorOf, members } = useMembers();

  // view: 'main' | 'myspot' | 'neighbor'
  const [view,             setView]             = useState('main');
  const [neighborSpotId,   setNeighborSpotId]   = useState(null);
  const [showRangeForm,    setShowRangeForm]     = useState(false);
  const [agendaView,       setAgendaView]        = useState('Mois');
  const [agendaDay,        setAgendaDay]         = useState(now.getDate());
  const [agendaWeekStart,  setAgendaWeekStart]   = useState(null);
  const [clickedSlotRange, setClickedSlotRange]  = useState(null); // { day, startSlot, endSlot }
  const [cancelSlotRange,  setCancelSlotRange]   = useState(null); // { day, startSlot, endSlot }
  const [myAddSlotRange,   setMyAddSlotRange]    = useState(null); // myspot: add avail
  const [myRemoveSlotRange,setMyRemoveSlotRange] = useState(null); // myspot: remove avail
  const [showNeighborForm, setShowNeighborForm]  = useState(false);
  const [neighborFormKey,  setNeighborFormKey]   = useState(0);
  const [neighborError,    setNeighborError]     = useState(null);
  const [mySpotError,      setMySpotError]       = useState(null);
  const [pendingRange,     setPendingRange]      = useState(null);

  const isInactive = member && member.isActive === false && !member.isAdmin;
  const InactiveBanner = () => isInactive ? (
    <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400E' }}>
      <strong>Compte inactif</strong> — Votre compte n'est pas encore activé. Contactez un administrateur pour pouvoir effectuer des réservations.
    </div>
  ) : null;

  const minDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const canGoPrev = new Date(year, month) > minDate;
  function prevMonth() { if (!canGoPrev) return; if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); }

  function isPast(sid) {
    if (!operationalMode || member?.isAdmin) return false;
    const n = new Date();
    const ny = n.getFullYear(), nm = n.getMonth();
    if (year < ny || (year === ny && month < nm)) return true;
    if (year > ny || (year === ny && month > nm)) return false;
    const cur = (n.getDate() - 1) * SLOTS_PER_DAY + n.getHours() * 2 + (n.getMinutes() >= 30 ? 1 : 0);
    return sid < cur;
  }

  // ── My spot availability getSlotState ────────────────────────────────────
  const myAvail = mySpot ? (availability[mySpot.id] ?? { slots: [], taken: {} }) : { slots: [], taken: {} };
  const myColor = colorOf(member?.uid);

  const getMySlotState = useCallback(sid => {
    const takerUid = myAvail.taken?.[String(sid)];
    if (takerUid) {
      const takerColor = colorOf(takerUid);
      const takerName  = members.find(m => m.uid === takerUid)?.name ?? '?';
      return { state: 'other', color: takerColor, label: takerName };
    }
    if (myAvail.slots?.includes(sid)) return { state: 'available', color: null, label: '✦' };
    return { state: 'empty', color: null, label: '' };
  }, [myAvail, colorOf, members]);

  // ── Neighbor spot getSlotState ───────────────────────────────────────────
  const neighborAvail = neighborSpotId ? (availability[neighborSpotId] ?? { slots: [], taken: {} }) : null;

  const neighborOwnerColor = neighborSpotId
    ? colorOf(otherSpots.find(s => s.id === neighborSpotId)?.ownerUid)
    : null;

  const getNeighborSlotState = useCallback(sid => {
    if (!neighborAvail) return { state: 'empty', color: null, label: '' };
    const takenBy = neighborAvail.taken?.[String(sid)];
    if (takenBy) {
      const c = colorOf(takenBy);
      return { state: takenBy === member?.uid ? 'mine' : 'other', color: c, label: '' };
    }
    if (neighborAvail.slots?.includes(sid)) return { state: 'available', color: neighborOwnerColor, label: '✦' };
    return { state: 'empty', color: null, label: '' };
  }, [neighborAvail, member, colorOf, neighborOwnerColor]);

  // ── Handle range apply (my spot) ─────────────────────────────────────────
  async function handleRangeApply(mode, fromSlot, toSlot, qDay) {
    setMySpotError(null);
    if (isPast(fromSlot)) {
      setMySpotError('Impossible de modifier des créneaux passés.');
      return;
    }
    if (mode === 'add' && !member?.spotNumber?.trim()) {
      setPendingRange({ mode, fromSlot, toSlot, qDay });
      return;
    }
    await executeRangeApply(mode, fromSlot, toSlot, qDay);
  }

  async function executeRangeApply(mode, fromSlot, toSlot, qDay) {
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
  const mySlotCount    = myAvail.slots?.length ?? 0;
  const myReserverUids = new Set(Object.values(myAvail.taken ?? {}));
  const myReserverCount = myReserverUids.size;

  // ── Back button ───────────────────────────────────────────────────────────
  function goBack() { setView('main'); setNeighborSpotId(null); setShowRangeForm(false); setShowNeighborForm(false); setNeighborError(null); }

  async function handleNeighborRangeApply(mode, fromSlot, toSlot, qDay) {
    setNeighborError(null);
    if (isInactive) { setNeighborError('Compte inactif — contactez un administrateur.'); return; }
    if (isPast(fromSlot)) {
      setNeighborError('Impossible de modifier des créneaux passés.');
      return;
    }
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
      <button onClick={prevMonth} disabled={!canGoPrev}
        style={{ border: 'none', background: '#F1F5F9', borderRadius: 8,
                 padding: '8px 14px', fontSize: 22, lineHeight: 1,
                 color: canGoPrev ? '#1E293B' : '#CBD5E1' }}>‹</button>
      <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
        {MONTHS[month]} {year}
      </span>
      <button onClick={nextMonth}
        style={{ border: 'none', background: '#F1F5F9', borderRadius: 8,
                 padding: '8px 14px', fontSize: 22, lineHeight: 1, color: '#1E293B' }}>›</button>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: my spot editor
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'myspot') return (
    <div>
      <MonthNav />
      <BackButton onClick={goBack} />
      <InactiveBanner />

      {/* Range form toggle */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => { setShowRangeForm(v => !v); setMySpotError(null); }}
          style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0',
                   borderRadius: showRangeForm ? '10px 10px 0 0' : 10,
                   padding: '9px 12px', fontSize: 13, color: '#475569',
                   display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>± Ajouter / Supprimer une plage de disponibilité</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{showRangeForm ? '▲' : '▼'}</span>
        </button>
        {showRangeForm && (
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none',
                        borderRadius: '0 0 10px 10px', padding: '12px 12px 14px',
                        display: 'flex', flexDirection: 'column', gap: 10 }}>
            <RangeForm
              daysInMonth={daysInMonth} month={month}
              accentBg={AMBER.bg}
              onApply={handleRangeApply}
            />
            {mySpotError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                            padding: '8px 10px', fontSize: 12, color: '#DC2626' }}>
                ⚠️ {mySpotError}
              </div>
            )}
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
          onSlotClick={sid => {
            if (isPast(sid)) return;
            const day  = Math.floor(sid / SLOTS_PER_DAY) + 1;
            const base = (day - 1) * SLOTS_PER_DAY;
            const s    = sid % SLOTS_PER_DAY;
            if (myAvail.taken?.[String(sid)]) return; // reserved by a neighbor, can't touch
            if (myAvail.slots?.includes(sid)) {
              // My available slot → remove
              let startSlot = s;
              while (startSlot > 0 && myAvail.slots.includes(base + startSlot - 1) && !myAvail.taken?.[String(base + startSlot - 1)]) startSlot--;
              let endSlot = s;
              while (endSlot < SLOTS_PER_DAY - 1 && myAvail.slots.includes(base + endSlot + 1) && !myAvail.taken?.[String(base + endSlot + 1)]) endSlot++;
              setMyRemoveSlotRange({ day, startSlot, endSlot });
            } else {
              // Empty slot → add
              const isEmpty = i => !myAvail.slots?.includes(base + i);
              let startSlot = s;
              while (startSlot > 0 && isEmpty(startSlot - 1)) startSlot--;
              let endSlot = s;
              while (endSlot < SLOTS_PER_DAY - 1 && isEmpty(endSlot + 1)) endSlot++;
              setMyAddSlotRange({ day, startSlot, endSlot });
            }
          }}
        />
      </div>

      {/* Click-to-add modal */}
      {myAddSlotRange !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      zIndex: 50, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 20 }}
          onClick={() => setMyAddSlotRange(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 20, maxWidth: 360, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Proposer — {myAddSlotRange.day} {MONTHS[month]}</div>
              <button onClick={() => setMyAddSlotRange(null)}
                style={{ border: 'none', background: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <RangeForm
              key={`myadd-${myAddSlotRange.day}-${myAddSlotRange.startSlot}`}
              daysInMonth={daysInMonth} month={month}
              accentBg={AMBER.bg}
              modes={['add']}
              modeLabels={['+ Proposer ce créneau']}
              defaultDay={myAddSlotRange.day}
              defaultDayEnd={myAddSlotRange.day}
              defaultStart={myAddSlotRange.startSlot}
              defaultEnd={myAddSlotRange.endSlot}
              hideDayRange
              onApply={async (_mode, fromSlot, toSlot, qDay) => {
                const spotId = mySpot?.id ?? await ensureMySpot(`Place de ${member?.name ?? 'moi'}`);
                await mergeMySlots(spotId, buildSlotList(fromSlot, toSlot));
                setAgendaDay(qDay);
                setMyAddSlotRange(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Click-to-remove modal */}
      {myRemoveSlotRange !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      zIndex: 50, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 20 }}
          onClick={() => setMyRemoveSlotRange(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 20, maxWidth: 360, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Retirer — {myRemoveSlotRange.day} {MONTHS[month]}</div>
              <button onClick={() => setMyRemoveSlotRange(null)}
                style={{ border: 'none', background: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <RangeForm
              key={`myremove-${myRemoveSlotRange.day}-${myRemoveSlotRange.startSlot}`}
              daysInMonth={daysInMonth} month={month}
              accentBg="#EF4444"
              modes={['remove']}
              modeLabels={['− Retirer la disponibilité']}
              defaultDay={myRemoveSlotRange.day}
              defaultDayEnd={myRemoveSlotRange.day}
              defaultStart={myRemoveSlotRange.startSlot}
              defaultEnd={myRemoveSlotRange.endSlot}
              hideDayRange
              confirmMessage="Retirer la disponibilité de cette plage ?"
              onApply={async (_mode, fromSlot, toSlot, qDay) => {
                const spotId = mySpot?.id;
                if (spotId) await clearMyRange(spotId, fromSlot, toSlot);
                setAgendaDay(qDay);
                setMyRemoveSlotRange(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Popup avertissement numéro de place manquant */}
      {pendingRange !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      zIndex: 50, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 20 }}
          onClick={() => setPendingRange(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 20,
                        maxWidth: 340, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
              Tu n'as pas de N° de place
            </div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18, lineHeight: 1.5 }}>
              Les voisins ne verront pas ton numéro de place. Ils auront du mal à te trouver.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { setPendingRange(null); onOpenProfile?.(); }}
                style={{ width: '100%', padding: '11px 0', background: '#0F172A', color: 'white',
                         border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                         cursor: 'pointer' }}>
                Renseigner mon N°
              </button>
              <button
                onClick={async () => {
                  const { mode, fromSlot, toSlot, qDay } = pendingRange;
                  setPendingRange(null);
                  await executeRangeApply(mode, fromSlot, toSlot, qDay);
                }}
                style={{ width: '100%', padding: '10px 0', background: '#F1F5F9', color: '#475569',
                         border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
                         cursor: 'pointer' }}>
                Continuer quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Month legend — reservers only (available slots are plain green, no colored dot) */}
      {agendaView === 'Mois' && (() => {
        const takerUids = [...new Set(Object.values(myAvail.taken ?? {}))].filter(uid => members.find(m => m.uid === uid));
        if (takerUids.length === 0) return null;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '10px 4px 2px' }}>
            {takerUids.map(uid => (
              <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                               background: colorOf(uid)?.bg }} />
                {members.find(m => m.uid === uid)?.name ?? '?'}
              </div>
            ))}
          </div>
        );
      })()}
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
        <MonthNav />
        <BackButton onClick={goBack} />
        <InactiveBanner />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ownerColor?.bg }} />
          <div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Place de {owner?.name ?? '?'}</span>
            {owner?.spotNumber && (
              <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 6 }}>· N° {owner.spotNumber}</span>
            )}
          </div>
        </div>

        {/* Range form */}
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => { setShowNeighborForm(v => !v); setNeighborError(null); setNeighborFormKey(k => k + 1); }}
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
                key={neighborFormKey}
                daysInMonth={daysInMonth} month={month}
                accentBg="#16A34A"
                onApply={handleNeighborRangeApply}
                modeLabels={['+ Réserver', '− Annuler']}
                modes={['add', 'remove']}
                confirmMessage="Annuler ma réservation sur cette plage ?"
                defaultDay={agendaView === 'Jour' ? agendaDay
                  : agendaView === 'Semaine' ? (agendaWeekStart ?? agendaDay)
                  : 1}
                defaultDayEnd={agendaView === 'Jour' ? agendaDay
                  : agendaView === 'Semaine' ? Math.min(daysInMonth, (agendaWeekStart ?? agendaDay) + 6)
                  : 1}
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
            onWeekStartChange={setAgendaWeekStart}
            onSlotClick={sid => {
              if (isInactive) return;
              if (isPast(sid)) return;
              const day  = Math.floor(sid / SLOTS_PER_DAY) + 1;
              const base = (day - 1) * SLOTS_PER_DAY;
              const s    = sid % SLOTS_PER_DAY;
              const takenBy = neighborAvail?.taken?.[String(sid)];
              if (takenBy === member?.uid) {
                // My reservation → cancel
                const isMine = i => neighborAvail?.taken?.[String(base + i)] === member?.uid;
                let startSlot = s;
                while (startSlot > 0 && isMine(startSlot - 1)) startSlot--;
                let endSlot = s;
                while (endSlot < SLOTS_PER_DAY - 1 && isMine(endSlot + 1)) endSlot++;
                setNeighborError(null);
                setCancelSlotRange({ day, startSlot, endSlot });
              } else if (neighborAvail?.slots?.includes(sid) && !takenBy) {
                // Free slot → book
                const isFree = i => (neighborAvail.slots ?? []).includes(base + i) && !neighborAvail.taken?.[String(base + i)];
                let startSlot = s;
                while (startSlot > 0 && isFree(startSlot - 1)) startSlot--;
                let endSlot = s;
                while (endSlot < SLOTS_PER_DAY - 1 && isFree(endSlot + 1)) endSlot++;
                setClickedSlotRange({ day, startSlot, endSlot });
              }
            }}
          />
        </div>

        {/* Month legend — visible only in Mois view */}
        {agendaView === 'Mois' && (() => {
          const items = [];
          const hasAvailable = (neighborAvail?.slots ?? []).some(s => !neighborAvail?.taken?.[String(s)]);
          if (hasAvailable) items.push({ color: ownerColor, name: owner?.name ?? '?', isAvailable: true });
          const takerUids = [...new Set(Object.values(neighborAvail?.taken ?? {}))].filter(uid => members.find(m => m.uid === uid));
          for (const uid of takerUids) {
            items.push({ color: colorOf(uid), name: members.find(m => m.uid === uid)?.name ?? '?', isAvailable: false });
          }
          if (items.length === 0) return null;
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px',
                          padding: '10px 4px 2px' }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background:   item.isAvailable ? 'transparent' : item.color?.bg,
                    border:       item.isAvailable ? `2px solid ${item.color?.bg}` : 'none',
                  }} />
                  {item.name}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Click-to-book modal: range form pre-filled with the day's available range */}
        {clickedSlotRange !== null && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                        zIndex: 50, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: 20 }}
            onClick={() => setClickedSlotRange(null)}>
            <div style={{ background: 'white', borderRadius: 16, padding: 20, maxWidth: 360, width: '100%' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Réserver — Place de {owner?.name ?? '?'}</div>
                <button onClick={() => setClickedSlotRange(null)}
                  style={{ border: 'none', background: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <RangeForm
                key={`clicked-${clickedSlotRange.day}-${clickedSlotRange.startSlot}`}
                daysInMonth={daysInMonth} month={month}
                accentBg="#16A34A"
                modes={['add']}
                modeLabels={['+ Réserver']}
                defaultDay={clickedSlotRange.day}
                defaultDayEnd={clickedSlotRange.day}
                defaultStart={clickedSlotRange.startSlot}
                defaultEnd={clickedSlotRange.endSlot}
                hideDayRange
                onApply={async (_mode, fromSlot, toSlot, qDay) => {
                  setNeighborError(null);
                  if (isInactive) { setNeighborError('Compte inactif — contactez un administrateur.'); return; }
                  try {
                    await claimNeighborRange(neighborSpotId, fromSlot, toSlot);
                    setAgendaDay(qDay);
                    setClickedSlotRange(null);
                  } catch (e) {
                    if (e.message === 'OVERLAP') setNeighborError('Chevauchement : un créneau est déjà réservé par quelqu\'un d\'autre.');
                    else if (e.message === 'UNAVAILABLE') setNeighborError('Créneau non disponible : le propriétaire n\'a pas ouvert cette plage.');
                    else setNeighborError('Erreur inattendue, réessaie.');
                  }
                }}
              />
              {neighborError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                              padding: '8px 10px', fontSize: 12, color: '#DC2626', marginTop: 10 }}>
                  ⚠️ {neighborError}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Click-to-cancel modal */}
        {cancelSlotRange !== null && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                        zIndex: 50, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: 20 }}
            onClick={() => setCancelSlotRange(null)}>
            <div style={{ background: 'white', borderRadius: 16, padding: 20, maxWidth: 360, width: '100%' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Annuler — Place de {owner?.name ?? '?'}</div>
                <button onClick={() => setCancelSlotRange(null)}
                  style={{ border: 'none', background: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <RangeForm
                key={`cancel-${cancelSlotRange.day}-${cancelSlotRange.startSlot}`}
                daysInMonth={daysInMonth} month={month}
                accentBg="#EF4444"
                modes={['remove']}
                modeLabels={['− Annuler la réservation']}
                confirmMessage="Annuler ma réservation sur cette plage ?"
                defaultDay={cancelSlotRange.day}
                defaultDayEnd={cancelSlotRange.day}
                defaultStart={cancelSlotRange.startSlot}
                defaultEnd={cancelSlotRange.endSlot}
                hideDayRange
                onApply={async (_mode, fromSlot, toSlot, qDay) => {
                  setNeighborError(null);
                  if (isInactive) { setNeighborError('Compte inactif — contactez un administrateur.'); return; }
                  try {
                    await releaseNeighborRange(neighborSpotId, fromSlot, toSlot);
                    setAgendaDay(qDay);
                    setCancelSlotRange(null);
                  } catch (e) {
                    setNeighborError('Erreur inattendue, réessaie.');
                  }
                }}
              />
              {neighborError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                              padding: '8px 10px', fontSize: 12, color: '#DC2626', marginTop: 10 }}>
                  ⚠️ {neighborError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW: main
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <MonthNav />
      <InactiveBanner />

      {/* Mes propositions */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8',
                    letterSpacing: '0.05em', marginBottom: 8 }}>
        MES PROPOSITIONS
      </div>
      <button onClick={() => setView('myspot')}
        style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0',
                 borderRadius: 12, padding: '12px 16px', fontSize: 14,
                 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                 marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔑</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, color: AMBER.text }}>Ma place</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>
              {mySlotCount > 0
                ? `${mySlotCount / 2}h proposées${myReserverCount > 0 ? ` · ${myReserverCount} voisin${myReserverCount > 1 ? 's' : ''} a réservé` : ''}`
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

      {spotsLoading ? (
        <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 20,
                      textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          Chargement…
        </div>
      ) : visibleOtherSpots.length === 0 ? (
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
                    {owner?.spotNumber && (
                      <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 6 }}>
                        · N° {owner.spotNumber}
                      </span>
                    )}
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
