import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as vm from 'node:vm';
import { describe, expect, it } from 'vitest';

// Static evals for the narration ear substitutes (audio.mjs: word check and
// loudness), the springs and the no-linear rule (motion.js), and the parallel
// render (pieces.mjs + render.mjs --workers). `problems()` reads the shipped
// text and every mutant must break a rule; the behaviour suites feed fixtures
// to the pure helpers and run each rule mutant through the same probes. Runs
// that need ffmpeg or a browser skip when the tool is not there.

const DIR = path.resolve(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(DIR, ...p), 'utf8');
const script = (name: string) => path.join(DIR, 'scripts', name);
const tmp = (prefix: string) => fs.mkdtempSync(path.join(tmpdir(), prefix));

type Files = { skill: string; craft: string; motion: string; example: string; narrate: string; audio: string; render: string; pieces: string };
const SHIPPED: Files = {
  skill: read('SKILL.md'),
  craft: read('references', 'motion-craft.md'),
  motion: read('assets', 'motion.js'),
  example: read('assets', 'scenes.example.js'),
  narrate: read('scripts', 'narrate.mjs'),
  audio: read('scripts', 'audio.mjs'),
  render: read('scripts', 'render.mjs'),
  pieces: read('scripts', 'pieces.mjs'),
};

function problems(f: Files): string[] {
  const out: string[] = [];
  const need = (ok: boolean, name: string) => { if (!ok) out.push(name); };
  // #4 word check and loudness.
  need(/With\s+whisper installed, it transcribes each beat/.test(f.skill), 'skill: word check');
  need(/rewrite it or add a `pronounce` entry, and rerun/.test(f.skill), 'skill: fix a flagged beat');
  need(/Without whisper it\s+says the words were not checked; report that/.test(f.skill), 'skill: report a skipped check');
  need(/levels the track to -16 LUFS/.test(f.skill), 'skill: loudness');
  need(/from '\.\/audio\.mjs'/.test(f.narrate) && /'--no-word-check'/.test(f.narrate), 'narrate: uses audio.mjs');
  need(/const result = checkBeat\(text, spoken\(text\), heard\)/.test(f.narrate), 'narrate: checks every beat');
  need(/narration-check\.json/.test(f.narrate), 'narrate: writes narration-check.json');
  need(/final = measureLoudness\(wav\)/.test(f.narrate), 'narrate: measures again after leveling');
  need(/wordCheck\.flagged\?\.length\s+\? `The voice did not say/.test(f.narrate), 'narrate: next names flagged beats');
  need(/LOUDNESS = \{ target: -16, tolerance: 2, maxPeak: -1 \}/.test(f.audio), 'audio: -16 LUFS ±2, -1 dBTP');
  need(/ebur128=peak=true/.test(f.audio), 'audio: ffmpeg meter');
  need(/const forms = \[wordDiff\(said, heard\), wordDiff\(written, heard\)\]/.test(f.audio), 'audio: spoken and written forms');
  need(/so the words were not checked/.test(f.audio), 'audio: skip note');
  // #5 springs, reads, no linear motion.
  need(/never move anything linearly/.test(f.skill) && /`readTime\(text\)`/.test(f.skill), 'skill: springs and reads');
  need((f.motion.match(/ease\.linear/g) ?? []).length === 0, 'motion: a helper eases linearly');
  need(!/ease\.linear/.test(f.example), 'example: eases linearly');
  need(/snappy: \{ k: 320, c: 30 \}/.test(f.motion) && /camera: \{ k: 170, c: 26 \}/.test(f.motion) && /heavy: \{ k: 120, c: 24 \}/.test(f.motion) && /playful: \{ k: 180, c: 12 \}/.test(f.motion), 'motion: spring presets');
  need(/: spring\(t, s, sp \?\? \(d >= 0\.75 \? 'heavy'/.test(f.motion), 'motion: rise springs by default');
  need(/function pop\(e, t, s, preset = 'playful'\) \{\s+const k = spring\(/.test(f.motion), 'motion: pop springs');
  need(!/Date\.now\(|Math\.random\(|performance\.now\(/.test(f.motion), 'motion: wall clock');
  need(/## Springs, never linear/.test(f.craft) && /Fast moves, slow meanings/.test(f.craft), 'craft: springs and reads');
  // #6 parallel render.
  need(/--workers N/.test(f.render) && /planPieces\(frames, workersArg \? Number\(workersArg\) : defaultWorkers\(cpus\(\)\.length\)\)/.test(f.render), 'render: plans pieces');
  need(/Promise\.all\(pieces\.map\(renderPiece\)\)/.test(f.render), 'render: pieces in parallel');
  need(/'-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy'/.test(f.render), 'render: joins without re-encoding');
  need(/frameParity\(pieces, files\.map\(countFrames\), countFrames\(joined\)\)/.test(f.render), 'render: frame parity');
  need(/exitCode = durationMatches && parity\.ok \? 0 : 1/.test(f.render), 'render: exit 1 on a frame mismatch');
  need(/Math\.max\(1, Math\.min\(3, Math\.floor\(cpus \/ 2\)\)\)/.test(f.pieces), 'pieces: at most 3 workers');
  return out;
}

const swap = (key: keyof Files, from: string | RegExp, to: string) => (f: Files): Files => ({ ...f, [key]: f[key].replace(from, to) });
const mutants: Record<string, (f: Files) => Files> = {
  'skill drops the word check': swap('skill', /With\s+whisper installed, it transcribes each beat/, 'It may transcribe'),
  'skill hides a skipped check': swap('skill', /Without whisper it\s+says the words were not checked; report that\./, ''),
  'skill drops loudness': swap('skill', 'It levels the track to -16 LUFS.', ''),
  'narrate never checks words': swap('narrate', 'const result = checkBeat(text, spoken(text), heard);', 'const result = { ok: true };'),
  'narrate no record file': swap('narrate', /narration-check\.json/g, 'narration.json'),
  'narrate trusts the first meter': swap('narrate', 'final = measureLoudness(wav);', 'final = measured;'),
  'narrate hides flagged beats': swap('narrate', /wordCheck\.flagged\?\.length\s+\? `The voice did not say/, 'false ? `The voice did not say'),
  'audio target -23': swap('audio', 'target: -16,', 'target: -23,'),
  'audio peak ceiling 0': swap('audio', 'maxPeak: -1 }', 'maxPeak: 0 }'),
  'audio written form only': swap('audio', 'const forms = [wordDiff(said, heard), wordDiff(written, heard)];', 'const forms = [wordDiff(written, heard)];'),
  'audio silent skip': swap('audio', 'so the words were not checked', 'so'),
  'skill allows linear motion': swap('skill', 'never move anything linearly', 'move as you like'),
  'motion fade-out linear': swap('motion', 'P(t, s.dur - 0.4, 0.4, ease.inOut)', 'P(t, s.dur - 0.4, 0.4, ease.linear)'),
  'motion hide linear': swap('motion', 'const k = P(t, s, d, ease.inOut);\n  e.style.opacity = (e._o ?? 1) * (1 - k);', 'const k = P(t, s, d, ease.linear);\n  e.style.opacity = (e._o ?? 1) * (1 - k);'),
  'example linear move': swap('example', 'P(t, B[1], 0.7)', 'P(t, B[1], 0.7, ease.linear)'),
  'motion playful stiff': swap('motion', 'playful: { k: 180, c: 12 }', 'playful: { k: 180, c: 30 }'),
  'motion rise eased': swap('motion', ": spring(t, s, sp ?? (d >= 0.75 ? 'heavy'", ": ease.out(clamp((t - s) / d)) ?? (d >= 0.75 ? 'heavy'"),
  'motion pop eased': swap('motion', /function pop\(e, t, s, preset = 'playful'\) \{\s+const k = spring\([^\n]*/, "function pop(e, t, s, preset = 'playful') {\n  const k = P(t, s, 0.55, ease.back);"),
  'motion wall clock': swap('motion', 'const x = t - s;', 'const x = Date.now() / 1000 - s;'),
  'craft drops the rule': swap('craft', '## Springs, never linear', '## Springs'),
  'render serial only': swap('render', 'Promise.all(pieces.map(renderPiece))', 'Promise.all(pieces.slice(0, 1).map(renderPiece))'),
  'render re-encodes the join': swap('render', "'-i', list, '-c', 'copy'", "'-i', list, '-c:v', 'libx264'"),
  'render skips parity': swap('render', 'exitCode = durationMatches && parity.ok ? 0 : 1', 'exitCode = durationMatches ? 0 : 1'),
  'render ignores --workers': swap('render', 'planPieces(frames, workersArg ? Number(workersArg) : defaultWorkers(cpus().length))', 'planPieces(frames, 1)'),
  'pieces 8 workers': swap('pieces', 'Math.min(3, Math.floor(cpus / 2))', 'Math.min(8, cpus)'),
};

describe('explain-video audio, motion, speed: contract', () => {
  it('shipped files break no rule', () => {
    expect(problems(SHIPPED)).toEqual([]);
  });
  it.each(Object.entries(mutants))('mutant "%s" is caught', (_name, mutate) => {
    const mutated = mutate(SHIPPED);
    expect(JSON.stringify(mutated)).not.toBe(JSON.stringify(SHIPPED));
    expect(problems(mutated).length).toBeGreaterThan(0);
  });
  it('keeps SKILL.md under 200 lines and copies no Apache-2.0 file', () => {
    expect(SHIPPED.skill.split('\n').length).toBeLessThan(200);
    for (const src of [SHIPPED.audio, SHIPPED.pieces, SHIPPED.motion]) expect(src).toMatch(/take-one/);
    for (const src of Object.values(SHIPPED)) expect(src).not.toMatch(/anidoodle|Apache License/);
  });
});

// ---------- pure helpers through fixtures, and rule mutants through the same probes
type Audio = typeof import('../scripts/audio.mjs');
type Pieces = typeof import('../scripts/pieces.mjs');
type Motion = {
  spring: (t: number, s: number, p?: string) => number;
  springTo: (t: number, keys: Array<[number, number]>, p?: string) => number;
  settle: (p?: string) => number;
  readTime: (text: string) => number;
};
type Mods = { audio: Audio; pieces: Pieces; motion: Motion };
const loadModule = async (name: string, src: string) => {
  const dir = tmp('vs-ams-mutant-');
  fs.copyFileSync(script('media.mjs'), path.join(dir, 'media.mjs'));
  fs.writeFileSync(path.join(dir, name), src);
  return import(pathToFileURL(path.join(dir, name)).href);
};
const loadMotion = (src: string): Motion => vm.runInNewContext(`${src};({ spring, springTo, settle, readTime })`, {});
const load = async (over: Partial<Pick<Files, 'audio' | 'pieces' | 'motion'>> = {}): Promise<Mods> => ({
  audio: await loadModule('audio.mjs', over.audio ?? SHIPPED.audio),
  pieces: await loadModule('pieces.mjs', over.pieces ?? SHIPPED.pieces),
  motion: loadMotion(over.motion ?? SHIPPED.motion),
});

const EBUR = `[Parsed_ebur128_0 @ 0x1] t: 1.9   TARGET:-23 LUFS    M: -29.0 S:-120.7     I: -30.4 LUFS       LRA:   0.0 LU  FTPK: -25.0 dBFS  TPK: -25.0 dBFS
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -21.8 LUFS
    Threshold: -31.8 LUFS

  Loudness range:
    LRA:         0.0 LU

  True peak:
    Peak:      -18.1 dBFS
`;
const peakOf = (m: Motion, p: string) => {
  let max = 0;
  for (let x = 0; x < 3; x += 0.001) max = Math.max(max, m.spring(x, 0, p));
  return max;
};

const probes: Record<string, (m: Mods) => boolean> = {
  'words: an exact transcript passes': (m) => m.audio.checkBeat('The fix drops the timestamp.', 'The fix drops the timestamp.', 'the fix drops the timestamp').ok,
  'words: a lost word is missing': (m) => JSON.stringify(m.audio.checkBeat('The search hits the cache.', 'The search hits the cache.', 'The search hits the.')) === '{"ok":false,"missing":["cache"],"extra":[]}',
  'words: a changed word is missing and extra': (m) => {
    const r = m.audio.checkBeat('a search for nile', 'a search for nile', 'a search for NIL');
    return !r.ok && r.missing.join() === 'nile' && r.extra.join() === 'nil';
  },
  'words: the spoken form counts (pronounce)': (m) => m.audio.checkBeat('AICM installs it.', 'A I C M installs it.', 'A.I.C.M. installs it.').ok,
  'words: letters said one by one match the acronym': (m) => m.audio.checkBeat('The AICM tool', 'The AICM tool', 'The A I C M tool').ok,
  'words: the written form counts': (m) => m.audio.checkBeat('The CDN caches it.', 'The C D N caches it.', 'The CDN caches it.').ok,
  'words: numbers said in words match digits': (m) => m.audio.checkBeat('from eight hundred forty milliseconds to twelve', 'from eight hundred forty milliseconds to twelve', 'From 840 milliseconds to 12.').ok,
  'words: big numbers': (m) => m.audio.normalizeWords('two thousand and twenty six').join() === '2026',
  'loudness: parses the summary, not the live lines': (m) => JSON.stringify(m.audio.parseEbur128(EBUR)) === '{"lufs":-21.8,"truePeak":-18.1}',
  'loudness: in range needs nothing': (m) => m.audio.levelFilter({ lufs: -16.5, truePeak: -2 }) === null && m.audio.loudnessVerdict({ lufs: -16.5, truePeak: -2 }) === 'ok',
  'loudness: quiet speech is leveled': (m) => m.audio.levelFilter({ lufs: -22.6, truePeak: -0.9 }) === 'loudnorm=I=-16:TP=-1.5:LRA=11',
  'loudness: a hot peak is leveled': (m) => m.audio.levelFilter({ lufs: -16, truePeak: -0.2 }) !== null && /true peak/.test(m.audio.loudnessVerdict({ lufs: -16, truePeak: -0.2 })),
  'loudness: unmeasured says so': (m) => m.audio.levelFilter({ lufs: null, truePeak: null }) === null && /not measured/.test(m.audio.loudnessVerdict({ lufs: null, truePeak: null })),
  'springs: 0 before the start, 1 at rest': (m) => m.motion.spring(0.9, 1) === 0 && Math.abs(1 - m.motion.spring(4, 0, 'heavy')) < 1e-3,
  'springs: the same t gives the same value in any order': (m) => {
    const ts = [2, 0.3, 1.1, 0.3, 2];
    const vs = ts.map((t) => m.motion.spring(t, 0, 'playful'));
    return vs[1] === vs[3] && vs[0] === vs[4];
  },
  'springs: snappy barely overshoots': (m) => peakOf(m.motion, 'snappy') < 1.02,
  'springs: playful overshoots 15-25%': (m) => peakOf(m.motion, 'playful') > 1.15 && peakOf(m.motion, 'playful') < 1.25,
  'springs: heavy never overshoots': (m) => peakOf(m.motion, 'heavy') <= 1.0001,
  'springs: settle times by weight': (m) => m.motion.settle('snappy') < m.motion.settle('camera') && m.motion.settle('camera') < m.motion.settle('heavy') && m.motion.settle('heavy') < 1,
  'springs: a retarget keeps the value continuous': (m) => {
    const keys: Array<[number, number]> = [[0, 0], [0.2, 400], [0.5, 150]];
    const before = m.motion.springTo(0.4999, keys);
    const after = m.motion.springTo(0.5001, keys);
    return Math.abs(before - after) < 1 && Math.abs(m.motion.springTo(5, keys) - 150) < 0.5;
  },
  'reads: 0.4 s + 0.2 s a word': (m) => Math.abs(m.motion.readTime('six words on this card here') - 1.6) < 1e-9,
  'pieces: every frame once, in order, balanced': (m) => {
    const plan = m.pieces.planPieces(1001, 3);
    return JSON.stringify(plan) === '[{"index":0,"first":0,"count":334},{"index":1,"first":334,"count":334},{"index":2,"first":668,"count":333}]';
  },
  'pieces: never more pieces than frames, never fewer than one': (m) => m.pieces.planPieces(2, 5).length === 2 && m.pieces.planPieces(90, 0).length === 1,
  'pieces: half the cores, at most 3': (m) => [1, 2, 4, 8, 64].map((c) => m.pieces.defaultWorkers(c)).join() === '1,1,2,3,3',
  'parity: matching counts pass': (m) => m.pieces.frameParity(m.pieces.planPieces(90, 3), [30, 30, 30], 90).ok,
  'parity: a short piece fails': (m) => {
    const r = m.pieces.frameParity(m.pieces.planPieces(90, 3), [30, 29, 30], 89);
    return !r.ok && r.problems.length === 2;
  },
};
const ruleMutants: Record<string, ['audio' | 'pieces' | 'motion', string, string]> = {
  'diff ignores extra words': ['audio', '  extra.push(...b.slice(j));', ''],
  'spelled letters not joined': ['audio', 'if (w.length === 1 && /\\p{L}/u.test(w) && last?.spelled) last.text += w;', 'if (false) last.text += w;'],
  'numbers not joined': ['audio', 'for (const w of joinNumbers(raw)) {', 'for (const w of raw) {'],
  'hundreds added, not multiplied': ['audio', 'if (SCALE[word] === 100) current *= 100;', 'if (SCALE[word] === 100) current += 100;'],
  'live line parsed': ['audio', "const summary = stderr.slice(stderr.lastIndexOf('Summary:'));", 'const summary = stderr;'],
  'peak ignored': ['audio', ' && truePeak <= LOUDNESS.maxPeak;\n  return inRange', ';\n  return inRange'],
  'no tolerance': ['audio', 'tolerance: 2,', 'tolerance: 0,'],
  'spring underdamped sign': ['motion', 'return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));', 'return 1 - Math.exp(-z * w * x) * Math.cos(wd * x);'],
  'spring starts early': ['motion', 'if (x <= 0) return 0;', 'if (x < -1) return 0;'],
  'springTo restarts': ['motion', 'v += (keys[i][1] - keys[i - 1][1]) * spring(t, keys[i][0], preset);', 'if (t >= keys[i][0]) v = keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * spring(t, keys[i][0], preset);'],
  'reads 0.3 a word': ['motion', 'const readTime = (text) => 0.4 + 0.2 *', 'const readTime = (text) => 0.4 + 0.3 *'],
  'heavy is bouncy': ['motion', 'heavy: { k: 120, c: 24 }', 'heavy: { k: 120, c: 14 }'],
  'pieces drop the remainder': ['pieces', 'const count = base + (index < extra ? 1 : 0);', 'const count = base;'],
  'pieces overlap': ['pieces', '    first += count;\n', '    first += count - 1;\n'],
  'parity ignores the join': ['pieces', '  if (joined !== total) problems.push', '  if (false) problems.push'],
  'workers unbounded': ['pieces', 'Math.max(1, Math.min(3, Math.floor(cpus / 2)))', 'Math.max(1, cpus)'],
};

describe('explain-video audio, motion, speed: helpers on fixtures', () => {
  it.each(Object.entries(probes))('%s', async (_name, probe) => {
    expect(probe(await load())).toBe(true);
  });
  it.each(Object.entries(ruleMutants))('rule mutant "%s" fails a probe', async (_name, [file, from, to]) => {
    const src = SHIPPED[file].replace(from, to);
    expect(src).not.toBe(SHIPPED[file]);
    const m = await load({ [file]: src });
    const broken = Object.values(probes).filter((probe) => {
      try {
        return !probe(m);
      } catch {
        return true;
      }
    });
    expect(broken.length).toBeGreaterThan(0);
  });
});

// ---------- end to end
const which = (name: string) => spawnSync('/bin/sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).stdout.trim();
const FFMPEG = which('ffmpeg');
const hasFfmpeg = Boolean(FFMPEG && which('ffprobe'));

// A stub piper (a short tone per beat) and, optionally, a stub whisper-cli that
// answers from a list, one line per call, in beat order.
function narrateWork(heard: string[] | null) {
  const dir = tmp('vs-ams-narrate-');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'piper'), `#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = "--output_file" ] && out=$2; shift; done\ncat >/dev/null\nexec "${FFMPEG}" -v error -y -f lavfi -i "sine=f=220:d=1.4" -af "volume=-30dB" "$out"\n`, { mode: 0o755 });
  const env: NodeJS.ProcessEnv = { PATH: `${bin}:${path.dirname(FFMPEG)}:/usr/bin:/bin`, HOME: dir };
  if (heard) {
    fs.writeFileSync(path.join(dir, 'heard.json'), JSON.stringify(heard));
    fs.writeFileSync(path.join(dir, 'model.bin'), '');
    fs.writeFileSync(path.join(bin, 'whisper-cli'), `#!/bin/sh\nexec "${process.execPath}" "$0.cjs" "$@"\n`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'whisper-cli.cjs'), `const fs = require('node:fs');
const args = process.argv.slice(2);
const list = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(dir, 'heard.json'))}, 'utf8'));
const n = Number(fs.existsSync(${JSON.stringify(path.join(dir, 'n'))}) ? fs.readFileSync(${JSON.stringify(path.join(dir, 'n'))}, 'utf8') : 0);
fs.writeFileSync(${JSON.stringify(path.join(dir, 'n'))}, String(n + 1));
fs.writeFileSync(args[args.indexOf('-of') + 1] + '.txt', list[n] + '\\n');
`);
    env.VS_WHISPER_MODEL = path.join(dir, 'model.bin');
  }
  const work = path.join(dir, 'work');
  fs.mkdirSync(work);
  fs.writeFileSync(path.join(work, 'script.json'), JSON.stringify({
    scenes: [{ id: 'fix', beats: ['The fix drops the timestamp.', 'The search hits the cache.'] }],
  }));
  const out = spawnSync(process.execPath, [script('narrate.mjs'), path.join(work, 'script.json'), '--engine', 'piper'], { encoding: 'utf8', env });
  return { out, work };
}

