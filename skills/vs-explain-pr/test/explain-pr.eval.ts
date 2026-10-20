import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { CATCH_ALL_ASK_USER, CONVERSE_ASK_USER_DEFAULTS } from '../../vs-internal-shared/test/pathgrade-v1';
import { agentEnv, buildWorkspace, gitDirFor, ghCalls, pinMockGhFirst, prepareRunDir, prs, setupGit } from '../../vs-ship-it/test/ab/harness';
import { VARIANTS } from '../../vs-ship-it/test/ab/variants';

// Live ship-it runs against the offline gh (ship-it/test/ab/mock-gh.mjs):
//   offers-and-ships  a big user-facing UI change: ship-it offers the video in one line early, then
//                     commits, pushes, and opens the PR in the same run (the offer never blocks)
//   tiny-silent       a one-word docs typo: no offer, no video, a normal PR
//   mid-silent        a ~90-line pricing helper with a test, no UI: no offer, no video, a normal PR
//   pr-before-video   "create pr with video": no offer; the PR is created before the upload and the REST PATCH
//   late-yes          the offer is answered "yes" after the PR is open: the video lands on the open PR
// Opt-in (each run is a full agent session):
//   EXPLAIN_PR_LIVE=1 [EXPLAIN_PR_CASES=asks-up-front,...] [EXPLAIN_PR_RUNS=3] [EXPLAIN_PR_ARM=branch]
//   [SHIPIT_AB_SKILLS_ROOT=<master checkout>/skills] npx vitest run skills/vs-explain-pr/test/explain-pr.eval.ts
// Every run appends one row to /tmp/shipit-ab/runs/explain-pr.jsonl with a pass/fail per scorer.

const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const RUNS = Number(process.env.EXPLAIN_PR_RUNS ?? 3);
const ARM = process.env.EXPLAIN_PR_ARM ?? 'branch';
const CASES = (process.env.EXPLAIN_PR_CASES ?? 'offers-and-ships,tiny-silent,mid-silent,pr-before-video,late-yes').split(',');
const RESULTS = '/tmp/shipit-ab/runs/explain-pr.jsonl';
const BASELINE = VARIANTS.find((v) => v.id === 'v0-baseline')!;
const QUESTION = /narrated video|video explainer|want a video/i;
const OFFER = /want a narrated video|reply yes and i'll add it|want a video/i;
const NO_BROWSER = 'No preview server, browser, or Playwright exists in this environment: state the media gaps instead of capturing.';

const g = (runDir: string, ws: string, ...a: string[]) =>
  execFileSync('git', ['--git-dir', gitDirFor(EVAL_AGENT, runDir, ws), '--work-tree', ws, ...a], { cwd: ws, encoding: 'utf8' }).trim();

// A multi-step checkout wizard: ~330 lines of user-facing UI (frontend path, a flow with clicks and a submit).
function writeWizard(ws: string) {
  const steps = ['Cart', 'Shipping', 'Coupon', 'Payment', 'Review', 'Done'];
  const fields = ['name', 'street', 'city', 'zip', 'phone', 'email', 'coupon', 'card', 'expiry', 'cvc'];
  const lines: string[] = ["import { applyCoupon } from '../coupon.js';", '', 'export const STEPS = ['];
  for (const s of steps) lines.push(`  { id: '${s.toLowerCase()}', title: '${s}' },`);
  lines.push('];', '');
  for (const f of fields) {
    lines.push(`export function ${f}Field({ value, onChange, error }) {`,
      `  return (`, `    <label className="field field-${f}">`, `      <span>${f}</span>`,
      `      <input name="${f}" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />`,
      `      {error ? <p role="alert" className="field-error">{error}</p> : null}`, `    </label>`, `  );`, '}', '');
  }
  for (const s of steps) {
    lines.push(`export function ${s}Step({ state, setState, next, back }) {`,
      `  const errors = validate${s}(state);`, `  return (`, `    <section aria-labelledby="step-${s.toLowerCase()}">`,
      `      <h2 id="step-${s.toLowerCase()}">${s}</h2>`,
      `      <button type="button" onClick={back} disabled={!back}>Back</button>`,
      `      <button type="button" onClick={() => (Object.keys(errors).length ? setState({ ...state, errors }) : next())}>Continue</button>`,
      `    </section>`, `  );`, '}', '',
      `function validate${s}(state) {`, `  const errors = {};`,
      `  if (state.step === '${s.toLowerCase()}' && !state.ok) errors.step = '${s} is incomplete';`, `  return errors;`, '}', '');
  }
  lines.push('export function CheckoutWizard({ cart, now = Date.now() }) {', '  const [state, setState] = useState({ step: 0, cart });',
    '  const step = STEPS[state.step];', '  const next = () => setState({ ...state, step: Math.min(state.step + 1, STEPS.length - 1) });',
    '  const back = state.step ? () => setState({ ...state, step: state.step - 1 }) : null;',
    '  const total = applyCoupon(cart.total, state.coupon, now);',
    '  return <form onSubmit={(e) => { e.preventDefault(); next(); }}>{step.title} — {total}</form>;', '}', '');
  fs.mkdirSync(path.join(ws, 'src', 'ui'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'src', 'ui', 'CheckoutWizard.jsx'), `${lines.join('\n')}\n`);
}

