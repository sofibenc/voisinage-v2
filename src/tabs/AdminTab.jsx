import { useState, useEffect, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { settingsDoc, setSubtitle, setOperationalMode,
         claimReservationRange, releaseReservationRange, reservationDoc,
         deleteMember, setMemberAdmin, setMemberActive, upsertMember } from '../firebase.js';
import { useMembers } from '../hooks/useMembers.js';
import { useUsageStats } from '../hooks/useUsageStats.js';
import AgendaView from '../components/AgendaView/AgendaView.jsx';
import { MONTHS, monthKey } from '../constants.js';
import { SLOTS_PER_DAY } from '../utils/slots.js';

function fmtStart(s) { return `${String(Math.floor(s/2)).padStart(2,'0')}h${s%2?'30':'00'}`; }
function fmtEnd(s)   { return s === 47 ? '24h00' : fmtStart(s + 1); }

const SUPERADMIN_EMAIL = 'sofibenc@gmail.com';

export default function AdminTab({ member }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { members, colorOf } = useMembers();
  const { stats }            = useUsageStats(members, now.getFullYear(), now.getMonth());
  const nameOf = uid => members.find(m => m.uid === uid)?.name ?? uid.slice(0, 6);

  const [subtitle,        setSubtitleInput]  = useState('');
  const [operationalMode, setOperationalModeState] = useState(false);
  const [editingName,     setEditingName]    = useState(null); // { uid, value }

  // Visitor calendar state
  const mk = monthKey(year, month);
  const [assignments,   setAssignments]   = useState({});
  const [agendaView,    setAgendaView]    = useState('Mois');
  const [agendaDay,     setAgendaDay]     = useState(now.getDate());
  const [editModal,     setEditModal]     = useState(null); // { day, startSlot, endSlot, mode:'add'|'remove', ownerUid? }
  const [editError,     setEditError]     = useState(null);

  useEffect(() => {
    return onSnapshot(reservationDoc(mk), snap => {
      setAssignments(snap.exists() ? (snap.data().assignments ?? {}) : {});
    });
  }, [mk]);

  const getSlotState = useCallback(sid => {
    const owner = assignments[String(sid)];
    if (!owner) return { state: 'empty', color: null, label: '' };
    const color = colorOf(owner);
    return { state: 'other', color, label: nameOf(owner) };
  }, [assignments, colorOf, members]);

  useEffect(() => {
    return onSnapshot(settingsDoc(), snap => {
      const data = snap.exists() ? snap.data() : {};
      setSubtitleInput(data.subtitle ?? '');
      setOperationalModeState(data.operationalMode ?? false);
    });
  }, []);

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div>
      {/* Subtitle */}
      <div style={{ background: 'white', borderRadius: 14, padding: 16,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>NOM DE LA RÉSIDENCE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={subtitle} onChange={e => setSubtitleInput(e.target.value)}
            placeholder="Ex : Résidence Karma"
            maxLength={40}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8,
                     border: '1px solid #E2E8F0', fontSize: 14 }} />
          <button onClick={() => setSubtitle(subtitle.trim())}
            style={{ background: '#1E293B', color: 'white', border: 'none',
                     borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600 }}>
            OK
          </button>
        </div>
      </div>

      {/* Member management */}
      <div style={{ background: 'white', borderRadius: 14, padding: 16,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>GESTION DES MEMBRES</div>
        {members.length === 0 && (
          <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>Aucun membre.</div>
        )}
        {members.map(m => (
          <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                           background: m.color.bg }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingName?.uid === m.uid ? (
                <input
                  autoFocus
                  value={editingName.value}
                  onChange={e => setEditingName({ uid: m.uid, value: e.target.value })}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      await upsertMember(m.uid, { name: editingName.value.trim() });
                      setEditingName(null);
                    } else if (e.key === 'Escape') {
                      setEditingName(null);
                    }
                  }}
                  onBlur={async () => {
                    await upsertMember(m.uid, { name: editingName.value.trim() });
                    setEditingName(null);
                  }}
                  style={{ fontSize: 13, fontWeight: 500, border: '1px solid #CBD5E1',
                           borderRadius: 6, padding: '2px 6px', width: '100%' }}
                />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => setEditingName({ uid: m.uid, value: m.name || '' })}>
                  {m.name || m.uid.slice(0, 8)} <span style={{ fontSize: 10, color: '#CBD5E1' }}>✎</span>
                </div>
              )}
              {m.email && <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>}
            </div>
            {/* Active toggle — masqué pour le superadmin */}
            {m.email !== SUPERADMIN_EMAIL && (
              <button
                onClick={() => {
                  if (m.isActive && !window.confirm(`Désactiver ${m.name || m.uid.slice(0, 8)} ?`)) return;
                  setMemberActive(m.uid, !m.isActive);
                }}
                style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, border: 'none',
                         borderRadius: 6, cursor: 'pointer',
                         background: m.isActive ? '#D1FAE5' : '#FEE2E2',
                         color: m.isActive ? '#065F46' : '#DC2626' }}>
                {m.isActive ? '✓ Actif' : 'Inactif'}
              </button>
            )}
            {/* Admin toggle — masqué pour le superadmin */}
            {m.email !== SUPERADMIN_EMAIL && (
              <button
                onClick={() => {
                  if (m.isAdmin && !window.confirm(`Révoquer les droits admin de ${m.name || m.uid.slice(0, 8)} ?`)) return;
                  setMemberAdmin(m.uid, !m.isAdmin);
                }}
                style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, border: 'none',
                         borderRadius: 6, cursor: 'pointer',
                         background: m.isAdmin ? '#1E293B' : '#F1F5F9',
                         color: m.isAdmin ? 'white' : '#64748B' }}>
                {m.isAdmin ? '★ Admin' : 'Admin'}
              </button>
            )}
            {/* Delete — masqué pour le superadmin */}
            {m.email !== SUPERADMIN_EMAIL && (
              <button
                onClick={() => {
                  if (window.confirm(`Supprimer ${m.name || m.uid.slice(0, 8)} ?`))
                    deleteMember(m.uid);
                }}
                style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, border: 'none',
                         borderRadius: 6, cursor: 'pointer',
                         background: '#FEE2E2', color: '#DC2626' }}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Operational mode toggle */}
      <div style={{ background: 'white', borderRadius: 14, padding: 16,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>MODE OPÉRATIONNEL</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, color: '#475569' }}>
            {operationalMode
              ? 'Actif — les voisins ne peuvent pas modifier les réservations passées.'
              : 'Inactif — les voisins peuvent modifier librement.'}
          </div>
          <button onClick={() => setOperationalMode(!operationalMode)}
            style={{ flexShrink: 0, padding: '8px 16px', fontSize: 13, fontWeight: 700,
                     border: 'none', borderRadius: 8,
                     background: operationalMode ? '#166534' : '#E2E8F0',
                     color: operationalMode ? 'white' : '#64748B' }}>
            {operationalMode ? '✓ Actif' : 'Inactif'}
          </button>
        </div>
      </div>

      {/* Visitor calendar — admin can add/remove any slot for any member */}
      <div style={{ background: 'white', borderRadius: 14, padding: 12,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>
          🏢 PLACE VISITEUR — GESTION ADMIN
        </div>
        <AgendaView
          year={year} month={month}
          getSlotState={getSlotState}
          controlledView={agendaView} onViewChange={setAgendaView}
          controlledDay={agendaDay}   onDayChange={setAgendaDay}
          onSlotClick={sid => {
            const day  = Math.floor(sid / SLOTS_PER_DAY) + 1;
            const base = (day - 1) * SLOTS_PER_DAY;
            const s    = sid % SLOTS_PER_DAY;
            const owner = assignments[String(sid)];
            if (owner) {
              // Taken → remove: find contiguous block of same owner
              let startSlot = s;
              while (startSlot > 0 && assignments[String(base + startSlot - 1)] === owner) startSlot--;
              let endSlot = s;
              while (endSlot < SLOTS_PER_DAY - 1 && assignments[String(base + endSlot + 1)] === owner) endSlot++;
              setEditError(null);
              setEditModal({ day, startSlot, endSlot, mode: 'remove', ownerUid: owner });
            } else {
              // Empty → add: find contiguous free block
              let startSlot = s;
              while (startSlot > 0 && !assignments[String(base + startSlot - 1)]) startSlot--;
              let endSlot = s;
              while (endSlot < SLOTS_PER_DAY - 1 && !assignments[String(base + endSlot + 1)]) endSlot++;
              setEditError(null);
              setEditModal({ day, startSlot, endSlot, mode: 'add', ownerUid: null });
            }
          }}
        />
      </div>

      {/* Edit modal */}
      {editModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      zIndex: 50, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 20 }}
          onClick={() => { setEditModal(null); setEditError(null); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 20,
                        maxWidth: 360, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <AdminEditForm
              modal={editModal} month={month} mk={mk}
              members={members}
              error={editError} setError={setEditError}
              onClose={() => { setEditModal(null); setEditError(null); }}
              onDone={day => { setAgendaDay(day); setEditModal(null); setEditError(null); }}
            />
          </div>
        </div>
      )}

      {/* Usage stats per month */}
      <div style={{ background: 'white', borderRadius: 14, padding: 16,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={prevMonth}
            style={{ border: 'none', background: 'none', fontSize: 20, color: '#1E293B' }}>‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth}
            style={{ border: 'none', background: 'none', fontSize: 20, color: '#1E293B' }}>›</button>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>
          CONSOMMATION VOISINS
        </div>
        {stats.length === 0 && (
          <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>Aucun voisin.</div>
        )}
        {stats.map(s => (
          <div key={s.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%',
                          background: s.color.bg, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13 }}>{s.name || s.uid.slice(0, 6)}</span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>ce mois</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
              {s.monthPastHours > 0 ? `${s.monthPastHours % 1 === 0 ? s.monthPastHours : s.monthPastHours.toFixed(1)}h` : '—'}
            </span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>mois dernier</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
              {s.lastMonthHours > 0 ? `${s.lastMonthHours % 1 === 0 ? s.lastMonthHours : s.lastMonthHours.toFixed(1)}h` : '—'}
            </span>
            {s.next7Hours > 0 && (
              <span style={{ fontSize: 12, color: s.color.text, fontWeight: 600 }}>
                +{s.next7Hours % 1 === 0 ? s.next7Hours : s.next7Hours.toFixed(1)}h à venir
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminEditForm({ modal, month, mk, members, error, setError, onClose, onDone }) {
  const { day, startSlot, endSlot, mode } = modal;
  const base = (day - 1) * SLOTS_PER_DAY;
  const [mStart,    setMStart]    = useState(startSlot);
  const [mEnd,      setMEnd]      = useState(endSlot);
  const [targetUid, setTargetUid] = useState(mode === 'remove' ? modal.ownerUid : (members[0]?.uid ?? ''));

  const disabled = mStart > mEnd;

  async function apply() {
    setError(null);
    try {
      if (mode === 'remove') {
        await releaseReservationRange(mk, base + mStart, base + mEnd, targetUid);
      } else {
        await claimReservationRange(mk, base + mStart, base + mEnd, targetUid);
      }
      onDone(day);
    } catch (e) {
      if (e.message === 'OVERLAP') setError('Chevauchement : un créneau est déjà pris.');
      else setError('Erreur : ' + e.message);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {mode === 'add' ? 'Ajouter' : 'Supprimer'} — {day} {MONTHS[month]}
        </div>
        <button onClick={onClose}
          style={{ border: 'none', background: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      {/* Voisin selector */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: '#64748B', width: 50, flexShrink: 0 }}>Voisin</label>
        <select value={targetUid} onChange={e => setTargetUid(e.target.value)}
          style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
          {members.map(m => (
            <option key={m.uid} value={m.uid}>{m.name || m.uid.slice(0, 6)}</option>
          ))}
        </select>
      </div>

      {/* Time range */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: '#64748B', width: 50, flexShrink: 0 }}>De</label>
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

      <button onClick={apply} disabled={disabled}
        style={{ width: '100%', background: disabled ? '#94A3B8' : mode === 'remove' ? '#EF4444' : '#1E293B',
                 color: 'white', border: 'none', borderRadius: 8,
                 padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
        {mode === 'add' ? '+ Ajouter la réservation' : '− Supprimer la réservation'}
      </button>
    </>
  );
}
