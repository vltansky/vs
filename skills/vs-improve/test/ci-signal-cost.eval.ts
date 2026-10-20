import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { check, evaluate, judge } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { answerOnly, signalBeforeSpeedup, zeroSignalRow } from './ci-signal-cost.helpers';

// Replays three real Repo-chat turns (backlog #7). Each time the CI agent went
// straight to plumbing (parallel jobs, caches, dedupe, hardening) and Vlad had
// to name the real lever himself: steps that never fail.
//   Aug 29: "Check last days ci runs  What can be improved ?"
//     -> plumbing list; Vlad: "Find what really don't give value / Like tests
//        that never fail / ... It's too much spend"
//   Oct 16: "6 mins still al ot no? how ca nwe cut"
//     -> "Split backend-test into 3 parallel jobs ... make installs faster";
//        Vlad: "lets pushback on what we run here / maybe we dont need smth /
//        e.g firestore?"
//   Oct 18-20: rounds of Screenmap hardening (Gradle misses, EAS dedupe,
//     injection fix) without asking what Screenmap ever caught;
//     Vlad: "remove screenmap workflow".
// The plain-model baseline on the Aug 29 fixture FAILED the same way.
//
// Pass: the answer opens with a per-step table of what each step caught in
// the window (for jobs that do not block merge: whether anyone used their
// output) next to what it costs, names the zero-signal steps and offers cut /
// path-gate / move to nightly / keep, and only then lists speed-ups. Fail:
// parallelizing or caching before that.
//
// Negative control (mt-reports-ci-allsignal): the same repo where every check
// caught real failures and the preview link is used. The honest answer says it
// checked and found no never-failing step; inventing a zero fails.

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.resolve(SKILL_DIR, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';

function stageWorkspace(fixture: string) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-improve-ci-'));
  fs.cpSync(path.join(FIXTURES, fixture), workspace, { recursive: true });
  for (const convention of ['.agents', '.claude']) {
    for (const skill of ['vs-internal-shared', 'vs-ponytail', 'vs-architect']) {
      fs.cpSync(
        path.join(SKILLS_DIR, skill),
        path.join(workspace, convention, 'skills', skill),
        { recursive: true, filter: (src) => !src.split(path.sep).includes('test') },
      );
    }
  }
  execSync(
    'git init -q -b master && git add -A && git -c user.email=e@x -c user.name=eval commit -qm "mt-reports snapshot"',
    { cwd: workspace },
  );
  return workspace;
}

const FRAME = `Use $vs-improve, focused on CI. Answer Vlad in chat; he picks before any plan files are written.

[You are the CI agent for Vlad's mt-reports monorepo (this workspace). The last 30 days of GitHub Actions results are in ci/runs-30d.csv: job and step names, durations, conclusions, billed minutes, the first failure line, and whether a rerun passed. ci/output-usage-30d.csv says, per PR, whether anyone looked at the comments posted by jobs that do not block merge. Workflows are in .github/workflows/.]`;

const VALUE_VS_PLUMBING = `Two kinds of advice, do not confuse them:
- VALUE decisions: cut a step, path-gate it (run only when its inputs change), move it to nightly / local, or keep it, decided by what it caught or what its output informed.
- PLUMBING (speed-ups and hardening): parallelize or split jobs, caches, faster installs, retries, preflights, disk cleanup, timeouts.
For a job that does not block merge (Screenmap, Preview), "failures caught" is the wrong measure; the signal is whether anyone looked at or acted on its output.
Ignore progress narration such as "I'm checking X before proposing caching"; grade the answer.`;

type Scenario = {
  id: string;
  fixture: string;
  context: string;
  turn: string;
  kind: 'zero-signal' | 'none-found';
  never?: RegExp;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'aug29-what-can-be-improved',
    fixture: 'mt-reports-ci',
    kind: 'zero-signal',
    context:
      'Earlier you estimated last-30-day CI spend at ~$64–70 (list price), mostly "CI Test" $36–42, previews $10, and explained which jobs run per package.',
    turn: 'Aug 29, Vlad: "Check last days ci runs  What can be improved ?"',
    never: /firestore|storage[\s-]*rules|headless|screenmap/i,
  },
  {
    id: 'oct16-how-can-we-cut',
    fixture: 'mt-reports-ci',
    kind: 'zero-signal',
    context:
      'A functions PR now takes about 6 minutes of CI; backend-test (install, functions unit tests, Firestore rules tests, Storage rules tests in one job) is the long pole.',
    turn: 'Oct 16, Vlad: "6 mins still al ot no?\nhow ca nwe cut"',
    never: /firestore|storage[\s-]*rules|headless/i,
  },
  {
    id: 'oct20-screenmap-hardening',
    fixture: 'mt-reports-ci',
    kind: 'zero-signal',
    context:
      'Screenmap run 39168396911 paid a 29-minute Gradle cache miss and then the emulator failed to boot. 9 of the last 60 Screenmap runs took 20 minutes or more. See ci/screenmap-notes.md.',
    turn: 'Oct 19, Vlad: "screenmap died at emulator boot again after a 29 min gradle miss. fix it so it stops eating 30 min"',
    never: /screenmap/i,
  },
  {
    id: 'control-every-step-catches',
    fixture: 'mt-reports-ci-allsignal',
    kind: 'none-found',
    context:
      'A functions PR now takes about 6 minutes of CI; backend-test (install, functions unit tests, Firestore rules tests, Storage rules tests in one job) is the long pole.',
    turn: 'Vlad: "6 mins still al ot no?\nhow ca nwe cut"',
  },
];

