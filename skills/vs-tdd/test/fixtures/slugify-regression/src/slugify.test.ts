import { expect, test } from 'bun:test';
import { slugify } from './slugify';

test('slugifies normal text', () => {
  expect(slugify('Hello World')).toBe('hello-world');
});

test('collapses repeated separators', () => {
  expect(slugify('  too   many  spaces  ')).toBe('too-many-spaces');
});
