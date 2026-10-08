import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Static contract for what shape-it does with the user's reply to its close.
// `problems(skill)` returns every broken rule; the base skill must return none,
// and each mutant below (a known way to regress #86/#87) must return some.

const SKILL = fs.readFileSync(path.resolve(__dirname, '..', 'SKILL.md'), 'utf8');

type Row = { situation: string; outcome: string; verb: string; line: string };

function between(text: string, start: string, end: RegExp): string {
  const from = text.indexOf(start);
  if (from === -1) return '';
  const rest = text.slice(from + start.length);
  const stop = rest.search(end);
  return start + (stop === -1 ? rest : rest.slice(0, stop));
}

function parse(skill: string) {
  const hardGate = skill.match(/<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/)?.[1] ?? '';
  const workflow = between(skill, '## Workflow', /\n\*\*Prev:\*\*/);
  const approval = between(skill, '#### Approval', /\n#{2,4} /);
  const item4 = skill.match(/^4\. One `Your action` line\.[\s\S]*?(?=\n\n)/m)?.[0] ?? '';
  const rows: Row[] = approval
    .split('\n')
    .filter((line) => /^\|/.test(line) && !/^\|\s*-/.test(line))
    .map((line) => ({ line, cells: line.split('|').slice(1, -1).map((c) => c.trim()) }))
    .filter(({ cells }) => cells.length === 2 && cells[0] !== 'Situation')
    .map(({ line, cells: [situation, outcome] }) => ({
      line,
      situation,
      outcome,
      verb: outcome.match(/^\*\*(\w+):?\*\*/)?.[1] ?? '',
    }));
  return { hardGate, workflow, approval, item4, rows };
}

// A sentence that makes shape-it start build-it. Negated forms ("does not
// start build-it") are not starts.
const BUILD_TARGET = String.raw`(?:\`\/vs-build-it\`|\`\.\.\/vs-build-it\/SKILL\.md\`|\/vs-build-it|build-it)`;
const BUILD_VERB = String.raw`(?:invoke[sd]?|invoking|start(?:s|ed|ing)?|continue[sd]? into|load and follow|loads and follows|run[s]?|hand(?:s|ed)? off to|route[sd]? to)`;
const BUILD_START = new RegExp(String.raw`\b${BUILD_VERB}\b[^|\n]{0,40}?${BUILD_TARGET}`, 'gi');
const NEGATED = /\b(?:not|never|n't|no)\s+(?:\w+\s+){0,1}$/i;

function buildStarts(text: string): string[] {
  const hits: string[] = [];
  for (const m of text.matchAll(BUILD_START)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 16), m.index);
    if (!NEGATED.test(before)) hits.push(m[0]);
  }
  return hits;
}

// Lines allowed to name a build start: the Build rows themselves, and the
// item-4 Your action lines (text the user reads, not an agent action).
const ITEM4_LINE = /^ {3}- (?:READY|READY_WITH_RISKS|Spec or design only[^:]*|NOT_READY):/;

const SPEC_ONLY_EXCLUSION = 'the user did not ask for spec or design only';
const DIRECT_EXPLORE = 'Direct Explore or Guided Explore run';
const PRECEDENCE = /any non-Build row that matches wins over Build/;
const WORKFLOW_LINE =
  'Direct: on a Build approval (Approval table), continue into **Next**; otherwise emit **Next** only. Composed: return the approved spec to the caller.';
