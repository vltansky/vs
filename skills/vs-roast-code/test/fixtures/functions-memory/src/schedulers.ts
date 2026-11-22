import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { formatReminder } from './format';

// Cloud Scheduler calls both of these every 5 minutes in production.
export const sendVisitReminders = onSchedule(
  { schedule: 'every 5 minutes', region: 'europe-west1', maxInstances: 1 },
  async () => {
    const db = getFirestore();
    const visits = await db.collection('visits').where('remindAt', '<=', new Date()).get();
    const messages = visits.docs.map((doc) => formatReminder(doc.data()));
    await Promise.all(messages.map((m) => db.collection('outbox').add(m)));
  },
);

export const deliverQueuedMessages = onSchedule(
  { schedule: 'every 5 minutes', region: 'europe-west1', maxInstances: 1 },
  async () => {
    const db = getFirestore();
    const queued = await db.collection('outbox').where('status', '==', 'queued').limit(50).get();
    for (const doc of queued.docs) {
      await doc.ref.update({ status: 'sent', sentAt: new Date() });
    }
  },
);
