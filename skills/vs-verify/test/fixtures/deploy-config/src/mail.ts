export async function sendMail(opts: { apiKey: string; from: string; template: string }) {
  if (!opts.apiKey) throw new Error('mail API key missing');
  return { queued: true, template: opts.template };
}
