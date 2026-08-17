import type { Job } from '../domain/job';

export interface QueuePort {
  enqueue(queue: 'fast' | 'bulk', job: Job): Promise<string>;
}
