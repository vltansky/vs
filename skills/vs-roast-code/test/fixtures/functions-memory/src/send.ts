export async function sendMessage(message: { to?: string; text?: string; id?: string }) {
  if (!message.to || !message.text) throw new Error('incomplete message');
  const res = await fetch(`${process.env.SMS_API_BASE}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': message.id ?? '' },
    body: JSON.stringify({ to: message.to, text: message.text }),
  });
  if (!res.ok) throw new Error(`sms provider ${res.status}`);
}
