import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';
import { findRunWorkDirs } from './run-dirs';

// Live explain-video runs on the renderer choice:
//   fframes-default   a warm shared build: the agent writes the per-video Rust crate from the
//                     template (ff/src/main.rs, one arm per scene) and checks it with fframes.mjs
//   fallback-loud     no usable Rust and no shared build: the agent falls back to Playwright
//                     (scenes.js) and says FALLBACK out loud instead of degrading silently
//   warm-fails        Rust looks fine but the shared build fails (a cargo that exits 101): the
//                     agent tries doctor --warm, then falls back loudly
// The fallback checks score behaviour, not wording: the agent's own text says it fell back,
// names Playwright, and gives a reason; and the video's renderer.json records playwright.
// Opt-in (each run is a full agent session with narration and stills):
//   EXPLAIN_VIDEO_LIVE=1 [EXPLAIN_VIDEO_CASES=fframes-default,fallback-loud,warm-fails]
//   [EXPLAIN_VIDEO_RUNS=3] [EXPLAIN_VIDEO_OUT=/tmp/explain-video-live]
//   [VS_FF_CACHE=<warm cache>] [VS_FF_CARGO=<cargo>] npx vitest run skills/vs-explain-video/test/explain-video-renderer.eval.ts
// fframes-default needs the shared build warmed once (fframes.mjs doctor --warm).

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const LIVE = process.env.EXPLAIN_VIDEO_LIVE === '1';
const CASES = (process.env.EXPLAIN_VIDEO_CASES ?? 'fframes-default,fallback-loud,warm-fails').split(',');
const RUNS = Number(process.env.EXPLAIN_VIDEO_RUNS ?? 1);
const OUT = process.env.EXPLAIN_VIDEO_OUT ?? '/tmp/explain-video-live';
const WARM_CACHE = process.env.VS_FF_CACHE ?? path.join(os.homedir(), '.cache', 'vs', 'fframes');
const CARGO = process.env.VS_FF_CARGO ?? path.join(os.homedir(), '.cargo', 'bin', 'cargo');
// The agent runs with a sandboxed HOME: point it at this machine's voice and Playwright
// (the fallback case needs a browser; neither case may block on a missing voice).
const HOST_TOOLS: Record<string, string> = Object.fromEntries(Object.entries({
  KOKORO_DIR: process.env.KOKORO_DIR ?? path.join(os.homedir(), '.cache', 'kokoro'),
  PLAYWRIGHT_MODULE: process.env.PLAYWRIGHT_MODULE ?? (() => { try { return path.dirname(createRequire(__filename).resolve('playwright-core')); } catch { return undefined; } })(),
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(os.homedir(), '.cache', 'ms-playwright'),
  // rustup's cargo proxy and uv's Python resolve from HOME; keep the machine's toolchains.
  RUSTUP_HOME: process.env.RUSTUP_HOME ?? path.join(os.homedir(), '.rustup'),
  CARGO_HOME: process.env.CARGO_HOME ?? path.join(os.homedir(), '.cargo'),
  UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? path.join(os.homedir(), '.cache', 'uv'),
  UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR ?? path.join(os.homedir(), '.local', 'share', 'uv', 'python'),
}).filter((e): e is [string, string] => typeof e[1] === 'string' && fs.existsSync(e[1])));
// Kokoro and uv take a lock inside their cache, and the host's caches are read-only to a
// sandboxed agent: give each run its own writable copy under /tmp (removed after the run).
const WRITABLE = ['KOKORO_DIR', 'UV_CACHE_DIR'];
const tools = (): Record<string, string> => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ev-tools-'));
  CLEANUP.push(scratch);
  return Object.fromEntries(Object.entries(HOST_TOOLS).map(([k, v]) => {
    if (!WRITABLE.includes(k)) return [k, v];
    const copy = path.join(scratch, k.toLowerCase());
    fs.cpSync(v, copy, { recursive: true });
    return [k, copy];
  }));
};

const TOPIC = `Use $vs-explain-video. Make a short explainer (about 20 seconds, 2 scenes) on why a debounce waits for the user to stop typing before it searches. Use the default voice. Stop after the stills check passes (step 7 checks); skip the final mp4 render, and give the handoff with the renderer you used.`;

