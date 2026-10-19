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

// The skill's own checks, from the last run of each: check-ste (exit 2 means
// not checked, which is not a pass), the stills layout audit, check.mjs (the
// measured gate and text audit), the full render with its duration check,
// and the mp4 on disk. The fresh review verdict is reported, not required:
// it needs a second agent the host may not offer.
export const checkResults = (steps, mp4Exists) => {
  const lastExit = (kind) => steps.filter((s) => s.kind === kind).at(-1)?.exit ?? null;
  const checks = {
    ste: lastExit('ste') === 0,
    layout: lastExit('stills') === 0,
    measured: lastExit('measure') === 0,
    render: lastExit('render') === 0,
    mp4: Boolean(mp4Exists),
  };
  const verdict = lastExit('verdict');
  const review = verdict === 0 ? 'pass' : verdict === 1 ? 'return' : verdict === null ? 'not-run' : 'blocked';
  return { ...checks, pass: Object.values(checks).every(Boolean), review };
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
  return { n: xs.length, median: med, min, max, spread: med === 0 ? 0 : Math.round(((max - min) / med) * 1000) / 1000 };
};

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

export const aggregate = (runs) => {
  const flat = runs.map(flatten);
  const metrics = {};
  for (const name of METRICS) metrics[name] = stats(flat.map((f) => f[name]));
  const reviews = runs.map((r) => r.checks?.review ?? 'not-run');
  const review = [...new Set(reviews)].map((v) => `${v} ${reviews.filter((x) => x === v).length}`).join(', ');
  return { n: runs.length, passed: runs.filter((r) => r.checks?.pass).length, review, metrics };
};

// ---------- compare

export const DEFAULT_THRESHOLDS = { time: 0.2, tokens: 0.15, cost: 0.15, tools: 0.25, minTimeMs: 5000 };

// Latest vs baseline, brief by brief, on the medians. A metric is a
// regression when it grows by more than its kind's threshold. Time metrics
// whose baseline median is under minTimeMs are reported but never flagged:
// a 2 s stage moving 1 s is noise. Fewer passing runs is always flagged.
// Warn-only: the caller prints warnings and never fails CI on them.
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
      const b = base.metrics?.[name]?.median;
      const c = cur.metrics?.[name]?.median;
      if (!Number.isFinite(b) || !Number.isFinite(c)) continue;
      const delta = b === 0 ? (c === 0 ? 0 : Infinity) : (c - b) / b;
      const kind = metricKind(name);
      const limit = t[kind];
      const tooSmall = kind === 'time' && b < t.minTimeMs;
      const regressed = limit !== undefined && !tooSmall && delta > limit;
      rows.push({ brief, metric: name, baseline: b, latest: c, delta, regressed });
      if (regressed) warnings.push(`${brief}: ${name} ${fmtDelta(delta)} (limit +${Math.round(limit * 100)}%)`);
    }
    const bRate = base.n ? base.passed / base.n : null;
    const cRate = cur.n ? cur.passed / cur.n : null;
    if (bRate !== null && cRate !== null && cRate < bRate) {
      warnings.push(`${brief}: passing runs ${cur.passed}/${cur.n}, baseline ${base.passed}/${base.n}`);
    }
  }
  return { rows, warnings, thresholds: t };
};

export const fmtDelta = (d) => (Number.isFinite(d) ? `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%` : 'new');

// The row to compare against: the newest row marked baseline for the same
// agent and model, else null. A sha picks that baseline instead.
export const pickBaseline = (history, latest, sha) => {
  const same = history.filter((r) => r !== latest && r.agent === latest.agent && r.model === latest.model);
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
    lines.push(`## ${brief}`, '', `Passed ${agg.passed}/${agg.n} runs (check-ste, stills audit, check.mjs, render duration check, mp4). Fresh review: ${agg.review ?? '—'}.`, '');
    lines.push('| Metric | Median | Min | Max | Spread |', '| --- | --- | --- | --- | --- |');
    for (const name of METRICS) {
      const s = agg.metrics[name];
      if (!s || s.n === 0) continue;
      lines.push(`| ${name} | ${fmt(name, s.median)} | ${fmt(name, s.min)} | ${fmt(name, s.max)} | ${Math.round((s.spread ?? 0) * 100)}% |`);
    }
    lines.push('');
  }
  lines.push('## Compared with baseline', '');
  if (!cmp) {
    lines.push(row.baseline ? 'This row is the baseline. The next run compares against it.' : 'No baseline row yet for this agent and model.');
  } else {
    lines.push(`Baseline: \`${String(cmp.baseline.gitSha).slice(0, 7)}\` · ${cmp.baseline.date}. Limits: time +${Math.round(cmp.result.thresholds.time * 100)}%, tokens +${Math.round(cmp.result.thresholds.tokens * 100)}%, cost +${Math.round(cmp.result.thresholds.cost * 100)}%. Warn only.`, '');
    lines.push(cmp.result.warnings.length ? cmp.result.warnings.map((w) => `- ⚠️ ${w}`).join('\n') : '- No regressions.');
  }
  lines.push('');
  return lines.join('\n');
};
