import { useState, useCallback } from 'react';
import { useSpots }   from '../hooks/useSpots.js';
import { useMembers } from '../hooks/useMembers.js';
import AgendaView     from '../components/AgendaView/AgendaView.jsx';
import { MONTHS } from '../constants.js';

export default function SpotsTab({ member }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [confirmSlot,  setConfirmSlot]  = useState(null);

  const { spots, availability, addSpot, toggleSpotSlot, claimSlot } = useSpots(year, month);
  const { colorOf } = useMembers();

  const spot = spots.find(s => s.id === selectedSpot);
  const avail = selectedSpot ? availability[selectedSpot] : null;
  const isOwner = spot?.ownerUid === member?.uid;

  const getSlotState = useCallback((sid) => {
    if (!avail) return { state: 'empty', color: null, label: '' };
    const takenBy = avail.taken?.[String(sid)];
    if (takenBy) {
      const color = colorOf(takenBy);
      return { state: takenBy === member?.uid ? 'mine' : 'other', color, label: '' };
    }
    if (avail.slots?.includes(sid)) return { state: 'available', color: null, label: '' };
    return { state: 'empty', color: null, label: '' };
  }, [avail, member, colorOf]);

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>›</button>
      </div>

      {/* Spot list */}
      {!selectedSpot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {spots.map(s => (
            <button key={s.id} onClick={() => setSelectedSpot(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                       background: 'white', borderRadius: 12, border: '1px solid #E2E8F0',
                       textAlign: 'left' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {availability[s.id]?.slots?.length ?? 0} créneaux disponibles ce mois
                </div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#94A3B8' }}>›</span>
            </button>
          ))}
          {member?.isAdmin && (
            <button onClick={() => addSpot(member.uid, `Place de ${member.name}`, '#457B9D')}
              style={{ padding: 14, background: '#F1F5F9', borderRadius: 12,
                       border: '2px dashed #CBD5E1', fontSize: 13, color: '#64748B' }}>
              + Ajouter ma place
            </button>
          )}
        </div>
      )}

      {/* Spot detail */}
      {selectedSpot && spot && (
        <div>
          <button onClick={() => setSelectedSpot(null)}
            style={{ border: 'none', background: 'none', fontSize: 14,
                     color: '#64748B', marginBottom: 10 }}>
            ← Retour
          </button>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{spot.name}</div>

          {isOwner && (
            <div style={{ background: '#EFF6FF', borderRadius: 10, padding: 10,
                          fontSize: 12, color: '#1D4ED8', marginBottom: 10 }}>
              Propriétaire — appuyez sur un créneau pour le rendre disponible ou l'enlever.
            </div>
          )}

          <div style={{ background: 'white', borderRadius: 14, padding: 8,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <AgendaView year={year} month={month}
              getSlotState={getSlotState}
              onSlotClick={sid => {
                if (isOwner) { toggleSpotSlot(selectedSpot, sid, member.uid); }
                else if (avail?.slots?.includes(sid) && !avail?.taken?.[String(sid)]) {
                  setConfirmSlot(sid);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Confirm claim */}
      {confirmSlot !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      zIndex: 50, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%' }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Prendre ce créneau ?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmSlot(null)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0',
                         background: 'white', fontSize: 14 }}>Annuler</button>
              <button onClick={() => { claimSlot(selectedSpot, confirmSlot, member.uid); setConfirmSlot(null); }}
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