describe.skipIf(!hasFfmpeg)('explain-video narrate ear substitutes', () => {
  it('flags the beat whose words the transcript lost, and levels the track', () => {
    const { out, work } = narrateWork(['The fix drops the timestamp.', 'The search hits cash.']);
    expect(out.status, out.stderr).toBe(0);
    const report = JSON.parse(out.stdout);
    expect(report.words.status).toBe('checked');
    expect(report.words.flagged).toEqual([
      { scene: 'fix', beat: 1, text: 'The search hits the cache.', heard: 'The search hits cash.', missing: ['the', 'cache'], extra: ['cash'] },
    ]);
    expect(report.next).toMatch(/did not say 1 beat/);
    expect(report.loudness.leveled).toBe(true);
    expect(Math.abs(report.loudness.final.lufs + 16)).toBeLessThanOrEqual(2);
    expect(report.loudness.final.truePeak).toBeLessThanOrEqual(-1);
    const saved = JSON.parse(fs.readFileSync(path.join(work, 'narration-check.json'), 'utf8'));
    expect(saved.words.flagged).toHaveLength(1);
  }, 60_000);

  it('skips the word check with a note when no whisper is installed', () => {
    const { out } = narrateWork(null);
    expect(out.status, out.stderr).toBe(0);
    const report = JSON.parse(out.stdout);
    expect(report.words).toEqual({ status: 'skipped', note: expect.stringMatching(/the words were not checked/) });
    expect(report.next).toMatch(/render\.mjs --stills/);
  }, 60_000);
});

