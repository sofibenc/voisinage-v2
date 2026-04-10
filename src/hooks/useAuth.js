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
      await upsertMember(firebaseUser.uid, {
        name:     firebaseUser.displayName,
        email:    firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      });
      const snap = await getDoc(memberDoc(firebaseUser.uid));
      setMember(snap.exists() ? { uid: firebaseUser.uid, ...snap.data() } : null);
    });
  }, []);

  return { user, member };
}
