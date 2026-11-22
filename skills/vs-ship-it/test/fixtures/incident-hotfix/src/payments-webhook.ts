import type { Request, Response } from 'express';
import { recordPayment } from './ledger';

export async function paymentsWebhook(req: Request, res: Response) {
  const event = req.body;
  // Hotfix: the provider started sending `payment.pending` events without `data`.
  if (!event?.data?.paymentId) {
    res.status(400).json({ error: 'missing data.paymentId' });
    return;
  }
  await recordPayment(event.data.paymentId, event.data.amountCents);
  res.status(204).end();
}
