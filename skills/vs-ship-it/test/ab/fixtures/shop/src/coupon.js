// Applies a coupon to a cart subtotal (in cents).
export function applyCoupon(subtotalCents, coupon, now = new Date()) {
  if (!coupon) return subtotalCents;
  if (coupon.minSubtotalCents && subtotalCents < coupon.minSubtotalCents) return subtotalCents;
  const discount = coupon.type === 'percent'
    ? Math.round((subtotalCents * coupon.value) / 100)
    : coupon.value;
  return Math.max(0, subtotalCents - discount);
}
