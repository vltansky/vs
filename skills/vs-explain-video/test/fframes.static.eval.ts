import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { findRunWorkDirs, removeRunWorkDirs } from './run-dirs';
import { afterAll, describe, expect, it } from 'vitest';

// Static evals for the default renderer: fframes (Rust + SVG, Skia on the CPU).
// The template crate and the kit are checked as files (CI does not build Rust),
// the pure helpers in ffkit.mjs by behaviour, and doctor and preflight through
// fake toolchains, so the FALLBACK path is exercised on every machine.

const DIR = path.resolve(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(DIR, ...p), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const script = (name: string) => path.join(DIR, 'scripts', name);
const temps: string[] = [];
const tmp = (prefix: string) => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});
const ffkit = async () => import(pathToFileURL(script('ffkit.mjs')).href);

// A fake rustup bin dir whose cargo and rustc report `version`.
const fakeRust = (version: string) => {
  const bin = tmp('vs-ff-rust-');
  for (const tool of ['cargo', 'rustc']) fs.writeFileSync(path.join(bin, tool), `#!/bin/sh\necho "${tool} ${version} (fake 2026-01-01)"\n`, { mode: 0o755 });
  return path.join(bin, 'cargo');
};
const doctor = (env: Record<string, string>, ...args: string[]) => {
  const home = tmp('vs-ff-home-');
  const res = spawnSync(process.execPath, [script('fframes.mjs'), 'doctor', ...args], {
    encoding: 'utf8',
    cwd: tmpdir(),
    env: { PATH: process.env.PATH ?? '', HOME: home, VS_FF_CACHE: path.join(home, 'cache'), ...env },
  });
  return { ...res, report: JSON.parse(res.stdout) };
};

describe('the fframes template crate and kit', () => {
  it('ships a template crate with placeholders and a pinned lock file', () => {
    const cargo = read('fframes', 'video', 'Cargo.toml');
    expect(cargo).toContain('name = "@BIN@"');
    expect(cargo).toContain('path = "@KIT@"');
    expect(cargo).toMatch(/fframes = "=1\.3\.0"/);
    expect(cargo).toMatch(/\[workspace\]/);
    const lock = read('fframes', 'video', 'Cargo.lock');
    expect(lock).toMatch(/name = "fframes"\nversion = "1\.3\.0"/);
    const main = read('fframes', 'video', 'src', 'main.rs');
    expect(main).toMatch(/vs_fframes_kit::run\(env!\("CARGO_MANIFEST_DIR"\), scene\)/);
    for (const id of ['"intro"', '"miss"', '"fix"']) expect(main).toContain(id);
  });

  it('renders on the CPU with prebuilt Skia, Metal on macOS and Vulkan on Linux', () => {
    const kit = read('fframes', 'kit', 'Cargo.toml');
    expect(kit).toMatch(/cfg\(target_os = "macos"\)[^\n]*\n[^\n]*features = \["metal", "cli"\]/);
    expect(kit).toMatch(/cfg\(not\(target_os = "macos"\)\)[^\n]*\n[^\n]*features = \["vulkan", "cli"\]/);
    expect(read('scripts', 'fframes.mjs')).toMatch(/'--renderer', process\.env\.VS_FF_RENDERER \?\? 'skia-cpu'/);
  });

  it('keeps the parity fixes in the kit', () => {
    const lib = read('fframes', 'kit', 'src', 'lib.rs');
    // Rounded still corners: the screenshot is clipped to the card's radius.
    expect(lib).toMatch(/clipPath id=\{clip\}><rect x=\{x\} y=\{y\} width=\{w\} height=\{h\} rx="20"/);
    // Clip windows are on the scene clock and moved onto the video timeline.
    expect(lib).toMatch(/start_from: self\.start \+ win\.from/);
    // The clip draws in place, so a chip drawn after it stays on top.
    expect(lib).toMatch(/pub fn clip\([^)]*\) -> Svgr<'a>/);
    // Text runs are spaced by the renderer, and a run glued to the word before has no gap.
    expect(lib).toMatch(/gap = ws\.get\(i \+ 1\)\.is_some_and\(\|n\| !n\.glue\)/);
    expect(read('fframes', 'kit', 'src', 'style.rs')).toMatch(/pub glue: bool/);
    // Audio: AAC at 48 kHz, the narration level narrate.mjs set.
    expect(read('scripts', 'fframes.mjs')).toMatch(/'-ar', '48000'/);
  });
});

