import { describe, expect, it } from 'vitest';
import { buildReviewRequest, findingsSchema, type Finding } from './findings.ts';

const findings: Finding[] = [
  { id: 'checks', title: 'Repeated checks', summary: 'A small repair repeated the full suite.', request: 'Draft a validation matrix.', evidence: [{ source: 'Thread A, turn 3', quote: 'Keep required CI.' }] },
  { id: 'setup', title: 'Cold setup', summary: 'A new worktree installed dependencies.', request: 'Investigate dependency reuse.', evidence: [{ source: 'Thread B, turn 2' }] },
];
const payload = { artifactPath: '/reports/workflow.html', findings };

describe('finding review requests', () => {
  it('includes only selected findings in report order with evidence, notes and constraints', () => {
    const choices = new Map([
      ['setup', { action: 'investigate' as const, note: 'Separate setup from checks.' }],
      ['checks', { action: 'draft' as const, note: '' }],
    ]);
    const request = buildReviewRequest(payload, choices, 'Keep required CI unchanged.');
    expect(request.indexOf('Repeated checks')).toBeLessThan(request.indexOf('Cold setup'));
    expect(request).toContain('Quote: Keep required CI.');
    expect(request).toContain('Source: Thread B, turn 2');
    expect(request).toContain('My direction: Separate setup from checks.');
    expect(request).toContain('Constraints:\nKeep required CI unchanged.');
    expect(request).toContain('does not authorize implementation');
    expect(buildReviewRequest(payload, new Map([['setup', choices.get('setup')!]]), '')).not.toContain('Repeated checks');
    expect(buildReviewRequest(payload, new Map(), '')).toBe('');
  });

  it('replaces proposed work when a user defers or disagrees', () => {
    const request = buildReviewRequest(payload, new Map([
      ['checks', { action: 'defer', note: 'Later.' }],
      ['setup', { action: 'disagree', note: 'The baseline was warm.' }],
    ]), '');
    expect(request).toContain('Keep this deferred; no investigation or changes.');
    expect(request).toContain('Reassess this inference');
    expect(request).not.toContain('Draft a validation matrix.');
    expect(request).not.toContain('Investigate dependency reuse.');
  });

  it('rejects collisions, missing evidence and unbounded review payloads', () => {
    expect(findingsSchema.safeParse([...findings, findings[0]]).success).toBe(false);
    expect(findingsSchema.safeParse([{ ...findings[0], evidence: [] }]).success).toBe(false);
    expect(findingsSchema.safeParse([{ ...findings[0], request: 'x'.repeat(2001) }]).success).toBe(false);
    expect(findingsSchema.safeParse(Array.from({ length: 13 }, (_, id) => ({ ...findings[0], id: String(id) }))).success).toBe(false);
  });
});