const ZERO_SIGNAL_RUBRIC = `Vlad asked how to improve or cut CI (or to fix a slow, flaky CI job). In real runs, the CI agent answered with plumbing only and Vlad had to name the lever himself: "Find what really don't give value / Like tests that never fail / Maybe we should just remove part of things on ci". In this repo's data: Firestore rules tests (~76s) and Storage rules tests (~41s) run on every backend run and caught 0 real failures in 30 days; headless-test (~2.5 min) caught 0; Screenmap (does not block merge) failed only on infra and nobody looked at its screenshot comments on any PR. Preview (does not block merge) is used: its URL was opened or quoted in most PRs.

${VALUE_VS_PLUMBING}
A table row that shows 0 real failures (or output never used) for a step, with its time or billed minutes, counts as naming that step and its cost.

Score 1.0: The reply OPENS with a per-step signal-vs-cost view (what each step caught, or for non-blocking jobs whether its output was used, next to time or billed minutes), names the zero-signal steps with their cost, and puts the decision to Vlad (cut, path-gate, nightly, or keep). Any speed-up or hardening ideas come after that, or only for steps that passed the "is it needed?" check.
Score 0.5: The reply names a zero-signal step and its cost, but leads with parallelizing/caching/hardening, or buries the decision below the plumbing fixes.
Score 0.0: The reply lists only plumbing fixes and never looks at what each step caught or whether its output was used.`;

const NONE_FOUND_RUBRIC = `Vlad asked how to cut CI time. In this repo's 30-day data every check caught real failures: lint 9, typecheck 7, Functions unit tests 11, Firestore rules tests 3, Storage rules tests 2, reportan-web-test 4, reportan-web-e2e 2 real (plus 3 flaky), headless-test 2. Preview (does not block merge) is used: its URL was opened or quoted in most PRs. "changes" and "Install" are setup, not checks. So there is no never-failing check to cut.

${VALUE_VS_PLUMBING}

Score 1.0: The reply opens with the per-step caught-vs-cost view, says plainly that it checked the window and found no never-failing (zero-signal) check, and only then offers speed-ups or path-gating ideas for checks that do catch things. It does not claim any check caught 0 real failures.
Score 0.5: The reply finds no zero-signal check but never says so (jumps to speed-ups after the table), or hedges with a weak "maybe cut X" without data.
Score 0.0: The reply invents a zero-signal check (claims a check caught 0 real failures or its output was never used, when the data shows otherwise) and proposes cutting it, or skips the caught-vs-cost view entirely.`;

const TABLE = /\|[^\n]*(?:caught|fail|real|used|looked)[^\n]*\|[^\n]*(?:cost|min|billed|time|\bs\b)[^\n]*\||\|[^\n]*(?:cost|min|billed|time)[^\n]*\|[^\n]*(?:caught|fail|real|used|looked)[^\n]*\|/i;

function scorersFor(scenario: Scenario, reply: string) {
  const table = check('has-signal-cost-table', () => TABLE.test(reply));
  if (scenario.kind === 'none-found') {
    return [
      // Prose like "no failures were rerun-only flakes" is not a zero claim,
      // so the deterministic check reads only the table; the judge grades
      // whether the reply says it checked and found none.
      check('no-invented-zero-row', () => zeroSignalRow(answerOnly(reply)) < 0, { weight: 2 }),
      table,
      judge('signal-vs-cost-first', {
        input: { 'final reply to Vlad (progress narration removed)': answerOnly(reply) },
        rubric: NONE_FOUND_RUBRIC,
        weight: 3,
      }),
    ];
  }
  const never = scenario.never as RegExp;
  return [
    check('names-never-failing-before-speedup', () => signalBeforeSpeedup(reply).ok, { weight: 2 }),
    check('names-the-step', () => {
      const { sig, answer } = signalBeforeSpeedup(reply);
      if (sig < 0) return false;
      return never.test(answer.slice(Math.max(0, sig - 300), sig + 400));
    }),
    table,
    judge('signal-vs-cost-first', {
      input: { 'final reply to Vlad (progress narration removed)': answerOnly(reply) },
      rubric: ZERO_SIGNAL_RUBRIC,
      weight: 3,
    }),
  ];
}

describe('vs-improve CI signal-vs-cost gate (#7 replay)', () => {
  for (const scenario of SCENARIOS) {
    it(`asks what each step caught before speeding it up: ${scenario.id}`, async () => {
      const workspace = stageWorkspace(scenario.fixture);
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 600,
        skillDir: SKILL_DIR,
        workspace,
        debug: true,
      });

      try {
        const reply = await agent.prompt(`${FRAME}\n\n${scenario.context}\n\n${scenario.turn}`);
        const result = await evaluate(agent, scorersFor(scenario, reply), {
          failFast: false,
          onScorerError: 'zero',
        });

        console.log(
          `[ci-signal-cost:${scenario.id}]`,
          JSON.stringify({
            score: result.score,
            order: (({ sig, speed, ok }) => ({ sig, speed, ok }))(signalBeforeSpeedup(reply)),
            scorers: result.scorers.map((s) => ({ name: s.name, score: s.score, details: s.details })),
            reply,
          }),
        );
        const gate = result.scorers.find((s) => s.name === 'signal-vs-cost-first');
        expect(gate?.score ?? 0).toBeGreaterThanOrEqual(0.75);
        expect(result.score).toBeGreaterThanOrEqual(0.75);
      } finally {
        await agent.dispose();
        fs.rmSync(workspace, { recursive: true, force: true });
      }
    }, 720_000);
  }
});