describe('ffkit.mjs helpers', () => {
  it('reads Rust versions and enforces 1.88', async () => {
    const { parseRustVersion, versionAtLeast } = await ffkit();
    expect(parseRustVersion('rustc 1.85.0 (4d91de4e4 2025-02-17)')).toEqual([1, 85, 0]);
    expect(versionAtLeast([1, 85, 0])).toBe(false);
    expect(versionAtLeast([1, 88, 0])).toBe(true);
    expect(versionAtLeast([2, 0, 0])).toBe(true);
    expect(versionAtLeast(null)).toBe(false);
  });

  it('turns timeline.js into the kit timeline with numeric beats', async () => {
    const { readTimelineJs, toKitTimeline } = await ffkit();
    const TL = readTimelineJs('window.TL = { title: "T", fps: 30, total: 6, scenes: [{ id: "a", start: 0, dur: 6, beats: [{ t: 0.7, d: 2, text: "x" }, { t: 3, d: 2, text: "y" }] }], subs: [] };');
    const kit = toKitTimeline(TL);
    expect(kit.scenes[0].beats).toEqual([0.7, 3]);
    expect(kit.captions.style).toBe('pill');
    expect(kit.total).toBe(6);
    expect(() => readTimelineJs('window.X = 1;')).toThrow(/window\.TL/);
  });

  it('picks the clip rate finish.mjs picks and names the slowed copy', async () => {
    const { clipRate, slowName } = await ffkit();
    expect(clipRate(1.625, 5.22)).toBe(0.5);
    expect(clipRate(3, 5)).toBeCloseTo(0.6);
    expect(clipRate(10, 5)).toBe(1);
    expect(slowName('apply.mp4', 0.5)).toBe('apply.r0500.mp4');
  });

  it('reads HOLDS from main.rs', async () => {
    const { readHolds } = await ffkit();
    expect(readHolds('const HOLDS: &[&str] = &["intro:1", "fix:0"];')).toEqual(['intro:1', 'fix:0']);
    expect(readHolds('const HOLDS: &[&str] = &[];')).toEqual([]);
    expect(readHolds('fn main() {}')).toEqual([]);
  });

  it('audits a frame like the stage audit, and adds the phone checks with --pr', async () => {
    const { auditFrame } = await ffkit();
    const text = (x: number, y: number, w: number, size: number, words: string, block: number) => ({ kind: 'text', frame: 0, x, y, w, h: size, size, text: words, o: 1, block });
    const card = (x: number, y: number, w: number, h: number, block: number) => ({ kind: 'card', frame: 0, x, y, w, h, o: 1, block });
    const kinds = (records: object[], pr = false) => auditFrame(records, { pr }).map((i: { kind: string }) => i.kind);

    expect(kinds([card(160, 300, 600, 140, 1), text(190, 330, 400, 40, 'fine', 1)])).toEqual([]);
    expect(kinds([card(160, 300, 600, 140, 1), card(500, 350, 600, 140, 2)])).toContain('overlap');
    expect(kinds([card(160, 300, 600, 140, 1), card(500, 350, 600, 140, 2), { kind: 'overlap-ok', frame: 0, block: 2 }])).not.toContain('overlap');
    expect(kinds([card(160, 300, 300, 140, 1), text(190, 330, 500, 40, 'too wide for its card', 1)])).toContain('text-overflows-box');
    expect(kinds([text(190, 330, 100, 16, 'tiny', 1)])).toContain('SMALL');
    expect(kinds([card(160, 900, 600, 140, 1)])).toContain('under-subtitle-zone');
    expect(kinds([card(1500, 20, 300, 50, 1)])).toContain('under-chapter-bar');
    expect(kinds([card(10, 300, 300, 140, 1)])).toContain('outside-safe-area');
    // Faded-out blocks are not on screen.
    expect(kinds([card(160, 300, 600, 140, 1), { ...card(500, 350, 600, 140, 2), o: 0 }])).toEqual([]);

    expect(kinds([text(190, 330, 600, 22, 'four words of body', 1)], true)).toContain('PHONE');
    expect(kinds([text(190, 330, 600, 22, 'four words of body', 1)], false)).not.toContain('PHONE');
    expect(kinds([text(190, 330, 1400, 30, Array(41).fill('w').join(' '), 1)], true)).toContain('DENSE');
    expect(kinds([{ kind: 'media', frame: 0, x: 200, y: 200, w: 800, h: 450, o: 1, block: 1 }], true)).toContain('PHONE');
    expect(kinds([{ kind: 'missing-media', frame: 0, x: 1, y: 1, w: 1, h: 1, o: 1, block: 1 }])).toContain('missing-media');
    expect(kinds([{ kind: 'clip-missing', frame: 0, scene: 'after', file: 'apply.r0500.mp4' }])).toContain('CLIP-MISSING');
    // A clip check never prepared plays as a still: say so instead of shipping it.
    const clip = { kind: 'clip', frame: 0, scene: 'after', file: 'apply.mp4', x: 200, y: 200, w: 1200, h: 675, o: 1, block: 1, from: 30, to: 34 };
    expect(kinds([{ ...clip, prepared: false }])).toContain('CLIP-UNPREPARED');
    expect(kinds([{ ...clip, prepared: true }])).not.toContain('CLIP-UNPREPARED');
  });

  it('keeps only fframes diagnostics worth a fix', async () => {
    const { frameDiagnostics } = await ffkit();
    const found = frameDiagnostics([{ seconds: 1, diagnostics: [{ severity: 'info', kind: 'text_off_canvas' }, { severity: 'warning', kind: 'text_overflow', text: 'Long' }] }]);
    expect(found).toEqual([expect.objectContaining({ kind: 'text_overflow', block: 'Long', seconds: 1 })]);
  });
});

