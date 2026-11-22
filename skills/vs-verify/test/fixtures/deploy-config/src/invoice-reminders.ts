import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { sendMail } from './mail';

const mailApiKey = defineSecret('INVOICE_MAIL_API_KEY');

// New in this release: email customers whose invoice is overdue.
export const sendInvoiceReminders = onSchedule(
  { schedule: 'every day 09:00', region: 'europe-west1', memory: '512MiB', secrets: [mailApiKey] },
  async () => {
    const from = process.env.INVOICE_FROM_ADDRESS;
    if (!from) throw new Error('INVOICE_FROM_ADDRESS is not set');
    await sendMail({ apiKey: mailApiKey.value(), from, template: 'invoice-overdue' });
  },
);
