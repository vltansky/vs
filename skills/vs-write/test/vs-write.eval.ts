import * as fs from 'node:fs';
import * as path from 'node:path';
import { check, createAgent, evaluate, judge, score } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';
import {
  CASES,
  SLOP,
  readBrief,
  scoreShapeBudget,
  type WriteCase,
} from './cases';

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'claude') as
  | 'claude'
  | 'codex';

// The held-out slice never runs during iteration, so a pass cannot be tuned
// toward cases it was allowed to watch. `VS_WRITE_SLICE=all` opens it, and only
// the final gate sets that. See adr/gate-writing-concision-on-source-fidelity.md.
const SLICE = process.env.VS_WRITE_SLICE ?? 'iteration';
const TRIALS = Number(process.env.VS_WRITE_TRIALS ?? '1');

// Fidelity is a gate, not a weighted score. Zero canaries is absolute; anchor
// survival has a floor because no draft in the blind test carried every anchor,
// so a 100% bar would fail every plausible version of the skill alike.
//
// The composite score is recorded, not gated. An earlier 0.8 floor on it was
// set before anything had been measured; measurement then put the pre-merge
// skill's own mean at 0.811 with runs as low as 0.432, so the floor sat above
// the mean and failed roughly half of every version's runs alike. It also
// gated on two binary judges, which the ADR rules out — force is measured on
// structure, not by a judge. See
// adr/gate-writing-concision-on-source-fidelity.md.
const FACTS_FLOOR = 0.9;

const ANSWER = 'answer.md';

/**
 * The agent writes its copy to a file and is told not to print it. Scoring the
 * file rather than `ctx.transcript` is what makes these checks behavioral:
 * `transcript()` concatenates user and agent messages, so the brief we hand in
 * is inside it and a `facts-survive` regex over it would pass on the prompt
 * alone.
 */
function readAnswer(workspace: string): string {
  const file = path.join(workspace, ANSWER);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function buildPrompt(caseSpec: WriteCase): string {
  return (
    `${readBrief(caseSpec)}\n\n` +
    `Write the finished copy to a file named ${ANSWER} in the current ` +
    `directory. Put only the copy in that file — no preamble, no notes about ` +
    `your process. Do not reproduce the copy in your reply.`
  );
}

function scorersFor(caseSpec: WriteCase) {
  return [
    score(
      'facts-survive',
      ({ workspace }) => {
        const copy = readAnswer(workspace);
        if (!copy) return { score: 0, details: `${ANSWER} not written` };
        const missing = caseSpec.anchors.filter((re) => !re.test(copy));
        return {
          score: (caseSpec.anchors.length - missing.length) / caseSpec.anchors.length,
          details: missing.length
            ? `dropped: ${missing.map(String).join(' ')}`
            : 'all anchors present',
        };
      },
      { weight: 3 },
    ),
    // Scored rather than checked only so a failure names the canary and quotes
    // the sentence that tripped it. The gate is unchanged: anything below 1 is
    // a fidelity failure.
    score(
      'no-invention',
      ({ workspace }) => {
        const copy = readAnswer(workspace);
        if (!copy) return { score: 0, details: `${ANSWER} not written` };
        const tripped = caseSpec.canaries
          .map((re) => ({ re, hit: copy.match(re) }))
          .filter((entry) => entry.hit);
        return {
          score: tripped.length ? 0 : 1,
          details: tripped
            .map((entry) => `${entry.re} matched "${entry.hit?.[0]}"`)
            .join(' | '),
        };
      },
      { weight: 3 },
    ),
    check(
      'no-slop',
      ({ workspace }) => {
        const copy = readAnswer(workspace);
        return copy !== '' && !SLOP.some((re) => re.test(copy));
      },
      { weight: 1 },
    ),
    score(
      'shape-budget',
      ({ workspace }) => {
        const copy = readAnswer(workspace);
        if (!copy) return { score: 0, details: `${ANSWER} not written` };
        return scoreShapeBudget(copy, caseSpec);
      },
      { weight: 1 },
    ),
    judge('reader-first-order', {
      weight: 2,
      input: ({ workspace }) => ({ 'The finished copy': readAnswer(workspace) }),
      rubric: `You are judging one piece of finished copy against the writing brief it was written from. The brief is in the transcript; the copy is below it.

First, in two or three sentences, reason about what the brief's named audience most needs to know, and about what the copy actually puts first — at the top of the document, and at the top of each section.

Then score, and only after you have reasoned:

1.0 — the opening sentence of the document, and of every section, carries what that audience most needs. A reader who stopped after the first line of any block would still have the most important thing in it.
0.0 — anything else. The copy opens with background or setup, restates the brief's own framing, buries the decision or the impact under detail, or orders blocks so the reader meets a term before it has been grounded.

Score exactly 1.0 or 0.0. There is no partial credit.`,
    }),
    judge('genre-fit', {
      weight: 1,
      input: ({ workspace }) => ({ 'The finished copy': readAnswer(workspace) }),
      rubric: `The brief in the transcript asked for ${caseSpec.artifact}. The finished copy is below it.

First, in one or two sentences, say what artifact the copy actually is, and whether it contains material the requested artifact would not.

Then score:

1.0 — the copy is that artifact and nothing more. It does not annex neighbouring sections, add a section the format does not need, or address a different audience than the brief named.
0.0 — anything else, including a correct artifact padded with material the brief did not ask for.

Score exactly 1.0 or 0.0. There is no partial credit.`,
    }),
  ];
}

const ACTIVE = CASES.filter(
  (caseSpec) => SLICE === 'all' || caseSpec.slice === 'iteration',
);

describe(`vs-write fidelity and shape (${SLICE} slice)`, () => {
  for (const caseSpec of ACTIVE) {
    for (let trial = 1; trial <= TRIALS; trial++) {
      it(`${caseSpec.id} keeps the facts and drops the padding (trial ${trial})`, async () => {
        const agent = await createAgent({
          agent: EVAL_AGENT,
          timeout: 300,
          skillDir: SKILL_DIR,
        });

        await promptOnce(agent, buildPrompt(caseSpec), { maxTurns: 4 });

        const result = await evaluate(agent, scorersFor(caseSpec), {
          failFast: false,
          onScorerError: 'zero',
        });

        const by = (name: string) =>
          result.scorers.find((entry) => entry.name === name);

        // Printed so a baseline run is a recorded measurement, not a pass/fail.
        console.log(
          `[${caseSpec.id} t${trial}] overall=${result.score.toFixed(3)} ` +
            result.scorers
              .map((entry) => `${entry.name}=${entry.score.toFixed(2)}`)
              .join(' '),
        );
        for (const entry of result.scorers) {
          if (entry.score < 1 && entry.details) {
            console.log(`    ${entry.name}: ${entry.details}`);
          }
        }

        // The workspace goes away with the agent, so keep the copy for
        // inspection. `VS_WRITE_KEEP` names the run so passes stay comparable.
        const keep = process.env.VS_WRITE_KEEP;
        if (keep) {
          fs.mkdirSync(keep, { recursive: true });
          fs.writeFileSync(
            path.join(keep, `${caseSpec.id}-t${trial}.md`),
            readAnswer(agent.workspace),
          );
        }

        await agent.dispose();

        expect(by('no-invention')?.score).toBe(1);
        expect(by('facts-survive')?.score).toBeGreaterThanOrEqual(FACTS_FLOOR);
      });
    }
  }
});
