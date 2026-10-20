#!/usr/bin/env node
// Live speed and token-cost benchmark for the vs-explain-video skill.
//
//   npm run bench:explain-video -- [--runs 5] [--brief <id>]... [--set-baseline]
//                                  [--no-record] [--timeout 1800] [--network | --no-network]
//
// Runs the skill end to end through a real PathGrade agent (Codex on the
// repository default model unless PATHGRADE_AGENT / PATHGRADE_CODEX_MODEL say
// otherwise) on each fixed brief in briefs.json, N times. Per run it records
// wall time, time per stage, agent tokens, tool calls, $ cost, the video
// length, and whether the skill's own checks passed. It appends one row to
// history.jsonl, rewrites SUMMARY.md, and warns when the medians regress
// against the stored baseline (compare.mjs). Never part of eval:static or CI.
//
// Narration uses the free local kokoro voice; ELEVENLABS_API_KEY is removed
// from the agent's environment so no paid TTS can run.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { aggregate, checkResults, networkDefault, compare, parseCodexTap, parseStageLog, pickBaseline, priceTokens, renderedVideo, renderSummary, stageTimes, stepTotals } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SKILLS = path.join(ROOT, 'skills');
const SKILL_DIR = path.join(SKILLS, 'vs-explain-video');
const HISTORY = path.join(HERE, 'history.jsonl');
const SUMMARY = path.join(HERE, 'SUMMARY.md');
const DEFAULT_CODEX_MODEL = 'gpt-5.6-luna'; // keep in step with skills/vs-internal-shared/test/pathgrade-agent.ts

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i < 0) return fallback;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
};
const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : a.startsWith(`${name}=`) ? [a.slice(name.length + 1)] : []));
const runs = Number(opt('--runs', '5'));
const timeoutSec = Number(opt('--timeout', '1800'));
const record = !args.includes('--no-record');
const setBaseline = args.includes('--set-baseline');
const network = networkDefault(process.platform, args);
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');

const agentName = process.env.PATHGRADE_AGENT ?? 'codex';
const model = agentName === 'codex' ? (process.env.PATHGRADE_CODEX_MODEL ?? DEFAULT_CODEX_MODEL) : (process.env.PATHGRADE_MODEL ?? undefined);
const { briefs: allBriefs } = JSON.parse(readFileSync(path.join(HERE, 'briefs.json'), 'utf8'));
const picked = all('--brief');
const briefs = picked.length ? allBriefs.filter((b) => picked.includes(b.id)) : allBriefs;
if (briefs.length === 0) throw new Error(`no brief matches ${picked.join(', ')}`);
const prices = JSON.parse(readFileSync(path.join(HERE, 'prices.json'), 'utf8'));

const sh = (cmd) => spawnSync('/bin/sh', ['-c', cmd], { encoding: 'utf8' });
const which = (name) => sh(`command -v ${name}`).stdout.trim() || null;
const log = (msg) => process.stderr.write(`[bench] ${msg}\n`);

// ---------- warm tooling on the host, outside any agent sandbox.
// The agent's sandbox has no network, its own empty HOME, and can write only
// to the workspace and /tmp. The skill's tools are made ready once, as on a
// machine that has run the skill before, so the numbers measure the skill and
// not first-time downloads.
const TOOL_DIR = process.env.VS_BENCH_TOOL_DIR ?? '/tmp/vs-bench-explain-video';
const prepareTooling = () => {
  mkdirSync(TOOL_DIR, { recursive: true });
  const media = readFileSync(path.join(SKILL_DIR, 'scripts', 'media.mjs'), 'utf8');
  const pw = media.match(/PLAYWRIGHT_CORE_VERSION = '([^']+)'/)?.[1];
  const playwrightDir = path.join(TOOL_DIR, `playwright-core-${pw}`);
  if (!existsSync(path.join(playwrightDir, 'node_modules', 'playwright-core'))) {
    log(`installing playwright-core@${pw} into ${playwrightDir}`);
    execFileSync('npm', ['install', '--prefix', playwrightDir, '--no-audit', '--no-fund', '--loglevel=error', `playwright-core@${pw}`], { stdio: 'inherit' });
  }
  const kokoroDir = process.env.KOKORO_DIR ?? path.join(os.homedir(), '.cache', 'kokoro');
  for (const file of ['kokoro-v1.0.onnx', 'voices-v1.0.bin']) {
    if (!existsSync(path.join(kokoroDir, file))) throw new Error(`kokoro model missing: ${path.join(kokoroDir, file)}. Run preflight.mjs and follow its tts install hint.`);
  }
  if (!which('uv')) throw new Error('uv is not on PATH; the kokoro voice needs it.');
  const uvCache = path.join(TOOL_DIR, 'uv-cache');
  const warm = spawnSync('uv', ['run', '--quiet', '--python', '3.12', '--with', 'kokoro-onnx', '--with', 'soundfile', 'python', '-c', 'import kokoro_onnx, soundfile'], {
    encoding: 'utf8', env: { ...process.env, UV_CACHE_DIR: uvCache },
  });
  if (warm.status !== 0) throw new Error(`could not warm the kokoro env: ${warm.stderr.slice(-400)}`);
  const uvPython = sh('uv python dir').stdout.trim();
  // init.mjs downloads fonts to ~/.cache/vs-explain-video once; do that on the host.
  const scratch = mkdtempSync(path.join(TOOL_DIR, 'init-'));
  spawnSync(process.execPath, [path.join(SKILL_DIR, 'scripts', 'init.mjs'), scratch], { stdio: 'ignore' });
  rmSync(scratch, { recursive: true, force: true });
  return { playwrightDir, kokoroDir, uvCache, uvPython };
};

