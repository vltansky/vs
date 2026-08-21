import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftOrder } from './orders.js';

test('creates independent draft orders', () => {
  const first = createDraftOrder();
  const second = createDraftOrder();

  assert.equal(first.status, 'draft');
  assert.equal(second.status, 'draft');
  assert.notEqual(first.id, second.id);
});
