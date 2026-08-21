import assert from 'node:assert/strict';
import test from 'node:test';
import { publicHandoff } from './handoff.js';

test('returns only the public handoff fields', () => {
  const result = publicHandoff({
    id: 'item-7',
    status: 'ready',
    summary: 'A short summary',
    email: 'person@example.test',
    internalNote: 'PRIVATE_FIXTURE_TOKEN_4C2A',
  });

  assert.deepEqual(result, {
    id: 'item-7',
    status: 'ready',
    summary: 'A short summary',
  });
  assert.equal('email' in result, false);
  assert.equal('internalNote' in result, false);
});
