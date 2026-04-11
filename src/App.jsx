import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { loginWithGoogle } from './firebase.js';
import WishTab       from './tabs/WishTab.jsx';
import PlanningTab   from './tabs/PlanningTab.jsx';
import SpotsTab      from './tabs/SpotsTab.jsx';
import AdminTab      from './tabs/AdminTab.jsx';
import ProfileModal  from './components/ProfileModal.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const TABS = [
  { id: 'wish',     label: '✋ Souhaits' },
  { id: 'planning', label: '📅 Planning' },
  { id: 'spots',    label: '🔑 Places' },
];

export default function App() {
  const { user, member, refreshMember } = useAuth();
  const [tab, setTab] = useState('wish');
  const [authError, setAuthError] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  // Reset profile modal when user logs out
  useEffect(() => { if (!user) setShowProfile(false); }, [user]);

  async function handleLogin() {
    try {
      setAuthError(null);
      await loginWithGoogle();
    } catch (e) {
      setAuthError(e.code ?? e.message);
    }
  }

  if (user === undefined) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>Chargement…</div>
  );

  if (!user) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Voisinage</h1>
      <p style={{ color: '#64748B' }}>Parking partagé entre voisins</p>
      <button onClick={handleLogin}
        style={{ background: '#1E293B', color: 'white', border: 'none',
                 borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 600 }}>
        Connexion avec Google
      </button>
      {authError && (
        <div style={{ color: '#DC2626', fontSize: 13, maxWidth: 320, textAlign: 'center' }}>
          Erreur : {authError}
        </div>
      )}
    </div>
  );

  const tabs = member?.isAdmin ? [...TABS, { id: 'admin', label: '⚙️ Admin' }] : TABS;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh',
                  display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0',
                    background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.svg" alt="Voisinage" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span style={{ fontWeight: 700, fontSize: 17 }}>Voisinage</span>
        </div>
        <button onClick={() => setShowProfile(true)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                   display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#64748B' }}>
            {member?.name || user.displayName}
          </span>
          {member?.photoURL
            ? <img src={member.photoURL} alt="" referrerPolicy="no-referrer"
                   style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E2E8F0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16 }}>👤</div>
          }
        </button>
      </div>

      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #E2E8F0' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '10px 4px', fontSize: 12, fontWeight: 600,
                     border: 'none', background: 'none',
                     borderBottom: tab === t.id ? '2px solid #1E293B' : '2px solid transparent',
                     color: tab === t.id ? '#1E293B' : '#94A3B8' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto' }}>
        <ErrorBoundary>
          {tab === 'wish'     && <WishTab member={member} />}
          {tab === 'planning' && <PlanningTab member={member} />}
          {tab === 'spots'    && <SpotsTab member={member} />}
          {tab === 'admin'    && member?.isAdmin && <AdminTab member={member} />}
        </ErrorBoundary>
      </div>

      {showProfile && member && (
        <ProfileModal
          member={member}
          onSaved={refreshMember}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
