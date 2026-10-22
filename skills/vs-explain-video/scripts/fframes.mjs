#!/usr/bin/env node
// The default renderer: fframes (Rust + SVG, Skia on the CPU), with one shared
// build per machine and a small Rust crate per video.
//
//   node fframes.mjs doctor [--warm]           can this machine render? (--warm: build the shared cache once)
//   node fframes.mjs init <work-dir>            write <work>/ff/, the video crate, from the template
//   node fframes.mjs check <work-dir> [--pr] [--scene <id>] [--at 12.5,30]
//   node fframes.mjs render <work-dir> --out <video.mp4> [--size 1080|720] [--draft]
//
// doctor checks Rust >= 1.88 (rustup), the freetype/fontconfig dev libraries on
// Linux, ffmpeg/ffprobe, make (for an ffmpeg source build), and the shared cache
// in ~/.cache/vs/fframes (VS_FF_CACHE): the kit crate, a pinned Cargo.lock
// (fframes 1.3.0) and CARGO_TARGET_DIR with fframes, ffmpeg and Skia prebuilt.
// The first --warm builds them: about 5 minutes and 4 GB, once. Prebuilt
// ffmpeg is tried first; when it does not link (Debian's libx264 is newer than
// the prebuilt's), it rebuilds with FFMPEG_FORCE_BUILD=1 and remembers that in
// env.json. After that a video crate compiles in seconds. No GPU is needed:
// Skia renders on the CPU. XDG_RUNTIME_DIR matters only for --renderer gpu.
// When fframes cannot run here, doctor says FALLBACK in capitals and names the
// Playwright renderer (render.mjs) as the way on: never a silent switch.
//
// check builds the crate, renders each beat when it finishes speaking and each
// scene's end to <work>/stills/ (fframes `frame`), and audits them: the stage's
// layout audit (overlap, safe area, chapter bar, subtitle zone, text past its
// card), SMALL text, text fframes reports clipped, NO-BUILD (a beat that
// changes under 0.5% of the frame; declare an intended hold in main.rs:
// `const HOLDS: &[&str] = &["scene:1"];`), and a clip that decodes no frame.
// --pr adds vs-explain-pr's phone checks (PHONE, DENSE, media under 900 px).
//
// render builds, pre-slows each clip to the rate finish.mjs would pick, renders
// silently with Skia on the CPU at --size (1080 default; 720 for a PR), muxes
// narration.wav as AAC 48 kHz (the level narrate.mjs set, about -16 LUFS), and
// checks the duration against timeline.js. Clips are already in the frames, so
// it writes <out>.fframes.json and finish.mjs skips its own clip splice.
//
// Exit codes: 0 ok; 1 problems to fix (check findings, build errors in main.rs,
// duration mismatch); 2 blocked or FALLBACK (use render.mjs and say so).
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beatIssues, beatWindows, changedFraction } from './checks.mjs';
import { auditFrame, clipRate, FFRAMES_VERSION, frameDiagnostics, MIN_RUST, parseRustVersion, readHolds, readTimelineJs, slowName, stillMoments, toKitTimeline, versionAtLeast } from './ffkit.mjs';
import { probeDuration, run, which } from './media.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, '..');
const KIT_SRC = path.join(SKILL, 'fframes', 'kit');
const TEMPLATE = path.join(SKILL, 'fframes', 'video');
export const cacheDir = () => process.env.VS_FF_CACHE ?? path.join(homedir(), '.cache', 'vs', 'fframes');
const CACHE = cacheDir();
const TARGET = path.join(CACHE, 'target');
const ENV_FILE = path.join(CACHE, 'env.json');

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const positional = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !['--out', '--size', '--scene', '--at'].includes(all[i - 1]));
const print = (obj) => process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
const die = (message, code = 2, extra = {}) => {
  print({ ok: false, error: message, ...extra });
  process.exit(code);
};

