#!/usr/bin/env node
// Reports whether this machine can run the explain-video pipeline (ffmpeg,
// Playwright, a TTS engine), as JSON on stdout, and which renderer it uses:
// fframes (the default, see fframes.mjs doctor) or, when fframes cannot run
// here, the Playwright renderer, with a FALLBACK warning to pass on.
//
//   node preflight.mjs [<work-dir>]
//
// Pass the work dir to also find Playwright installed there. When nothing
// resolves, it installs the pinned playwright-core into the skill's tool cache
// (~/.vs/tooling), the same place render.mjs looks.
//
// The ElevenLabs key is reported as a boolean only. Its value is never read
// into the report, printed, or logged.
//
// Exit codes: 0 a full pipeline is available; 2 blocked, with `next` naming
// the install step that unblocks it.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { ensurePlaywright, run, which } from './media.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// fframes doctor without --warm only looks; it never builds.
const doctor = (() => {
  const r = run(process.execPath, [path.join(here, 'fframes.mjs'), 'doctor']);
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { ok: false, problems: [`fframes doctor did not answer: ${String(r.stderr).slice(0, 300)}`], next: 'FALLBACK: use the Playwright renderer (render.mjs).' };
  }
})();
// Only the shared cache missing: still fframes, after one `fframes.mjs doctor --warm`.
const renderer = doctor.ok || doctor.warmable ? 'fframes' : 'playwright';

const pythonHas = (module) =>
  which('python3') !== null && run('python3', ['-c', `import ${module}`]).status === 0;

const workDir = process.argv[2];
const playwright = ensurePlaywright(workDir ? [path.resolve(workDir)] : []);
const tools = {
  ffmpeg: which('ffmpeg'),
  ffprobe: which('ffprobe'),
  playwright: playwright.entry,
};
const kokoroDir = process.env.KOKORO_DIR ?? path.join(homedir(), '.cache', 'kokoro');
// narrate.mjs loads both files; one without the other fails at speak time.
const kokoroOnnx = which('uv') !== null
  && existsSync(path.join(kokoroDir, 'kokoro-v1.0.onnx'))
  && existsSync(path.join(kokoroDir, 'voices-v1.0.bin'));

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
  playwright: `auto-install did not finish (${playwright.error}). Fix that and rerun preflight.mjs, or set PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core`,
  tts:
    'export ELEVENLABS_API_KEY in your shell (never paste it into chat), or get the free local kokoro voice: mkdir -p ~/.cache/kokoro && curl -L -o ~/.cache/kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx && curl -L -o ~/.cache/kokoro/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin  (needs uv)',
};

const missing = [];
if (!tools.ffmpeg) missing.push({ tool: 'ffmpeg', install: INSTALL.ffmpeg });
if (!tools.ffprobe) missing.push({ tool: 'ffprobe', install: INSTALL.ffprobe });
// fframes draws every frame itself: Playwright is needed only to render the fallback.
if (!tools.playwright && renderer === 'playwright') missing.push({ tool: 'playwright', install: INSTALL.playwright });
if (!ttsEngine) missing.push({ tool: 'tts', install: INSTALL.tts });

const ok = missing.length === 0;
const report = {
  ok,
  ttsEngine,
  renderer,
  fframes: { ok: doctor.ok, warmable: Boolean(doctor.warmable), rust: doctor.rust ?? null, cache: doctor.cache ?? null, problems: doctor.problems ?? [], next: doctor.next },
  ...(renderer === 'fframes' ? {} : { warning: `FALLBACK: fframes is not available (${(doctor.problems ?? []).join('; ')}). This video renders with Playwright (render.mjs, scenes.js); say so in the handoff.` }),
  tools,
  tts,
  missing,
  next: ok
    ? `Pipeline ready with ${ttsEngine} narration and the ${renderer} renderer. Run init.mjs <work-dir> next.${doctor.ok ? '' : ` ${doctor.next}`}`
    : `Blocked on ${missing.map((item) => item.tool).join(', ')}. Run: ${missing
        .map((item) => item.install)
        .join(' ; ')}. Then rerun preflight.mjs. Until then, offer the storyboard as a /vs-show-me page instead.`,
};

if (report.warning) process.stderr.write(`\n*** ${report.warning} ***\n\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(ok ? 0 : 2);
