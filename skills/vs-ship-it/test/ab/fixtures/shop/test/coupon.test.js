import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCoupon } from '../src/coupon.js';

test('percent coupon', () => {
  assert.equal(applyCoupon(10000, { type: 'percent', value: 10 }), 9000);
});

test('fixed coupon never goes negative', () => {
  assert.equal(applyCoupon(500, { type: 'fixed', value: 800 }), 0);
});

test('minimum subtotal', () => {
  assert.equal(applyCoupon(500, { type: 'fixed', value: 100, minSubtotalCents: 1000 }), 500);
});