// ---------- toolchain
const cargoBin = () => {
  if (process.env.VS_FF_CARGO) return existsSync(process.env.VS_FF_CARGO) ? process.env.VS_FF_CARGO : null;
  const rustup = path.join(homedir(), '.cargo', 'bin', 'cargo');
  // rustup's cargo first: a distro cargo is often older than 1.88.
  return existsSync(rustup) ? rustup : which('cargo');
};
const rustcFor = (cargo) => {
  const sibling = cargo ? path.join(path.dirname(cargo), 'rustc') : null;
  return sibling && existsSync(sibling) ? sibling : which('rustc');
};
const readEnv = () => (existsSync(ENV_FILE) ? JSON.parse(readFileSync(ENV_FILE, 'utf8')) : {});
const hashDir = (dir) => {
  const h = createHash('sha256');
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      if (f === 'target') continue;
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(path.relative(dir, p)).update(readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex').slice(0, 12);
};
const kitHash = () => hashDir(KIT_SRC);
const kitDir = () => path.join(CACHE, `kit-${kitHash()}`);
const cargoEnv = (env) => {
  const cargo = cargoBin();
  const vars = { ...process.env, CARGO_TARGET_DIR: TARGET, PATH: `${path.dirname(cargo ?? '/usr/bin')}:${process.env.PATH}` };
  if (env.ffmpegForceBuild) vars.FFMPEG_FORCE_BUILD = '1';
  // Skia's prebuilt binaries land in the target dir; keep them there.
  return vars;
};

export const doctor = ({ warm = false, quiet = false } = {}) => {
  const problems = [];
  const notes = [];
  const next = [];
  const mac = process.platform === 'darwin';
  const cargo = cargoBin();
  const rustc = rustcFor(cargo);
  const rustProbe = rustc ? run(rustc, ['--version']) : null;
  const rustVersion = rustProbe ? parseRustVersion(rustProbe.stdout) : null;
  if (!cargo || !rustc) {
    problems.push('no Rust toolchain (cargo, rustc)');
    next.push("curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y");
  } else if (!rustVersion) {
    // A rustup proxy with no toolchain under $RUSTUP_HOME answers with an error, not a version.
    problems.push(`${rustc} --version gave no version (${String(rustProbe?.stderr ?? '').trim().split('\n')[0].slice(0, 160) || 'no output'})`);
    next.push('rustup default stable  (if HOME moved, set RUSTUP_HOME and CARGO_HOME to the real ~/.rustup and ~/.cargo)');
  } else if (!versionAtLeast(rustVersion)) {
    problems.push(`Rust ${rustVersion.join('.')} is older than ${MIN_RUST.join('.')}`);
    next.push('rustup update stable  (or install rustup: a distro rustc is usually too old)');
  }
  for (const tool of ['ffmpeg', 'ffprobe']) {
    if (!which(tool)) {
      problems.push(`${tool} missing`);
      next.push(mac ? 'brew install ffmpeg' : 'sudo apt-get install -y ffmpeg');
    }
  }
  if (!mac && process.platform === 'linux') {
    const pc = which('pkg-config');
    const has = (lib, header) => (pc ? run(pc, ['--exists', lib]).status === 0 : existsSync(header));
    const libs = [['freetype2', '/usr/include/freetype2', 'libfreetype-dev'], ['fontconfig', '/usr/include/fontconfig', 'libfontconfig-dev']];
    const missing = libs.filter(([lib, header]) => !has(lib, header));
    if (missing.length) {
      problems.push(`dev libraries missing: ${missing.map((m) => m[0]).join(', ')}`);
      next.push(`sudo apt-get install -y ${missing.map((m) => m[2]).join(' ')} pkg-config`);
    }
    if (!which('make')) notes.push('make is missing: needed only if prebuilt ffmpeg does not link (sudo apt-get install -y make)');
    if (!process.env.XDG_RUNTIME_DIR) notes.push('XDG_RUNTIME_DIR is unset: fine for the default Skia CPU renderer; --renderer gpu (Vulkan) needs it');
  }
  if (mac && !which('pkg-config')) notes.push('pkg-config missing: needed only if prebuilt ffmpeg fails (brew install pkg-config nasm x264)');
  const env = readEnv();
  const hash = kitHash();
  let warmed = env.kitHash === hash && existsSync(path.join(CACHE, `kit-${hash}`));
  let warmInfo = null;
  if (warm && problems.length === 0) {
    warmInfo = warmCache(env);
    if (warmInfo.ok) warmed = true;
    else problems.push(`shared build failed: ${warmInfo.error}`);
  }
  let warmable = false;
  if (problems.length === 0 && !warmed) {
    warmable = true;
    problems.push(`the shared fframes build is not ready in ${CACHE}`);
    next.push(`node ${path.join(here, 'fframes.mjs')} doctor --warm   (once per machine: ~5 min, ~4 GB; later videos compile in seconds)`);
  }
  const ok = problems.length === 0;
  const report = {
    ok,
    renderer: ok ? 'fframes' : 'playwright',
    fframes: FFRAMES_VERSION,
    backend: 'skia-cpu',
    rust: rustVersion ? rustVersion.join('.') : null,
    cache: CACHE,
    kit: ok ? path.join(CACHE, `kit-${hash}`) : null,
    ffmpegForceBuild: Boolean((warmInfo?.env ?? env).ffmpegForceBuild),
    ...(warmInfo ? { warm: warmInfo } : {}),
    // Only the cache is missing: `doctor --warm` fixes it with no system install.
    warmable,
    problems,
    notes,
    next: ok
      ? 'fframes is ready. Run fframes.mjs init <work-dir>, write the scenes in <work>/ff/src/main.rs, then fframes.mjs check.'
      : warmable
        ? `fframes is installable here: run \`node ${path.join(here, 'fframes.mjs')} doctor --warm\` once (builds into ${CACHE}: ~5 min, ~4 GB, no system installs; later videos compile in seconds). If --warm fails, FALLBACK to the Playwright renderer (render.mjs, scenes.js) and say so in the handoff.`
        : `FALLBACK: fframes cannot render on this machine (${problems.join('; ')}). Use the Playwright renderer (render.mjs, scenes.js) for this video, and say in the handoff that it fell back and why. To enable fframes: ${next.join(' ; ')}`,
  };
  if (!ok && !warmable && !quiet) process.stderr.write(`\n*** FALLBACK: fframes is not available (${problems.join('; ')}). Rendering with Playwright instead. ***\n\n`);
  return report;
};

// Build the kit and the template once into the shared target dir.
const warmCache = (env) => {
  const started = Date.now();
  mkdirSync(CACHE, { recursive: true });
  const hash = kitHash();
  const kit = path.join(CACHE, `kit-${hash}`);
  if (!existsSync(kit)) cpSync(KIT_SRC, kit, { recursive: true });
  const warmCrate = path.join(CACHE, 'warm');
  rmSync(warmCrate, { recursive: true, force: true });
  writeCrate(warmCrate, 'vs-video-warm', kit, readFileSync(path.join(TEMPLATE, 'src', 'main.rs'), 'utf8'));
  writeFileSync(path.join(warmCrate, 'timeline.json'), JSON.stringify(WARM_TL));
  mkdirSync(path.join(warmCrate, 'media'), { recursive: true });
  const attempt = (e) => run(cargoBin(), ['build', '--locked', '--manifest-path', path.join(warmCrate, 'Cargo.toml')], { env: cargoEnv(e), cwd: warmCrate });
  let used = { ...env };
  let res = attempt(used);
  const log = path.join(CACHE, 'warm.log');
  writeFileSync(log, `${res.stdout ?? ''}${res.stderr ?? ''}`);
  if (res.status !== 0 && !used.ffmpegForceBuild && /x264|ffmpeg|libav|avcodec|undefined reference|linking with/i.test(res.stderr ?? '')) {
    used = { ...used, ffmpegForceBuild: true };
    res = attempt(used);
    writeFileSync(log, `${res.stdout ?? ''}${res.stderr ?? ''}`);
  }
  if (res.status !== 0) return { ok: false, error: `cargo build failed, see ${log}: ${lastErrors(res.stderr)}`, seconds: Math.round((Date.now() - started) / 1000) };
  // One frame proves Skia, fonts and the media loader work here.
  const bin = path.join(TARGET, 'debug', 'vs-video-warm');
  const probe = run(bin, ['frame', '0.5s', '-o', path.join(warmCrate, 'frames'), '--json'], { env: { ...process.env, VS_FF_DIR: warmCrate } });
  if (probe.status !== 0) return { ok: false, error: `the warm binary did not render a frame: ${String(probe.stderr).slice(-600)}`, seconds: Math.round((Date.now() - started) / 1000) };
  const out = { ...used, kitHash: hash, fframes: FFRAMES_VERSION, warmedAt: new Date().toISOString(), platform: `${process.platform}-${process.arch}` };
  writeFileSync(ENV_FILE, JSON.stringify(out, null, 2));
  return { ok: true, seconds: Math.round((Date.now() - started) / 1000), env: out, log, pruned: prune(kit) };
};
// Each kit update leaves the old kit's sources and build behind; cargo never collects them.
// Keep the current kit dir and the newest kit build (the one the warm build just used or
// confirmed fresh); drop older kit dirs and the other kit builds.
const prune = (kit) => {
  let removed = 0;
  for (const d of readdirSync(CACHE)) {
    const p = path.join(CACHE, d);
    if (/^kit-[0-9a-f]+$/.test(d) && p !== kit) { rmSync(p, { recursive: true, force: true }); removed++; }
  }
  const groups = new Map();
  for (const sub of ['deps', 'incremental', '.fingerprint']) {
    const dir = path.join(TARGET, 'debug', sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const m = /vs_fframes_kit-([0-9a-f]+)/.exec(f);
      if (!m) continue;
      const p = path.join(dir, f);
      const g = groups.get(m[1]) ?? { paths: [], newest: 0 };
      g.paths.push(p);
      g.newest = Math.max(g.newest, statSync(p).mtimeMs);
      groups.set(m[1], g);
    }
  }
  const keep = [...groups.entries()].sort((a, b) => b[1].newest - a[1].newest)[0]?.[0];
  for (const [id, g] of groups) {
    if (id === keep) continue;
    for (const p of g.paths) { rmSync(p, { recursive: true, force: true }); removed++; }
  }
  return removed;
};
const WARM_TL = { title: 'warm', brand: 'vs', fps: 30, total: 1, scenes: [{ id: 'intro', title: 'Intro', start: 0, dur: 1, beats: [0.1, 0.5] }], subs: [], captions: { style: 'pill' } };

const lastErrors = (stderr) => {
  const lines = String(stderr ?? '').split('\n');
  const errs = lines.filter((l) => /^error/.test(l)).slice(0, 6);
  return (errs.length ? errs : lines.slice(-8)).join(' | ').slice(0, 1500);
};

// ---------- the per-video crate
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'video';
const binName = (work) => `vs-video-${slug(path.basename(work))}-${createHash('sha256').update(work).digest('hex').slice(0, 6)}`;
const writeCrate = (dir, bin, kit, mainRs) => {
  mkdirSync(path.join(dir, 'src'), { recursive: true });
  const toml = readFileSync(path.join(TEMPLATE, 'Cargo.toml'), 'utf8').replace('@BIN@', bin).replace('@KIT@', kit.replaceAll('\\', '/'));
  writeFileSync(path.join(dir, 'Cargo.toml'), toml);
  copyFileSync(path.join(TEMPLATE, 'Cargo.lock'), path.join(dir, 'Cargo.lock'));
  if (mainRs !== null && !existsSync(path.join(dir, 'src', 'main.rs'))) writeFileSync(path.join(dir, 'src', 'main.rs'), mainRs);
};

const skeleton = (script) => {
  const arms = (script.scenes ?? []).map((s) => `        // ${s.title ?? s.id}: ${(s.beats ?? []).length} beat(s), s.b[0]..\n        "${s.id}" => {\n            let title = s.words(160.0, 300.0, Type::H2, &[${JSON.stringify(s.title ?? s.id)}], 0.15);\n            svgr!(<g>{title}</g>)\n        }`).join('\n');
  return `//! Scenes for "${script.title ?? ''}". One arm per scene id in script.json.
//! The worked example (every helper in use) is the kit's template:
//! ${path.join(TEMPLATE, 'src', 'main.rs')}
//! The kit API: ${path.join(SKILL, 'references', 'fframes.md')}
use vs_fframes_kit::*;

// Beats meant to hold still (NO-BUILD exempt), as "scene-id:beat".
const HOLDS: &[&str] = &[];

fn scene<'a>(s: &mut S<'_, 'a, '_>) -> Svgr<'a> {
    let _ = HOLDS;
    match s.id {
${arms}
        _ => Svgr::empty(),
    }
}

fn main() -> std::process::ExitCode {
    vs_fframes_kit::run(env!("CARGO_MANIFEST_DIR"), scene)
}
`;
};

const needWork = () => {
  const w = positional[0];
  if (!w) die(`Usage: node fframes.mjs ${cmd} <work-dir>`);
  const work = path.resolve(w);
  if (!existsSync(work)) die(`${work} does not exist. Run init.mjs <work-dir> first.`);
  return work;
};
const needReady = () => {
  const report = doctor({ warm: false });
  if (!report.ok) {
    print(report);
    process.exit(2);
  }
  return report;
};

// The crate is plain files: init works before the shared build is warm (check
// and render need it), so the scenes can be written while --warm runs.
const init = (work) => {
  const warm = readEnv().kitHash === kitHash() && existsSync(kitDir());
  const ff = path.join(work, 'ff');
  const scriptPath = path.join(work, 'script.json');
  const script = existsSync(scriptPath) ? JSON.parse(readFileSync(scriptPath, 'utf8')) : { scenes: [] };
  const had = existsSync(path.join(ff, 'src', 'main.rs'));
  writeCrate(ff, binName(work), kitDir().replaceAll('\\', '/'), skeleton(script));
  mkdirSync(path.join(ff, 'media'), { recursive: true });
  return { ok: true, crate: ff, main: path.join(ff, 'src', 'main.rs'), kept: had ? ['src/main.rs'] : [], example: path.join(TEMPLATE, 'src', 'main.rs'), reference: path.join(SKILL, 'references', 'fframes.md'), next: `${warm ? '' : 'The shared build is not warm yet: run fframes.mjs doctor --warm before check. '}Write one arm per scene in ff/src/main.rs (copy the patterns from the example), then run fframes.mjs check <work-dir>.` };
};

// timeline.js -> ff/timeline.json; work/media and work/fonts -> ff/media.
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|mp4|ttf|otf)$/i;
const prep = (work) => {
  const ff = path.join(work, 'ff');
  if (!existsSync(path.join(ff, 'Cargo.toml'))) die(`${ff} has no crate. Run: node fframes.mjs init ${work}`, 2);
  // Point the crate at this machine's current kit (a skill update moves it).
  const toml = path.join(ff, 'Cargo.toml');
  const kit = kitDir().replaceAll('\\', '/');
  const before = readFileSync(toml, 'utf8');
  const after = before.replace(/vs_fframes_kit\s*=\s*\{\s*path\s*=\s*"[^"]*"/, `vs_fframes_kit = { path = "${kit}"`);
  if (after !== before) writeFileSync(toml, after);
  const tlPath = path.join(work, 'timeline.js');
  if (!existsSync(tlPath)) die(`${tlPath} is missing. Run narrate.mjs first.`, 2);
  const TL = readTimelineJs(readFileSync(tlPath, 'utf8'));
  writeFileSync(path.join(ff, 'timeline.json'), JSON.stringify(toKitTimeline(TL)));
  const media = path.join(ff, 'media');
  mkdirSync(media, { recursive: true });
  for (const sub of ['media', 'fonts', '.']) {
    const from = path.join(work, sub);
    if (!existsSync(from) || !statSync(from).isDirectory()) continue;
    for (const f of readdirSync(from)) {
      if (!MEDIA_EXT.test(f) || /\.r\d{4}\.mp4$/.test(f)) continue;
      const src = path.join(from, f);
      const dst = path.join(media, f);
      if (!statSync(src).isFile()) continue;
      if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs || statSync(dst).size !== statSync(src).size) copyFileSync(src, dst);
    }
  }
  return { ff, TL };
};

