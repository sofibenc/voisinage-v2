import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { auth, upsertMember, memberDoc } from '../firebase.js';

export function useAuth() {
  const [user, setUser]           = useState(undefined); // undefined = loading
  const [member, setMember]       = useState(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    let unsubMember = null;

    const unsubAuth = onAuthStateChanged(auth, async firebaseUser => {
      // Clean up previous member listener on auth change
      if (unsubMember) { unsubMember(); unsubMember = null; }

      if (!firebaseUser) { setUser(null); setMember(null); return; }
      setUser(firebaseUser);

      try {
        // Always sync email + photoURL. Only set name on first login (don't overwrite custom pseudo).
        await upsertMember(firebaseUser.uid, {
          email:    firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });
        // First login: name not yet in Firestore
        const snap = await getDoc(memberDoc(firebaseUser.uid));
        const data = snap.exists() ? snap.data() : {};
        if (!data.name) {
          await upsertMember(firebaseUser.uid, { name: firebaseUser.displayName, isActive: false });
          setIsFirstLogin(true);
        }
      } catch (e) {
        console.error('Firestore member sync failed:', e);
      }

      // Real-time listener: keeps member in sync when admin changes isActive, isAdmin, etc.
      unsubMember = onSnapshot(memberDoc(firebaseUser.uid), snap => {
        if (snap.exists()) setMember({ uid: firebaseUser.uid, ...snap.data() });
      });
    });

    return () => {
      unsubAuth();
      if (unsubMember) unsubMember();
    };
  }, []);

  const refreshMember = useCallback(async (uid) => {
    const snap = await getDoc(memberDoc(uid));
    if (snap.exists()) setMember({ uid, ...snap.data() });
  }, []);

  return { user, member, refreshMember, isFirstLogin };
}
