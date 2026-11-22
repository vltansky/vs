export function formatReminder(visit: { customerName?: string; at?: Date }) {
  console.log('formatting reminder', visit);
  return { to: visit.customerName ?? 'customer', text: `Reminder: visit at ${visit.at}` , status: 'queued' };
}
