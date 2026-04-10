import { useState, useEffect, useRef } from 'react';
import { onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import {
  scheduleDoc, settingsDoc, membersCol, wishlistDoc,
  prevUsageDoc, publishSchedule, releaseSlot, claimSlot,
} from '../firebase.js';
import { computeSchedule } from '../utils/schedule.js';
import { monthKey } from '../constants.js';

export function useSchedule(year, month) {
  const mk = monthKey(year, month);
  const [schedule,   setSchedule]   = useState(null);
  const [settings,   setSettings]   = useState(null);
  const [publishing, setPublishing]  = useState(false);
  const publishingRef = useRef(false);

  useEffect(() => {
    return onSnapshot(scheduleDoc(mk), snap => {
      setSchedule(snap.exists() ? snap.data() : null);
    });
  }, [mk]);

  useEffect(() => {
    return onSnapshot(settingsDoc(), async snap => {
      const s = snap.exists() ? snap.data() : {};
      setSettings(s);
      await checkAndPublish(mk, s, publishingRef, setPublishing);
    });
  }, [mk]);

  const release = (slotId, uid) => releaseSlot(mk, slotId, uid);
  const claim   = (slotId, uid) => claimSlot(mk, slotId, uid);

  const forcePublish = () => doPublish(mk, publishingRef, setPublishing);

  const deadline = settings?.deadlines?.[mk] ?? null;
  const isDeadlinePassed = deadline
    ? new Date() > new Date(deadline + 'T23:59:59')
    : false;

  return { schedule, deadline, isDeadlinePassed, publishing, release, claim, forcePublish };
}

async function doPublish(mk, publishingRef, setPublishing) {
  if (publishingRef.current) return;
  publishingRef.current = true;
  setPublishing(true);

  try {
    const [membersSnap, prevSnap] = await Promise.all([
      getDocs(membersCol()),
      getDoc(prevUsageDoc(mk)),
    ]);
    const members   = membersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const prevUsage = prevSnap.exists() ? prevSnap.data() : {};

    const wishlistSnaps = await Promise.all(
      members.map(m => getDoc(wishlistDoc(m.uid, mk)))
    );
    const wishlists = Object.fromEntries(
      members.map((m, i) => [
        m.uid,
        wishlistSnaps[i].exists() ? (wishlistSnaps[i].data().slots ?? []) : [],
      ])
    );

    const [y, mo] = mk.split('-').map(Number);
    const { assignments, quotaHours, fairness } = computeSchedule(
      members, wishlists, y, mo - 1, prevUsage
    );

    const prevUsageByUid = Object.fromEntries(
      members.map(m => [
        m.uid,
        (Object.entries(assignments).filter(([, uid]) => uid === m.uid).length) / 2,
      ])
    );

    await publishSchedule(mk, assignments, quotaHours, fairness, prevUsageByUid);
  } finally {
    publishingRef.current = false;
    setPublishing(false);
  }
}

async function checkAndPublish(mk, settings, publishingRef, setPublishing) {
  const deadline = settings?.deadlines?.[mk];
  if (!deadline) return;
  if (new Date() <= new Date(deadline + 'T23:59:59')) return;

  const schedSnap = await getDoc(scheduleDoc(mk));
  if (schedSnap.exists()) return;

  await doPublish(mk, publishingRef, setPublishing);
}
