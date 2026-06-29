export function buildNotifPayload(name) {
  const displayName = name || 'Nouveau voisin';
  return {
    notification: {
      title: 'Voisinage',
      body: `Nouveau voisin en attente — ${displayName} demande à rejoindre`,
    },
    webpush: {
      notification: { icon: '/icon-192.png' },
    },
  };
}

// memberDocs: Array<{ ref, fcmToken?: string, ... }>
// Retourne uniquement les éléments ayant un fcmToken valide (index-stable pour cleanup FCM)
export function adminsWithTokens(memberDocs) {
  return memberDocs.filter(m => m.fcmToken);
}