// Where the agent may write. Pathgrade gives it HOME=<run>/home and TMPDIR=<run>/tmp, both
// writable (the run root is under /tmp), so $HOME/.vs lands inside the run. Codex can also
// write anywhere in /tmp, and an agent has picked /tmp/.vs instead. /tmp is shared, so a
// work dir there counts as this run's only when its crate names this run's own
// VS_FF_CACHE (run-dirs.ts). Those dirs are scored read-only and their paths logged;
// nothing under /tmp/.vs is ever deleted (only the run's own temp caches are).
const STRAY = path.join(os.tmpdir(), '.vs');
let RUN_CACHE = '';
// Every file the run wrote: its root (workspace, sandboxed home and tmp) and its own work dirs under /tmp/.vs.
const runFiles = (workspace: string) => [path.dirname(workspace), ...findRunWorkDirs(STRAY, RUN_CACHE)].flatMap((r) => files(r));
function files(root: string, out: string[] = [], depth = 0): string[] {
  if (depth > 9 || !fs.existsSync(root)) return out;
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'target' || e.name === '.git') continue;
    const p = path.join(root, e.name);
    if (e.isDirectory()) files(p, out, depth + 1);
    else out.push(p);
  }
  return out;
}
const sceneArms = (main: string) => (main.match(/^\s*"[a-z0-9-]+"\s*=>/gm) ?? []).length;
// What the agent itself said (the prompt is excluded).
const agentText = (transcript: string) => transcript.split(/^\[User\]$/m).map((b) => b.replace(/^[\s\S]*?^\[Agent\]$/m, '')).join('\n');
// Loud fallback, by behaviour: it says it fell back, to Playwright, and why.
const saysFallback = check('says-fallback', ({ transcript }) => {
  const said = agentText(transcript);
  return /fall(?:ing|s)? ?back|fell back/i.test(said) && /playwright/i.test(said)
    && /because|unavailable|not available|missing|fail|cannot|can't|could not|couldn't|error|not installed|not found|blocked/i.test(said);
});
const wroteScenesJs = check('wrote-scenes-js', ({ workspace }) => {
  const js = runFiles(workspace).find((f) => f.endsWith(`${path.sep}scenes.js`) && !f.includes(`${path.sep}assets${path.sep}`));
  return !!js && (fs.readFileSync(js, 'utf8').match(/\bscene\(/g) ?? []).length >= 2;
});
// The fallback is recorded where lint.mjs reads it: the video's renderer.json ends as playwright.
const markerPlaywright = check('marker-playwright', ({ workspace }) => {
  const markers = runFiles(workspace).filter((f) => f.endsWith(`${path.sep}renderer.json`));
  return markers.length > 0 && markers.every((f) => {
    try { return JSON.parse(fs.readFileSync(f, 'utf8')).renderer === 'playwright'; } catch { return false; }
  });
});
const noFframesClaim = check('no-fframes-claim', ({ transcript }) => !/rendered (?:it )?with fframes|renderer: fframes/i.test(agentText(transcript)));

const CLEANUP: string[] = [];
let WARM_FAILS_BIN = '';
type Case = { id: string; env: () => Record<string, string>; checks: ReturnType<typeof check>[] };
const CASE_LIST: Case[] = [
  {
    id: 'fframes-default',
    // A sandboxed agent writes only under the workspace and /tmp, and the per-video build
    // takes the shared build lock: give it a private copy of the warm cache there.
    env: () => {
      const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ff-cache-'));
      fs.cpSync(WARM_CACHE, copy, { recursive: true, preserveTimestamps: true });
      CLEANUP.push(copy);
      return { ...tools(), VS_FF_CACHE: copy, VS_FF_CARGO: CARGO };
    },
    checks: [
      check('wrote-crate-from-template', ({ workspace }) => {
        const all = runFiles(workspace);
        const main = all.find((f) => f.endsWith(path.join('ff', 'src', 'main.rs')));
        if (!main) return false;
        const src = fs.readFileSync(main, 'utf8');
        const toml = fs.readFileSync(path.join(path.dirname(path.dirname(main)), 'Cargo.toml'), 'utf8');
        return /vs_fframes_kit/.test(toml) && sceneArms(src) >= 2 && !/todo!\(|unimplemented!\(/.test(src);
      }),
      check('checked-with-fframes', ({ workspace }) =>
        runFiles(workspace).some((f) => /[\\/]stills[\\/][^\\/]+\.png$/.test(f))),
      check('handoff-names-fframes', ({ transcript }) => /fframes/i.test(transcript)),
      check('no-silent-playwright', ({ transcript }) => !/rendered with playwright|playwright renderer/i.test(transcript) || /FALLBACK/.test(transcript)),
    ],
  },
  {
    id: 'fallback-loud',
    env: () => ({ ...tools(), VS_FF_CACHE: fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ff-empty-')), VS_FF_CARGO: '/nonexistent/cargo' }),
    checks: [saysFallback, wroteScenesJs, noFframesClaim, markerPlaywright],
  },
  {
    id: 'warm-fails',
    // A Rust that passes the version check but cannot build: --warm fails, so the agent
    // must fall back. The fake cargo logs each call, which proves the warm was tried.
    env: () => {
      const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ff-badcargo-'));
      fs.writeFileSync(path.join(bin, 'rustc'), '#!/bin/sh\necho "rustc 1.99.1 (fake 2026-01-01)"\n', { mode: 0o755 });
      fs.writeFileSync(path.join(bin, 'cargo'), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "cargo 1.99.1 (fake 2026-01-01)"; exit 0; fi\necho "$*" >> '${bin}/calls'\necho "error: could not compile fframes (lib) due to 1 previous error" >&2\nexit 101\n`, { mode: 0o755 });
      CLEANUP.push(bin);
      WARM_FAILS_BIN = bin;
      return { ...tools(), VS_FF_CACHE: fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ff-empty-')), VS_FF_CARGO: path.join(bin, 'cargo') };
    },
    checks: [
      check('tried-warm', () => fs.existsSync(path.join(WARM_FAILS_BIN, 'calls')) && /build/.test(fs.readFileSync(path.join(WARM_FAILS_BIN, 'calls'), 'utf8'))),
      saysFallback,
      wroteScenesJs,
      noFframesClaim,
      markerPlaywright,
    ],
  },
];

describe.skipIf(!LIVE)('vs-explain-video renderer choice', () => {
  for (const c of CASE_LIST.filter((x) => CASES.includes(x.id))) for (let run = 1; run <= RUNS; run++) {
    it(`${c.id} #${run}`, async () => {
      const runEnv = c.env();
      RUN_CACHE = runEnv.VS_FF_CACHE;
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 1800,
        skillDir: SKILL_DIR,
        env: runEnv,
        copyFromHome: EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
      });
      try {
        await promptOnce(agent, TOPIC);
        const result = await evaluate(agent, c.checks);
        fs.mkdirSync(OUT, { recursive: true });
        fs.appendFileSync(path.join(OUT, 'runs.jsonl'), `${JSON.stringify({ case: c.id, run, score: result.score, checks: Object.fromEntries(result.scorers.map((x) => [x.name, x.score])), at: new Date().toISOString() })}\n`);
        fs.writeFileSync(path.join(OUT, `${c.id}-${run}.transcript.txt`), agent.transcript());
        fs.writeFileSync(path.join(OUT, `${c.id}-${run}.log.json`), JSON.stringify(agent.log, null, 1));
        // Work dirs scored outside the run root (left in place).
        const outside = findRunWorkDirs(STRAY, RUN_CACHE);
        if (outside.length) {
          console.log(`[${c.id} #${run}] scored work dirs outside the run root (not deleted): ${outside.join(', ')}`);
          fs.appendFileSync(path.join(OUT, 'outside-dirs.log'), `${c.id} #${run}: ${outside.join(', ')}\n`);
        }
        expect(result.score).toBe(1);
      } finally {
        await agent.dispose();
        for (const dir of CLEANUP.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
      }
    }, 2_000_000);
  }
});
