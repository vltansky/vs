#!/usr/bin/env node
// Reports which explain-video pipeline this machine can run, as JSON on stdout.
//
//   node preflight.mjs [--math]
//
// --math prefers Manim when it is installed. A project that already depends on
// Remotion gets the Remotion backend. Otherwise the default is HTML/SVG scenes
// captured frame by frame with Playwright.
//
// The ElevenLabs key is reported as a boolean only. Its value is never read
// into the report, printed, or logged.
//
// Exit codes: 0 a full pipeline is available; 2 blocked, with `next` naming
// the install step that unblocks it.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { resolvePlaywright, run, which } from './media.mjs';

const math = process.argv.includes('--math');

const projectUsesRemotion = () => {
  const file = path.join(process.cwd(), 'package.json');
  if (!existsSync(file)) return false;
  try {
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    return Boolean({ ...pkg.dependencies, ...pkg.devDependencies }.remotion);
  } catch {
    return false;
  }
};

const pythonHas = (module) =>
  which('python3') !== null && run('python3', ['-c', `import ${module}`]).status === 0;

const playwrightEntry = resolvePlaywright();
const tools = {
  ffmpeg: which('ffmpeg'),
  ffprobe: which('ffprobe'),
  playwright: playwrightEntry,
  manim: which('manim'),
  remotion: projectUsesRemotion(),
};

const tts = {
  elevenlabs: { keyPresent: Boolean(process.env.ELEVENLABS_API_KEY) },
  kokoro: which('kokoro-tts') ?? (pythonHas('kokoro') ? 'python3 -m kokoro' : null),
  piper: which('piper'),
  say: process.platform === 'darwin' ? which('say') : null,
};

const ttsEngine = tts.elevenlabs.keyPresent
  ? 'elevenlabs'
  : tts.kokoro
    ? 'kokoro'
    : tts.piper
      ? 'piper'
      : tts.say
        ? 'say'
        : null;

const backend =
  tools.remotion
    ? 'remotion'
    : math && tools.manim
      ? 'manim'
      : tools.playwright
        ? 'html-playwright'
        : tools.manim
          ? 'manim'
          : null;

const INSTALL = {
  ffmpeg: 'brew install ffmpeg  (Linux: sudo apt-get install -y ffmpeg)',
  ffprobe: 'ships with ffmpeg: brew install ffmpeg',
  playwright:
    'npm i -D playwright && npx playwright install chromium  (or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright)',
  tts:
    'export ELEVENLABS_API_KEY in your shell (never paste it into chat), or install a free local voice: uv tool install kokoro-tts  |  pip install piper-tts',
};

const missing = [];
if (!tools.ffmpeg) missing.push({ tool: 'ffmpeg', install: INSTALL.ffmpeg });
if (!tools.ffprobe) missing.push({ tool: 'ffprobe', install: INSTALL.ffprobe });
if (!backend) missing.push({ tool: 'playwright', install: INSTALL.playwright });
if (!ttsEngine) missing.push({ tool: 'tts', install: INSTALL.tts });

const ok = missing.length === 0;
const report = {
  ok,
  backend,
  ttsEngine,
  tools,
  tts,
  missing,
  next: ok
    ? `Pipeline ready: ${backend} scenes, ${ttsEngine} narration. Write scenes.json, then run narrate.mjs, render-scenes.mjs, mux.mjs.`
    : `Blocked on ${missing.map((item) => item.tool).join(', ')}. Run: ${missing
        .map((item) => item.install)
        .join(' ; ')}. Then rerun preflight.mjs. Until then, offer the storyboard as a /vs-show-me page instead.`,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(ok ? 0 : 2);
