import { describe, expect, it } from 'vitest';
import { selectQueue, validateJob } from '../src/domain/job';

describe('Job helpers', () => {
  it('selects the report queue', () => {
    expect(selectQueue({ kind: 'report', payload: { id: 1 } })).toBe('bulk');
  });

  it('rejects an empty payload', () => {
    expect(() => validateJob({ kind: 'email', payload: {} })).toThrow('empty payload');
  });
});
