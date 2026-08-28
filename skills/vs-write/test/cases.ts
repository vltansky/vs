import * as fs from 'node:fs';
import * as path from 'node:path';

// Shared case table for the vs-write evals. Lives outside the *.eval.ts files
// so the static eval can assert that none of the `canaries` below appear in
// SKILL.md — a canary quoted in the instructions measures compliance with the
// instructions, not fidelity.
// See adr/gate-writing-concision-on-source-fidelity.md.

export type Slice = 'iteration' | 'held-out';

export interface WriteCase {
  id: string;
  fixture: string;
  slice: Slice;
  /** What the brief asks for, for the genre-fit judge. */
  artifact: string;
  wordCeiling: number;
  /** Facts that carry meaning. Never phrasing — see the ADR's anchor risk. */
  anchors: RegExp[];
  /** Fabrications observed in the blind test, or their near neighbours. */
  canaries: RegExp[];
}

export const FIXTURE_DIR = path.join(__dirname, 'fixtures');

export function readBrief(caseSpec: WriteCase): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, caseSpec.fixture), 'utf8');
}

export const CASES: WriteCase[] = [
  {
    id: 't1-pr-description',
    fixture: 'task-1-pr-description.md',
    slice: 'iteration',
    artifact: 'a pull request description for reviewers on the team',
    wordCeiling: 260,
    anchors: [
      /OPS-4412/,
      /sliding.window/i,
      /REDIS_URL/,
      /warn/i,
      /3\s?ms/i,
      /1\.?2k|1,?200/i,
      /eval\.lua/,
      /out of scope/i,
      /500/,
      /3 replicas|three replicas/i,
    ],
    canaries: [/fail open/i, /failover is (now )?(handled|fixed|safe)/i],
  },
  {
    id: 't2-cli-errors',
    fixture: 'task-2-cli-errors.md',
    slice: 'held-out',
    artifact: 'user-facing error message text for three CLI failures',
    wordCeiling: 160,
    anchors: [
      /deploy init/,
      /--config/,
      /deploy login/,
      /30 days/i,
      /nothing was uploaded|nothing to clean|nothing needs/i,
      /release/i,
      /admin/i,
      /retry|retrying/i,
    ],
    canaries: [/contact support/i, /try again (later|in a few)/i],
  },
  {
    id: 't3-readme-config',
    fixture: 'task-3-readme-config.md',
    slice: 'iteration',
    artifact: 'the configuration section of a README for first-time setup',
    wordCeiling: 220,
    anchors: [
      /RETRY_MAX_ATTEMPTS/,
      // The range's two bounds near each other, however they are joined:
      // "0-10", "0 to 10", "between 0 and 10".
      /\b0\b[^.\n]{0,24}\b10\b/,
      /RETRY_BASE_DELAY_MS/,
      /500/,
      /2\^|doubl/i,
      /20%/,
      /jitter/i,
      /RETRY_DEAD_LETTER_URL/,
      /warn/i,
      /restart/i,
      /4\s*\+?\s*min|four minutes/i,
    ],
    canaries: [
      // Dead-lettering fires after attempts are exhausted, so it cannot
      // shorten the retry window. The blind test produced this claim verbatim.
      /dead.?letter\w*[^.]{0,80}(stop|shorten|fewer|sooner)[^.]{0,20}(retry|retries|attempts)/i,
      /lower the base delay/i,
      /before the first retry/i,
    ],
  },
  {
    id: 't4-incident-summary',
    fixture: 'task-4-incident-summary.md',
    slice: 'iteration',
    artifact: 'the summary section of a postmortem, not the whole postmortem',
    wordCeiling: 200,
    anchors: [
      /39 minutes/i,
      /1,?140/,
      /812/,
      /328/,
      /1\/400|400x|400 times/i,
      /not confirmed|do not know|don't know|haven't confirmed/i,
      // Negation is part of the fact: "orders were lost" is the opposite claim.
      /no data (loss|was lost)|no (data|orders?|records?) (were|was) lost|nothing was lost|(data|orders?) (were|was) not lost/i,
      /double.charg/i,
      /ledger/i,
      /contributing factor|contributed to/i,
    ],
    canaries: [
      // The brief says "39 minutes of degraded checkout" at a 38% error rate.
      /\boutage\b/i,
      // Only assertive loss counts. "we have not confirmed whether they
      // retried later or abandoned" restates the brief's own hedge, so a bare
      // /abandoned/ punished faithful copy — the hedge itself is already an
      // anchor above.
      /\bchurn\w*|lost (those|these|the) customers/i,
      // Promotes the tooling gap from contributing factor to cause.
      /(root )?cause[:\s][^.]{0,60}production.like/i,
    ],
  },
  {
    id: 't5-concept-explainer',
    fixture: 'task-5-concept-explainer.md',
    slice: 'held-out',
    artifact: 'an explainer of idempotency keys for non-coding staff',
    wordCeiling: 380,
    anchors: [
      /24.?h|24 hours/i,
      /endpoint/i,
      /different.{0,20}(body|request)/i,
      /reject|error/i,
      /(two|separate|different)[^.]{0,25}keys/i,
      /expire/i,
    ],
    canaries: [
      // The self-contradiction: a different body with a reused key is
      // rejected, not answered from the store.
      /(different|second|new) (charge|request)[^.]{0,80}(returns?|gets?|gives?)[^.]{0,40}(stored|first|original) (result|response)/i,
    ],
  },
  {
    id: 't6-release-announcement',
    fixture: 'task-6-release-announcement.md',
    slice: 'iteration',
    artifact: 'a release announcement for existing users',
    wordCeiling: 230,
    anchors: [
      /410/,
      /\/docs\/v3-migration/,
      /50,?000/,
      /mobile web/i,
      /recently updated/i,
      /[Ss]ettings/,
    ],
    canaries: [
      // The brief claims only that the >200-item bug is fixed.
      /regardless of (the )?(selection )?size/i,
      /we'?ll (follow up|let you know|update you)/i,
      /we'?re (excited|thrilled|pleased|delighted)/i,
    ],
  },
];

