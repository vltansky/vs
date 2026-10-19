import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as real from '../lib.mjs';

// Static contract for the explain-video benchmark harness (no agent, no
// video). `problems(lib)` returns every broken rule; the shipped lib returns
// none, and each mutant must return some.

const HERE = path.resolve(__dirname, '..');
const ROOT = path.resolve(HERE, '..', '..');
type Lib = typeof real;

const T0 = 1_000_000;
const step = (script: string, args: string[], start: number, end: number, exit = 0) =>
  JSON.stringify({ script, args, start: T0 + start, end: T0 + end, exit });
const STAGE_LOG = [
  step('preflight', [], 1000, 2000),
  step('init', ['/w'], 3000, 4000),
  step('narrate', ['/w/script.json', '--dry-run'], 20000, 20500),
  step('check-ste', ['narration.md'], 21000, 22000, 1),
  step('check-ste', ['narration.md'], 30000, 31000, 0),
  step('narrate', ['/w/script.json'], 40000, 60000),
  step('render', ['/w', '--stills'], 90000, 95000, 1),
  step('render', ['/w', '--stills'], 100000, 105000, 0),
  step('render', ['/w', '--out', '/w/a.mp4', '--scene', 's1'], 106000, 110000),
  step('check', ['/w'], 106000, 108000, 0),
  step('render', ['/w', '--out', '/w/a.mp4'], 120000, 150000),
  step('pack', ['/w', '/w/a.mp4'], 151000, 152000),
  step('verdict', ['/w'], 160000, 161000, 1),
  step('render', ['/w', '--out', '/w/a.mp4'], 170000, 180000),
  step('verdict', ['/w'], 190000, 191000, 0),
  'not json',
  JSON.stringify({ script: 'render', args: [] }),
].join('\n');

const rpc = (ts: number, msg: unknown) => JSON.stringify({ ts, line: JSON.stringify(msg) });
const usage = (input: number, cached: number, write: number, output: number) => ({
  method: 'thread/tokenUsage/updated',
  params: {
    threadId: 't1',
    tokenUsage: {
      total: { inputTokens: input, cachedInputTokens: cached, cacheWriteInputTokens: write, outputTokens: output, reasoningOutputTokens: 10, totalTokens: input + output },
      last: { inputTokens: 1, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 1, totalTokens: 2 },
    },
  },
});
const item = (type: string) => ({ method: 'item/started', params: { item: { type } } });
const TAP = [
  rpc(1, { id: 2, result: { thread: { id: 't1' }, model: 'gpt-5.6-luna', reasoningEffort: 'medium' } }),
  rpc(2, item('userMessage')),
  rpc(3, item('reasoning')),
  rpc(4, item('commandExecution')),
  rpc(5, item('fileChange')),
  rpc(6, usage(1000, 0, 900, 50)),
  rpc(7, item('agentMessage')),
  rpc(8, item('commandExecution')),
  rpc(9, usage(3_000_000, 1_000_000, 1_000_000, 100_000)),
  'garbage',
].join('\n');

const PRICES = { models: { 'gpt-5.6-luna': { input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 1.2 } } };

const runRow = (wallMs: number, total: number, pass = true) => ({
  wallMs,
  stages: { setup: 1000, script: 20000, narrate: 20000, scenes: 30000, checks: wallMs - 71000, render: 0, review: 0, handoff: 0 },
  tokens: { input: total - 1000, output: 1000, total },
  toolCalls: 40,
  costUsd: total / 1e6,
  videoSec: 30,
  checks: { pass },
});
const rowOf = (runs: ReturnType<typeof runRow>[], extra: Record<string, unknown> = {}) => ({
  agent: 'codex', model: 'gpt-5.6-luna', gitSha: 'abc1234', date: 'd',
  briefs: { a: { ...real.aggregate(runs) } }, ...extra,
});