const build = (work, ff) => {
  const env = readEnv();
  const started = Date.now();
  const res = run(cargoBin(), ['build', '--locked', '--message-format=short', '--manifest-path', path.join(ff, 'Cargo.toml')], { env: cargoEnv(env), cwd: ff });
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  if (res.status !== 0) {
    const errors = String(res.stderr).split('\n').filter((l) => /(^|: )error/.test(l)).slice(0, 12);
    // A sandboxed agent (writes limited to the project and /tmp) cannot take the shared
    // build lock: that is a permission, not a bug in the scenes.
    const blocked = errors.some((l) => l.includes(TARGET) && /failed to open|Permission denied|Read-only file system|Operation not permitted/i.test(l));
    const next = blocked
      ? `The shared build dir ${TARGET} is not writable here (a sandbox?). Rerun this command with write access to ${CACHE} (approve the escalation, or add it as a writable root). Do not fall back for this.`
      : 'Fix these errors in ff/src/main.rs and rerun.';
    print({ ok: false, stage: 'build', seconds, errors: errors.length ? errors : String(res.stderr).split('\n').slice(-20), ...(blocked ? { sandboxed: true } : {}), next });
    process.exit(1);
  }
  const toml = readFileSync(path.join(ff, 'Cargo.toml'), 'utf8');
  const bin = /\[\[bin\]\]\s*name\s*=\s*"([^"]+)"/.exec(toml)[1];
  return { bin: path.join(TARGET, 'debug', bin + (process.platform === 'win32' ? '.exe' : '')), seconds };
};

