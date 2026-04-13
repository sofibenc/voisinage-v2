import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { loginWithGoogle, settingsDoc } from './firebase.js';
import { onSnapshot } from 'firebase/firestore';
import VisitorTab    from './tabs/VisitorTab.jsx';
import SpotsTab      from './tabs/SpotsTab.jsx';
import AdminTab      from './tabs/AdminTab.jsx';
import ProfileModal  from './components/ProfileModal.jsx';
import WelcomeModal  from './components/WelcomeModal.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// Section accent colors
const VISITOR  = { bg: '#1E293B', light: '#F1F5F9', text: '#1E293B' };
const MYSPOTS  = { bg: '#B45309', light: '#FEF3C7', text: '#92400E' };

export default function App() {
  const { user, member, refreshMember } = useAuth();
  const [section,    setSection]    = useState('visitor'); // 'visitor' | 'myspots' | 'admin'
  const [authError,  setAuthError]  = useState(null);
  const [showProfile,  setShowProfile]  = useState(false);
  const [showWelcome,  setShowWelcome]  = useState(false);
  const [subtitle,         setSubtitle]         = useState('');
  const [operationalMode,  setOperationalModeState] = useState(false);

  useEffect(() => { if (!user) setShowProfile(false); }, [user]);
  useEffect(() => {
    if (user && !localStorage.getItem('voisinage_welcomed')) setShowWelcome(true);
  }, [user]);
  useEffect(() => {
    return onSnapshot(settingsDoc(), snap => {
      const data = snap.exists() ? snap.data() : {};
      setSubtitle(data.subtitle ?? '');
      setOperationalModeState(data.operationalMode ?? false);
    });
  }, []);

  async function handleLogin() {
    try { setAuthError(null); await loginWithGoogle(); }
    catch (e) { setAuthError(e.code ?? e.message); }
  }

  if (user === undefined) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>Chargement…</div>
  );

  if (!user) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <img src="/logo.svg" alt="" style={{ width: 64, height: 64, borderRadius: 16 }} />
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Voisinage</h1>
      <p style={{ color: '#64748B', margin: 0 }}>Parking partagé entre voisins</p>
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

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh',
                  display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>

      {/* ── Header ── */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', background: 'white',
                    borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.svg" alt="Voisinage" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>Voisinage</div>
            {subtitle && <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.2 }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {member?.isAdmin && (
            <button onClick={() => setSection('admin')}
              style={{ background: section === 'admin' ? '#1E293B' : '#F1F5F9',
                       color: section === 'admin' ? 'white' : '#64748B',
                       border: 'none', borderRadius: 8, padding: '5px 10px',
                       fontSize: 12, fontWeight: 600 }}>
              ⚙️
            </button>
          )}
          <button onClick={() => setShowProfile(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                     display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#64748B' }}>{member?.name || user.displayName}</span>
            {member?.photoURL
              ? <img src={member.photoURL} alt="" referrerPolicy="no-referrer"
                     style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E2E8F0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 16 }}>👤</div>
            }
          </button>
        </div>
      </div>

      {/* ── Section selector ── */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px',
                    background: 'white', borderBottom: '1px solid #E2E8F0' }}>
        <button onClick={() => setSection('visitor')}
          style={{ flex: 1, padding: '10px 8px', fontSize: 13, fontWeight: 700,
                   border: 'none', borderRadius: 10,
                   background: section === 'visitor' ? VISITOR.bg : VISITOR.light,
                   color: section === 'visitor' ? 'white' : VISITOR.text }}>
          🏢 Place visiteur
        </button>
        <button onClick={() => setSection('myspots')}
          style={{ flex: 1, padding: '10px 8px', fontSize: 13, fontWeight: 700,
                   border: 'none', borderRadius: 10,
                   background: section === 'myspots' ? MYSPOTS.bg : MYSPOTS.light,
                   color: section === 'myspots' ? 'white' : MYSPOTS.text }}>
          🔑 Place Voisin
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto' }}>
        <ErrorBoundary>
          {section === 'visitor'  && <VisitorTab member={member} operationalMode={operationalMode} />}
          {section === 'myspots'  && <SpotsTab member={member} />}
          {section === 'admin'    && member?.isAdmin && <AdminTab member={member} />}
        </ErrorBoundary>
      </div>

      {showProfile && member && (
        <ProfileModal member={member} onSaved={refreshMember} onClose={() => setShowProfile(false)} />
      )}
      {showWelcome && (
        <WelcomeModal onClose={() => { localStorage.setItem('voisinage_welcomed', '1'); setShowWelcome(false); }} />
      )}
    </div>
  );
}