function problems(lib: Lib): string[] {
  const out: string[] = [];
  const steps = lib.parseStageLog(STAGE_LOG);
  if (steps.length !== 15) out.push(`stage log: ${steps.length} steps, want 15 (bad lines dropped)`);
  const kinds = steps.map((s) => s.kind).join(',');
  if (kinds !== 'preflight,init,narrate-dry,ste,ste,narrate,stills,stills,preview,measure,render,pack,verdict,render,verdict') out.push(`step kinds: ${kinds}`);

  const st = lib.stageTimes(steps, T0, T0 + 200000);
  const want = { setup: 4000, script: 36000, narrate: 20000, scenes: 30000, checks: 30000, render: 30000, review: 41000, handoff: 9000 };
  for (const [k, v] of Object.entries(want)) if (st[k] !== v) out.push(`stage ${k}=${st[k]}, want ${v}`);
  const sum = Object.values(st).reduce((a: number, b) => a + (b as number), 0);
  if (sum !== 200000) out.push(`stages sum ${sum}, want wall 200000`);
  const noStills = lib.stageTimes(steps.filter((s) => s.kind !== 'stills'), T0, T0 + 200000);
  if (noStills.checks !== 0 || noStills.scenes !== 60000) out.push('missing marker does not fold into the stage before it');
  const none = lib.stageTimes([], T0, T0 + 5000);
  if (none.setup !== 5000 || Object.values(none).reduce((a: number, b) => a + (b as number), 0) !== 5000) out.push('empty log does not give all time to setup');

  const failedInit = lib.parseStageLog([step('init', ['/ro'], 2000, 2500, 1), STAGE_LOG].join('\n'));
  if (lib.stageTimes(failedInit, T0, T0 + 200000).setup !== 4000) out.push('setup ends at a failed init');
  if (lib.renderedVideo(steps) !== '/w/a.mp4') out.push('video path not read from the last full render');
  if (lib.renderedVideo(steps.filter((s) => s.kind !== 'render')) !== null) out.push('preview render taken as the video');
  const totals = lib.stepTotals(steps);
  if (totals.ste?.count !== 2 || totals.ste?.lastExit !== 0 || totals.stills?.ms !== 10000 || totals.render?.count !== 2) out.push('step totals wrong');

  const ok = lib.checkResults(steps, true);
  if (!ok.pass) out.push('passing run reported as fail');
  if (ok.review !== 'pass') out.push(`review ${ok.review}, want the last verdict (pass)`);
  if (lib.checkResults(steps.filter((s) => s.kind !== 'measure'), true).pass) out.push('run without check.mjs still passes');
  if (lib.checkResults(steps.filter((s) => s.kind !== 'verdict'), true).review !== 'not-run') out.push('no verdict not reported as not-run');
  if (lib.checkResults(steps, false).pass) out.push('missing mp4 still passes');
  const lastStillsRed = steps.map((s) => (s.kind === 'stills' ? { ...s, exit: 1 } : s));
  if (lib.checkResults(lastStillsRed, true).pass) out.push('failed layout audit still passes');
  const steUnchecked = steps.map((s) => (s.kind === 'ste' ? { ...s, exit: 2 } : s));
  if (lib.checkResults(steUnchecked, true).pass) out.push('check-ste exit 2 (not checked) counted as pass');

  const tap = lib.parseCodexTap(TAP);
  if (tap.toolCalls !== 3) out.push(`tool calls ${tap.toolCalls}, want 3 (messages and reasoning are not tools)`);
  if (tap.tokens?.input !== 3_000_000 || tap.tokens?.output !== 100_000) out.push('tokens are not the last cumulative total');
  if (tap.model !== 'gpt-5.6-luna' || tap.reasoningEffort !== 'medium') out.push('model not read from thread/start');
  if (lib.parseCodexTap('').tokens !== null) out.push('no usage should give null tokens, not zero');

  const usd = lib.priceTokens(tap.tokens, 'gpt-5.6-luna', PRICES);
  // 1M fresh * 0.2 + 1M cached * 0.02 + 1M write * 0.25 + 0.1M out * 1.2
  if (usd !== 0.59) out.push(`cost ${usd}, want 0.59`);
  if (lib.priceTokens(tap.tokens, 'unknown-model', PRICES) !== null) out.push('unpriced model must give null');

  if (lib.median([3, 1, 2]) !== 2 || lib.median([1, 2, 30]) !== 2 || lib.median([4, 1, 3, 2]) !== 2.5 || lib.median([]) !== null) out.push('median wrong');
  if (lib.median([5, Number.NaN, 1, undefined as unknown as number, 3]) !== 3) out.push('median counts missing values');
  const s = lib.stats([100, 120, 80]);
  if (s.median !== 100 || s.min !== 80 || s.max !== 120 || s.spread !== 0.4) out.push(`stats ${JSON.stringify(s)}`);

  const base = rowOf([runRow(100000, 50000), runRow(110000, 52000), runRow(120000, 54000)], { baseline: true });
  const same = lib.compare(base, rowOf([runRow(110000, 52000)]));
  if (same.warnings.length) out.push(`no change flagged: ${same.warnings}`);
  const slow = lib.compare(base, rowOf([runRow(140000, 52000)]));
  if (!slow.warnings.some((w) => w.includes('wallMs'))) out.push('+27% wall time not flagged at 20%');
  const tok = lib.compare(base, rowOf([runRow(110000, 61000)]));
  if (!tok.warnings.some((w) => w.includes('tokens.total'))) out.push('+17% tokens not flagged at 15%');
  const under = lib.compare(base, rowOf([runRow(110000, 59000)]));
  if (under.warnings.some((w) => w.includes('tokens.total'))) out.push('+13% tokens flagged at 15%');
  const loose = lib.compare(base, rowOf([runRow(140000, 52000)]), { time: 0.5 });
  if (loose.warnings.some((w) => w.includes('wallMs'))) out.push('time threshold not configurable');
  const fewer = lib.compare(base, rowOf([runRow(110000, 52000, false)]));
  if (!fewer.warnings.some((w) => w.includes('passing runs'))) out.push('lower pass rate not flagged');
  const tinyBase = rowOf([runRow(100000, 50000)]);
  (tinyBase.briefs.a.metrics as Record<string, { median: number }>)['stage.setupMs'] = { median: 1000 } as never;
  const tinyCur = rowOf([runRow(100000, 50000)]);
  (tinyCur.briefs.a.metrics as Record<string, { median: number }>)['stage.setupMs'] = { median: 3000 } as never;
  if (lib.compare(tinyBase, tinyCur).warnings.some((w) => w.includes('stage.setupMs'))) out.push('stage under minTimeMs flagged as regression');
  const faster = lib.compare(base, rowOf([runRow(60000, 30000)]));
  if (faster.warnings.length) out.push('improvements flagged as regressions');

  const latest = rowOf([runRow(1, 1)]);
  const other = rowOf([runRow(1, 1)], { baseline: true, model: 'gpt-5.6-sol' });
  const old = rowOf([runRow(1, 1)], { baseline: true, gitSha: 'old0001' });
  const plain = rowOf([runRow(1, 1)], { gitSha: 'new0002' });
  if (lib.pickBaseline([old, other, plain, latest], latest, undefined) !== old) out.push('baseline not the newest baseline row of the same model');
  if (lib.pickBaseline([old, plain, latest], latest, 'new0') !== plain) out.push('--baseline sha ignored');
  return out;
}