const frames = (bin, ff, specs, outDir, extraEnv = {}) => {
  const lint = path.join(ff, `.lint-${process.pid}-${Date.now()}.jsonl`);
  const res = run(bin, ['frame', ...specs, '-o', outDir, '--json'], { env: { ...process.env, VS_FF_DIR: ff, VS_FF_LINT: lint, ...extraEnv } });
  if (res.status !== 0) die(`fframes frame failed: ${String(res.stderr).slice(-1500)}`, 1);
  const json = JSON.parse(res.stdout);
  const records = existsSync(lint) ? readFileSync(lint, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  rmSync(lint, { force: true });
  return { frames: json, records };
};

// Find every clip slot (one frame mid-scene each) and pre-slow its recording.
const prepClips = (bin, ff, TL) => {
  const tmp = path.join(ff, '.probe');
  const specs = TL.scenes.map((s) => `${(s.start + s.dur / 2).toFixed(3)}s`);
  const { records } = frames(bin, ff, specs, tmp);
  rmSync(tmp, { recursive: true, force: true });
  const slots = new Map();
  for (const r of records.filter((x) => x.kind === 'clip')) slots.set(`${r.scene}|${r.file}`, r);
  const clips = {};
  const report = [];
  for (const [key, slot] of slots) {
    const src = path.join(ff, 'media', slot.file);
    if (!existsSync(src)) die(`clip ${slot.file} (scene ${slot.scene}) is not in media/. Run prep.mjs again.`, 2);
    const clipSeconds = probeDuration(src);
    const window = slot.to - slot.from;
    const rate = clipRate(clipSeconds, window);
    const played = Math.min(window, clipSeconds / rate);
    const slow = slowName(slot.file, rate);
    const dst = path.join(ff, 'media', slow);
    if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs) {
      const w = Math.round(slot.w / 2) * 2;
      const h = Math.round(slot.h / 2) * 2;
      const r = run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-an', '-vf', `setpts=(PTS-STARTPTS)/${rate.toFixed(4)},fps=30,scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', dst]);
      if (r.status !== 0) die(`ffmpeg could not pre-slow ${slot.file}: ${String(r.stderr).slice(0, 600)}`, 1);
    }
    clips[key] = { file: slow, played: Number(played.toFixed(3)), rate };
    report.push({ src: slot.file, scene: slot.scene, window: Number(window.toFixed(2)), clipSeconds, rate: Number(rate.toFixed(3)), heldSeconds: Number(Math.max(0, window - clipSeconds / rate).toFixed(2)), trimmed: clipSeconds / rate > window + 0.05 });
  }
  writeFileSync(path.join(ff, 'clips.json'), JSON.stringify(clips, null, 2));
  return report;
};