const resolved = spawnSync(process.execPath, ['-e', `import(${JSON.stringify(pathToFileURL(script('media.mjs')).href)}).then((m) => process.stdout.write(String(m.resolvePlaywright([]))))`], { encoding: 'utf8' }).stdout.trim();
const hasChrome = Boolean(which('google-chrome') || which('chromium')) || fs.existsSync('/Applications/Google Chrome.app');
const canBrowse = resolved !== 'null' && resolved !== '' && hasFfmpeg && hasChrome;

describe.skipIf(!canBrowse)('explain-video render --workers', () => {
  it('renders the same frames in 1 piece and in 3, and counts them', () => {
    const home = tmp('vs-ams-render-');
    const fonts = path.join(home, '.cache', 'vs-explain-video', 'fonts');
    fs.mkdirSync(fonts, { recursive: true });
    for (const f of ['SpaceGrotesk.ttf', 'JetBrainsMono.ttf']) fs.writeFileSync(path.join(fonts, f), '');
    const work = path.join(home, 'work');
    expect(spawnSync(process.execPath, [script('init.mjs'), work], { env: { ...process.env, HOME: home } }).status).toBe(0);
    fs.writeFileSync(path.join(work, 'scenes.js'), `scene('a', (R) => {
  const b = box(R, 160, 300, 600, 200, 'card pad', 'one card');
  return (t) => { rise(b, t, 0.2, { dx: 400, dy: 0 }); };
});`);
    fs.writeFileSync(path.join(work, 'timeline.js'), `window.TL = ${JSON.stringify({ fps: 30, total: 3, scenes: [{ id: 'a', title: 'a', start: 0, dur: 3, beats: [{ t: 0.2, d: 2, text: 'one card' }] }], subs: [[0.2, 2.2, 'one card']] })};\n`);
    expect(spawnSync(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '3', path.join(work, 'narration.wav')]).status).toBe(0);
    const render = (workers: number) => {
      const out = spawnSync(process.execPath, [script('render.mjs'), work, '--out', path.join(work, `w${workers}.mp4`), '--workers', String(workers)], { encoding: 'utf8', env: { ...process.env, VS_EXPLAIN_VIDEO_NO_INSTALL: '1' }, timeout: 180_000 });
      expect(out.status, out.stderr).toBe(0);
      return JSON.parse(out.stdout);
    };
    const one = render(1);
    const three = render(3);
    expect(one).toMatchObject({ workers: 1, frames: 90, framesMatch: true, frameProblems: [], durationMatches: true });
    expect(three).toMatchObject({ workers: 3, frames: 90, framesMatch: true, frameProblems: [], durationMatches: true });
    const psnr = spawnSync(FFMPEG, ['-i', path.join(work, 'w1.mp4'), '-i', path.join(work, 'w3.mp4'), '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
    const db = /average:(inf|[\d.]+)/.exec(psnr.stderr)?.[1];
    expect(db === 'inf' || Number(db) > 40, `psnr ${db}`).toBe(true);
  }, 240_000);
});
