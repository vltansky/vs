import { selectQueue, type Job, validateJob } from '../domain/job';
import type { QueuePort } from '../queue/queue-port';

export async function submitCli(job: Job, queue: QueuePort) {
  try {
    validateJob(job);
    const queueName = selectQueue(job);
    const id = await queue.enqueue(queueName, job);
    return `queued ${id}`;
  } catch (error) {
    return `rejected: ${(error as Error).message}`;
  }
}
