import { onRequest } from 'firebase-functions/v2/https';

export const healthz = onRequest({ region: 'europe-west1' }, (_req, res) => {
  res.status(200).json({ ok: true });
});
