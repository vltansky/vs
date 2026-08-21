import assert from 'node:assert/strict';
import test from 'node:test';
import { slugify } from './slug.js';

test('creates a stable slug', () => {
  assert.equal(slugify('Release Notes'), 'release-notes');
});

test('uses a safe fallback for punctuation-only titles', () => {
  assert.equal(slugify('!!!'), 'untitled');
});
