import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { check, evaluate, judge } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';

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
// the window next to what it costs, names the never-failing steps (or says it
// checked and found none) and offers cut / path-gate / move-local, and only
// then lists speed-ups. Fail: parallelizing or caching before that.

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.resolve(SKILL_DIR, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'mt-reports-ci');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';

function stageWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-improve-ci-'));
  fs.cpSync(FIXTURE_DIR, workspace, { recursive: true });
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

[You are the CI agent for Vlad's mt-reports monorepo (this workspace). The last 30 days of GitHub Actions results are in ci/runs-30d.csv: job and step names, durations, conclusions, billed minutes, the first failure line, and whether a rerun passed. Workflows are in .github/workflows/.]`;

const SCENARIOS = [
  {
    id: 'aug29-what-can-be-improved',
    context:
      'Earlier you estimated last-30-day CI spend at ~$64–70 (list price), mostly "CI Test" $36–42, previews $10, and explained which jobs run per package.',
    turn: 'Aug 29, Vlad: "Check last days ci runs  What can be improved ?"',
    never: /firestore|storage[\s-]*rules|headless/i,
  },
  {
    id: 'oct16-how-can-we-cut',
    context:
      'A functions PR now takes about 6 minutes of CI; backend-test (install, functions unit tests, Firestore rules tests, Storage rules tests in one job) is the long pole.',
    turn: 'Oct 16, Vlad: "6 mins still al ot no?\nhow ca nwe cut"',
    never: /firestore|storage[\s-]*rules|headless/i,
  },
  {
    id: 'oct20-screenmap-hardening',
    context:
      'Screenmap run 39168396911 paid a 29-minute Gradle cache miss and then the emulator failed to boot. 9 of the last 60 Screenmap runs took 20 minutes or more. See ci/screenmap-notes.md.',
    turn: 'Oct 19, Vlad: "screenmap died at emulator boot again after a 29 min gradle miss. fix it so it stops eating 30 min"',
    never: /screenmap/i,
  },
] as const;

// Codex streams progress notes ("I'm checking X before proposing caching...")
// into the same reply. Score the answer, not the narration.
function answerOnly(reply: string) {
  return reply
    .split(/\n{2,}/)
    .filter(
      (para) =>
        para.includes('|') ||
        !/\bI[’'](?:m|ll)\b|\bI (?:am|will)\b|\bbefore (?:proposing|suggesting|considering)\b|\bonly then consider\b/.test(para),
    )
    .join('\n\n');
}

// First mention of a step that caught nothing (prose, or a table row whose
// real-failures cell is 0), vs first speed-up idea.
const NEVER_FAILED =
  /(?:\b(?:0|zero|no|never|none)\b[^.\n|]{0,40}\b(?:fail(?:ed|ures?)?|caught|catch(?:es)?|real (?:failure|bug|regression)s?)\b)|(?:\bfail(?:ed|ures?)\b[^.\n|]{0,12}\b(?:0|zero|never)\b)|(?:\binfra(?:structure)?[- ]only\b)|(?:\ball (?:\d+ )?(?:failures? )?(?:were |are )?infra)/i;
const SPEEDUP =
  /\bparallel(?:i[sz]e|i[sz]ing|ism)?\b|\bshard(?:s|ing)?\b|\bmatrix\b|\bcach(?:e|es|ed|ing)\b|\bsplit (?:\S+ ){0,3}(?:into|jobs?)\b|\bfaster install/i;

function zeroSignalRow(answer: string): number {
  const lines = answer.split('\n');
  let offset = 0;
  let col = -1;
  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const header = cells.findIndex((c) => /real|caught/i.test(c));
      if (header >= 0 && !/^\d/.test(cells[header])) col = header;
      else if (col >= 0 && /^(?:0|none)$/i.test(cells[col] ?? '') && cells[0] && !/^-+$/.test(cells[0])) return offset;
    } else {
      col = -1;
    }
    offset += line.length + 1;
  }
  return -1;
}

function signalBeforeSpeedup(reply: string) {
  const answer = answerOnly(reply);
  const hits = [answer.search(NEVER_FAILED), zeroSignalRow(answer)].filter((i) => i >= 0);
  const sig = hits.length ? Math.min(...hits) : -1;
  const speed = answer.search(SPEEDUP);
  return { sig, speed, ok: sig >= 0 && (speed < 0 || sig < speed), answer };
}

describe('vs-improve CI signal-vs-cost gate (#7 replay)', () => {
  for (const scenario of SCENARIOS) {
    it(`asks what each step caught before speeding it up: ${scenario.id}`, async () => {
      const workspace = stageWorkspace();
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 600,
        skillDir: SKILL_DIR,
        workspace,
        debug: true,
      });

      try {
        const reply = await agent.prompt(`${FRAME}\n\n${scenario.context}\n\n${scenario.turn}`);

        const result = await evaluate(
          agent,
          [
            check('names-never-failing-before-speedup', () => signalBeforeSpeedup(reply).ok, {
              weight: 2,
            }),
            check('names-the-step', () => {
              const { sig, answer } = signalBeforeSpeedup(reply);
              if (sig < 0) return false;
              return scenario.never.test(answer.slice(Math.max(0, sig - 300), sig + 400));
            }),
            check('has-signal-cost-table', () =>
              /\|[^\n]*(?:caught|fail|real)[^\n]*\|[^\n]*(?:cost|min|billed|time|\bs\b)[^\n]*\||\|[^\n]*(?:cost|min|billed|time)[^\n]*\|[^\n]*(?:caught|fail|real)[^\n]*\|/i.test(
                reply,
              ),
            ),
            judge('signal-vs-cost-first', {
              input: { 'final reply to Vlad (progress narration removed)': answerOnly(reply) },
              rubric: `Vlad asked how to improve or cut CI (or to fix a slow, flaky CI job). In real runs, the CI agent answered with plumbing only (split jobs into parallel ones, faster installs, caches, dedupe, hardening) and Vlad had to name the lever himself: "Find what really don't give value / Like tests that never fail / Maybe we should just remove part of things on ci". The data in this repo has steps that took real time and never caught a real failure in 30 days (Firestore rules tests ~76s and Storage rules tests ~41s on every backend run, headless-test ~2.5 min, 0 failures; Screenmap failed only on infra: emulator boot, runner disk, Gradle download).

Two kinds of advice, do not confuse them:
- VALUE decisions (the good lever here): cut a step, path-gate it (run only when its inputs change), or move it local / nightly, because it caught nothing.
- PLUMBING (speed-ups and hardening): parallelize or split jobs, caches, faster installs, retries, preflights, disk cleanup, timeouts.
A table row that shows 0 real failures for a step, with its time or billed minutes, counts as naming that step and its cost.
Ignore progress narration such as "I'm checking X before proposing caching"; grade the answer.

Score 1.0: The reply OPENS with a per-step signal-vs-cost view (what each step caught in the window next to what it costs: time or billed minutes), names the steps that never failed or only failed on infra with their cost, and proposes cutting, path-gating, or moving them local (or explicitly says it checked and found none). Any speed-up or hardening ideas (parallel jobs, caching, faster installs, retries) come after that, or only for steps that passed the "is it needed?" check.
Score 0.5: The reply names a never-failing step and its cost, but leads with parallelizing/caching/hardening, or buries the cut decision below the plumbing fixes.
Score 0.0: The reply lists only plumbing fixes (parallelize, cache, faster installs, retries, dedupe) and never looks at what each step caught.`,
              weight: 3,
            }),
          ],
          { failFast: false, onScorerError: 'zero' },
        );

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
