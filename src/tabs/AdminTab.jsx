import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { settingsDoc, setDeadline, scheduleDoc, unpublishSchedule } from '../firebase.js';
import { useMembers } from '../hooks/useMembers.js';
import { useSchedule } from '../hooks/useSchedule.js';
import { monthKey, MONTHS } from '../constants.js';

function defaultDeadline(year, month) {
  // Last day of previous month
  const d = new Date(year, month, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminTab({ member }) {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const mk = monthKey(year, month);
  const isPastMonth = new Date(year, month + 1, 0) < new Date(now.getFullYear(), now.getMonth(), 1);

  const { schedule, publishing, forcePublish } = useSchedule(year, month);
  const { members } = useMembers();

  const [deadline, setDeadlineInput] = useState('');

  useEffect(() => {
    return onSnapshot(settingsDoc(), snap => {
      const s = snap.exists() ? snap.data() : {};
      setDeadlineInput(s.deadlines?.[mk] ?? defaultDeadline(year, month));
    });
  }, [mk]);

  async function saveDeadline() {
    await setDeadline(mk, deadline);
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ border: 'none', background: 'none', fontSize: 20 }}>›</button>
      </div>

      {/* Deadline */}
      <div style={{ background: 'white', borderRadius: 14, padding: 16,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>DEADLINE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={deadline}
            onChange={e => setDeadlineInput(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8,
                     border: '1px solid #E2E8F0', fontSize: 14 }} />
          <button onClick={saveDeadline}
            style={{ background: '#1E293B', color: 'white', border: 'none',
                     borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600 }}>
            Enregistrer
          </button>
        </div>
      </div>

      {/* Schedule status */}
      {schedule && (
        <div style={{ background: 'white', borderRadius: 14, padding: 16,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>PLANNING PUBLIÉ</div>
          <div style={{ fontSize: 13, color: '#166534', marginBottom: 12 }}>
            ✓ Publié · Quota : {schedule.quotaHours}h/voisin
          </div>
          {/* Fairness per member */}
          {members.map(m => {
            const dev = schedule.fairness?.[m.uid] ?? 0;
            return (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center',
                                        gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%',
                               background: m.color.bg }} />
                <span style={{ flex: 1, fontSize: 13 }}>{m.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600,
                                color: dev >= 0 ? '#166534' : '#DC2626' }}>
                  {dev >= 0 ? '+' : ''}{dev}h
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!schedule && (
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16,
                      textAlign: 'center', color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
          Planning non encore publié pour ce mois.
        </div>
      )}

      {schedule && !isPastMonth && (
        <button onClick={() => unpublishSchedule(mk)}
          style={{ width: '100%', background: '#FEF2F2', color: '#DC2626', border: '2px solid #FECACA',
                   borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          Dépublier le planning
        </button>
      )}

      {!schedule && !isPastMonth && (
        <button onClick={forcePublish} disabled={publishing}
          style={{ width: '100%', background: publishing ? '#94A3B8' : '#1E293B',
                   color: 'white', border: 'none', borderRadius: 12,
                   padding: '14px 0', fontSize: 15, fontWeight: 700 }}>
          {publishing ? 'Publication en cours…' : 'Publier maintenant'}
        </button>
      )}
    </div>
  );
}
