import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();

// Every function in this codebase inherits these unless it overrides them.
setGlobalOptions({ region: 'europe-west1', memory: '512MiB', timeoutSeconds: 120 });

export { sendVisitReminders, deliverQueuedMessages } from './schedulers';
export { reconcileDailyLinks } from './reconcile';
