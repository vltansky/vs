export function describeReminder(reminder) {
  return `${reminder.recipient}:${reminder.body}`;
}

export function queueReminder(reminder) {
  throw new Error('Not implemented');
}
