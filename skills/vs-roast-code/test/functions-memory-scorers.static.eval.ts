import { describe, expect, it } from 'vitest';
import { flagsCoveredFunctions, scoreMemoryReview } from './functions-memory-scorers';

// Each wrong answer must lose a check; each right answer (taken from real runs) must pass all.
const score = (o: string) => Object.values(scoreMemoryReview(o)).filter(Boolean).length;

const RIGHT = [
  `### FELONIES
3. **Unbounded scheduler memory configuration — Act** — \`src/schedulers.ts:8-9\`, \`src/schedulers.ts:27-28\`
   Both production schedulers rely on the platform's default memory limit.
   Fix: set an explicit, measured \`memory\` value on both \`onSchedule\` definitions.`,
  `1. **FELONY — no memory set** — src/schedulers.ts:7 and src/schedulers.ts:28: sendVisitReminders and deliverQueuedMessages declare no \`memory\`, so they run on the 256 MiB default. Fix: add memory: '512MiB' (or setGlobalOptions).`,
];

const WRONG: Record<string, string> = {
  'memory is fine everywhere': `1. src/schedulers.ts:10 — duplicate reminders. Fix: claim visits first.
2. Memory is fine everywhere: reconcile.ts already sets memory: '512MiB', and the schedulers are small.`,
  'generic memory exhaustion only': `1. src/schedulers.ts:10-12 — unbounded batch risks memory exhaustion. Fix: paginate.`,
  'blames the function that declares memory': `1. src/reconcile.ts:9 has no explicit memory. Fix: set memory: '1GiB'.`,
  'flags but recommends nothing': `1. src/schedulers.ts:7 — runs without an explicit memory setting.`,
};

describe('roast-code functions-memory scorers', () => {
  it.each(RIGHT.map((r, i) => [i, r]))('right answer %i scores 4/4', (_i, r) => {
    expect(scoreMemoryReview(r as string)).toEqual({ flags: true, recommends: true, cites: true, sparesExplicit: true });
  });
  it.each(Object.entries(WRONG))('wrong answer "%s" loses a check', (_n, w) => {
    expect(score(w)).toBeLessThan(4);
  });
  it('the fixture own 512MiB does not satisfy the recommendation', () => {
    expect(scoreMemoryReview(WRONG['memory is fine everywhere']).recommends).toBe(false);
  });
  it('with a repo-level default, flagging a scheduler is wrong and staying quiet is right', () => {
    expect(flagsCoveredFunctions(RIGHT[1])).toBe(true);
    expect(flagsCoveredFunctions(`1. src/format.ts:2 logs PII. Memory: setGlobalOptions sets 512MiB for every function; schedulers inherit it.`)).toBe(false);
    expect(flagsCoveredFunctions(`1. src/schedulers.ts:10 — duplicate reminders. Fix: claim visits first.`)).toBe(false);
  });
});
