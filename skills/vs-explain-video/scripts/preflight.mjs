#!/usr/bin/env node
// Reports whether this machine can run the explain-video pipeline (ffmpeg,
// Playwright, a TTS engine), as JSON on stdout.
//
//   node preflight.mjs
//
// The ElevenLabs key is reported as a boolean only. Its value is never read
// into the report, printed, or logged.
//
// Exit codes: 0 a full pipeline is available; 2 blocked, with `next` naming
// the install step that unblocks it.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { resolvePlaywright, run, which } from './media.mjs';

const pythonHas = (module) =>
  which('python3') !== null && run('python3', ['-c', `import ${module}`]).status === 0;

const playwrightEntry = resolvePlaywright();
const tools = {
  ffmpeg: which('ffmpeg'),
  ffprobe: which('ffprobe'),
  playwright: playwrightEntry,
};
const kokoroDir = process.env.KOKORO_DIR ?? path.join(homedir(), '.cache', 'kokoro');
const kokoroOnnx = which('uv') !== null && existsSync(path.join(kokoroDir, 'kokoro-v1.0.onnx'));

const tts = {
  elevenlabs: { keyPresent: Boolean(process.env.ELEVENLABS_API_KEY) },
  kokoro: kokoroOnnx ? `kokoro-onnx via uv (${kokoroDir})` : which('kokoro-tts') ?? (pythonHas('kokoro') ? 'python3 kokoro' : null),
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

const INSTALL = {
  ffmpeg: 'brew install ffmpeg  (Linux: sudo apt-get install -y ffmpeg)',
  ffprobe: 'ships with ffmpeg: brew install ffmpeg',
  playwright:
    'after init.mjs: npm i --prefix <work-dir> playwright-core (uses installed Chrome; keeps the project untouched), or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright',
  tts:
    'export ELEVENLABS_API_KEY in your shell (never paste it into chat), or get the free local kokoro voice: mkdir -p ~/.cache/kokoro && curl -L -o ~/.cache/kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx && curl -L -o ~/.cache/kokoro/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin  (needs uv)',
};

const missing = [];
if (!tools.ffmpeg) missing.push({ tool: 'ffmpeg', install: INSTALL.ffmpeg });
if (!tools.ffprobe) missing.push({ tool: 'ffprobe', install: INSTALL.ffprobe });
if (!tools.playwright) missing.push({ tool: 'playwright', install: INSTALL.playwright });
if (!ttsEngine) missing.push({ tool: 'tts', install: INSTALL.tts });

const ok = missing.length === 0;
const report = {
  ok,
  ttsEngine,
  tools,
  tts,
  missing,
  next: ok
    ? `Pipeline ready with ${ttsEngine} narration. Run init.mjs <work-dir> next.`
    : `Blocked on ${missing.map((item) => item.tool).join(', ')}. Run: ${missing
        .map((item) => item.install)
        .join(' ; ')}. Then rerun preflight.mjs. Until then, offer the storyboard as a /vs-show-me page instead.`,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(ok ? 0 : 2);
