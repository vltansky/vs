import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { check, createAgent, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

describe('debug-mode', () => {
  it.skip('has a runnable behavior-eval scaffold for future runtime fixtures', async () => {
    const agent = await createAgent({ agent: 'codex', timeout: 300, skillDir: SKILL_DIR });
    const result = await evaluate(agent, [check('placeholder', () => true)]);
    expect(result.score).toBe(1);
  });

  it('makes an executable feedback loop mandatory before deep debugging', () => {
    expect(SKILL).toMatch(/Build the feedback loop/);
    expect(SKILL).toMatch(/command, script, browser flow, curl call, fixture replay, bisect, or temporary harness/);
    expect(SKILL).toMatch(/Static inspection alone is not a reproduction/);
  });

  it('requires falsifiable predictions for hypotheses', () => {
    expect(SKILL).toMatch(/Each hypothesis includes a \*\*prediction\*\*/);
    expect(SKILL).toMatch(/Prediction:/);
    expect(SKILL).toMatch(/what observation or change should happen/);
  });

  it('requires correct regression seams and intermittent failure rates', () => {
    expect(SKILL).toMatch(/Choose the correct regression seam/);
    expect(SKILL).toMatch(/too-shallow helper test/);
    expect(SKILL).toMatch(/before\/after failure rate/);
  });
});
