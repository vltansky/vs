import { selectQueue, type Job, validateJob } from '../domain/job';
import type { QueuePort } from '../queue/queue-port';

export async function submitHttp(job: Job, queue: QueuePort) {
  try {
    validateJob(job);
    const queueName = selectQueue(job);
    const id = await queue.enqueue(queueName, job);
    return { status: 202, body: { id } };
  } catch (error) {
    return { status: 400, body: { error: (error as Error).message } };
  }
}
