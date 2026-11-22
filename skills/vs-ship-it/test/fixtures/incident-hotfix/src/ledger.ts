export async function recordPayment(paymentId: string, amountCents: number) {
  return { paymentId, amountCents };
}
