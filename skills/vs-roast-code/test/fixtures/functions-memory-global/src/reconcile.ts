import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';

export const reconcileDailyLinks = onSchedule(
  {
    schedule: '20 4 * * *',
    timeZone: 'Asia/Jerusalem',
    region: 'europe-west1',
    memory: '1GiB',
    timeoutSeconds: 300,
    maxInstances: 1,
  },
  async () => {
    const db = getFirestore();
    let cursor: string | undefined;
    do {
      let q = db.collection('conversations').orderBy('__name__').limit(50).select('linkStatus');
      if (cursor) q = q.startAfter(cursor);
      const page = await q.get();
      cursor = page.docs.at(-1)?.id;
      const batch = db.batch();
      page.docs.forEach((doc) => batch.update(doc.ref, { checkedAt: new Date() }));
      await batch.commit();
    } while (cursor);
  },
);
