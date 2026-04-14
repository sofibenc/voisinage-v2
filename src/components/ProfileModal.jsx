import { useState } from 'react';
import { upsertMember } from '../firebase.js';
import { logout } from '../firebase.js';

export default function ProfileModal({ member, onSaved, onClose }) {
  const [name,        setName]        = useState(member?.name ?? '');
  const [spotNumber,  setSpotNumber]  = useState(member?.spotNumber ?? '');
  const [saving,      setSaving]      = useState(false);

  async function handleSave() {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      await upsertMember(member.uid, { name: name.trim(), spotNumber: spotNumber.trim() });
      await onSaved(member.uid);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)',
                  zIndex: 200, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28,
                    maxWidth: 320, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}
           onClick={e => e.stopPropagation()}>

        {/* Header with avatar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {member?.photoURL
              ? <img src={member.photoURL} alt="" referrerPolicy="no-referrer"
                     style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E2E8F0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 20 }}>👤</div>
            }
            <h2 style={{ fontSize: 17, fontWeight: 900, color: '#0F172A', margin: 0 }}>Mon profil</h2>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>
            ×
          </button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 5 }}>N° logement</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          maxLength={20}
          placeholder="Ton pseudo…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10,
                   border: '1.5px solid #E2E8F0', fontSize: 15, fontWeight: 600,
                   outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
        />

        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 5 }}>
          N° de ta place personnelle{' '}
          <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optionnel)</span>
        </div>
        <input
          value={spotNumber}
          onChange={e => setSpotNumber(e.target.value)}
          maxLength={10}
          placeholder="Ex : 12, B3, sous-sol 4…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10,
                   border: '1.5px solid #E2E8F0', fontSize: 14, fontWeight: 600,
                   outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
        />
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 18 }}>
          💡 Ce numéro sera affiché quand tu proposes ta place aux voisins.
        </div>

        <button onClick={handleSave} disabled={name.trim().length < 2 || saving}
          style={{ width: '100%', padding: 13, background: '#0F172A', color: 'white',
                   border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
                   cursor: 'pointer', marginBottom: 10,
                   opacity: name.trim().length < 2 || saving ? 0.4 : 1 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        <button onClick={logout}
          style={{ width: '100%', padding: 11, background: '#F8FAFC', color: '#64748B',
                   border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 13,
                   fontWeight: 600, cursor: 'pointer' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