const HARD_GATE_SCOPE = /Until the user approves a READY or READY_WITH_RISKS close|After that approval/;
const PROHIBITION = /\b(?:never|do not|don't|must not)\b[^.]*\b(?:implement\w*|build\w*|code|scaffold\w*)\b/i;

const MUST_NOT_BUILD: Array<[string, RegExp, string]> = [
  ['approve with edits', /`approve but rename X`/, 'Revise'],
  ['non-recommended pick on the combined decision gate', /non-recommended option/, 'Revise'],
  ['ambiguous reply', /^Ambiguous reply/, 'Ask'],
  ['spec-only request', /asked for a spec or design only/, 'Finalize'],
  ['composed run', /^Composed run/, 'Return'],
  ['NOT_READY close', /^NOT_READY/, 'Rework'],
  ['Challenge route', /^Challenge route/, 'Return'],
  ['build-it unavailable', /cannot resolve `\.\.\/vs-build-it\/SKILL\.md`/, 'Stop'],
];

function problems(skill: string): string[] {
  const out: string[] = [];
  const { hardGate, workflow, approval, item4, rows } = parse(skill);
  const fail = (cond: boolean, msg: string) => {
    if (cond) out.push(msg);
  };

  // HARD-GATE: scoped to before approval; no unscoped "never build" sentence.
  fail(!/Shape-it itself never writes code/.test(hardGate), 'HARD-GATE: missing "Shape-it itself never writes code"');
  fail(!/Until the user approves a READY or READY_WITH_RISKS close/.test(hardGate), 'HARD-GATE: not scoped to before approval');
  fail(!/hands the approved spec to `\/vs-build-it`/.test(hardGate), 'HARD-GATE: no post-approval handoff');
  for (const sentence of hardGate.replace(/\s+/g, ' ').split(/(?<=\.)\s+/)) {
    if (!PROHIBITION.test(sentence)) continue;
    const allowed = HARD_GATE_SCOPE.test(sentence) || sentence.trim() === 'Shape-it itself never writes code.';
    fail(!allowed, `HARD-GATE: unscoped prohibition: "${sentence.trim()}"`);
  }

  // Workflow route points at the Approval table.
  fail(!workflow.includes(WORKFLOW_LINE), 'Workflow: route line is not the Build-approval line');

  // Decision table.
  fail(rows.length < 8, `Approval: expected a decision table, got ${rows.length} rows`);
  fail(!PRECEDENCE.test(approval), 'Approval: no precedence rule (non-Build rows win)');
  for (const r of rows) {
    fail(!/^(Build|Revise|Ask|Finalize|Return|Rework|Stop)$/.test(r.verb), `Approval: row without outcome verb: ${r.situation}`);
  }
  const builds = rows.filter((r) => r.verb === 'Build');
  fail(builds.length === 0, 'Approval: no Build row');
  for (const r of builds) {
    fail(!r.situation.includes(DIRECT_EXPLORE), `Build row not scoped to direct Explore: ${r.situation}`);
    fail(!r.situation.includes(SPEC_ONLY_EXCLUSION), `Build row lacks spec-only exclusion: ${r.situation}`);
    fail(!/`approve`|strict acceptance/.test(r.situation), `Build row without strict approve: ${r.situation}`);
    fail(!/load and follow `\.\.\/vs-build-it\/SKILL\.md`/.test(r.outcome), `Build row does not load build-it by path: ${r.outcome}`);
  }
  for (const [name, situation, verb] of MUST_NOT_BUILD) {
    const matches = rows.filter((r) => situation.test(r.situation));
    if (matches.length !== 1) {
      out.push(`Approval: expected one row for ${name}, got ${matches.length}`);
      continue;
    }
    fail(matches[0].verb !== verb, `Approval: ${name} should be ${verb}, is ${matches[0].verb}`);
  }
  fail(!/type `\/vs-build-it <spec path>` and stop/.test(rows.find((r) => r.verb === 'Stop')?.outcome ?? ''), 'Stop row: no slash-command fallback');

  // Whole-skill negative pin: nothing outside Build rows and item-4 lines starts build-it.
  const buildLines = new Set(builds.map((r) => r.line));
  for (const line of skill.split('\n')) {
    if (buildLines.has(line) || ITEM4_LINE.test(line)) continue;
    for (const hit of buildStarts(line)) out.push(`build start outside a Build row: "${hit}" in: ${line.trim().slice(0, 120)}`);
  }
  // Same check across wrapped prose (a start split over two lines).
  const prose = skill
    .split('\n')
    .filter((line) => !buildLines.has(line) && !ITEM4_LINE.test(line))
    .join(' ')
    .replace(/\s+/g, ' ');
  for (const hit of buildStarts(prose)) {
    if (!out.some((p) => p.includes(hit))) out.push(`build start outside a Build row (wrapped): "${hit}"`);
  }

  // Informed consent and scope.
  fail(!/READY_WITH_RISKS: Reply `approve` to accept <[^>]*risk[^>]*> and start `\/vs-build-it`/.test(item4), 'item 4: READY_WITH_RISKS line does not name the risk');
  fail(!/READY: Reply `approve` to start `\/vs-build-it`/.test(item4), 'item 4: READY line does not say approve starts the build');
  fail(!/Spec or design only[^\n]*Reply `approve` to accept the spec, or `build`/.test(item4), 'item 4: no spec-only line');
  fail(!/authorizes `\/vs-build-it` only/.test(approval), 'Approval: does not limit approval to build-it');
  fail(!/does not authorize\s+`\/vs-to-issues`/.test(approval), 'Approval: issues/workers not opt-in');
  fail(!/never shape-it/.test(approval), 'Approval: does not say shape-it never creates issues or workers');
  fail(!/default session action is Continue/.test(approval), 'Approval: Continue is not the default');
  fail(!/`Next: \/vs-build-it <spec path>`/.test(approval), 'Approval: no explicit Next on Clear/Handoff');
  fail(!/Codex planning goal, mark it complete before\s+loading build-it/.test(approval), 'Approval: Codex planning goal not completed before build-it');
  fail(!/build-it's first `\[1\/7\]` line continues the same run/.test(skill), 'Handoff: no bridge into build-it');

  // Restored from approve-starts-build.static.eval.ts.
  fail(/it does not start implementation/i.test(skill), 'stale #86 close: "it does not start implementation"');
  fail(!/before approval, no implementation/i.test(skill), 'Verification: no "before approval, no implementation" check');
  return out;
}

describe('shape-it approve handoff: base skill', () => {
  it('has no contract problems', () => {
    expect(problems(SKILL)).toEqual([]);
  });

  for (const [name, situation, verb] of MUST_NOT_BUILD) {
    it(`does not build on: ${name} (${verb})`, () => {
      const row = parse(SKILL).rows.find((r) => situation.test(r.situation));
      expect(row?.verb).toBe(verb);
      expect(buildStarts(row?.outcome ?? '')).toEqual([]);
    });
  }
});

// Each mutant must change the text and must be caught.
const FINALIZE_ROW = /(\| The user asked for a spec or design only, not implementation \| )[^\n]*/;
const MUTANTS: Array<[string, (s: string) => string]> = [
  [
    'M1 spec-only row invokes build-it',
    (s) => s.replace(FINALIZE_ROW, '$1**Finalize:** `approve` accepts the spec, then invoke `/vs-build-it` too (a `build` reply also works) |'),
  ],
  [
    "M2 #86's loose trigger pasted back as prose",
    (s) =>
      s.replace(
        '\nA caller that handed off and ended',
        '\nWhen the user replies `approve` (or another clear acceptance), invoke `/vs-build-it` on the approved spec path in the same turn, even for spec-only requests.\n\nA caller that handed off and ended',
      ),
  ],
  [
    'M3 Build row loses the spec-only exclusion',
    (s) => s.replace(`READY, ${SPEC_ONLY_EXCLUSION}:`, 'READY:'),
  ],
  [
    'M4 unscoped never-build line inside HARD-GATE',
    (s) => s.replace('</HARD-GATE>', 'Never start implementation or invoke a build workflow from shape-it.\n</HARD-GATE>'),
  ],
  ['M5 precedence rule removed', (s) => s.replace(PRECEDENCE, 'rows are checked in order')],
  [
    "M6 #87's bare Workflow line restored",
    (s) => s.replace(WORKFLOW_LINE, 'Direct: on approval, continue into **Next**; otherwise emit **Next** only. Composed: return the approved spec to the caller.'),
  ],
  [
    "M7 #86's stale close restored",
    (s) => s.replace('#### Approval\n', '#### Approval\n\nApproval means ready for `/vs-build-it`; it does not start implementation.\n'),
  ],
  [
    'M8 Challenge row starts build-it',
    (s) => s.replace(/(\| Challenge route \| )[^\n]*/, '$1**Return:** `/vs-pushback` owns that close, then continue into `/vs-build-it` |'),
  ],
];

describe('shape-it approve handoff: mutants are caught', () => {
  for (const [name, mutate] of MUTANTS) {
    it(name, () => {
      const mutant = mutate(SKILL);
      expect(mutant, `${name} did not change the skill`).not.toBe(SKILL);
      expect(problems(mutant).length, `${name} survived`).toBeGreaterThan(0);
    });
  }
});
