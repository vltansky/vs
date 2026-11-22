export async function sendMessage(message: { to?: string; text?: string }) {
  if (!message.to || !message.text) throw new Error('incomplete message');
  return { delivered: true };
}