const mutants: Record<string, (l: Lib) => Lib> = {
  'median is the mean': (l) => ({ ...l, median: (xs: number[]) => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; } }),
  'stats spread over min': (l) => ({ ...l, stats: (xs: number[]) => { const s = l.stats(xs); return { ...s, spread: s.min ? (s.max! - s.min) / s.min : 0 }; } }),
  'compare ignores tokens': (l) => ({ ...l, compare: (b: never, c: never, t = {}) => l.compare(b, c, { ...t, tokens: 99 }) }),
  'compare flags >= limit+5%': (l) => ({ ...l, compare: (b: never, c: never, t = {}) => l.compare(b, c, { time: 0.3, ...t }) }),
  'compare ignores pass rate': (l) => ({ ...l, compare: (b: never, c: never, t = {}) => { const r = l.compare(b, c, t); return { ...r, warnings: r.warnings.filter((w: string) => !w.includes('passing')) }; } }),
  'stages miss handoff': (l) => ({ ...l, stageTimes: (s: never, a: number, b: number) => ({ ...l.stageTimes(s, a, b), handoff: 0 }) }),
  'review stops at the first render': (l) => ({ ...l, stageTimes: (s: never, a: number, b: number) => { const r = l.stageTimes(s, a, b); return { ...r, review: 0, handoff: r.handoff + r.review }; } }),
  'measured check optional': (l) => ({ ...l, checkResults: (s: { kind: string }[], m: boolean) => l.checkResults([...s, { kind: 'measure', exit: 0 }] as never, m) }),
  'dry run counted as narrate': (l) => ({ ...l, parseStageLog: (t: string) => l.parseStageLog(t).map((s) => (s.kind === 'narrate-dry' ? { ...s, kind: 'narrate' } : s)) }),
  'ste exit 2 passes': (l) => ({ ...l, checkResults: (s: never[], m: boolean) => l.checkResults((s as { kind: string; exit: number }[]).map((x) => (x.kind === 'ste' && x.exit === 2 ? { ...x, exit: 0 } : x)) as never, m) }),
  'messages counted as tools': (l) => ({ ...l, parseCodexTap: (t: string) => { const r = l.parseCodexTap(t); return { ...r, toolCalls: r.toolCalls + 2 }; } }),
  'cached tokens priced as input': (l) => ({ ...l, priceTokens: (tok: never, m: string, p: never) => l.priceTokens({ ...(tok as object), cachedInput: 0, cacheWrite: 0 } as never, m, p) }),
  'baseline ignores model': (l) => ({ ...l, pickBaseline: (h: never[], latest: never) => (h as { baseline?: boolean }[]).filter((r) => r !== latest && r.baseline).at(-1) ?? null }),
};