// The skill reads ../vs-write and ../vs-internal-shared; stage them next to it.
const stageFixture = () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'vs-bench-fixture-'));
  for (const convention of ['.agents', '.claude']) {
    for (const skill of ['vs-write', 'vs-internal-shared']) {
      cpSync(path.join(SKILLS, skill), path.join(fixture, convention, 'skills', skill), {
        recursive: true,
        filter: (src) => !src.split(path.sep).includes('test'),
      });
    }
  }
  writeFileSync(path.join(fixture, 'README.md'), '# Benchmark workspace\n\nA disposable workspace for the explain-video benchmark.\n');
  return fixture;
};

const promptFor = (brief) => {
  const invoke = agentName === 'codex' ? '$vs-explain-video' : '/vs-explain-video';
  return `Use ${invoke} to make a short explainer video. Topic slug: ${brief.topic}.\n\n${brief.brief}\n\n` +
    'Benchmark constraints: the whole video must be 20-40 seconds (2-3 scenes, 2 beats each). ' +
    'Use the default free local voice (kokoro, af_heart); do not audition voices. ' +
    'Do not ask me anything; make reasonable choices and finish. Follow the skill to the end: check-ste, narrate, stills audit, full render, handoff.';
};

// gitSha is the checkout that ran. skillsTree is the git tree of skills/, so
// two rows with the same tree measured the same skill code even after a
// rebase. dirty means skills/ had uncommitted edits.
const gitInfo = () => {
  const g = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  return {
    gitSha: g('rev-parse', 'HEAD'),
    branch: g('rev-parse', '--abbrev-ref', 'HEAD'),
    skillsTree: g('rev-parse', 'HEAD:skills'),
    dirty: g('status', '--porcelain', '--', 'skills').length > 0,
  };
};

const machine = () => ({
  label: process.env.VS_BENCH_MACHINE ?? `${os.platform()}-${os.arch()}`,
  platform: os.platform(),
  arch: os.arch(),
  cpu: os.cpus()[0]?.model?.trim() ?? 'unknown',
  cores: os.cpus().length,
  memGb: Math.round(os.totalmem() / 2 ** 30),
  node: process.version,
});

