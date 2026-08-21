const pending = [];

export function validateRecipient(recipient) {
  if (typeof recipient !== 'string' || !recipient.includes('@')) {
    throw new TypeError('recipient is invalid');
  }
  return recipient;
}

export function enqueue(job) {
  const queued = { id: `job-${pending.length + 1}`, status: 'queued', ...job };
  pending.push(queued);
  return queued;
}
