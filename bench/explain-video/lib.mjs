// Pure helpers for the explain-video benchmark: parse the stage log and the
// Codex app-server tap, split wall time into stages, price tokens, aggregate
// runs (median and spread), and compare a run against the stored baseline.
// No I/O here, so the static evals can test every rule directly.

// ---------- stage log (stage-hook.mjs output)

export const parseJsonl = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });

// One script invocation -> the step it belongs to.
export const stepKind = ({ script, args = [] }) => {
  if (script === 'narrate') return args.includes('--dry-run') ? 'narrate-dry' : 'narrate';
  if (script === 'render') {
    if (args.includes('--stills')) return 'stills';
    if (args.includes('--out')) return args.includes('--scene') ? 'preview' : 'render';
    return 'render-other';
  }
  if (script === 'check-ste') return 'ste';
  if (script === 'check') return 'measure';
  return script;
};

export const parseStageLog = (text) =>
  parseJsonl(text)
    .filter((e) => typeof e.script === 'string' && Number.isFinite(e.start) && Number.isFinite(e.end))
    .map((e) => ({ ...e, kind: stepKind(e) }))
    .sort((a, b) => a.start - b.start);

export const STAGES = ['setup', 'script', 'narrate', 'scenes', 'checks', 'render', 'review', 'handoff'];

// Wall time split at the first time each step happens:
//   setup   run start -> first init.mjs that succeeds ends (preflight, scaffold)
//   script  -> first real narrate starts (script.json, dry run, check-ste)
//   narrate -> that narrate ends (TTS and the word check)
//   scenes  -> first render --stills starts (writing scenes.js)
//   checks  -> first full render starts (stills audit, check.mjs, fixes)
//   render  -> that full render ends
//   review  -> the last full render, pack.mjs, or verdict.mjs ends (fresh
//              review rounds and their fixes and rerenders)
//   handoff -> run end
// A missing marker ends the stage at the next marker that exists, so the
// stage it would have started shows 0 ms. Stages always sum to the wall time.
export const stageTimes = (steps, t0, t1) => {
  const first = (kind) => steps.find((s) => s.kind === kind);
  const ends = steps.filter((s) => ['render', 'pack', 'verdict'].includes(s.kind)).map((s) => s.end);
  const init = steps.find((s) => s.kind === 'init' && s.exit === 0) ?? first('init');
  const marks = [
    init?.end,
    first('narrate')?.start,
    first('narrate')?.end,
    first('stills')?.start,
    first('render')?.start,
    first('render')?.end,
    ends.length ? Math.max(...ends) : undefined,
  ];
  const bounds = [t0];
  for (let i = 0; i < marks.length; i += 1) {
    const next = marks.slice(i).find((m) => Number.isFinite(m)) ?? t1;
    bounds.push(Math.min(Math.max(next, bounds.at(-1)), t1));
  }
  bounds.push(t1);
  const out = {};
  STAGES.forEach((stage, i) => {
    out[stage] = bounds[i + 1] - bounds[i];
  });
  return out;
};

// Per step kind: invocation count (reruns show here), summed process time,
// and the last exit code.
export const stepTotals = (steps) => {
  const out = {};
  for (const s of steps) {
    const t = (out[s.kind] ??= { count: 0, ms: 0, lastExit: null });
    t.count += 1;
    t.ms += s.end - s.start;
    t.lastExit = s.exit;
  }
  return out;
};

// The length every brief asks for, in seconds.
export const VIDEO_RANGE = [20, 40];

// The skill's own checks, from the last run of each: check-ste (exit 2 means
// not checked, which is not a pass), the stills audit, check.mjs (the
// measured gate and text audit), the full render with its duration check,
// and the mp4 on disk. Plus the brief's length: a video outside 20-40 s fails,
// so a shorter video never reads as a speed or cost win. The fresh review
// verdict is reported, not required: it needs a second agent the host may not
// offer.
export const checkResults = (steps, mp4Exists, videoSec = null) => {
  const lastExit = (kind) => steps.filter((s) => s.kind === kind).at(-1)?.exit ?? null;
  const checks = {
    ste: lastExit('ste') === 0,
    layout: lastExit('stills') === 0,
    measured: lastExit('measure') === 0,
    render: lastExit('render') === 0,
    mp4: Boolean(mp4Exists),
    length: Number.isFinite(videoSec) && videoSec >= VIDEO_RANGE[0] && videoSec <= VIDEO_RANGE[1],
  };
  const verdict = lastExit('verdict');
  const review = verdict === 0 ? 'pass' : verdict === 1 ? 'return' : verdict === null ? 'not-run' : 'blocked';
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  return { ...checks, pass: failed.length === 0, failed, review };
};

