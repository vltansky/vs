import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { check, evaluate } from '@wix/pathgrade';
import { describe, expect, it } from 'vitest';
import { createAgent } from '../../vs-internal-shared/test/pathgrade-agent';
import { promptOnce } from '../../vs-internal-shared/test/pathgrade-v1';

// Live explain-video runs on the renderer choice:
//   fframes-default   a warm shared build: the agent writes the per-video Rust crate from the
//                     template (ff/src/main.rs, one arm per scene) and checks it with fframes.mjs
//   fallback-loud     no usable Rust and no shared build: the agent falls back to Playwright
//                     (scenes.js) and says FALLBACK out loud instead of degrading silently
// Opt-in (each run is a full agent session with narration and stills):
//   EXPLAIN_VIDEO_LIVE=1 [EXPLAIN_VIDEO_CASES=fframes-default,fallback-loud]
//   [VS_FF_CACHE=<warm cache>] [VS_FF_CARGO=<cargo>] npx vitest run skills/vs-explain-video/test/explain-video-renderer.eval.ts
// fframes-default needs the shared build warmed once (fframes.mjs doctor --warm).

const SKILL_DIR = path.resolve(__dirname, '..');
const EVAL_AGENT = (process.env.PATHGRADE_AGENT ?? 'codex') as 'claude' | 'codex';
const LIVE = process.env.EXPLAIN_VIDEO_LIVE === '1';
const CASES = (process.env.EXPLAIN_VIDEO_CASES ?? 'fframes-default,fallback-loud').split(',');
const WARM_CACHE = process.env.VS_FF_CACHE ?? path.join(os.homedir(), '.cache', 'vs', 'fframes');
const CARGO = process.env.VS_FF_CARGO ?? path.join(os.homedir(), '.cargo', 'bin', 'cargo');

const TOPIC = `Use $vs-explain-video. Make a short explainer (about 20 seconds, 2 scenes) on why a debounce waits for the user to stop typing before it searches. Use the default voice. Stop after the stills check passes (step 7 checks); skip the final mp4 render, and give the handoff with the renderer you used.`;

// Every file under the run's root (workspace and the sandboxed home), so the work dir is found wherever $HOME/.vs puts it.
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

type Case = { id: string; env: () => Record<string, string>; checks: ReturnType<typeof check>[] };
const CASE_LIST: Case[] = [
  {
    id: 'fframes-default',
    env: () => ({ VS_FF_CACHE: WARM_CACHE, VS_FF_CARGO: CARGO }),
    checks: [
      check('wrote-crate-from-template', ({ workspace }) => {
        const all = files(path.dirname(workspace));
        const main = all.find((f) => f.endsWith(path.join('ff', 'src', 'main.rs')));
        if (!main) return false;
        const src = fs.readFileSync(main, 'utf8');
        const toml = fs.readFileSync(path.join(path.dirname(path.dirname(main)), 'Cargo.toml'), 'utf8');
        return /vs_fframes_kit/.test(toml) && sceneArms(src) >= 2 && !/todo!\(|unimplemented!\(/.test(src);
      }),
      check('checked-with-fframes', ({ workspace }) =>
        files(path.dirname(workspace)).some((f) => /[\\/]stills[\\/][^\\/]+\.png$/.test(f))),
      check('handoff-names-fframes', ({ transcript }) => /fframes/i.test(transcript)),
      check('no-silent-playwright', ({ transcript }) => !/rendered with playwright|playwright renderer/i.test(transcript) || /FALLBACK/.test(transcript)),
    ],
  },
  {
    id: 'fallback-loud',
    env: () => ({ VS_FF_CACHE: fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ff-empty-')), VS_FF_CARGO: '/nonexistent/cargo' }),
    checks: [
      check('says-fallback', ({ transcript }) => /FALLBACK/.test(transcript) && /playwright/i.test(transcript)),
      check('wrote-scenes-js', ({ workspace }) => {
        const js = files(path.dirname(workspace)).find((f) => f.endsWith(`${path.sep}scenes.js`) && !f.includes(`${path.sep}assets${path.sep}`));
        return !!js && (fs.readFileSync(js, 'utf8').match(/\bscene\(/g) ?? []).length >= 2;
      }),
      check('no-fframes-claim', ({ transcript }) => !/rendered (?:it )?with fframes|renderer: fframes/i.test(transcript)),
    ],
  },
];

describe.skipIf(!LIVE)('vs-explain-video renderer choice', () => {
  for (const c of CASE_LIST.filter((x) => CASES.includes(x.id))) {
    it(c.id, async () => {
      const agent = await createAgent({
        agent: EVAL_AGENT,
        timeout: 1800,
        skillDir: SKILL_DIR,
        env: c.env(),
        copyFromHome: EVAL_AGENT === 'codex' ? ['.codex/auth.json'] : undefined,
      });
      try {
        await promptOnce(agent, TOPIC);
        const result = await evaluate(agent, c.checks);
        fs.mkdirSync('/tmp/explain-video-live', { recursive: true });
        fs.appendFileSync('/tmp/explain-video-live/runs.jsonl', `${JSON.stringify({ case: c.id, score: result.score, at: new Date().toISOString() })}\n`);
        fs.writeFileSync(`/tmp/explain-video-live/${c.id}.transcript.txt`, agent.transcript());
        expect(result.score).toBe(1);
      } finally {
        await agent.dispose();
      }
    }, 2_000_000);
  }
});