const runOne = async (brief, i, tooling, fixture, createAgent) => {
  const runDir = mkdtempSync(path.join(TOOL_DIR, `run-${brief.id}-${i}-`));
  const stageLog = path.join(runDir, 'stages.jsonl');
  const tap = path.join(runDir, 'codex-tap.jsonl');
  const realCodex = which('codex');
  const env = {
    NODE_OPTIONS: `--import=${pathToFileURL(path.join(HERE, 'stage-hook.mjs')).href}`,
    VS_BENCH_STAGE_LOG: stageLog,
    KOKORO_DIR: tooling.kokoroDir,
    UV_CACHE_DIR: tooling.uvCache,
    UV_PYTHON_INSTALL_DIR: tooling.uvPython,
    VS_TOOLING_DIR: tooling.playwrightDir,
    VS_EXPLAIN_VIDEO_NO_INSTALL: '1',
    ELEVENLABS_API_KEY: '',
    ...(agentName === 'codex' && realCodex
      ? { PATH: `${path.join(HERE, 'bin')}:${process.env.PATH}`, VS_BENCH_REAL_CODEX: realCodex, VS_BENCH_CODEX_TAP: tap, VS_BENCH_CODEX_NETWORK: network ? '1' : '0' }
      : {}),
  };
  const agent = await createAgent({
    agent: agentName,
    ...(model ? { model } : {}),
    timeout: timeoutSec,
    skillDir: SKILL_DIR,
    workspace: fixture,
    env,
    copyFromHome: ['.cache/vs-explain-video'],
  });
  const t0 = Date.now();
  let error = null;
  try {
    await agent.prompt(promptFor(brief));
  } catch (e) {
    error = String(e?.message ?? e).split('\n')[0];
  }
  const t1 = Date.now();
  try {
    const steps = parseStageLog(existsSync(stageLog) ? readFileSync(stageLog, 'utf8') : '');
    let mp4 = renderedVideo(steps);
    if (!mp4 || !existsSync(mp4)) {
      const found = await agent.exec('find "$HOME" "$PWD" "$TMPDIR" -name "*.mp4" -not -path "*/node_modules/*" 2>/dev/null');
      mp4 = found.stdout.split('\n').map((s) => s.trim()).filter(Boolean).at(-1) ?? null;
    }
    let videoSec = null;
    if (mp4 && existsSync(mp4)) {
      const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4], { encoding: 'utf8' });
      videoSec = Number.parseFloat(p.stdout) || null;
    }
    const codex = existsSync(tap) ? parseCodexTap(readFileSync(tap, 'utf8')) : null;
    let tokens = codex?.tokens ?? null;
    let costUsd = null;
    let costSource = 'none';
    const usage = agent.llm?.tokenUsage;
    if (!tokens && usage && (usage.inputTokens || usage.outputTokens)) {
      tokens = { input: usage.inputTokens, output: usage.outputTokens, total: usage.inputTokens + usage.outputTokens };
    }
    if (Number.isFinite(agent.llm?.costUsd) && agent.llm.costUsd > 0) {
      costUsd = agent.llm.costUsd;
      costSource = 'reported';
    } else {
      costUsd = priceTokens(tokens, codex?.model ?? model, prices);
      costSource = costUsd === null ? 'none' : 'computed';
    }
    const toolCalls = codex ? codex.toolCalls : agent.log.filter((e) => e.type === 'tool_event').length;
    const run = {
      brief: brief.id,
      run: i,
      error,
      wallMs: t1 - t0,
      stages: stageTimes(steps, t0, t1),
      steps: stepTotals(steps),
      tokens,
      toolCalls,
      toolTypes: codex?.toolTypes,
      costUsd,
      costSource,
      model: codex?.model ?? model ?? null,
      reasoningEffort: codex?.reasoningEffort ?? null,
      videoSec,
      checks: checkResults(steps, Boolean(mp4 && existsSync(mp4)), videoSec),
    };
    writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);
    log(`${brief.id} #${i}: ${(run.wallMs / 1000).toFixed(0)}s, ${tokens?.total ?? '?'} tokens, $${costUsd ?? '?'}, video ${videoSec?.toFixed(1) ?? '?'}s, ${run.checks.pass ? 'pass' : `FAIL (${run.checks.failed.join(', ')})`}${error ? ` (${error})` : ''}`);
    return run;
  } finally {
    await agent.dispose();
  }
};

const main = async () => {
  const { createAgent } = await import('@wix/pathgrade');
  const tooling = prepareTooling();
  const fixture = stageFixture();
  const results = {};
  try {
    for (const brief of briefs) {
      results[brief.id] = [];
      for (let i = 1; i <= runs; i += 1) {
        log(`${brief.id} run ${i}/${runs}`);
        results[brief.id].push(await runOne(brief, i, tooling, fixture, createAgent));
      }
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
  const allRuns = Object.values(results).flat();
  const costSources = [...new Set(allRuns.map((r) => r.costSource))];
  const row = {
    schema: 1,
    date: new Date().toISOString(),
    ...gitInfo(),
    baseline: setBaseline,
    agent: agentName,
    model: allRuns.find((r) => r.model)?.model ?? model ?? null,
    reasoningEffort: allRuns.find((r) => r.reasoningEffort)?.reasoningEffort ?? null,
    transport: agentName === 'codex' ? (process.env.PATHGRADE_CODEX_TRANSPORT ?? 'app-server') : null,
    agentCli: agentName === 'codex' ? sh('codex --version').stdout.trim() : null,
    machine: machine(),
    runsPerBrief: runs,
    costSource: costSources.includes('reported')
      ? 'reported by the agent'
      : costSources.includes('computed')
        ? `computed from tokens with prices.json (pinned ${prices.pinned}); ${agentName} does not report cost`
        : 'unavailable',
    briefs: Object.fromEntries(Object.entries(results).map(([id, rs]) => [id, { ...aggregate(rs), runs: rs }])),
  };
  const history = existsSync(HISTORY) ? readFileSync(HISTORY, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const base = pickBaseline(history, row, opt('--baseline'));
  const cmp = base ? { baseline: base, result: compare(base, row) } : null;
  if (record) {
    appendFileSync(HISTORY, `${JSON.stringify(row)}\n`);
    writeFileSync(SUMMARY, renderSummary(row, cmp));
    log(`recorded ${HISTORY} and ${SUMMARY}`);
  } else {
    process.stdout.write(renderSummary(row, cmp));
  }
  for (const w of cmp?.result.warnings ?? []) log(`WARN regression: ${w}`);
  if (!cmp) log('no baseline row for this agent, model, and machine; rerun with --set-baseline to store one');
};

main().catch((e) => {
  process.stderr.write(`[bench] ${e.stack ?? e}\n`);
  process.exit(2);
});