// The mp4 the last full render wrote (its --out argument), or null.
export const renderedVideo = (steps) => {
  const r = steps.filter((s) => s.kind === 'render').at(-1);
  return r ? r.args[r.args.indexOf('--out') + 1] ?? null : null;
};

// ---------- Codex app-server tap (bin/codex output)

const NOT_TOOLS = new Set(['userMessage', 'agentMessage', 'reasoning', 'plan', 'contextCompaction']);

export const parseCodexTap = (text) => {
  const usageByThread = new Map();
  const toolTypes = {};
  let toolCalls = 0;
  let model = null;
  let reasoningEffort = null;
  for (const { line } of parseJsonl(text)) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.result?.thread && typeof msg.result.model === 'string') {
      model = msg.result.model;
      reasoningEffort = msg.result.reasoningEffort ?? null;
    }
    if (msg.method === 'thread/tokenUsage/updated' && msg.params?.tokenUsage?.total) {
      usageByThread.set(msg.params.threadId ?? 'thread', msg.params.tokenUsage.total);
    }
    if (msg.method === 'item/started' && msg.params?.item?.type && !NOT_TOOLS.has(msg.params.item.type)) {
      toolCalls += 1;
      toolTypes[msg.params.item.type] = (toolTypes[msg.params.item.type] ?? 0) + 1;
    }
  }
  if (usageByThread.size === 0) return { tokens: null, toolCalls, toolTypes, model, reasoningEffort };
  const tokens = { input: 0, cachedInput: 0, cacheWrite: 0, output: 0, reasoning: 0, total: 0 };
  for (const u of usageByThread.values()) {
    tokens.input += u.inputTokens ?? 0;
    tokens.cachedInput += u.cachedInputTokens ?? 0;
    tokens.cacheWrite += u.cacheWriteInputTokens ?? 0;
    tokens.output += u.outputTokens ?? 0;
    tokens.reasoning += u.reasoningOutputTokens ?? 0;
    tokens.total += u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
  }
  return { tokens, toolCalls, toolTypes, model, reasoningEffort };
};

// ---------- cost

// USD from a pinned per-1M price table. Input tokens include the cached and
// cache-write tokens, so each class is priced once. null when the model has
// no pinned price.
export const priceTokens = (tokens, model, table) => {
  const p = table?.models?.[model];
  if (!p || !tokens) return null;
  const cached = tokens.cachedInput ?? 0;
  const write = tokens.cacheWrite ?? 0;
  const fresh = Math.max(0, (tokens.input ?? 0) - cached - write);
  const usd = (fresh * p.input + cached * p.cachedInput + write * (p.cacheWrite ?? p.input) + (tokens.output ?? 0) * p.output) / 1e6;
  return Math.round(usd * 1e6) / 1e6;
};

// ---------- aggregation

