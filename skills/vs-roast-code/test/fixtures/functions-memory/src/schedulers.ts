import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { formatReminder } from './format';
import { sendMessage } from './send';

// Cloud Scheduler calls both of these every 5 minutes in production. Each
// instance loads the whole functions bundle (all exports) at cold start.
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
      batch.set(db.collection('outbox').doc(`reminder-${doc.id}`), formatReminder(doc.data()));
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
      await sendMessage(doc.data());
      await doc.ref.update({ status: 'sent', sentAt: new Date() });
    }
  },
);