describe('explain-video benchmark harness', () => {
  it('the shipped lib meets every rule', () => {
    expect(problems(real)).toEqual([]);
  });

  for (const [name, mutate] of Object.entries(mutants)) {
    it(`catches mutant: ${name}`, () => {
      expect(problems(mutate(real)).length).toBeGreaterThan(0);
    });
  }

  it('stage hook logs only skill scripts, only when asked', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vs-bench-hook-'));
    const scripts = path.join(dir, 'vs-explain-video', 'scripts');
    fs.mkdirSync(scripts, { recursive: true });
    writeFileSync(path.join(scripts, 'narrate.mjs'), 'process.exit(3);\n');
    writeFileSync(path.join(dir, 'other.mjs'), '');
    const logFile = path.join(dir, 'stages.jsonl');
    const hook = `--import=${path.join(HERE, 'stage-hook.mjs')}`;
    const run = (file: string, env: Record<string, string>) =>
      spawnSync(process.execPath, [hook, file, '--dry-run'], { env: { ...process.env, ...env } });
    run(path.join(scripts, 'narrate.mjs'), {});
    expect(fs.existsSync(logFile)).toBe(false);
    run(path.join(scripts, 'narrate.mjs'), { VS_BENCH_STAGE_LOG: logFile });
    run(path.join(dir, 'other.mjs'), { VS_BENCH_STAGE_LOG: logFile });
    const lines = real.parseStageLog(fs.readFileSync(logFile, 'utf8'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ script: 'narrate', kind: 'narrate-dry', exit: 3 });
  });

  it('compare CLI warns and never fails on a regression', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vs-bench-cmp-'));
    const file = path.join(dir, 'history.jsonl');
    const base = rowOf([runRow(100000, 50000)], { baseline: true });
    const cur = rowOf([runRow(200000, 90000)], { gitSha: 'def5678' });
    writeFileSync(file, `${JSON.stringify(base)}\n${JSON.stringify(cur)}\n`);
    const cli = (...a: string[]) => spawnSync(process.execPath, [path.join(HERE, 'compare.mjs'), '--history', file, ...a], { encoding: 'utf8' });
    const r = cli();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/a: wallMs \+100%/);
    expect(r.stdout).toMatch(/regression warning/);
    expect(cli('--time=5', '--tokens', '5', '--cost', '5', '--tools', '5').stdout).toMatch(/No regressions\./);
    expect(cli('--time', 'x').status).toBe(2);
    writeFileSync(file, `${JSON.stringify(cur)}\n`);
    expect(cli().status).toBe(2);
  });

  it('is opt-in: not in eval:static, CI, or the default eval run', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['bench:explain-video']).toBe('node bench/explain-video/run.mjs');
    expect(pkg.scripts['bench:explain-video:compare']).toBe('node bench/explain-video/compare.mjs');
    for (const name of ['eval', 'eval:static']) expect(pkg.scripts[name]).not.toMatch(/bench/);
    const live = fs.readdirSync(HERE).filter((f) => f.endsWith('.eval.ts'));
    expect(live).toEqual([]);
    const ci = fs.readdirSync(path.join(ROOT, '.github', 'workflows')).map((f) => fs.readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf8')).join('\n');
    expect(ci).not.toMatch(/bench:explain-video/);
  });

  it('never runs paid TTS and records what the brief needs', () => {
    const run = fs.readFileSync(path.join(HERE, 'run.mjs'), 'utf8');
    expect(run).toMatch(/ELEVENLABS_API_KEY: ''/);
    expect(run).toMatch(/kokoro/);
    const { briefs } = JSON.parse(fs.readFileSync(path.join(HERE, 'briefs.json'), 'utf8'));
    expect(briefs).toHaveLength(2);
    expect(run).toMatch(/20-40 seconds/);
    expect(run).toMatch(/opt\('--runs', '3'\)/);
    for (const key of ['gitSha', 'date:', 'agent:', 'model:', 'machine:', 'costSource']) expect(run).toContain(key);
  });

  it('every history row parses and carries the fields compare needs', () => {
    const file = path.join(HERE, 'history.jsonl');
    const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toMatchObject({ schema: 1, agent: expect.any(String), model: expect.any(String), gitSha: expect.stringMatching(/^[0-9a-f]{40}$/) });
      for (const agg of Object.values(row.briefs) as { metrics: Record<string, unknown> }[]) {
        for (const m of real.METRICS) expect(agg.metrics).toHaveProperty([m]);
      }
    }
  });
});