// A ~90-line backend helper plus its test: below the 150-line skip line, no UI, no new screen.
function writePricing(ws: string) {
  const tiers = [[10, 2], [25, 5], [50, 8], [100, 12], [250, 15], [500, 18]];
  const lines = ['// Bulk discounts: the percent off grows with the quantity.', 'export const TIERS = ['];
  for (const [qty, pct] of tiers) lines.push(`  { minQty: ${qty}, percentOff: ${pct} },`);
  lines.push('];', '', 'export function tierFor(qty) {', '  let tier = null;', '  for (const t of TIERS) if (qty >= t.minQty) tier = t;', '  return tier;', '}', '');
  for (const name of ['unitPrice', 'lineTotal', 'discountFor', 'roundCents', 'clampQty', 'formatPercent']) {
    lines.push(`export function ${name}(value, qty = 1) {`, '  if (!Number.isFinite(value)) throw new TypeError(`bad value: ${value}`);',
      '  const tier = tierFor(qty);', '  const pct = tier ? tier.percentOff : 0;', `  return Math.round(value * (1 - pct / 100) * 100) / 100; // ${name}`, '}', '');
  }
  fs.writeFileSync(path.join(ws, 'src', 'pricing.js'), `${lines.join('\n')}\n`);
  fs.mkdirSync(path.join(ws, 'test'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'test', 'pricing.test.js'), ["import { test } from 'node:test';", "import assert from 'node:assert/strict';",
    "import { tierFor, lineTotal } from '../src/pricing.js';", '',
    "test('no tier under ten', () => assert.equal(tierFor(9), null));", "test('ten gets two percent', () => assert.equal(tierFor(10).percentOff, 2));",
    "test('line total applies the tier', () => assert.equal(lineTotal(100, 50), 92));", ''].join('\n'));
}

function tinyVideo(runDir: string) {
  const file = path.join(runDir, 'final.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:size=1280x720:rate=10:duration=2', '-pix_fmt', 'yuv420p', file]);
  if (r.status !== 0) fs.writeFileSync(file, Buffer.alloc(4096));
  return file;
}

type Reaction = { when: RegExp; reply: string; once?: boolean };
type Case = { id: string; prepare: (runDir: string, ws: string) => string; maxTurns: number; reactions?: (runDir: string) => Reaction[]; score: (o: Outcome) => Record<string, boolean> };
type Outcome = { transcript: string; calls: Array<{ t: number; args: string[] }>; pr?: { body: string; number: number; headRefName?: string }; runDir: string; ws: string };

