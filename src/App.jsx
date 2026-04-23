import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useAuth } from './hooks/useAuth.js';
import { loginWithGoogle, settingsDoc } from './firebase.js';
import { onSnapshot } from 'firebase/firestore';
import VisitorTab    from './tabs/VisitorTab.jsx';
import SpotsTab      from './tabs/SpotsTab.jsx';
import AdminTab      from './tabs/AdminTab.jsx';
import ProfileModal  from './components/ProfileModal.jsx';
import WelcomeModal  from './components/WelcomeModal.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useNotificationBadges } from './hooks/useNotificationBadges.js';

// Section accent colors
const VISITOR  = { bg: '#1E293B', light: '#F1F5F9', text: '#1E293B' };
const MYSPOTS  = { bg: '#B45309', light: '#FEF3C7', text: '#92400E' };

export default function App() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(registration) {
      // Vérifie immédiatement à chaque chargement de la page
      registration?.update();
    },
  });
  const { user, member, isFirstLogin } = useAuth();
  const [section,    setSection]    = useState('visitor'); // 'visitor' | 'myspots' | 'admin'
  const [authError,  setAuthError]  = useState(null);
  const [showProfile,  setShowProfile]  = useState(false);
  const [showWelcome,  setShowWelcome]  = useState(false);
  const [subtitle,         setSubtitle]         = useState('');
  const [operationalMode,  setOperationalModeState] = useState(false);
  const { spotsBadge, adminBadge, clearSpotBadge } = useNotificationBadges(
    user?.uid ?? null,
    member?.isAdmin ?? false,
  );

  useEffect(() => { if (!user) setShowProfile(false); }, [user]);
  useEffect(() => {
    if (isFirstLogin) setShowWelcome(true);
  }, [isFirstLogin]);
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

      {/* ── Bandeau mise à jour disponible ── */}
      {needRefresh && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
                      background: '#2563EB', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 12, padding: '10px 16px', fontSize: 13 }}>
          <span>Nouvelle version disponible</span>
          <button onClick={() => updateServiceWorker(true)}
            style={{ background: 'white', color: '#2563EB', border: 'none',
                     borderRadius: 6, padding: '5px 12px', fontSize: 13,
                     fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            Recharger
          </button>
        </div>
      )}

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
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button onClick={() => setSection('admin')}
                style={{ background: section === 'admin' ? '#1E293B' : '#F1F5F9',
                         color: section === 'admin' ? 'white' : '#64748B',
                         border: 'none', borderRadius: 8, padding: '5px 10px',
                         fontSize: 12, fontWeight: 600 }}>
                ⚙️
              </button>
              {adminBadge > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#DC2626', border: '2px solid white',
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          )}
          <button onClick={() => setShowWelcome(true)}
            style={{ background: '#F1F5F9', border: 'none', borderRadius: 8,
                     padding: '5px 10px', fontSize: 12, fontWeight: 600,
                     color: '#64748B', cursor: 'pointer' }}>
            ?
          </button>
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
        <div style={{ flex: 1, position: 'relative', display: 'inline-flex' }}>
          <button onClick={() => { setSection('myspots'); clearSpotBadge(); }}
            style={{ flex: 1, width: '100%', padding: '10px 8px', fontSize: 13, fontWeight: 700,
                     border: 'none', borderRadius: 10,
                     background: section === 'myspots' ? MYSPOTS.bg : MYSPOTS.light,
                     color: section === 'myspots' ? 'white' : MYSPOTS.text }}>
            🔑 Place Voisin
          </button>
          {spotsBadge > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -3,
              width: 10, height: 10, borderRadius: '50%',
              background: '#DC2626', border: '2px solid white',
              pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto' }}>
        <ErrorBoundary>
          {section === 'visitor'  && <VisitorTab member={member} operationalMode={operationalMode} />}
          {section === 'myspots'  && <SpotsTab member={member} operationalMode={operationalMode} onOpenProfile={() => setShowProfile(true)} />}
          {section === 'admin'    && member?.isAdmin && <AdminTab member={member} />}
        </ErrorBoundary>
      </div>

      {showProfile && member && (
        <ProfileModal member={member} onClose={() => setShowProfile(false)} />
      )}
      {showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}
    </div>
  );
}
