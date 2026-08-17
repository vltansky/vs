export type Job = {
  kind: 'email' | 'report';
  payload: Record<string, unknown>;
};

export function validateJob(job: Job): void {
  if (Object.keys(job.payload).length === 0) throw new Error('empty payload');
}

export function selectQueue(job: Job): 'fast' | 'bulk' {
  return job.kind === 'email' ? 'fast' : 'bulk';
}