const grey = (png) => {
  const r = run('ffmpeg', ['-v', 'error', '-i', png, '-vf', 'scale=480:270,format=gray', '-f', 'rawvideo', '-'], { encoding: 'buffer' });
  return r.status === 0 ? r.stdout : null;
};

const check = (work) => {
  needReady();
  const pr = args.includes('--pr');
  const only = opt('--scene');
  const at = opt('--at') ? opt('--at').split(',').map(Number) : null;
  const { ff, TL } = prep(work);
  const { bin, seconds: buildSeconds } = build(work, ff);
  const clips = prepClips(bin, ff, TL);
  const moments = at ? at.map((t) => ({ t, name: `t${t.toFixed(2)}` })) : stillMoments(TL, only);
  const stillsDir = path.join(work, 'stills');
  mkdirSync(stillsDir, { recursive: true });
  const started = Date.now();
  const { frames: shot, records } = frames(bin, ff, moments.map((m) => `${m.t.toFixed(3)}s`), stillsDir);
  const issues = [];
  const stills = [];
  shot.forEach((f, i) => {
    const m = moments[i];
    const named = path.join(stillsDir, `${m.name}.png`);
    if (f.path && existsSync(f.path)) {
      copyFileSync(f.path, named);
      if (path.resolve(f.path) !== named) rmSync(f.path, { force: true });
    }
    stills.push(named);
    const mine = records.filter((r) => r.frame === f.frame);
    for (const issue of auditFrame(mine, { pr })) issues.push({ still: m.name, atSeconds: Number(m.t.toFixed(2)), ...issue });
    for (const d of frameDiagnostics([f])) issues.push({ still: m.name, atSeconds: Number(m.t.toFixed(2)), ...d });
  });
  // NO-BUILD, measured calm (no captions, chrome, dots or camera push).
  const holds = readHolds(readFileSync(path.join(ff, 'src', 'main.rs'), 'utf8'));
  // The same windows, threshold and rule as check.mjs (checks.mjs), on fframes frames.
  const windows = at ? [] : beatWindows(TL, holds).filter((w) => !only || w.scene === only);
  if (windows.length) {
    const calmDir = path.join(ff, '.calm');
    rmSync(calmDir, { recursive: true, force: true });
    const specs = windows.flatMap((w) => [`${w.from.toFixed(3)}s`, `${w.to.toFixed(3)}s`]);
    const { frames: calm } = frames(bin, ff, specs, calmDir, { VS_CALM: '1' });
    const fractions = windows.map((w, i) => {
      const [a, b] = [calm[2 * i], calm[2 * i + 1]].map((f) => (f?.path ? grey(f.path) : null));
      return a && b && a.length === b.length ? changedFraction(a, b) : 1;
    });
    for (const issue of beatIssues(windows, fractions)) {
      issues.push({ kind: 'NO-BUILD', still: `${issue.scene}-b${windows.find((w) => w.from === issue.at && w.scene === issue.scene)?.beat}`, atSeconds: issue.at, detail: `${issue.detail}. Build something on it, or list it in HOLDS in main.rs.` });
    }
    rmSync(calmDir, { recursive: true, force: true });
  }
  const ok = issues.length === 0;
  print({
    ok,
    renderer: 'fframes',
    buildSeconds,
    stillsSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    stills,
    clips,
    issues,
    next: ok
      ? 'Checks passed. Open the stills and look at them, then fframes.mjs render <work-dir> --out <video.mp4>.'
      : 'Fix each issue in ff/src/main.rs (move or resize the block; s.allow_overlap() inside a group marks an intended overlap), then rerun check.',
  });
  process.exit(ok ? 0 : 1);
};

