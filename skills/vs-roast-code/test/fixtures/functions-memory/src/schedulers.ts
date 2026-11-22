import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { formatReminder } from './format';
import { sendMessage } from './send';

export const sendVisitReminders = onSchedule(
  { schedule: 'every 5 minutes', region: 'europe-west1', maxInstances: 1 },
  async () => {
    const db = getFirestore();
    const due = await db
      .collection('visits')
      .where('reminded', '==', false)
      .where('remindAt', '<=', new Date())
      .limit(100)
      .get();
    const batch = db.batch();
    for (const doc of due.docs) {
      batch.create(db.collection('outbox').doc(`reminder-${doc.id}`), formatReminder(doc.data()));
      batch.update(doc.ref, { reminded: true });
    }
    await batch.commit();
  },
);

export const deliverQueuedMessages = onSchedule(
  { schedule: 'every 5 minutes', region: 'europe-west1', maxInstances: 1 },
  async () => {
    const db = getFirestore();
    const queued = await db.collection('outbox').where('status', '==', 'queued').limit(50).get();
    for (const doc of queued.docs) {
      await sendMessage({ ...doc.data(), id: doc.id });
      await doc.ref.update({ status: 'sent', sentAt: new Date() });
    }
  },
);
