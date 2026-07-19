import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { check, createAgent, evaluate } from '@wix/pathgrade';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

describe('github-research', () => {
  it.skip('has a runnable behavior-eval scaffold for future octocode-backed broad search fixtures', async () => {
    const agent = await createAgent({ agent: 'codex', timeout: 300, skillDir: SKILL_DIR });
    const result = await evaluate(agent, [check('placeholder', () => true)]);
    expect(result.score).toBe(1);
  });

  it('is framed as broad external GitHub research rather than local code tracing', () => {
    expect(SKILL).toMatch(/GitHub-backed prior art/i);
    expect(SKILL).toMatch(/looking outward at real GitHub projects/i);
    expect(SKILL).toMatch(/not a local call-graph tracer/i);
    expect(SKILL).toMatch(/rename blast-radius checker/i);
  });

  it('requires project discovery, representative inspection, and pattern synthesis', () => {
    expect(SKILL).toMatch(/Discover candidate projects/i);
    expect(SKILL).toMatch(/Inspect representative examples/i);
    expect(SKILL).toMatch(/Group findings by pattern/i);
    expect(SKILL).toMatch(/3-5 candidate projects/i);
  });

  it('plans research around falsifiable claims, evidence targets, and stop tests', () => {
    expect(SKILL).toMatch(/hypotheses/i);
    expect(SKILL).toMatch(/disconfirm/i);
    expect(SKILL).toMatch(/claim[\s\S]{0,80}evidence[\s\S]{0,80}confidence[\s\S]{0,80}next check/i);
    expect(SKILL).toMatch(/active \/ skipped surfaces/i);
    expect(SKILL).toMatch(/budget/i);
    expect(SKILL).toMatch(/stop test/i);
  });

  it('uses Octocode tools directly and never gates execution on plan approval', () => {
    expect(SKILL).toMatch(/typed MCP tools directly/i);
    expect(SKILL).toMatch(/Do not load or invoke Octocode[^\n]+orchestration/i);
    expect(SKILL).toMatch(/host or repository policy requires a research subagent/i);
    expect(SKILL).toMatch(/Never ask for approval of the research plan/i);
  });

  it('resolves repository-local identifiers before broad discovery', () => {
    expect(SKILL).toMatch(/PR numbers are repository-local/i);
    expect(SKILL).toMatch(/Keep every receipt line/i);
  });

  it('keeps evidence GitHub-cited and separates nearby skills', () => {
    expect(SKILL).toMatch(/full GitHub URLs with line numbers/i);
    expect(SKILL).toMatch(/Separate direct evidence from inference/i);
    expect(SKILL).toMatch(/\/vs-steal/);
    expect(SKILL).toMatch(/\/vs-rfc-research/);
    expect(SKILL).toMatch(/\/vs-shape-it/);
  });

  it('keeps compact prior art in Markdown and renders dense landscapes as one HTMDX artifact', () => {
    expect(SKILL).toMatch(/prior-art answer[\s\S]{0,180}Markdown/i);
    expect(SKILL).toMatch(/YYYY-MM-DD-landscape\.html/);
    expect(SKILL).toMatch(/HTMDX/);
    expect(SKILL).toMatch(/no Markdown twin/i);
  });
});
