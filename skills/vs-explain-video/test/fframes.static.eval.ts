import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
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
const doctor = (env: Record<string, string>) => {
  const home = tmp('vs-ff-home-');
  const res = spawnSync(process.execPath, [script('fframes.mjs'), 'doctor'], {
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
  });

  it('keeps only fframes diagnostics worth a fix', async () => {
    const { frameDiagnostics } = await ffkit();
    const found = frameDiagnostics([{ seconds: 1, diagnostics: [{ severity: 'info', kind: 'text_off_canvas' }, { severity: 'warning', kind: 'text_overflow', text: 'Long' }] }]);
    expect(found).toEqual([expect.objectContaining({ kind: 'text_overflow', block: 'Long', seconds: 1 })]);
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

  it('prunes old kits on warm and keeps the newest kit build', () => {
    const src = read('scripts', 'fframes.mjs');
    expect(src).toMatch(/pruned: prune\(kit\)/);
    expect(src).toMatch(/\^kit-\[0-9a-f\]\+\$/);
    expect(src).toMatch(/sort\(\(a, b\) => b\[1\]\.newest - a\[1\]\.newest\)/);
  });

  it('tells a sandboxed build to ask for write access, not to fall back', () => {
    const src = read('scripts', 'fframes.mjs');
    expect(src).toMatch(/sandboxed: ?true/);
    expect(src).toMatch(/Do not fall back for this/);
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

  it('reports fframes when only the shared cache is missing', () => {
    const home = tmp('vs-ff-pre-');
    const res = spawnSync(process.execPath, [script('preflight.mjs')], {
      encoding: 'utf8',
      cwd: tmpdir(),
      env: { PATH: process.env.PATH ?? '', HOME: home, VS_FF_CACHE: path.join(home, 'c'), VS_FF_CARGO: fakeRust('1.90.0'), VS_EXPLAIN_VIDEO_NO_INSTALL: '1' },
    });
    const report = JSON.parse(res.stdout);
    if (!report.fframes.warmable) return; // no ffmpeg or dev libraries here: covered above
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
