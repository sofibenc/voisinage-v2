export default function WelcomeModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  zIndex: 100, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px',
                    maxWidth: 380, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 10, marginBottom: 22 }}>
          <img src="/logo.svg" alt="" style={{ width: 56, height: 56, borderRadius: 14 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#1E293B' }}>Bienvenue sur Voisinage 👋</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
              Le parking partagé entre voisins
            </div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <Section icon="🏢" title="Place visiteur" color="#1E293B">
            Une place partagée, accessible à tous. Réservez les créneaux dont vous avez besoin,
            dans la limite de <strong>2 jours consécutifs</strong>.
          </Section>
          <Section icon="🔑" title="Place Voisin" color="#B45309">
            Si vous avez votre propre place et que vous partez, proposez-la à vos voisins.
            Consultez aussi les places disponibles des autres.
          </Section>
        </div>

        {/* Profile reminder */}
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 12,
                      padding: '12px 14px', marginBottom: 10, fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
          <strong>⚠️ Avant de commencer</strong> — Remplacez votre nom par votre <strong>N° logement</strong> dans votre profil
          (icône en haut à droite). Cela permet aux voisins de vous identifier.
        </div>

        {/* Rules */}
        <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px',
                      marginBottom: 22, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>📋 Règles de bonne conduite</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Respectez le quota de <strong>2 jours consécutifs</strong> max sur la place visiteur</li>
            <li>Annulez vos réservations si vos plans changent</li>
            <li>Soyez équitable — consultez la consommation des voisins</li>
          </ul>
        </div>

        <button onClick={onClose}
          style={{ width: '100%', background: '#1E293B', color: 'white', border: 'none',
                   borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 700,
                   cursor: 'pointer' }}>
          C'est parti !
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, color, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 12px',
                  background: '#F8FAFC', borderRadius: 12,
                  borderLeft: `3px solid ${color}` }}>
      <span style={{ fontSize: 20, lineHeight: 1.3 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}
