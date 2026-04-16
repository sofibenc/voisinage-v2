import { useState, useEffect, useRef } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { spotsCol, membersCol, clearSpotUnread } from '../firebase.js';

export function useNotificationBadges(uid, isAdmin) {
  const [spotsBadge, setSpotsBadge] = useState(0);
  const [adminBadge, setAdminBadge]  = useState(0);
  const mySpotIdRef = useRef(null);

  // Badge "Place Voisin" : unreadClaims sur ma place
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(spotsCol(), snap => {
      const mySpot = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                              .find(s => s.ownerUid === uid);
      mySpotIdRef.current = mySpot?.id ?? null;
      setSpotsBadge(mySpot?.unreadClaims ?? 0);
    });
  }, [uid]);

  // Badge admin : membres inactifs en attente d'activation
  useEffect(() => {
    if (!uid || !isAdmin) return;
    return onSnapshot(membersCol(), snap => {
      const pending = snap.docs.filter(d => d.data().isActive === false).length;
      setAdminBadge(pending);
    });
  }, [uid, isAdmin]);

  function clearSpotBadge() {
    if (mySpotIdRef.current) clearSpotUnread(mySpotIdRef.current);
  }

  return { spotsBadge, adminBadge, clearSpotBadge };
}
