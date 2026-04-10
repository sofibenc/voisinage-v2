import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { membersCol } from '../firebase.js';
import { PALETTE } from '../constants.js';

export function useMembers() {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    return onSnapshot(membersCol(), snap => {
      const list = snap.docs.map((d, i) => ({
        uid: d.id,
        ...d.data(),
        color: PALETTE[i % PALETTE.length],
      }));
      setMembers(list);
    });
  }, []);

  const colorOf = uid => members.find(m => m.uid === uid)?.color ?? PALETTE[0];

  return { members, colorOf };
}