const render = (work) => {
  needReady();
  const outArg = opt('--out');
  if (!outArg) die('Usage: node fframes.mjs render <work-dir> --out <video.mp4> [--size 1080|720]');
  const out = path.resolve(outArg);
  const size = Number(opt('--size') ?? 1080);
  if (![1080, 720].includes(size)) die('--size is 1080 or 720.');
  const narration = path.join(work, 'narration.wav');
  if (!existsSync(narration)) die(`${narration} is missing. Run narrate.mjs first.`);
  const { ff, TL } = prep(work);
  const { bin, seconds: buildSeconds } = build(work, ff);
  const clips = prepClips(bin, ff, TL);
  const silent = path.join(ff, '.silent.mp4');
  const started = Date.now();
  const flags = ['render', '-o', silent, '--renderer', process.env.VS_FF_RENDERER ?? 'skia-cpu', ...(size === 720 ? ['--scale', '0.6666667'] : []), ...(args.includes('--draft') ? ['--draft'] : [])];
  const r = run(bin, flags, { env: { ...process.env, VS_FF_DIR: ff } });
  if (r.status !== 0) die(`fframes render failed: ${String(r.stderr).slice(-1500)}`, 1);
  const renderSeconds = Number(((Date.now() - started) / 1000).toFixed(1));
  mkdirSync(path.dirname(out), { recursive: true });
  const mux = run('ffmpeg', ['-y', '-v', 'error', '-i', silent, '-i', narration, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
  if (mux.status !== 0) die(`ffmpeg could not mux the narration: ${String(mux.stderr).slice(0, 800)}`, 1);
  rmSync(silent, { force: true });
  const seconds = probeDuration(out);
  const okDuration = seconds !== null && Math.abs(seconds - TL.total) <= 0.15;
  const sidecar = `${out.replace(/\.mp4$/i, '')}.fframes.json`;
  writeFileSync(sidecar, JSON.stringify({ engine: 'fframes', output: out, size, clipsInFrame: clips }, null, 2));
  print({ ok: okDuration, renderer: 'fframes', output: out, seconds, expected: TL.total, size, buildSeconds, renderSeconds, clips, sidecar, next: okDuration ? 'Rendered. Run the review (pack.mjs) next.' : `Duration ${seconds} s does not match the timeline (${TL.total} s). Rerun narrate.mjs and render again.` });
  process.exit(okDuration ? 0 : 1);
};

// preflight.mjs imports doctor() in-process: some agent sandboxes drop a child node's piped stdout.
const isMain = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (!isMain) {
  // imported: no CLI
} else if (cmd === 'doctor') {
  const report = doctor({ warm: args.includes('--warm') });
  print(report);
  process.exit(report.ok ? 0 : 2);
} else if (cmd === 'init') print(init(needWork()));
else if (cmd === 'check') check(needWork());
else if (cmd === 'render') render(needWork());
else die('Usage: node fframes.mjs doctor [--warm] | init <work> | check <work> [--pr] | render <work> --out <mp4> [--size 720]');
