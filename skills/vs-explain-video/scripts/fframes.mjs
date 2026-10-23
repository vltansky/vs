#!/usr/bin/env node
// The default renderer: fframes (Rust + SVG, Skia on the CPU), with one shared
// build per machine and a small Rust crate per video.
//
//   node fframes.mjs doctor [--warm]           can this machine render? (--warm: build the shared cache once)
//   node fframes.mjs init <work-dir> [--fframes]  write <work>/ff/, the video crate, from the template
//                                               (--fframes: switch a video that fell back back to fframes)
//   node fframes.mjs check <work-dir> [--pr] [--scene <id>] [--at 12.5,30]
//   node fframes.mjs render <work-dir> --out <video.mp4> [--size 1080|720] [--draft]
//   node fframes.mjs fallback <work-dir> --reason "..."   give up on fframes for this video (loudly)
//
// doctor checks Rust >= 1.88 (rustup), the freetype/fontconfig dev libraries on
// Linux, ffmpeg/ffprobe, make (for an ffmpeg source build), and the shared cache
// in ~/.cache/vs/fframes (VS_FF_CACHE): the kit crate, a pinned Cargo.lock
// (fframes 1.3.0) and CARGO_TARGET_DIR with fframes, ffmpeg and Skia prebuilt.
// The first --warm builds them: about 5 minutes and 4 GB, once. Prebuilt
// ffmpeg is tried first; when it does not link (Debian's libx264 is newer than
// the prebuilt's), it rebuilds with FFMPEG_FORCE_BUILD=1 and remembers that in
// machine.json. Each kit version is ready when ready-<kitHash>.json exists and its
// kit copy has .complete; installs at other versions keep their own kit, and only
// kits, kit builds and per-video binaries unused for 14 days are pruned (at --warm
// and init). After that a video crate compiles in seconds. No GPU is needed:
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
// <work>/renderer.json names the renderer for this video (init, check, fallback
// write it); lint.mjs reads it. Builds, frames and renders have hard time limits
// (VS_FF_TIMEOUT_BUILD etc., minutes); a timeout says FALLBACK.
//
// Exit codes: 0 ok; 1 problems to fix (check findings, build errors in main.rs,
// duration mismatch); 2 blocked or FALLBACK (use render.mjs and say so; also a
// broken shared kit: rerun doctor --warm).
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
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
// Machine facts (ffmpegForceBuild) live in machine.json; each kit version has its own
// ready-<kitHash>.json, so plugin installs at different versions share one cache
// without evicting each other.
const MACHINE_FILE = path.join(CACHE, 'machine.json');
const readyFile = (hash) => path.join(CACHE, `ready-${hash}.json`);
const DAY = 24 * 3600 * 1000;
const KEEP_DAYS = 14;
// Hard caps so a hung build or render cannot block the agent forever (minutes).
const LIMIT = { warm: 60, build: 15, frame: 10, render: 30, ffmpeg: 10 };
const limit = (name) => ({ timeout: Number(process.env[`VS_FF_TIMEOUT_${name.toUpperCase()}`] ?? LIMIT[name]) * 60_000, killSignal: 'SIGKILL' });
// Our own time limit (spawnSync sets ETIMEDOUT) vs a SIGKILL from elsewhere (the OOM
// killer, a user): different causes, different advice.
const timedOut = (res) => res?.error?.code === 'ETIMEDOUT';
const killed = (res) => !timedOut(res) && res?.signal === 'SIGKILL';
// A timeout is a FALLBACK: record it, so lint and a rerun of init agree with the handoff.
const dieTimeout = (work, what, name) => {
  const reason = `${what} timed out after ${limit(name).timeout / 60_000} min`;
  writeRenderer(work, 'playwright', reason);
  process.stderr.write(`\n*** FALLBACK: ${reason}. Rendering with Playwright instead. ***\n\n`);
  die(`${reason}. FALLBACK recorded in ${path.join(work, 'renderer.json')}: render with Playwright (render.mjs, scenes.js) and say so in the handoff. To try fframes again later: fframes.mjs init <work-dir> --fframes.`, 2, { timedOut: true, renderer: 'playwright' });
};
const dieKilled = (what) => die(`${what} was killed by the system (SIGKILL, not our time limit; often out of memory). Close other heavy work and rerun; if it is killed again, run fframes.mjs fallback <work-dir> --reason "${what} was killed" and use Playwright.`, 2, { killed: true });
const guard = (res, work, what, name) => {
  if (timedOut(res)) dieTimeout(work, what, name);
  if (killed(res)) dieKilled(what);
};

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
// A missing, half-written or corrupt state file reads as "not warm", never a crash.
export const readJson = (file) => {
  try { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null; } catch { return null; }
};
export const writeJsonAtomic = (file, obj) => {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, file);
};
const readEnv = () => readJson(MACHINE_FILE) ?? {};
const isReady = (hash) => {
  const r = readJson(readyFile(hash));
  return Boolean(r && r.kitHash === hash && existsSync(path.join(CACHE, `kit-${hash}`, '.complete')));
};
// Copy the kit sources once per version. A copy is used only after its .complete
// marker, so an interrupted copy is redone instead of trusted.
const ensureKit = (hash) => {
  const kit = path.join(CACHE, `kit-${hash}`);
  const complete = () => existsSync(path.join(kit, '.complete'));
  if (complete()) return kit;
  const tmp = `${kit}.tmp-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  cpSync(KIT_SRC, tmp, { recursive: true, filter: (src) => path.basename(src) !== 'target' });
  writeFileSync(path.join(tmp, '.complete'), new Date().toISOString());
  // Replace only a copy that is still incomplete: another warm may have finished one
  // while this copy ran, and that one is in use.
  if (!complete()) rmSync(kit, { recursive: true, force: true });
  try { renameSync(tmp, kit); } catch { /* another warm placed a complete kit first */ }
  rmSync(tmp, { recursive: true, force: true });
  return kit;
};
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
export const kitHash = () => hashDir(KIT_SRC);
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
  const rustProbe = rustc ? run(rustc, ['--version'], { timeout: 120_000 }) : null;
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
    const libs = [['freetype2', '/usr/include/freetype2', 'libfreetype-dev'], ['fontconfig', '/usr/include/fontconfig', 'libfontconfig-dev'], ['x264', '/usr/include/x264.h', 'libx264-dev']];
    const missing = libs.filter(([lib, header]) => !has(lib, header));
    if (missing.length) {
      problems.push(`dev libraries missing: ${missing.map((m) => m[0]).join(', ')}`);
      next.push(`sudo apt-get install -y ${missing.map((m) => m[2]).join(' ')} pkg-config`);
    }
    for (const tool of ['make', 'nasm']) if (!which(tool)) notes.push(`${tool} is missing: needed only if prebuilt ffmpeg does not link and warm builds it (sudo apt-get install -y make nasm)`);
    if (!process.env.XDG_RUNTIME_DIR) notes.push('XDG_RUNTIME_DIR is unset: fine for the default Skia CPU renderer; --renderer gpu (Vulkan) needs it');
  }
  // ffmpeg-sys runs bindgen, which loads libclang at build time; a clean box often has none.
  if (!hasLibclang(mac)) {
    problems.push('libclang missing (the ffmpeg bindings are generated with it)');
    next.push(mac ? 'xcode-select --install' : 'sudo apt-get install -y libclang-dev  (or set LIBCLANG_PATH)');
  }
  if (mac && !which('pkg-config')) notes.push('pkg-config missing: needed only if prebuilt ffmpeg fails (brew install pkg-config nasm x264)');
  const env = readEnv();
  const hash = kitHash();
  let warmed = isReady(hash);
  let warmInfo = null;
  if (warm && problems.length === 0) {
    warmInfo = warmCache(env);
    if (warmInfo.ok) warmed = true;
    else {
      // Nothing machine-wide is recorded: another video's agent may warm again and succeed.
      // The agent whose warm failed records its own fallback.
      problems.push(`shared build failed: ${warmInfo.error}`);
      next.push(warmFailedNext(warmInfo));
    }
  }
  let warmable = false;
  if (problems.length === 0 && !warmed) {
    warmable = true;
    problems.push(`the shared fframes build is not ready in ${CACHE}`);
    next.push(`node ${path.join(here, 'fframes.mjs')} doctor --warm   (once per machine: ~5 min, ~4 GB; later videos compile in seconds)`);
  }
  const ok = problems.length === 0;
  // Mark this kit version as used, so prune keeps it.
  if (ok) { try { const now = new Date(); utimesSync(readyFile(hash), now, now); } catch { /* read-only cache */ } }
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
        : warmInfo?.killed
          ? `The shared build was killed by the system (SIGKILL, not a build error; often out of memory): ${warmFailedNext(warmInfo)}`
          : `FALLBACK: fframes cannot render on this machine (${problems.join('; ')}). Use the Playwright renderer (render.mjs, scenes.js) for this video, and say in the handoff that it fell back and why. To enable fframes: ${next.join(' ; ')}`,
  };
  if (!ok && !warmable && !quiet && !warmInfo?.killed) process.stderr.write(`\n*** FALLBACK: fframes is not available (${problems.join('; ')}). Rendering with Playwright instead. ***\n\n`);
  return report;
};

// Build the kit and the template once into the shared target dir. Each warm has its
// own crate dir and binary, so two warms (two installs, two agents) do not collide;
// cargo's own lock serializes the builds.
export const warmCache = (env = readEnv()) => {
  const started = Date.now();
  const secs = () => Math.round((Date.now() - started) / 1000);
  mkdirSync(CACHE, { recursive: true });
  const hash = kitHash();
  const kit = ensureKit(hash);
  const warmCrate = path.join(CACHE, `warm-${process.pid}`);
  const bin = `vs-video-warm-${hash}`;
  rmSync(warmCrate, { recursive: true, force: true });
  writeCrate(warmCrate, bin, kit, readFileSync(path.join(TEMPLATE, 'src', 'main.rs'), 'utf8'));
  writeFileSync(path.join(warmCrate, 'timeline.json'), JSON.stringify(WARM_TL));
  mkdirSync(path.join(warmCrate, 'media'), { recursive: true });
  const attempt = (e) => run(cargoBin(), ['build', '--locked', '--manifest-path', path.join(warmCrate, 'Cargo.toml')], { env: cargoEnv(e), cwd: warmCrate, ...limit('warm') });
  const log = path.join(CACHE, `warm-${hash}.log`);
  const done = (result) => {
    rmSync(warmCrate, { recursive: true, force: true });
    return { ...result, seconds: secs(), log };
  };
  let used = { ...env };
  let res = attempt(used);
  writeFileSync(log, `${res.stdout ?? ''}${res.stderr ?? ''}`);
  // A time limit or a system kill ends the warm with its own advice, on every attempt.
  const stopped = (r, what, name) => {
    if (timedOut(r)) return done({ ok: false, timedOut: true, error: `${what} timed out after ${limit(name).timeout / 60_000} min` });
    if (killed(r)) return done({ ok: false, killed: true, error: `${what} was killed by the system (SIGKILL, often out of memory): close other heavy work and rerun --warm` });
    return null;
  };
  let stop = stopped(res, 'cargo build', 'warm');
  if (stop) return stop;
  if (res.status !== 0 && !used.ffmpegForceBuild && /x264|ffmpeg|libav|avcodec|undefined reference|linking with/i.test(res.stderr ?? '')) {
    used = { ...used, ffmpegForceBuild: true };
    // ffmpeg-sys skips its build when an earlier prebuilt libavutil.a is in its out dir, so
    // FFMPEG_FORCE_BUILD alone would relink the same prebuilt (e.g. built against another x264).
    clearFfmpegOut();
    res = attempt(used);
    writeFileSync(log, `${res.stdout ?? ''}${res.stderr ?? ''}`);
    stop = stopped(res, 'cargo build (ffmpeg from source)', 'warm');
    if (stop) return stop;
  }
  if (res.status !== 0) return done({ ok: false, error: `cargo build failed, see ${log}: ${lastErrors(res.stderr)}` });
  // One frame proves Skia, fonts and the media loader work here.
  const probe = run(path.join(TARGET, 'debug', bin), ['frame', '0.5s', '-o', path.join(warmCrate, 'frames'), '--json'], { env: { ...process.env, VS_FF_DIR: warmCrate }, ...limit('frame') });
  stop = stopped(probe, 'the warm probe frame', 'frame');
  if (stop) return stop;
  if (probe.status !== 0) return done({ ok: false, error: `the warm binary did not render a frame: ${String(probe.stderr).slice(-600)}` });
  writeJsonAtomic(MACHINE_FILE, { ffmpegForceBuild: Boolean(used.ffmpegForceBuild), platform: `${process.platform}-${process.arch}` });
  const out = { kitHash: hash, fframes: FFRAMES_VERSION, ffmpegForceBuild: Boolean(used.ffmpegForceBuild), warmedAt: new Date().toISOString(), platform: `${process.platform}-${process.arch}` };
  writeJsonAtomic(readyFile(hash), out);
  return done({ ok: true, env: out, pruned: prune({ keep: hash }) });
};
// Old kit versions, kit builds and per-video binaries (about 50 MB each) pile up, and
// cargo never collects them. Remove only what nothing has used for KEEP_DAYS days: another
// install may still be on an older kit, and a video may be re-rendered. A removed build is
// rebuilt on next use (a kit in about 15 s, a video in about 1 s).
export const prune = ({ cache = CACHE, target = path.join(cache, 'target'), keep = null, now = Date.now(), days = KEEP_DAYS } = {}) => {
  const old = (p) => { try { return now - statSync(p).mtimeMs > days * DAY; } catch { return false; } };
  const gone = { kits: 0, kitBuilds: 0, videos: 0 };
  const rm = (p) => rmSync(p, { recursive: true, force: true });
  if (!existsSync(cache)) return gone;
  for (const d of readdirSync(cache)) {
    const p = path.join(cache, d);
    const kit = /^kit-([0-9a-f]+)$/.exec(d);
    if (kit && kit[1] !== keep) {
      const ready = path.join(cache, `ready-${kit[1]}.json`);
      if (existsSync(ready) ? old(ready) : old(p)) { rm(p); rm(ready); gone.kits++; }
    } else if (/^kit-[0-9a-f]+\.tmp-\d+$/.test(d) && now - statSync(p).mtimeMs > DAY) rm(p);
    else if (/^warm-\d+$/.test(d) && now - statSync(p).mtimeMs > DAY) rm(p);
    // Files from the first layout (one env.json, one shared warm crate).
    else if (d === 'env.json' || d === 'warm' || d === 'warm.log') rm(p);
  }
  // Kit builds: one group of files per kit path; keep the newest group always.
  const dbg = path.join(target, 'debug');
  const groups = new Map();
  for (const sub of ['deps', 'incremental', '.fingerprint']) {
    const dir = path.join(dbg, sub);
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
  const newest = [...groups.entries()].sort((a, b) => b[1].newest - a[1].newest)[0]?.[0];
  for (const [id, g] of groups) {
    if (id === newest || now - g.newest <= days * DAY) continue;
    for (const p of g.paths) rm(p);
    gone.kitBuilds++;
  }
  // Per-video binaries and their build files, by last build.
  const video = /^(vs-video-|vs_video_)/;
  const keepBin = keep ? `vs-video-warm-${keep}` : null;
  for (const sub of ['', 'deps', 'incremental', '.fingerprint']) {
    const dir = path.join(dbg, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!video.test(f) || (keepBin && f.startsWith(keepBin)) || (keepBin && f.startsWith(keepBin.replaceAll('-', '_')))) continue;
      const p = path.join(dir, f);
      if (old(p)) { rm(p); if (sub === '') gone.videos++; }
    }
  }
  return gone;
};
const clearFfmpegOut = () => {
  const dir = path.join(TARGET, 'debug', 'build');
  if (!existsSync(dir)) return;
  for (const d of readdirSync(dir)) if (/^ffmpeg-sys-fframes-/.test(d)) rmSync(path.join(dir, d, 'out'), { recursive: true, force: true });
};
const hasLibclang = (mac) => {
  const named = (dir) => {
    try { return readdirSync(dir).some((f) => /^libclang(-[\d.]+)?\.(so|dylib)/.test(f)); } catch { return false; }
  };
  if (process.env.LIBCLANG_PATH && named(process.env.LIBCLANG_PATH)) return true;
  const dirs = mac
    ? ['/Library/Developer/CommandLineTools/usr/lib', '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib', '/opt/homebrew/opt/llvm/lib', '/usr/local/opt/llvm/lib']
    : ['/usr/lib', '/usr/lib64', '/usr/local/lib', '/usr/lib/x86_64-linux-gnu', '/usr/lib/aarch64-linux-gnu',
      ...(() => { try { return readdirSync('/usr/lib').filter((d) => /^llvm-\d+$/.test(d)).map((d) => `/usr/lib/${d}/lib`); } catch { return []; } })()];
  return dirs.some(named);
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
const needReady = (work) => {
  const marked = readJson(path.join(work, MARKER));
  if (marked?.renderer === 'playwright') die(`This video fell back to Playwright (${marked.reason ?? 'recorded in renderer.json'}). Use render.mjs and scenes.js; to switch back to fframes, run fframes.mjs init <work-dir> --fframes first.`, 2, { renderer: 'playwright' });
  const report = doctor({ warm: false });
  if (!report.ok) {
    // A FALLBACK exit records it; "not warm yet" is not a fallback.
    if (!report.warmable) writeRenderer(work, 'playwright', report.problems.join('; '));
    print(report);
    process.exit(2);
  }
  return report;
};

// <work>/renderer.json records which renderer this video uses, so the checks that
// differ (lint.mjs page checks) never guess from leftover files: init writes it from
// doctor (fframes, or pending while --warm still has to run), a passing check writes
// fframes, and every FALLBACK exit (fallback, a timeout, doctor failing in check or
// render) writes playwright. It is one-way: once playwright, only `init --fframes`
// switches the video back.
const MARKER = 'renderer.json';
export const writeRenderer = (work, renderer, reason = null, { force = false } = {}) => {
  const file = path.join(work, MARKER);
  if (renderer !== 'playwright' && !force && readJson(file)?.renderer === 'playwright') return false;
  writeJsonAtomic(file, { renderer, ...(reason ? { reason } : {}), at: new Date().toISOString() });
  return true;
};
export const rendererFor = (work, { ready = () => doctor({ quiet: true }).ok } = {}) => {
  const marked = readJson(path.join(work, MARKER))?.renderer;
  if (marked === 'fframes' || marked === 'playwright') return marked;
  // No marker (older work dir) or pending: fframes only with a crate and a ready build.
  if (!existsSync(path.join(work, 'ff', 'src', 'main.rs'))) return 'playwright';
  return ready() ? 'fframes' : 'playwright';
};

// The crate is plain files: init writes it even before the shared build is warm
// (check and render need that), so the scenes can be written while --warm runs.
// renderer.json, not the crate, says which renderer this video uses.
const init = (work) => {
  const state = doctor({ warm: false, quiet: true });
  const renderer = state.ok ? 'fframes' : state.warmable ? 'pending' : 'playwright';
  const pruned = state.ok || state.warmable ? prune({ keep: kitHash() }) : null;
  const ff = path.join(work, 'ff');
  const scriptPath = path.join(work, 'script.json');
  const script = existsSync(scriptPath) ? JSON.parse(readFileSync(scriptPath, 'utf8')) : { scenes: [] };
  const had = existsSync(path.join(ff, 'src', 'main.rs'));
  writeCrate(ff, binName(work), kitDir().replaceAll('\\', '/'), skeleton(script));
  mkdirSync(path.join(ff, 'media'), { recursive: true });
  const force = args.includes('--fframes');
  const prior = readJson(path.join(work, MARKER));
  writeRenderer(work, renderer, renderer === 'playwright' ? state.problems.join('; ') : null, { force });
  if (renderer !== 'playwright' && prior?.renderer === 'playwright' && !force) {
    return { ok: true, renderer: 'playwright', fallback: true, crate: ff, reason: prior.reason, next: `This video already fell back to Playwright (${prior.reason ?? 'see renderer.json'}): keep using scenes.js and render.mjs. To switch it back to fframes on purpose, run fframes.mjs init <work-dir> --fframes.` };
  }
  if (renderer === 'playwright') {
    const earlier = prior?.renderer === 'playwright' ? `This video already fell back to Playwright (${prior.reason ?? 'see renderer.json'}); once fframes is available, switch it back on purpose with fframes.mjs init <work-dir> --fframes. ` : '';
    process.stderr.write(`\n*** FALLBACK: fframes is not available (${state.problems.join('; ')}). Rendering with Playwright instead. ***\n\n`);
    return { ok: true, renderer, fallback: true, problems: state.problems, ...(prior?.renderer === 'playwright' ? { reason: prior.reason } : {}), next: `FALLBACK: write scenes.js and use the Playwright steps (lint.mjs runs the page checks); say in the handoff that it fell back and why. ${earlier}${state.next}` };
  }
  return { ok: true, renderer, crate: ff, main: path.join(ff, 'src', 'main.rs'), kept: had ? ['src/main.rs'] : [], pruned, example: path.join(TEMPLATE, 'src', 'main.rs'), reference: path.join(SKILL, 'references', 'fframes.md'), next: `${state.ok ? '' : 'The shared build is not warm yet: run fframes.mjs doctor --warm before check. '}Write one arm per scene in ff/src/main.rs (copy the patterns from the example), then run fframes.mjs check <work-dir>.` };
};

// The agent gave up on fframes for this video (warm or build failed): record it so the
// fallback's checks run, and say it loudly.
const fallback = (work) => {
  const i = args.indexOf('--reason');
  const reason = i >= 0 && args[i + 1] ? args[i + 1] : 'fframes could not render this video';
  writeRenderer(work, 'playwright', reason);
  process.stderr.write(`\n*** FALLBACK: ${reason}. Rendering with Playwright instead. ***\n\n`);
  return { ok: true, renderer: 'playwright', reason, next: 'Write scenes.js, run lint.mjs (page checks run now), render.mjs, and say FALLBACK and why in the handoff.' };
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

// Who has to act on a failed build: the scenes (main.rs), the shared kit (re-warm), or
// the sandbox (write access to the cache).
export const classifyBuildError = (stderr, { target = TARGET, cache = CACHE } = {}) => {
  const text = String(stderr ?? '');
  const lines = text.split('\n');
  if (lines.some((l) => l.includes(target) && /failed to open|Permission denied|Read-only file system|Operation not permitted/i.test(l))) return 'sandboxed';
  const kitRef = (l) => l.includes(cache) || /vs_fframes_kit|kit-[0-9a-f]{8,}/.test(l);
  const inMain = (l) => /^(\S*\/)?src\/main\.rs:\d+:\d+:/.test(l);
  // The kit dir or its manifest is gone (pruned by another install, interrupted copy).
  // Only cargo's own manifest/IO errors count: `could not find X in vs_fframes_kit` in
  // main.rs is the author's (a wrong name), not a missing kit.
  if (lines.some((l) => !inMain(l) && kitRef(l) && /failed to (load|read|get|select)|No such file|does not exist/i.test(l))) return 'kit';
  // Errors in main.rs are the author's, even when they name the kit or a note points into it.
  if (lines.some((l) => inMain(l) && / error/.test(l))) return 'scenes';
  // Errors inside the kit's own sources: a broken or half-written kit copy.
  if (lines.some((l) => kitRef(l) && /^\S+\.rs:\d+:\d+: error/.test(l))) return 'kit';
  return 'scenes';
};
// What doctor --warm tells the agent after a failed warm. A system kill (often out of
// memory) is worth one rerun before falling back; a build error is not.
export const warmFailedNext = (info) => {
  const fallbackCmd = `node ${path.join(here, 'fframes.mjs')} fallback <work-dir> --reason "doctor --warm failed"`;
  return info.killed
    ? `rerun doctor --warm (close other heavy work first); if it is killed again, FALLBACK: ${fallbackCmd}`
    : `fix that and rerun doctor --warm, or FALLBACK: ${fallbackCmd}`;
};
export const buildCrate = (work, ff) => {
  const env = readEnv();
  const started = Date.now();
  const res = run(cargoBin(), ['build', '--locked', '--message-format=short', '--manifest-path', path.join(ff, 'Cargo.toml')], { env: cargoEnv(env), cwd: ff, ...limit('build') });
  guard(res, work, 'The video build', 'build');
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  if (res.status !== 0) {
    const errors = String(res.stderr).split('\n').filter((l) => /(^|: )error/.test(l)).slice(0, 12);
    const kind = classifyBuildError(res.stderr);
    const next = {
      // A sandboxed agent (writes limited to the project and /tmp) cannot take the shared build lock.
      sandboxed: `The shared build dir ${TARGET} is not writable here (a sandbox?). Rerun this command with write access to ${CACHE} (approve the escalation, or add it as a writable root). Do not fall back for this.`,
      // The kit dir went away or is broken (another install pruned it, an interrupted warm).
      kit: `The shared kit build is missing or broken, not your scenes: run node ${path.join(here, 'fframes.mjs')} doctor --warm, then rerun this command. Do not edit main.rs for this. If --warm fails, run fframes.mjs fallback <work-dir> --reason "shared kit broken" and use Playwright (FALLBACK).`,
      scenes: 'Fix these errors in ff/src/main.rs and rerun.',
    }[kind];
    print({ ok: false, stage: 'build', cause: kind, seconds, errors: errors.length ? errors : String(res.stderr).split('\n').slice(-20), ...(kind === 'sandboxed' ? { sandboxed: true } : {}), next });
    process.exit(kind === 'scenes' ? 1 : 2);
  }
  const toml = readFileSync(path.join(ff, 'Cargo.toml'), 'utf8');
  const bin = /\[\[bin\]\]\s*name\s*=\s*"([^"]+)"/.exec(toml)[1];
  return { bin: path.join(TARGET, 'debug', bin + (process.platform === 'win32' ? '.exe' : '')), seconds };
};

const frames = (bin, ff, specs, outDir, extraEnv = {}) => {
  const lint = path.join(ff, `.lint-${process.pid}-${Date.now()}.jsonl`);
  const res = run(bin, ['frame', ...specs, '-o', outDir, '--json'], { env: { ...process.env, VS_FF_DIR: ff, VS_FF_LINT: lint, ...extraEnv }, ...limit('frame') });
  guard(res, path.dirname(ff), 'fframes frame', 'frame');
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
      const r = run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-an', '-vf', `setpts=(PTS-STARTPTS)/${rate.toFixed(4)},fps=30,scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', dst], limit('ffmpeg'));
      guard(r, path.dirname(ff), `ffmpeg pre-slowing ${slot.file}`, 'ffmpeg');
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
  needReady(work);
  const pr = args.includes('--pr');
  const only = opt('--scene');
  const at = opt('--at') ? opt('--at').split(',').map(Number) : null;
  const { ff, TL } = prep(work);
  const { bin, seconds: buildSeconds } = buildCrate(work, ff);
  writeRenderer(work, 'fframes');
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
  needReady(work);
  const outArg = opt('--out');
  if (!outArg) die('Usage: node fframes.mjs render <work-dir> --out <video.mp4> [--size 1080|720]');
  const out = path.resolve(outArg);
  const size = Number(opt('--size') ?? 1080);
  if (![1080, 720].includes(size)) die('--size is 1080 or 720.');
  const narration = path.join(work, 'narration.wav');
  if (!existsSync(narration)) die(`${narration} is missing. Run narrate.mjs first.`);
  const { ff, TL } = prep(work);
  const { bin, seconds: buildSeconds } = buildCrate(work, ff);
  const clips = prepClips(bin, ff, TL);
  const silent = path.join(ff, '.silent.mp4');
  const started = Date.now();
  const flags = ['render', '-o', silent, '--renderer', process.env.VS_FF_RENDERER ?? 'skia-cpu', ...(size === 720 ? ['--scale', '0.6666667'] : []), ...(args.includes('--draft') ? ['--draft'] : [])];
  const r = run(bin, flags, { env: { ...process.env, VS_FF_DIR: ff }, ...limit('render') });
  guard(r, work, 'fframes render', 'render');
  if (r.status !== 0) die(`fframes render failed: ${String(r.stderr).slice(-1500)}`, 1);
  const renderSeconds = Number(((Date.now() - started) / 1000).toFixed(1));
  mkdirSync(path.dirname(out), { recursive: true });
  const mux = run('ffmpeg', ['-y', '-v', 'error', '-i', silent, '-i', narration, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], limit('ffmpeg'));
  guard(mux, work, 'ffmpeg muxing the narration', 'ffmpeg');
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
else if (cmd === 'fallback') print(fallback(needWork()));
else if (cmd === 'render') render(needWork());
else die('Usage: node fframes.mjs doctor [--warm] | init <work> [--fframes] | check <work> [--pr] | fallback <work> --reason "..." | render <work> --out <mp4> [--size 720]');
