import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp }     from 'firebase-admin/app';
import { getFirestore }      from 'firebase-admin/firestore';
import { getMessaging }      from 'firebase-admin/messaging';
import { buildNotifPayload, adminsWithTokens } from './lib/notif.js';

initializeApp();

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export const onNewMember = onDocumentWritten('members/{uid}', async event => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();

  // Agir uniquement quand needsActivation passe à true (premier login)
  if (!after?.needsActivation || before?.needsActivation === true) return;

  const db = getFirestore();
  const snapshot = await db.collection('members').where('isAdmin', '==', true).get();
  const allAdmins = snapshot.docs.map(d => ({ ref: d.ref, ...d.data() }));
  const eligible  = adminsWithTokens(allAdmins);

  if (eligible.length === 0) return;

  const payload = {
    ...buildNotifPayload(after.name ?? ''),
    tokens: eligible.map(a => a.fcmToken),
  };

  const response = await getMessaging().sendEachForMulticast(payload);

  // Supprimer les tokens invalides de Firestore
  const cleanup = [];
  response.responses.forEach((r, i) => {
    if (!r.success && INVALID_TOKEN_CODES.has(r.error?.code)) {
      cleanup.push(eligible[i].ref.update({ fcmToken: null }));
    }
  });
  if (cleanup.length) await Promise.all(cleanup);
});
