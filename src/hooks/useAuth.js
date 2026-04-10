import { useState, useEffect } from 'react';
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
      // Fallback member from Firebase Auth data (used if Firestore is unavailable)
      const fallback = {
        uid:      firebaseUser.uid,
        name:     firebaseUser.displayName,
        email:    firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        isAdmin:  false,
      };
      setMember(fallback);
      try {
        await upsertMember(firebaseUser.uid, {
          name:     firebaseUser.displayName,
          email:    firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });
        const snap = await getDoc(memberDoc(firebaseUser.uid));
        if (snap.exists()) setMember({ uid: firebaseUser.uid, ...snap.data() });
      } catch (e) {
        console.error('Firestore member sync failed:', e);
      }
    });
  }, []);

  return { user, member };
}