// Would doctor accept this machine with a new enough Rust? (ffmpeg, dev libraries, libclang)
const WARMABLE = doctor({ VS_FF_CARGO: fakeRust('1.90.0') }).report.warmable === true;
const ff = async () => import(pathToFileURL(script('fframes.mjs')).href);
// Run fframes.mjs exports in a child, so VS_FF_CACHE is read at import.
const inChild = (code: string, env: Record<string, string>) => {
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(pathToFileURL(script('fframes.mjs')).href)});\n${code}`], {
    encoding: 'utf8',
    cwd: tmpdir(),
    env: { PATH: process.env.PATH ?? '', HOME: tmp('vs-ff-home-'), ...env },
  });
  if (res.status !== 0) throw new Error(res.stderr);
  return JSON.parse(res.stdout);
};
const age = (p: string, days: number) => {
  const t = new Date(Date.now() - days * 24 * 3600 * 1000);
  fs.utimesSync(p, t, t);
};

describe('the shared cache', () => {
  it('prunes only kits, kit builds and video binaries unused for 14 days', async () => {
    const { prune } = await ff();
    const cache = tmp('vs-ff-prune-');
    const debug = path.join(cache, 'target', 'debug');
    for (const d of ['deps', 'incremental', '.fingerprint']) fs.mkdirSync(path.join(debug, d), { recursive: true });
    const put = (p: string, days: number, dir = false) => {
      if (dir) fs.mkdirSync(p, { recursive: true });
      else fs.writeFileSync(p, 'x');
      age(p, days);
    };
    // Another install's kit, used yesterday: kept. One last used 20 days ago: removed.
    put(path.join(cache, 'kit-aaaaaaaa'), 30, true);
    put(path.join(cache, 'ready-aaaaaaaa.json'), 1);
    put(path.join(cache, 'kit-bbbbbbbb'), 30, true);
    put(path.join(cache, 'ready-bbbbbbbb.json'), 20);
    put(path.join(cache, 'kit-cccccccc'), 20, true); // never warmed: its own age counts
    put(path.join(cache, 'kit-dddddddd'), 40, true); // the current kit: always kept
    put(path.join(cache, 'kit-eeeeeeee.tmp-123'), 3, true); // an abandoned copy
    // Kit builds: the newest group is kept even when old; another old group goes.
    put(path.join(debug, 'deps', 'libvs_fframes_kit-1111.rlib'), 30);
    put(path.join(debug, 'deps', 'libvs_fframes_kit-2222.rlib'), 20);
    put(path.join(debug, 'deps', 'libvs_fframes_kit-3333.rlib'), 2);
    put(path.join(debug, 'deps', 'libvs_fframes_kit-4444.rlib'), 25);
    // Per-video binaries (~50 MB each): only old ones go.
    put(path.join(debug, 'vs-video-old-abc123'), 20);
    put(path.join(debug, 'vs-video-new-def456'), 2);
    put(path.join(debug, 'deps', 'vs_video_old_abc123-99'), 20);
    put(path.join(debug, 'vs-video-warm-dddddddd'), 40);
    const gone = prune({ cache, keep: 'dddddddd' });
    const has = (...p: string[]) => fs.existsSync(path.join(cache, ...p));
    expect(has('kit-aaaaaaaa')).toBe(true);
    expect(has('kit-bbbbbbbb') || has('ready-bbbbbbbb.json')).toBe(false);
    expect(has('kit-cccccccc')).toBe(false);
    expect(has('kit-dddddddd')).toBe(true);
    expect(has('kit-eeeeeeee.tmp-123')).toBe(false);
    expect(has('target', 'debug', 'deps', 'libvs_fframes_kit-3333.rlib')).toBe(true);
    expect(has('target', 'debug', 'deps', 'libvs_fframes_kit-1111.rlib')).toBe(false);
    expect(has('target', 'debug', 'deps', 'libvs_fframes_kit-4444.rlib')).toBe(false);
    expect(has('target', 'debug', 'vs-video-old-abc123')).toBe(false);
    expect(has('target', 'debug', 'deps', 'vs_video_old_abc123-99')).toBe(false);
    expect(has('target', 'debug', 'vs-video-new-def456')).toBe(true);
    expect(has('target', 'debug', 'vs-video-warm-dddddddd')).toBe(true);
    expect(gone).toMatchObject({ kits: 2, videos: 1 });
  });

  it('reads a corrupt state file as not warm instead of crashing', async () => {
    const { readJson } = await ff();
    const dir = tmp('vs-ff-json-');
    fs.writeFileSync(path.join(dir, 'bad.json'), '{"kitHash": "ab');
    expect(readJson(path.join(dir, 'bad.json'))).toBeNull();
    expect(readJson(path.join(dir, 'none.json'))).toBeNull();
    // doctor with a corrupt machine.json and ready file still answers in JSON.
    const cache = tmp('vs-ff-corrupt-');
    const hash = inChild('console.log(JSON.stringify(m.kitHash()));', { VS_FF_CACHE: cache });
    fs.writeFileSync(path.join(cache, 'machine.json'), '{oops');
    fs.writeFileSync(path.join(cache, `ready-${hash}.json`), '');
    fs.mkdirSync(path.join(cache, `kit-${hash}`));
    fs.writeFileSync(path.join(cache, `kit-${hash}`, '.complete'), '');
    const { status, report } = doctor({ VS_FF_CARGO: fakeRust('1.90.0'), VS_FF_CACHE: cache });
    expect(status).toBe(2);
    expect(report.ok).toBe(false);
  });

  it('a failing warm redoes a half-copied kit, cleans its own crate, retries ffmpeg from source, and records nothing as ready', () => {
    const cache = tmp('vs-ff-warm-');
    const hash = inChild('console.log(JSON.stringify(m.kitHash()));', { VS_FF_CACHE: cache });
    // An interrupted copy: the kit dir exists without .complete.
    fs.mkdirSync(path.join(cache, `kit-${hash}`), { recursive: true });
    fs.writeFileSync(path.join(cache, `kit-${hash}`, 'junk'), '');
    // A prebuilt ffmpeg from an earlier warm that links the wrong x264.
    const out = path.join(cache, 'target', 'debug', 'build', 'ffmpeg-sys-fframes-0abc', 'out');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'libavutil.a'), '');
    const bin = tmp('vs-ff-cargo-');
    const log = path.join(bin, 'calls.log');
    fs.writeFileSync(path.join(bin, 'cargo'), `#!/bin/sh\necho "force=$FFMPEG_FORCE_BUILD out=$([ -e '${out}/libavutil.a' ] && echo yes || echo no)" >> '${log}'\necho "error: linking with cc failed: undefined reference to x264_encoder_open_164" >&2\nexit 101\n`, { mode: 0o755 });
    const { res, next } = inChild('const res = m.warmCache({}); console.log(JSON.stringify({ res, next: m.warmFailedNext(res) }));', { VS_FF_CACHE: cache, VS_FF_CARGO: path.join(bin, 'cargo') });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/cargo build failed/);
    expect(fs.readFileSync(log, 'utf8').trim().split('\n')).toEqual(['force= out=yes', 'force=1 out=no']);
    expect(fs.existsSync(path.join(cache, `kit-${hash}`, '.complete'))).toBe(true);
    expect(fs.existsSync(path.join(cache, `kit-${hash}`, 'junk'))).toBe(false);
    expect(fs.readdirSync(cache).filter((d) => /^warm-\d+$/.test(d))).toEqual([]);
    expect(fs.existsSync(path.join(cache, `ready-${hash}.json`))).toBe(false);
    // Nothing machine-wide records the failure: another agent may warm and succeed. Only
    // the agent whose warm failed falls back, and the report names the command.
    expect(fs.readdirSync(cache).filter((f) => f.startsWith('failed-'))).toEqual([]);
    expect(next).toMatch(/^fix that and rerun doctor --warm, or FALLBACK: node \S+fframes\.mjs fallback <work-dir> --reason/);
    // A complete kit copy is never replaced (another install may be using it).
    fs.writeFileSync(path.join(cache, `kit-${hash}`, 'in-use'), '');
    inChild('console.log(JSON.stringify(m.warmCache({})));', { VS_FF_CACHE: cache, VS_FF_CARGO: path.join(bin, 'cargo') });
    expect(fs.existsSync(path.join(cache, `kit-${hash}`, 'in-use'))).toBe(true);
  });

  it('after a warm killed by the system, says rerun first and fall back only if killed again', () => {
    const cache = tmp('vs-ff-warmkill-');
    const bin = tmp('vs-ff-cargo-');
    fs.writeFileSync(path.join(bin, 'cargo'), '#!/bin/sh\nkill -9 $$\n', { mode: 0o755 });
    const { res, next } = inChild('const res = m.warmCache({}); console.log(JSON.stringify({ res, next: m.warmFailedNext(res) }));', { VS_FF_CACHE: cache, VS_FF_CARGO: path.join(bin, 'cargo') });
    expect(res).toMatchObject({ ok: false, killed: true });
    expect(next).toMatch(/^rerun doctor --warm .*; if it is killed again, FALLBACK: node \S+fframes\.mjs fallback <work-dir>/);
    expect(fs.readdirSync(cache).filter((f) => f.startsWith('failed-') || f.startsWith('ready-'))).toEqual([]);
  });

  // The whole doctor --warm report: needs a machine doctor accepts (ffmpeg, dev libraries).
  it.skipIf(!WARMABLE)('doctor --warm prints the failed-warm advice in its next steps (skipped without ffmpeg or the fframes dev libraries)', () => {
    const bin = path.dirname(fakeRust('1.90.0'));
    fs.writeFileSync(path.join(bin, 'cargo'), '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "cargo 1.90.0 (fake 2026-01-01)"; exit 0; fi\necho "error: could not compile fframes" >&2\nexit 101\n', { mode: 0o755 });
    const { status, report } = doctor({ VS_FF_CARGO: path.join(bin, 'cargo'), VS_FF_CACHE: tmp('vs-ff-warmcli-') }, '--warm');
    expect(status).toBe(2);
    expect(report.next).toMatch(/fix that and rerun doctor --warm, or FALLBACK: node \S+fframes\.mjs fallback <work-dir>/);
  });

  it('tells the agent who must act on a failed build: the scenes, the kit (re-warm), or the sandbox', async () => {
    const { classifyBuildError } = await ff();
    const at = { target: '/h/.cache/vs/fframes/target', cache: '/h/.cache/vs/fframes' };
    expect(classifyBuildError('error: failed to open: /h/.cache/vs/fframes/target/debug/.cargo-lock\n\nCaused by:\n  Read-only file system (os error 30)', at)).toBe('sandboxed');
    expect(classifyBuildError('error: failed to get `vs_fframes_kit` as a dependency of package `vs-video v0.1.0 (/w/ff)`\n\nCaused by:\n  failed to load source for dependency `vs_fframes_kit`\n\nCaused by:\n  failed to read `/h/.cache/vs/fframes/kit-0123abcd/Cargo.toml`\n\nCaused by:\n  No such file or directory (os error 2)', at)).toBe('kit');
    expect(classifyBuildError('/h/.cache/vs/fframes/kit-0123abcd/src/lib.rs:12:5: error: expected item, found `}`', at)).toBe('kit');
    expect(classifyBuildError('src/main.rs:40:9: error[E0425]: cannot find value `x` in this scope\n/h/.cache/vs/fframes/kit-0123abcd/src/lib.rs:500:12: note: method defined here', at)).toBe('scenes');
    expect(classifyBuildError('src/main.rs:3:1: error: expected one of `!` or `::`', at)).toBe('scenes');
    // A wrong name in main.rs that mentions the kit is still the author's to fix.
    expect(classifyBuildError('src/main.rs:2:5: error[E0432]: unresolved import `vs_fframes_kit::Clipx`: could not find `Clipx` in `vs_fframes_kit`', at)).toBe('scenes');
    const src = read('scripts', 'fframes.mjs');
    expect(src).toMatch(/Do not fall back for this/);
    expect(src).toMatch(/run node .*doctor --warm, then rerun this command\. Do not edit main\.rs for this\./);
  });

  it('caps builds, frames and renders with a time limit that says FALLBACK', () => {
    const src = read('scripts', 'fframes.mjs');
    for (const name of ['warm', 'build', 'frame', 'render', 'ffmpeg']) expect(src).toContain(`limit('${name}')`);
    expect(src).toMatch(/timed out after \$\{limit\(name\)/);
    expect(src).toMatch(/FALLBACK recorded in/);
    // Every timed-out step records the fallback; none is reported with a bare die.
    expect(src.match(/guard\(\w+, [^,]+, [^,]+, '(build|frame|render|ffmpeg)'\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(src).not.toMatch(/if \(timedOut\(\w+\)\) die\(/);
    expect(read('scripts', 'media.mjs')).toMatch(/timeout: CMD_TIMEOUT_MS/);
  });

  it('keeps a fallback one-way: init -> fallback -> init stays playwright until init --fframes', async () => {
    const { writeRenderer, readJson } = await ff();
    const work = tmp('vs-ff-oneway-');
    const marker = () => readJson(path.join(work, 'renderer.json'))?.renderer;
    writeRenderer(work, 'playwright', 'warm failed');
    expect(writeRenderer(work, 'fframes')).toBe(false);
    expect(marker()).toBe('playwright');
    expect(writeRenderer(work, 'fframes', null, { force: true })).toBe(true);
    expect(marker()).toBe('fframes');
    // Through the CLI, as an agent runs it.
    const cli = tmp('vs-ff-oneway-cli-');
    fs.copyFileSync(path.join(DIR, 'assets', 'script.example.json'), path.join(cli, 'script.json'));
    const env = { PATH: process.env.PATH ?? '', HOME: tmp('vs-ff-home-'), VS_FF_CACHE: tmp('vs-ff-c-'), VS_FF_CARGO: fakeRust('1.90.0') };
    const ffm = (...a: string[]) => spawnSync(process.execPath, [script('fframes.mjs'), ...a], { encoding: 'utf8', env });
    const at = () => JSON.parse(fs.readFileSync(path.join(cli, 'renderer.json'), 'utf8')).renderer;
    expect(ffm('init', cli).status).toBe(0);
    expect(at()).toBe(WARMABLE ? 'pending' : 'playwright');
    const fb = ffm('fallback', cli, '--reason', 'warm failed');
    expect(fb.stderr).toMatch(/\*\*\* FALLBACK: warm failed/);
    expect(at()).toBe('playwright');
    const again = ffm('init', cli);
    expect(again.status).toBe(0);
    expect(at()).toBe('playwright');
    expect(JSON.parse(again.stdout).next).toMatch(/init <work-dir> --fframes/);
    // check refuses a video that fell back, instead of quietly rendering it with fframes.
    const chk = ffm('check', cli);
    expect(chk.status).toBe(2);
    expect(chk.stderr + chk.stdout).toMatch(/fell back to Playwright/);
    ffm('init', cli, '--fframes');
    expect(at()).toBe(WARMABLE ? 'pending' : 'playwright');
  });

  // The build step itself, with a cargo that hangs or is killed: no ffmpeg or dev libraries needed.
  it('a build past its time limit exits FALLBACK and records it; a SIGKILL from elsewhere is not called a timeout', () => {
    const fake = (body: string) => {
      const bin = tmp('vs-ff-cargo-');
      fs.writeFileSync(path.join(bin, 'cargo'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
      return path.join(bin, 'cargo');
    };
    const work = tmp('vs-ff-timeout-work-');
    fs.mkdirSync(path.join(work, 'ff'));
    const env = (cargo: string) => ({ PATH: process.env.PATH ?? '', HOME: tmp('vs-ff-home-'), VS_FF_CACHE: tmp('vs-ff-c-'), VS_FF_CARGO: cargo, VS_FF_TIMEOUT_BUILD: '0.02' });
    const buildWith = (cargo: string) => spawnSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(pathToFileURL(script('fframes.mjs')).href)});\nm.writeRenderer(${JSON.stringify(work)}, 'fframes');\nm.buildCrate(${JSON.stringify(work)}, ${JSON.stringify(path.join(work, 'ff'))});`],
      { encoding: 'utf8', cwd: tmpdir(), env: env(cargo) });
    const at = () => JSON.parse(fs.readFileSync(path.join(work, 'renderer.json'), 'utf8'));
    // Killed by something else (OOM): rerun advice, no timeout claim, nothing recorded.
    const k = buildWith(fake('kill -9 $$'));
    expect(k.status).toBe(2);
    expect(k.stdout).toMatch(/killed by the system \(SIGKILL, not our time limit/);
    expect(k.stdout + k.stderr).not.toMatch(/timed out|FALLBACK:/);
    expect(at().renderer).toBe('fframes');
    // Past our 1.2 s limit: FALLBACK, recorded, and a later init keeps it.
    const started = Date.now();
    const t = buildWith(fake('sleep 20'));
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(t.status).toBe(2);
    expect(t.stderr).toMatch(/\*\*\* FALLBACK: The video build timed out after 0\.02 min/);
    expect(at()).toMatchObject({ renderer: 'playwright', reason: expect.stringMatching(/timed out/) });
    const again = spawnSync(process.execPath, [script('fframes.mjs'), 'init', work], { encoding: 'utf8', env: { ...env(fakeRust('1.90.0')), VS_FF_TIMEOUT_BUILD: '' } });
    expect(again.status).toBe(0);
    expect(at().renderer).toBe('playwright');
    expect(JSON.parse(again.stdout).next).toMatch(/init <work-dir> --fframes/);
  });

  it('the live eval finds and removes only its own work dirs under a shared /tmp/.vs', () => {
    const stray = path.join(tmp('vs-ff-stray-'), '.vs');
    const ours = tmp('vs-ff-ours-');
    const theirs = `${ours}x`; // shares our cache path as a prefix
    const crate = (dir: string, cache: string) => {
      fs.mkdirSync(path.join(dir, 'ff'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'ff', 'Cargo.toml'), `[dependencies]\nvs_fframes_kit = { path = "${cache}/kit-0123456789ab" }\n`);
      fs.writeFileSync(path.join(dir, 'scenes.js'), '');
    };
    // Another agent's project, and a sibling video in the same pre-existing project dir.
    crate(path.join(stray, 'other-project', 'videos', 'theirs'), theirs);
    crate(path.join(stray, 'workspace', 'videos', 'sibling'), tmp('vs-ff-other-'));
    fs.mkdirSync(path.join(stray, 'workspace', 'videos', 'no-crate'), { recursive: true });
    // This run's video, inside the already existing /tmp/.vs/workspace.
    crate(path.join(stray, 'workspace', 'videos', 'mine'), ours);
    expect(findRunWorkDirs(stray, ours)).toEqual([path.join(stray, 'workspace', 'videos', 'mine')]);
    expect(findRunWorkDirs(stray, '')).toEqual([]);
    removeRunWorkDirs(stray, ours);
    expect(fs.existsSync(path.join(stray, 'workspace', 'videos', 'mine'))).toBe(false);
    for (const kept of ['other-project/videos/theirs/scenes.js', 'workspace/videos/sibling/scenes.js', 'workspace/videos/no-crate']) {
      expect(fs.existsSync(path.join(stray, kept))).toBe(true);
    }
  });

  it('records the renderer per video, so lint never guesses from leftover files', async () => {
    const { rendererFor, writeRenderer } = await ff();
    const work = tmp('vs-ff-marker-');
    fs.mkdirSync(path.join(work, 'ff', 'src'), { recursive: true });
    fs.writeFileSync(path.join(work, 'ff', 'src', 'main.rs'), '');
    fs.writeFileSync(path.join(work, 'scenes.js'), '');
    const ready = () => true;
    writeRenderer(work, 'fframes');
    expect(rendererFor(work, { ready: () => false })).toBe('fframes');
    writeRenderer(work, 'pending');
    expect(rendererFor(work, { ready })).toBe('fframes');
    expect(rendererFor(work, { ready: () => false })).toBe('playwright');
    writeRenderer(work, 'playwright', 'warm failed');
    expect(rendererFor(work, { ready })).toBe('playwright');
    fs.rmSync(path.join(work, 'renderer.json'));
    expect(rendererFor(work, { ready: () => false })).toBe('playwright');
  });

  it('documents the cache layout, the 14-day prune, the reset, and the unchecksummed downloads', () => {
    const REF = flat(read('references', 'fframes.md'));
    expect(REF).toContain('rm -rf ~/.cache/vs/fframes');
    expect(REF).toMatch(/14 days/);
    expect(REF).toMatch(/about 50 MB per video binary/);
    expect(REF).toMatch(/github\.com\/dmtrKovalenko\/rust-ffmpeg-sys\/releases/);
    expect(REF).toMatch(/release\/<version>. branch, which is not pinned/);
    expect(REF).toMatch(/CLIP-UNPREPARED/);
  });
});

describe('fframes.mjs doctor', () => {
  it('falls back to Playwright loudly when there is no Rust', () => {
    const { status, stderr, report } = doctor({ VS_FF_CARGO: '/nonexistent/cargo' });
    expect(status).toBe(2);
    expect(report.ok).toBe(false);
    expect(report.renderer).toBe('playwright');
    expect(report.warmable).toBe(false);
    expect(report.backend).toBe('skia-cpu');
    expect(report.problems.join(' ')).toMatch(/no Rust toolchain/);
    expect(report.next).toMatch(/^FALLBACK: .*Playwright renderer \(render\.mjs, scenes\.js\).*handoff/);
    expect(stderr).toMatch(/\*\*\* FALLBACK: fframes is not available/);
  });

  it('refuses a Rust older than 1.88', () => {
    const { status, report, stderr } = doctor({ VS_FF_CARGO: fakeRust('1.85.0') });
    expect(status).toBe(2);
    expect(report.rust).toBe('1.85.0');
    expect(report.problems.join(' ')).toMatch(/older than 1\.88\.0/);
    expect(report.renderer).toBe('playwright');
    expect(stderr).toMatch(/FALLBACK/);
  });

  it('names a rustup proxy that answers with no version instead of calling it old', () => {
    const bin = tmp('vs-ff-rust-');
    for (const tool of ['cargo', 'rustc']) fs.writeFileSync(path.join(bin, tool), '#!/bin/sh\necho "error: rustup could not choose a version of rustc to run" >&2\nexit 1\n', { mode: 0o755 });
    const { status, report, stderr } = doctor({ VS_FF_CARGO: path.join(bin, 'cargo') });
    expect(status).toBe(2);
    expect(report.problems.join(' ')).toMatch(/gave no version \(error: rustup could not choose/);
    expect(report.problems.join(' ')).not.toMatch(/older than/);
    expect(report.next).toMatch(/RUSTUP_HOME/);
    expect(stderr).toMatch(/FALLBACK/);
  });

  it('with a new enough Rust and an empty cache, says to warm it (no silent fallback)', () => {
    const { status, report, stderr } = doctor({ VS_FF_CARGO: fakeRust('1.90.0') });
    expect(status).toBe(2);
    expect(report.rust).toBe('1.90.0');
    expect(report.problems.join(' ')).not.toMatch(/Rust/);
    if (report.warmable) {
      // Only the shared cache is missing: one --warm, no system installs.
      expect(report.problems).toEqual([expect.stringMatching(/shared fframes build is not ready/)]);
      expect(report.next).toMatch(/doctor --warm/);
      expect(stderr).not.toMatch(/FALLBACK/);
    } else {
      // This machine also lacks ffmpeg or dev libraries: then it is a loud fallback.
      expect(stderr).toMatch(/FALLBACK/);
    }
  });
});

describe('preflight picks the renderer', () => {
  it('asks the doctor in-process (a sandbox can drop a child node\'s piped stdout)', () => {
    const src = read('scripts', 'preflight.mjs');
    expect(src).toMatch(/import \{ doctor as ffDoctor \} from '\.\/fframes\.mjs'/);
    expect(src).not.toMatch(/fframes\.mjs'\), 'doctor'\]/);
  });

  it('doctor checks libclang (bindgen) and names the install on each OS', () => {
    const src = read('scripts', 'fframes.mjs');
    expect(src).toMatch(/libclang missing/);
    expect(src).toMatch(/sudo apt-get install -y libclang-dev/);
    expect(src).toMatch(/xcode-select --install/);
    expect(src).toMatch(/LIBCLANG_PATH/);
    expect(src).toMatch(/\['x264', '\/usr\/include\/x264\.h', 'libx264-dev'\]/);
  });

  it('reports playwright with a FALLBACK warning when fframes cannot run', () => {
    const home = tmp('vs-ff-pre-');
    const res = spawnSync(process.execPath, [script('preflight.mjs')], {
      encoding: 'utf8',
      cwd: tmpdir(),
      env: { PATH: process.env.PATH ?? '', HOME: home, VS_FF_CACHE: path.join(home, 'c'), VS_FF_CARGO: '/nonexistent/cargo', VS_EXPLAIN_VIDEO_NO_INSTALL: '1' },
    });
    expect([0, 2]).toContain(res.status);
    const report = JSON.parse(res.stdout);
    expect(report.renderer).toBe('playwright');
    expect(report.fframes.ok).toBe(false);
    expect(report.warning).toMatch(/^FALLBACK: fframes is not available/);
    expect(res.stderr).toMatch(/\*\*\* FALLBACK/);
    if (!report.tools.playwright) expect(report.missing.map((m: { tool: string }) => m.tool)).toContain('playwright');
  });

  // Needs ffmpeg and the dev libraries: without them the doctor falls back (covered above).
  it.skipIf(!WARMABLE)('reports fframes when only the shared cache is missing (skipped without ffmpeg or the fframes dev libraries)', () => {
    const home = tmp('vs-ff-pre-');
    const res = spawnSync(process.execPath, [script('preflight.mjs')], {
      encoding: 'utf8',
      cwd: tmpdir(),
      env: { PATH: process.env.PATH ?? '', HOME: home, VS_FF_CACHE: path.join(home, 'c'), VS_FF_CARGO: fakeRust('1.90.0'), VS_EXPLAIN_VIDEO_NO_INSTALL: '1' },
    });
    const report = JSON.parse(res.stdout);
    expect(report.fframes.warmable).toBe(true);
    expect(report.renderer).toBe('fframes');
    expect(report.warning).toBeUndefined();
    expect(report.fframes.next).toMatch(/doctor --warm/);
    // fframes draws the frames: a machine without Playwright is not blocked.
    expect(report.missing.map((m: { tool: string }) => m.tool)).not.toContain('playwright');
  });
});

describe('fframes.mjs init', () => {
  it('writes a per-video crate from the template with a scene arm per script scene', () => {
    const work = tmp('vs-ff-init-');
    fs.copyFileSync(path.join(DIR, 'assets', 'script.example.json'), path.join(work, 'script.json'));
    const res = spawnSync(process.execPath, [script('fframes.mjs'), 'init', work], { encoding: 'utf8', env: { ...process.env, VS_FF_CACHE: tmp('vs-ff-c-') } });
    expect(res.status, res.stderr + res.stdout).toBe(0);
    const cargo = fs.readFileSync(path.join(work, 'ff', 'Cargo.toml'), 'utf8');
    expect(cargo).not.toMatch(/@BIN@|@KIT@/);
    expect(cargo).toMatch(/name = "vs-video-[a-z0-9-]+-[0-9a-f]{6}"/);
    expect(fs.existsSync(path.join(work, 'ff', 'Cargo.lock'))).toBe(true);
    const main = fs.readFileSync(path.join(work, 'ff', 'src', 'main.rs'), 'utf8');
    for (const id of ['"intro"', '"miss"', '"fix"']) expect(main).toContain(id);
    expect(main).toMatch(/const HOLDS: &\[&str\] = &\[\];/);
    expect(['fframes', 'pending', 'playwright']).toContain(JSON.parse(fs.readFileSync(path.join(work, 'renderer.json'), 'utf8')).renderer);
    // A second init keeps the scenes already written.
    fs.writeFileSync(path.join(work, 'ff', 'src', 'main.rs'), '// mine');
    spawnSync(process.execPath, [script('fframes.mjs'), 'init', work], { encoding: 'utf8' });
    expect(fs.readFileSync(path.join(work, 'ff', 'src', 'main.rs'), 'utf8')).toBe('// mine');
  });
});

describe('the explain-video skill defaults to fframes', () => {
  const SKILL = flat(read('SKILL.md'));
  const REF = flat(read('references', 'fframes.md'));
  it('names fframes the default and the fallback as loud, never silent', () => {
    expect(SKILL).toMatch(/fframes\.mjs init "\$WORK"/);
    expect(SKILL).toMatch(/fframes\.mjs check/);
    expect(SKILL).toMatch(/fframes\.mjs render/);
    expect(SKILL).toMatch(/doctor --warm/);
    expect(SKILL).toMatch(/FALLBACK/);
    expect(SKILL).toMatch(/Never switch renderers silently/);
    expect(SKILL).toContain('references/fframes.md');
  });
  it('keeps the narration engine as it was', () => {
    expect(SKILL).toMatch(/kokoro/i);
    expect(SKILL).toMatch(/ElevenLabs/);
  });
  it('documents the kit for scene authors', () => {
    for (const helper of ['s.words(', 's.info_card(', 's.row(', 's.chip(', 's.still(', 's.clip(', 's.terminal(', 's.allow_overlap()', 'HOLDS', 'S::own('])
      expect(REF).toContain(helper);
    expect(REF).toMatch(/FALLBACK/);
    expect(REF).toMatch(/brew install/);
  });
});
