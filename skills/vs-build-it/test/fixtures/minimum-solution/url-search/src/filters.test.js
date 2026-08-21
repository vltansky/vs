import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFilters } from './filters.js';

test('decodes the query and preserves repeated tags', () => {
  assert.deepEqual(parseFilters('?q=red+shoes&tag=sale&tag=summer%20sale'), {
    q: 'red shoes',
    tags: ['sale', 'summer sale'],
  });
});
