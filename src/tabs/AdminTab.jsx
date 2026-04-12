import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { settingsDoc, setSubtitle } from '../firebase.js';
import { useMembers } from '../hooks/useMembers.js';
import { useUsageStats } from '../hooks/useUsageStats.js';
import { MONTHS } from '../constants.js';

export default function AdminTab({ member }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { members } = useMembers();
  const { stats }   = useUsageStats(members, year, month);

  const [subtitle, setSubtitleInput] = useState('');

  useEffect(() => {
    return onSnapshot(settingsDoc(), snap => {
      setSubtitleInput(snap.exists() ? (snap.data().subtitle ?? '') : '');
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
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
              {s.pastHours % 1 === 0 ? s.pastHours : s.pastHours.toFixed(1)}h consommées
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
