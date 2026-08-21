import assert from 'node:assert/strict';
import test from 'node:test';
import { queueReminder } from './reminders.js';

test('queues a validated reminder without sending it', () => {
  assert.deepEqual(queueReminder({ recipient: 'person@example.test', body: 'Later' }), {
    id: 'job-1',
    status: 'queued',
    recipient: 'person@example.test',
    body: 'Later',
  });
});

test('rejects an invalid recipient before queueing', () => {
  assert.throws(() => queueReminder({ recipient: 'invalid', body: 'Later' }), /invalid/);
});
