import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

function section(start: string, end: RegExp): string {
  const from = SKILL.indexOf(start);
  if (from === -1) return '';
  const rest = SKILL.slice(from + start.length);
  const stop = rest.search(end);
  return start + (stop === -1 ? rest : rest.slice(0, stop));
}

const HARD_GATE = SKILL.match(/<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/)?.[1] ?? '';
const WORKFLOW = section('## Workflow', /\n\*\*Prev:\*\*/);
const APPROVAL = section('#### Approval', /\n#{2,4} /);
const ITEM_4 = SKILL.match(/^4\. One `Your action` line\.[\s\S]*?(?=\n\n)/m)?.[0] ?? '';

type Row = { situation: string; outcome: string; verb: string };

// The approval decision table: | Situation | Outcome |. The outcome cell
// starts with a bold verb (Build, Revise, Ask, Finalize, Return, Rework, Stop).
const ROWS: Row[] = APPROVAL.split('\n')
  .filter((line) => /^\|/.test(line) && !/^\|\s*-/.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
  .filter((cells) => cells.length === 2 && cells[0] !== 'Situation')
  .map(([situation, outcome]) => ({
    situation,
    outcome,
    verb: outcome.match(/^\*\*(\w+):?\*\*/)?.[1] ?? '',
  }));

function row(situation: RegExp): Row {
  const matches = ROWS.filter((r) => situation.test(r.situation));
  expect(matches, `one approval row for ${situation}`).toHaveLength(1);
  return matches[0];
}

const STARTS_BUILD = /continue into `\/vs-build-it`/i;

describe('shape-it approve handoff: no contradictions', () => {
  it('scopes the HARD-GATE no-code rule to before approval and hands off after', () => {
    expect(HARD_GATE).toMatch(/Shape-it itself never writes code/);
    expect(HARD_GATE).toMatch(/Until the user approves a READY or READY_WITH_RISKS close/);
    expect(HARD_GATE).toMatch(/hands the approved spec to `\/vs-build-it`/);
    expect(HARD_GATE).not.toMatch(/^\s*Do NOT write code/);
  });

  it('routes a direct run into build-it on approval and a composed run back to its caller', () => {
    expect(WORKFLOW).not.toMatch(/Direct: emit \*\*Next\*\* only/);
    expect(WORKFLOW).toMatch(/Direct: on approval, continue into \*\*Next\*\*/);
    expect(WORKFLOW).toMatch(/Composed: return the approved spec to the caller/);
  });
});

describe('shape-it approve handoff: decision table', () => {
  it('has an approval decision table', () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(8);
    for (const r of ROWS) expect(r.verb, r.situation).toMatch(/^(Build|Revise|Ask|Finalize|Return|Rework|Stop)$/);
  });

  it('builds only on a strict approve of a direct READY or READY_WITH_RISKS close', () => {
    const builds = ROWS.filter((r) => r.verb === 'Build');
    expect(builds.length).toBeGreaterThan(0);
    for (const r of builds) {
      expect(r.situation).toMatch(/`approve`/);
      expect(r.situation).toMatch(/READY/);
      // The strict-acceptance clause ("no edit, condition, question, or
      // non-recommended pick") is the exclusion itself; drop it before checking.
      const positive = r.situation.replace(/with no edit, condition, question, or non-recommended pick/, '');
      expect(positive).not.toMatch(/edit|condition|question|non-recommended|spec or design only|composed|Challenge|NOT_READY|ambiguous/i);
      expect(r.outcome).toMatch(STARTS_BUILD);
    }
    for (const r of ROWS.filter((x) => x.verb !== 'Build')) {
      expect(r.outcome, r.situation).not.toMatch(STARTS_BUILD);
    }
  });

  it('defines acceptance strictly: exact approve, case and punctuation ignored, no edit or condition', () => {
    const ready = row(/^Direct run, READY:/);
    expect(ready.situation).toMatch(/any case, punctuation ignored/);
    expect(ready.situation).toMatch(/no edit, condition, question, or non-recommended pick/);
  });

  const mustNotBuild: Array<[string, RegExp, string]> = [
    ['approve with edits', /`approve but rename X`/, 'Revise'],
    ['non-recommended pick on the combined decision gate', /non-recommended option/, 'Revise'],
    ['ambiguous reply', /^Ambiguous reply/, 'Ask'],
    ['spec-only request', /asked for a spec or design only/, 'Finalize'],
    ['composed run', /^Composed run/, 'Return'],
    ['NOT_READY close', /^NOT_READY/, 'Rework'],
    ['Challenge route', /^Challenge route/, 'Return'],
    ['build-it unavailable', /cannot resolve `\/vs-build-it`/, 'Stop'],
  ];

  for (const [name, situation, verb] of mustNotBuild) {
    it(`does not build on: ${name}`, () => {
      const r = row(situation);
      expect(r.verb).toBe(verb);
      expect(r.outcome).not.toMatch(STARTS_BUILD);
    });
  }

  it('keeps the spec-only build as its own explicit reply', () => {
    expect(row(/asked for a spec or design only/).outcome).toMatch(/`build`/);
  });

  it('tells the user the slash command when build-it cannot be resolved', () => {
    expect(row(/cannot resolve `\/vs-build-it`/).outcome).toMatch(/type `\/vs-build-it <spec path>` and stop/);
  });
});

describe('shape-it approve handoff: informed consent and scope', () => {
  it('names the accepted risk on a READY_WITH_RISKS approve line', () => {
    expect(ITEM_4).toMatch(/READY_WITH_RISKS: Reply `approve` to accept <[^>]*risk[^>]*> and start `\/vs-build-it`/);
    expect(row(/^Direct run, READY_WITH_RISKS/).situation).toMatch(/named the risk/);
  });

  it('makes the approve line say that approving starts the build', () => {
    expect(ITEM_4).toMatch(/READY: Reply `approve` to start `\/vs-build-it`/);
    expect(ITEM_4).toMatch(/Required/);
  });

  it('authorizes build-it only, not issues or workers', () => {
    expect(APPROVAL).toMatch(/starts `\/vs-build-it` only/);
    expect(APPROVAL).toMatch(/does not authorize `\/vs-to-issues`/);
  });

  it('continues by default but lets Phase Boundaries end with an explicit Next', () => {
    expect(APPROVAL).toMatch(/session action is Continue/);
    expect(APPROVAL).toMatch(/`Next: \/vs-build-it <spec path>`/);
  });

  it('bridges the 100% Handoff checkpoint into build-it without a restart', () => {
    expect(SKILL).toMatch(/build-it's first `\[1\/7\]` line continues the same run/);
  });
});