export const SLOP = [
  /\bdelve\b/i,
  /\bleverag\w+/i,
  /\bseamless\w*/i,
  /\brobust\w*/i,
  /\bgroundbreaking\b/i,
  /\bcutting.edge\b/i,
  /\bmultifaceted\b/i,
  /\bfoster\w*/i,
  /\brealm\b/i,
  /\btapestry\b/i,
  /\btestament\b/i,
  /\benduring legacy\b/i,
  /\bpivotal\b/i,
  /\bcomprehensive\w*/i,
  /\bempower\w*/i,
  /\bunlock\w*/i,
  /we'?re excited/i,
  /ensur\w+ (reliability|consistency|scalability)/i,
  /\p{Extended_Pictographic}/u,
  /\bIn conclusion\b/i,
  /the future looks bright/i,
  /not X but Y/i,
  /if you'?re coming from/i,
];

/** Slop-reject fixtures scored by scripts/reject-slop.mjs, not PathGrade. */
export const SLOP_FIXTURES = [
  'bad-closer.md',
  'comparison-crutch.md',
  'structural-no-chain.md',
  'structural-dont-verb-it.md',
  'structural-sit-with.md',
  'structural-whole-point.md',
  'structural-stacked-questions.md',
  'structural-echo-run.md',
  'structural-colon-triple.md',
  'structural-did-not-chain.md',
  'structural-already-know.md',
  'structural-punchline.md',
  'structural-heres-the-twist.md',
  'structural-not-nothing.md',
  'structural-worth-naming.md',
  'structural-performative-honesty.md',
  'structural-take-my-word.md',
  'structural-turns-out.md',
  'structural-sentence-anaphora.md',
  'structural-not-just.md',
  'structural-ai-leftovers.md',
  'structural-despite-challenges.md',
  'structural-participle-tail.md',
  'structural-vague-experts.md',
] as const;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was',
  'were', 'when', 'which', 'with', 'you', 'your',
]);

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word));
}

function trigrams(words: string[]): string[] {
  const grams: string[] = [];
  for (let i = 0; i + 2 < words.length; i++) {
    grams.push(words.slice(i, i + 3).join(' '));
  }
  return grams;
}

export function countWords(copy: string): number {
  return copy.split(/\s+/).filter(Boolean).length;
}

export function countHeadings(copy: string): number {
  return (copy.match(/^#{1,6}\s+\S/gm) ?? []).length;
}

/** Bold text used as a run-in label: `**Cause:** ...`, `- **Impact** — ...`. */
export function countBoldRunInLabels(copy: string): number {
  return (copy.match(/^\s*(?:[-*+]\s+|\d+\.\s+)?\*\*[^*\n]+\*\*\s*[:—–-]/gm) ?? [])
    .length;
}

/**
 * True when any sentence directly beneath a heading repeats three or more
 * consecutive content words from that heading. This is the "restates the
 * heading" failure the blind judges kept naming.
 */
export function restatesAHeading(copy: string): boolean {
  const lines = copy.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^#{1,6}\s+(.*\S)/);
    if (!heading) continue;

    const headingGrams = new Set(trigrams(contentWords(heading[1])));
    if (headingGrams.size === 0) continue;

    // The first non-empty block under the heading, up to the next heading.
    const body: string[] = [];
    for (let j = i + 1; j < lines.length && body.length < 4; j++) {
      if (/^#{1,6}\s/.test(lines[j])) break;
      if (lines[j].trim()) body.push(lines[j]);
    }

    for (const gram of trigrams(contentWords(body.join(' ')))) {
      if (headingGrams.has(gram)) return true;
    }
  }
  return false;
}

export interface ShapeBudget {
  score: number;
  details: string;
}

/** Four sub-criteria, scored as the fraction met. Graded, not binary, so the
 * improvement bar stays readable on cases that already pass some of them. */
export function scoreShapeBudget(copy: string, caseSpec: WriteCase): ShapeBudget {
  const words = countWords(copy);
  const headings = countHeadings(copy);
  const boldLabels = countBoldRunInLabels(copy);
  const restates = restatesAHeading(copy);

  const criteria = [
    { name: `words ${words}/${caseSpec.wordCeiling}`, met: words <= caseSpec.wordCeiling },
    { name: `headings ${headings}/5`, met: headings <= 5 },
    { name: `bold-labels ${boldLabels}/2`, met: boldLabels <= 2 },
    { name: 'no-heading-restatement', met: !restates },
  ];

  return {
    score: criteria.filter((c) => c.met).length / criteria.length,
    details: criteria.map((c) => `${c.met ? 'ok' : 'FAIL'} ${c.name}`).join(', '),
  };
}