export const median = (values) => {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

// min, max, and spread = (max - min) / median, so 0.25 means the runs span
// 25% of the median.
export const stats = (values) => {
  const xs = values.filter((v) => Number.isFinite(v));
  const med = median(xs);
  if (med === null) return { n: 0, median: null, min: null, max: null, spread: null };
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const second = xs.length > 1 ? [...xs].sort((a, b) => b - a)[1] : max;
  return { n: xs.length, median: med, min, max, second, spread: med === 0 ? 0 : Math.round(((max - min) / med) * 1000) / 1000 };
};

// The top of the baseline range compare uses. With 5 or more runs, one
// outlier run (a box-load spike) should not widen it, so use the
// second-highest run; with fewer, the max. Rows from before "second" was
// stored fall back to the max.
export const rangeTop = (s) => ((s?.n ?? 0) >= 5 && Number.isFinite(s?.second) ? s.second : s?.max);

// Flat metric names a run reports. Compare and the summary use the same list.
export const METRICS = [
  'wallMs',
  ...STAGES.map((s) => `stage.${s}Ms`),
  'tokens.input',
  'tokens.output',
  'tokens.total',
  'toolCalls',
  'costUsd',
  'videoSec',
];

export const metricKind = (name) => {
  if (name === 'wallMs' || name.startsWith('stage.')) return 'time';
  if (name.startsWith('tokens.')) return 'tokens';
  if (name === 'costUsd') return 'cost';
  if (name === 'toolCalls') return 'tools';
  return 'info';
};

export const flatten = (run) => {
  const out = { wallMs: run.wallMs, toolCalls: run.toolCalls, costUsd: run.costUsd, videoSec: run.videoSec };
  for (const s of STAGES) out[`stage.${s}Ms`] = run.stages?.[s];
  out['tokens.input'] = run.tokens?.input;
  out['tokens.output'] = run.tokens?.output;
  out['tokens.total'] = run.tokens?.total;
  return out;
};

// Medians come from passing runs only: a run that broke early is fast and
// cheap, and would pull the medians down. Failed runs are listed apart with
// the checks they failed.
export const aggregate = (runs) => {
  const ok = runs.filter((r) => r.checks?.pass);
  const flat = ok.map(flatten);
  const metrics = {};
  for (const name of METRICS) metrics[name] = stats(flat.map((f) => f[name]));
  const reviews = runs.map((r) => r.checks?.review ?? 'not-run');
  const review = [...new Set(reviews)].map((v) => `${v} ${reviews.filter((x) => x === v).length}`).join(', ');
  const failedRuns = runs.flatMap((r, i) => (r.checks?.pass ? [] : [{
    run: i + 1,
    failed: r.checks?.failed ?? Object.entries(r.checks ?? {}).filter(([k, v]) => v === false && k !== 'pass').map(([k]) => k),
    wallMs: r.wallMs ?? null,
    tokens: r.tokens?.total ?? null,
    costUsd: r.costUsd ?? null,
    videoSec: r.videoSec ?? null,
    error: r.error ?? null,
  }]));
  return { n: runs.length, passed: ok.length, review, metrics, failedRuns };
};

// ---------- compare

export const DEFAULT_THRESHOLDS = { time: 0.2, tokens: 0.15, cost: 0.15, tools: 0.25, minTimeMs: 5000 };

// Latest vs baseline, brief by brief, on the medians. Agent runs vary a lot
// (the first baseline spread 60-90%), so a metric is a regression only when
// both hold:
//   1. the latest median is above the top of the baseline range (the max, or
//      the second-highest run when n >= 5; see rangeTop), so it is not
//      run-to-run noise;
//   2. it grew by more than its kind's limit (time +20%, tokens +15%, ...).
// A baseline with one run has no range; then the limit alone decides. Time
// metrics whose baseline median is under minTimeMs never flag. A metric the
// baseline has and the latest row lacks (a renamed usage event) warns as
// "no data", never as a pass. Fewer passing runs always flags. Warn only: the
// caller prints warnings and never fails CI on them.
export const compare = (baseline, latest, thresholds = {}) => {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const rows = [];
  const warnings = [];
  for (const [brief, cur] of Object.entries(latest?.briefs ?? {})) {
    const base = baseline?.briefs?.[brief];
    if (!base) {
      rows.push({ brief, metric: null, note: 'no baseline for this brief' });
      continue;
    }
    for (const name of METRICS) {
      const bs = base.metrics?.[name] ?? {};
      const cs = cur.metrics?.[name] ?? {};
      const b = bs.median;
      const c = cs.median;
      if (!Number.isFinite(b)) continue;
      const kind = metricKind(name);
      if (!Number.isFinite(c)) {
        rows.push({ brief, metric: name, baseline: b, latest: null, delta: null, noData: true, regressed: false, base: bs, cur: cs });
        if (kind !== 'info') warnings.push(`${brief}: ${name} no data in the latest row (baseline ${b}); not compared`);
        continue;
      }
      const delta = b === 0 ? (c === 0 ? 0 : Infinity) : (c - b) / b;
      const limit = t[kind];
      const tooSmall = kind === 'time' && b < t.minTimeMs;
      const top = rangeTop(bs);
      const hasRange = (bs.n ?? 0) > 1 && Number.isFinite(top);
      const aboveRange = hasRange ? c > top : true;
      const regressed = limit !== undefined && !tooSmall && aboveRange && delta > limit;
      rows.push({ brief, metric: name, baseline: b, latest: c, delta, aboveRange, regressed, base: bs, cur: cs });
      if (regressed) {
        warnings.push(`${brief}: ${name} ${fmtDelta(delta)} (limit +${Math.round(limit * 100)}%, above baseline ${(bs.n ?? 0) >= 5 && Number.isFinite(bs.second) ? '2nd-highest' : 'max'} ${top ?? b}; ${spreadNote(bs, cs)})`);
      }
    }
    const bRate = base.n ? base.passed / base.n : null;
    const cRate = cur.n ? cur.passed / cur.n : null;
    if (bRate !== null && cRate !== null && cRate < bRate) {
      warnings.push(`${brief}: passing runs ${cur.passed}/${cur.n}, baseline ${base.passed}/${base.n}`);
    }
  }
  return { rows, warnings, thresholds: t };
};

// "baseline n=5 spread 60%, latest n=5 spread 30%"
export const spreadNote = (bs, cs) => {
  const one = (label, s) => `${label} n=${s?.n ?? 0}${Number.isFinite(s?.spread) ? ` spread ${Math.round(s.spread * 100)}%` : ''}`;
  return `${one('baseline', bs)}, ${one('latest', cs)}`;
};

// Network for the benchmark agent: on by default only on Linux, where the
// Codex sandbox's network filter also blocks the socket calls Chrome needs.
// --network or --no-network overrides.
export const networkDefault = (platform, args = []) => {
  if (args.includes('--no-network')) return false;
  if (args.includes('--network')) return true;
  return platform === 'linux';
};

export const fmtDelta = (d) => (Number.isFinite(d) ? `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%` : 'new');

// The row to compare against: the newest row marked baseline for the same
// agent, model, and machine label, else null. Rows from different machines
// are not comparable. A sha picks that baseline instead (same rule).
export const pickBaseline = (history, latest, sha) => {
  const same = history.filter((r) => r !== latest && r.agent === latest.agent && r.model === latest.model
    && (r.machine?.label ?? null) === (latest.machine?.label ?? null));
  if (sha) return same.filter((r) => String(r.gitSha).startsWith(sha)).at(-1) ?? null;
  return same.filter((r) => r.baseline).at(-1) ?? null;
};

// ---------- markdown

const fmt = (name, v) => {
  if (!Number.isFinite(v)) return '—';
  if (name === 'costUsd') return `$${v.toFixed(4)}`;
  if (name.endsWith('Ms')) return `${(v / 1000).toFixed(1)}s`;
  if (name === 'videoSec') return `${v.toFixed(1)}s`;
  return String(Math.round(v));
};

export const renderSummary = (row, cmp) => {
  const lines = [
    '# explain-video benchmark',
    '',
    'Generated by `npm run bench:explain-video`. Do not edit by hand; `history.jsonl` is the source.',
    '',
    `Latest: \`${String(row.gitSha).slice(0, 7)}\` (skills tree \`${String(row.skillsTree ?? '?').slice(0, 7)}\`)${row.dirty ? ' (dirty)' : ''} · ${row.date} · ${row.agent} ${row.model}${row.reasoningEffort ? ` (${row.reasoningEffort})` : ''} · ${row.machine?.label ?? '?'} · N=${row.runsPerBrief} per brief${row.baseline ? ' · **baseline**' : ''}`,
    `Cost: ${row.costSource}`,
    '',
  ];
  for (const [brief, agg] of Object.entries(row.briefs)) {
    lines.push(`## ${brief}`, '', `Passed ${agg.passed}/${agg.n} runs; medians use passing runs only (check-ste, stills audit, check.mjs, render duration check, mp4, 20-40 s length). Fresh review: ${agg.review ?? '—'}.`, '');
    lines.push('| Metric | Median | Min | Max | Spread |', '| --- | --- | --- | --- | --- |');
    for (const name of METRICS) {
      const s = agg.metrics[name];
      if (!s || s.n === 0) {
        lines.push(`| ${name} | no data | — | — | — |`);
        continue;
      }
      lines.push(`| ${name} | ${fmt(name, s.median)} | ${fmt(name, s.min)} | ${fmt(name, s.max)} | ${Math.round((s.spread ?? 0) * 100)}% |`);
    }
    if (agg.failedRuns?.length) {
      lines.push('', 'Failed runs, kept out of the medians:', '');
      for (const f of agg.failedRuns) {
        lines.push(`- run ${f.run}: failed ${f.failed.join(', ') || '?'} · ${fmt('wallMs', f.wallMs)} · ${fmt('tokens.total', f.tokens)} tokens · ${fmt('costUsd', f.costUsd)} · video ${fmt('videoSec', f.videoSec)}${f.error ? ` · ${f.error}` : ''}`);
      }
    }
    lines.push('');
  }
  lines.push('## Compared with baseline', '');
  if (!cmp) {
    lines.push(row.baseline ? 'This row is the baseline. The next run compares against it.' : 'No baseline row yet for this agent and model.');
  } else {
    lines.push(`Baseline: \`${String(cmp.baseline.gitSha).slice(0, 7)}\` · ${cmp.baseline.date}. A metric flags when its median is above the baseline range (max, or 2nd-highest run when n ≥ 5) and past its limit: time +${Math.round(cmp.result.thresholds.time * 100)}%, tokens +${Math.round(cmp.result.thresholds.tokens * 100)}%, cost +${Math.round(cmp.result.thresholds.cost * 100)}%. Warn only.`, '');
    lines.push(cmp.result.warnings.length ? cmp.result.warnings.map((w) => `- ⚠️ ${w}`).join('\n') : '- No regressions.');
  }
  lines.push('');
  return lines.join('\n');
};
