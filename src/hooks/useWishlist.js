import { useState, useEffect, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { wishlistDoc, setWishlist } from '../firebase.js';

export function useWishlist(uid, mk) {
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    if (!uid || !mk) return;
    return onSnapshot(wishlistDoc(uid, mk), snap => {
      setSlots(snap.exists() ? (snap.data().slots ?? []) : []);
    });
  }, [uid, mk]);

  const toggleSlot = useCallback(async (slotId) => {
    const next = slots.includes(slotId)
      ? slots.filter(s => s !== slotId)
      : [...slots, slotId].sort((a, b) => a - b);
    setSlots(next);
    await setWishlist(uid, mk, next);
  }, [uid, mk, slots]);

  const setSlotRange = useCallback(async (start, end, selected) => {
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const rangeSet = new Set();
    for (let s = lo; s <= hi; s++) rangeSet.add(s);
    const next = selected
      ? [...new Set([...slots, ...rangeSet])].sort((a, b) => a - b)
      : slots.filter(s => !rangeSet.has(s));
    setSlots(next);
    await setWishlist(uid, mk, next);
  }, [uid, mk, slots]);

  const mergeSlots = useCallback(async (toAdd) => {
    const next = [...new Set([...slots, ...toAdd])].sort((a, b) => a - b);
    setSlots(next);
    await setWishlist(uid, mk, next);
  }, [uid, mk, slots]);

  const clearRange = useCallback(async (fromSlot, toSlot) => {
    const next = slots.filter(s => s < fromSlot || s > toSlot);
    setSlots(next);
    await setWishlist(uid, mk, next);
  }, [uid, mk, slots]);

  const clearAll = useCallback(async () => {
    setSlots([]);
    await setWishlist(uid, mk, []);
  }, [uid, mk]);

  return { slots, toggleSlot, setSlotRange, mergeSlots, clearRange, clearAll };
}
