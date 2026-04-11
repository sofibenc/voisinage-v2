import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { auth, upsertMember, memberDoc } from '../firebase.js';

export function useAuth() {
  const [user, setUser]     = useState(undefined); // undefined = loading
  const [member, setMember] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) { setUser(null); setMember(null); return; }
      setUser(firebaseUser);
      const fallback = {
        uid:      firebaseUser.uid,
        name:     firebaseUser.displayName,
        email:    firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        isAdmin:  false,
      };
      setMember(fallback);
      try {
        // Always sync email + photoURL. Only set name on first login (don't overwrite custom pseudo).
        await upsertMember(firebaseUser.uid, {
          email:    firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });
        const snap = await getDoc(memberDoc(firebaseUser.uid));
        const data = snap.exists() ? snap.data() : {};
        // First login: name not yet in Firestore
        if (!data.name) {
          await upsertMember(firebaseUser.uid, { name: firebaseUser.displayName });
          data.name = firebaseUser.displayName;
        }
        setMember({ uid: firebaseUser.uid, ...data });
      } catch (e) {
        console.error('Firestore member sync failed:', e);
      }
    });
  }, []);

  const refreshMember = useCallback(async (uid) => {
    const snap = await getDoc(memberDoc(uid));
    if (snap.exists()) setMember({ uid, ...snap.data() });
  }, []);

  return { user, member, refreshMember };
}
