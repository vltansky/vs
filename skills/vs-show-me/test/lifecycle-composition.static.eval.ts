import { describe, expect, it } from 'vitest';
import { hasLifecycleMachine } from './lifecycle-composition';

const complete = `<Machine initial="queued">
- state queued: Waiting
- state running: 3 of 5 tasks complete
- state succeeded final: Complete
- state failed: Error
- queued -> running: starts
- running -> succeeded: done
- running -> failed: error
- failed -> running: retry
- screen queued: Waiting
- screen running: 3 of 5 tasks complete
- screen succeeded: Complete
- screen failed: Error shown; Retry available
</Machine>`;

describe('lifecycle composition scoring', () => {
  it('accepts the catalog lifecycle exhibit with every state and transition', () => {
    expect(hasLifecycleMachine(complete)).toBe(true);
  });

  it.each([
    '<Machine />',
    complete.replace('- screen running: 3 of 5 tasks complete', ''),
    complete.replace('- failed -> running: retry', ''),
    complete.replace('- running -> failed: error', ''),
    complete.replace('Error shown; Retry available', 'Stopped'),
  ])('rejects an incomplete or decorative Machine', (source) => {
    expect(hasLifecycleMachine(source)).toBe(false);
  });
});
