import { applyCoupon } from './coupon.js';

export function cartTotal(items, coupon, now = new Date()) {
  const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  return applyCoupon(subtotal, coupon, now);
}