// Commit and push are scored from git itself, not from gh calls: a local commit on a
// feature branch that touches the file, and the same file on that branch in the bare origin.
const tryGit = (args: string[]) => { try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const committed = (o: Outcome, file: string) =>
  tryGit(['--git-dir', gitDirFor(EVAL_AGENT, o.runDir, o.ws), 'log', '--all', '--format=%H', '--', file]) !== '';
const pushed = (o: Outcome, file: string) => {
  const remote = path.join(o.runDir, 'remote.git');
  return tryGit(['--git-dir', remote, 'for-each-ref', '--format=%(refname:short)', 'refs/heads'])
    .split('\n').filter((b) => b && b !== 'main')
    .some((b) => tryGit(['--git-dir', remote, 'ls-tree', '-r', '--name-only', b, '--', file]) === file);
};
const WIZARD = 'src/ui/CheckoutWizard.jsx';

const firstCall = (calls: Outcome['calls'], test: (a: string[]) => boolean) => calls.findIndex((c) => test(c.args));
const isCreate = (a: string[]) => a[0] === 'pr' && a[1] === 'create';
const isUpload = (a: string[]) => a[0] === 'api' && a.some((x) => /uploads\.github\.com\/user-attachments\/assets/.test(x));
const isPatch = (a: string[]) => a[0] === 'api' && a.includes('PATCH') && a.some((x) => /pulls\/\d+$/.test(x));
const isEdit = (a: string[]) => a[0] === 'pr' && a[1] === 'edit';

const CASE_LIST: Case[] = [
  {
    id: 'offers-and-ships',
    maxTurns: 1,
    prepare: (runDir, ws) => {
      writeWizard(ws);
      return `I added a multi-step checkout wizard (src/ui/CheckoutWizard.jsx): customers move through cart, shipping, coupon, payment and review, with inline errors. create pr. ${NO_BROWSER} Do not watch it after.`;
    },
    score: (o) => {
      const offerAt = o.transcript.search(OFFER);
      const prAt = o.transcript.search(/pull\/\d+|PR #?\d+ (?:is )?(?:open|created)/i);
      return {
        offersVideo: offerAt !== -1,
        offerBeforePrLink: offerAt !== -1 && (prAt === -1 || offerAt < prAt),
        committed: committed(o, WIZARD),
        pushed: pushed(o, WIZARD),
        prCreated: !!o.pr && firstCall(o.calls, isCreate) !== -1,
        noVideoWithoutYes: !o.calls.some((c) => isUpload(c.args)) && !/vs:video/.test(o.pr?.body ?? ''),
      };
    },
  },
  {
    id: 'tiny-silent',
    maxTurns: 2,
    prepare: (runDir, ws) => {
      const text = '# shop\n\nA small shop with coupons. Run `npm test` before every push.\n';
      fs.writeFileSync(path.join(ws, 'README.md'), text.replace('small', 'smal'));
      g(runDir, ws, 'add', 'README.md');
      g(runDir, ws, 'commit', '-qm', 'docs: readme');
      g(runDir, ws, '-c', `url.${path.join(runDir, 'remote.git')}.insteadOf=https://github.com/acme/shop.git`, 'push', '-q', 'origin', 'main');
      fs.writeFileSync(path.join(ws, 'README.md'), text);
      return 'Fixed the "smal" typo in README.md. create pr. Do not watch it after.';
    },
    score: ({ transcript, calls, pr }) => ({
      noQuestion: !QUESTION.test(transcript),
      prCreated: !!pr,
      noVideo: !calls.some((c) => isUpload(c.args)) && !/vs:video/.test(pr?.body ?? ''),
    }),
  },
  {
    id: 'mid-silent',
    maxTurns: 1,
    prepare: (runDir, ws) => {
      writePricing(ws);
      return 'I added a bulk-discount pricing helper (src/pricing.js) with a test (test/pricing.test.js); checkout does not call it yet. create pr. Do not watch it after.';
    },
    score: (o) => ({
      noQuestion: !QUESTION.test(o.transcript),
      committed: committed(o, 'src/pricing.js'),
      pushed: pushed(o, 'src/pricing.js'),
      prCreated: !!o.pr,
      noVideo: !o.calls.some((c) => isUpload(c.args)) && !/vs:video/.test(o.pr?.body ?? ''),
    }),
  },
  {
    id: 'pr-before-video',
    maxTurns: 2,
    prepare: (runDir, ws) => {
      writeWizard(ws);
      const video = tinyVideo(runDir);
      return `I added a multi-step checkout wizard (src/ui/CheckoutWizard.jsx): customers move through cart, shipping, coupon, payment and review, with inline errors. create pr with video. ${NO_BROWSER} Do not watch it after. For this test the explainer is already rendered and finished at ${video} (vs-explain-pr steps 1-7 are done); the video step only has to attach that file, and it may run in this same agent.`;
    },
    score: ({ transcript, calls, pr }) => {
      const create = firstCall(calls, isCreate);
      const upload = firstCall(calls, isUpload);
      const patch = firstCall(calls, isPatch);
      return {
        noQuestion: !OFFER.test(transcript),
        prBeforeUpload: create !== -1 && upload > create,
        uploadBeforePatch: upload !== -1 && patch > upload,
        noPrEdit: !calls.some((c) => isEdit(c.args)),
        blockInBody: /<!-- vs:video -->[\s\S]*<!-- \/vs:video -->/.test(pr?.body ?? ''),
      };
    },
  },
  {
    id: 'late-yes',
    maxTurns: 2,
    prepare: (runDir, ws) => {
      writeWizard(ws);
      return `I added a multi-step checkout wizard (src/ui/CheckoutWizard.jsx): customers move through cart, shipping, coupon, payment and review, with inline errors. create pr. ${NO_BROWSER} Do not watch it after.`;
    },
    reactions: (runDir) => [{
      when: OFFER,
      once: true,
      reply: `yes, add the video. For this test the explainer is already rendered and finished at ${path.join(runDir, 'final.mp4')} (vs-explain-pr steps 1-7 are done); the video step only has to attach that file, and it may run in this same agent.`,
    }],
    score: ({ calls, pr }) => {
      const create = firstCall(calls, isCreate);
      const upload = firstCall(calls, isUpload);
      const patch = firstCall(calls, isPatch);
      return {
        prBeforeUpload: create !== -1 && upload > create,
        uploadBeforePatch: upload !== -1 && patch > upload,
        noPrEdit: !calls.some((c) => isEdit(c.args)),
        blockInBody: /<!-- vs:video -->[\s\S]*<!-- \/vs:video -->/.test(pr?.body ?? ''),
      };
    },
  },
];

describe.skipIf(!process.env.EXPLAIN_PR_LIVE)(`ship-it video explainer (${EVAL_AGENT}, ${ARM})`, () => {
  for (const c of CASE_LIST.filter((x) => CASES.includes(x.id))) {
    for (let run = 1; run <= RUNS; run += 1) {
      it(`${c.id} #${run}`, async () => {
        const runDir = prepareRunDir(`explain-pr-${ARM}-${c.id}-${run}`);
        const agent = await createAgent({ agent: EVAL_AGENT, timeout: 1500, workspace: buildWorkspace(BASELINE, runDir), env: agentEnv(runDir, EVAL_AGENT) });
        const started = Date.now();
        try {
          const home = path.join(path.dirname(agent.workspace), 'home');
          setupGit(runDir, agent.workspace, EVAL_AGENT);
          pinMockGhFirst(home, runDir);
          const prompt = c.prepare(runDir, agent.workspace);
          if (c.id === 'late-yes') tinyVideo(runDir);
          await agent.runConversation({ firstMessage: prompt, maxTurns: c.maxTurns, reactions: [...(c.reactions?.(runDir) ?? []), CATCH_ALL_ASK_USER], ...CONVERSE_ASK_USER_DEFAULTS });
          const transcript = agent.messages.filter((m) => m.role === 'agent').map((m) => m.content).join('\n');
          const outcome: Outcome = { transcript, calls: ghCalls(runDir), pr: prs(runDir).at(-1), runDir, ws: agent.workspace };
          const scores = c.score(outcome);
          const row = { arm: ARM, case: c.id, run, agent: EVAL_AGENT, runDir, seconds: Math.round((Date.now() - started) / 1000), scores, pass: Object.values(scores).every(Boolean) };
          fs.appendFileSync(RESULTS, `${JSON.stringify(row)}\n`);
          fs.writeFileSync(path.join(runDir, 'transcript.txt'), agent.transcript());
          console.log(JSON.stringify(row));
          expect(row.pass, JSON.stringify(scores)).toBe(true);
        } finally {
          await agent.dispose();
        }
      }, 1_800_000);
    }
  }
});
