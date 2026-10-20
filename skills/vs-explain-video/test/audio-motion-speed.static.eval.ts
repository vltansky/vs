import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as vm from 'node:vm';
import { afterAll, describe, expect, it } from 'vitest';

// Static evals for the narration ear substitutes (audio.mjs: word check and
// loudness), the springs and the no-linear rule (motion.js), and the parallel
// render (pieces.mjs + render.mjs --workers). `problems()` reads the docs and
// the wiring CI cannot run (narrate and render need ffmpeg or a browser);
// every rule a pure helper owns is tested by behaviour: fixtures through
// audio.mjs, pieces.mjs, and motion.js, with each rule mutant run through the
// same probes. Runs that need ffmpeg or a browser skip when the tool is not there.

const DIR = path.resolve(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(DIR, ...p), 'utf8');
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
  need(/With\s+whisper\s+installed,\s+it transcribes each beat/.test(f.skill), 'skill: word check');
  need(/report it in\s+the handoff and do not narrate again/.test(f.skill), 'skill: report a flagged beat, no re-narration');
  need(/Without whisper it says the words were not\s+checked; report that/.test(f.skill), 'skill: report a skipped check');
  need(/`--require-word-check` exits 2/.test(f.skill), 'skill: the word check can be required');
  need(/levels the track to -16 LUFS/.test(f.skill), 'skill: loudness');
  need(/from '\.\/audio\.mjs'/.test(f.narrate) && /'--no-word-check'/.test(f.narrate), 'narrate: uses audio.mjs');
  need(/const result = checkBeat\(text, spoken\(text\), heard\)/.test(f.narrate), 'narrate: checks every beat');
  need(/narration-check\.json/.test(f.narrate), 'narrate: writes narration-check.json');
  need(/final = measureLoudness\(wav\)/.test(f.narrate), 'narrate: measures again after leveling');
  need(/wordCheck\.flagged\?\.length\s+\? `The voice did not say/.test(f.narrate), 'narrate: next names flagged beats');
  need(/: unchecked\s+\? `The word check was \$\{wordCheck\.status\}/.test(f.narrate), 'narrate: next names an unchecked run');
  need(/if \(warning\) process\.stderr\.write/.test(f.narrate), 'narrate: prints the warning');
  need(/if \(unchecked && args\.includes\('--require-word-check'\)\) process\.exit\(2\)/.test(f.narrate), 'narrate: --require-word-check exits 2');
  need(/ebur128=peak=true/.test(f.audio), 'audio: ffmpeg meter');
  need(/so the words were not checked/.test(f.audio), 'audio: skip note');
  // #5 springs, reads, no linear motion.
  need(/never move anything linearly/.test(f.skill) && /`readTime\(text\)`/.test(f.skill), 'skill: springs and reads');
  need((f.motion.match(/ease\.linear/g) ?? []).length === 0, 'motion: a helper eases linearly');
  need(!/ease\.linear/.test(f.example), 'example: eases linearly');
  need(!/Date\.now\(|Math\.random\(|performance\.now\(/.test(f.motion), 'motion: wall clock');
  need(/## Springs, never linear/.test(f.craft) && /Fast moves, slow meanings/.test(f.craft), 'craft: springs and reads');
  // #6 parallel render.
  need(/--workers N/.test(f.render) && /planPieces\(frames, workersArg \? Number\(workersArg\) : defaultWorkers\(cpus\(\)\.length\)\)/.test(f.render), 'render: plans pieces');
  need(/Promise\.all\(pieces\.map\(renderPiece\)\)/.test(f.render), 'render: pieces in parallel');
  need(/'-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy'/.test(f.render), 'render: joins without re-encoding');
  need(/frameParity\(pieces, files\.map\(countFrames\), countFrames\(joined\)\)/.test(f.render), 'render: frame parity');
  need(/exitCode = durationMatches && parity\.ok && boundaries\.ok \? 0 : 1/.test(f.render), 'render: exit 1 on a frame or boundary mismatch');
  need(/warmFrames\[piece\.index \+ 1\] = await p\.screenshot/.test(f.render) && /if \(frame === piece\.first\) firstFrames\[piece\.index\] = jpeg/.test(f.render), 'render: draws each boundary frame cold and warm');
  need(/process\.on\('exit', \(\) => rmSync\(scratch/.test(f.render), 'render: cleans up on every exit');
  return out;
}

const swap = (key: keyof Files, from: string | RegExp, to: string) => (f: Files): Files => ({ ...f, [key]: f[key].replace(from, to) });
const mutants: Record<string, (f: Files) => Files> = {
  'skill drops the word check': swap('skill', /With\s+whisper\s+installed,\s+it transcribes each beat/, 'It may transcribe'),
  'skill re-narrates a flagged beat': swap('skill', /report it in\s+the handoff and do not narrate again/, 'rewrite it and rerun'),
  'skill hides a skipped check': swap('skill', /Without whisper it says the words were not\s+checked; report that/, ''),
  'skill drops loudness': swap('skill', 'It levels the track to -16 LUFS.', ''),
  'narrate never checks words': swap('narrate', 'const result = checkBeat(text, spoken(text), heard);', 'const result = { ok: true };'),
  'narrate no record file': swap('narrate', /narration-check\.json/g, 'narration.json'),
  'narrate trusts the first meter': swap('narrate', 'final = measureLoudness(wav);', 'final = measured;'),
  'narrate hides flagged beats': swap('narrate', /wordCheck\.flagged\?\.length\s+\? `The voice did not say/, 'false ? `The voice did not say'),
  'narrate hides an unchecked run': swap('narrate', 'if (warning) process.stderr.write', 'if (false) process.stderr.write'),
  'narrate cannot require the check': swap('narrate', "if (unchecked && args.includes('--require-word-check')) process.exit(2);", ''),
  'skill hides --require-word-check': swap('skill', '(`--require-word-check` exits 2)', ''),
  'audio silent skip': swap('audio', 'so the words were not checked', 'so'),
  'skill allows linear motion': swap('skill', 'never move anything linearly', 'move as you like'),
  'motion fade-out linear': swap('motion', 'P(t, s.dur - 0.4, 0.4, ease.inOut)', 'P(t, s.dur - 0.4, 0.4, ease.linear)'),
  'motion hide linear': swap('motion', 'const k = P(t, s, d, ease.inOut);\n  e.style.opacity = (e._o ?? 1) * (1 - k);', 'const k = P(t, s, d, ease.linear);\n  e.style.opacity = (e._o ?? 1) * (1 - k);'),
  'example linear move': swap('example', 'P(t, B[1], 0.7)', 'P(t, B[1], 0.7, ease.linear)'),
  'motion wall clock': swap('motion', 'const x = t - s;', 'const x = Date.now() / 1000 - s;'),
  'craft drops the rule': swap('craft', '## Springs, never linear', '## Springs'),
  'render serial only': swap('render', 'Promise.all(pieces.map(renderPiece))', 'Promise.all(pieces.slice(0, 1).map(renderPiece))'),
  'render re-encodes the join': swap('render', "'-i', list, '-c', 'copy'", "'-i', list, '-c:v', 'libx264'"),
  'render skips parity': swap('render', 'exitCode = durationMatches && parity.ok && boundaries.ok ? 0 : 1', 'exitCode = durationMatches ? 0 : 1'),
  'render skips the boundaries': swap('render', 'exitCode = durationMatches && parity.ok && boundaries.ok ? 0 : 1', 'exitCode = durationMatches && parity.ok ? 0 : 1'),
  'render no warm boundary frame': swap('render', 'warmFrames[piece.index + 1] = await p.screenshot', 'void await p.screenshot'),
  'render leaks scratch on failure': swap('render', "process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));", ''),
  'render ignores --workers': swap('render', 'planPieces(frames, workersArg ? Number(workersArg) : defaultWorkers(cpus().length))', 'planPieces(frames, 1)'),
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
  it('keeps SKILL.md under 200 lines', () => {
    expect(SHIPPED.skill.split('\n').length).toBeLessThan(200);
  });
});

// ---------- third-party notices: the springs are adapted from take-one (MIT)
const ROOT = path.resolve(DIR, '..', '..');
type Notice = { notices: string; motion: string; license: string | null };
const SHIPPED_NOTICE: Notice = {
  notices: fs.readFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8'),
  motion: SHIPPED.motion,
  license: fs.existsSync(path.join(DIR, 'LICENSE.take-one')) ? read('LICENSE.take-one') : null,
};
function noticeProblems(n: Notice): string[] {
  const out: string[] = [];
  const need = (ok: boolean, name: string) => { if (!ok) out.push(name); };
  const start = n.notices.indexOf('## take-one springs and claude-motion-design\n');
  const end = start < 0 ? -1 : n.notices.indexOf('\n## ', start + 3);
  const entry = start < 0 ? '' : n.notices.slice(start, end < 0 ? undefined : end);
  need(/Tal Siach/.test(entry) && /Raphael Aubry/.test(entry) && /License: MIT/.test(entry), 'notices: springs entry with both authors');
  need(entry.includes('`skills/vs-explain-video/assets/motion.js`'), 'notices: lists motion.js');
  need(entry.includes('`skills/vs-explain-video/LICENSE.take-one`'), 'notices: names the licence file');
  const springs = n.motion.slice(n.motion.indexOf('// ---------- springs'), n.motion.indexOf('const SPRINGS'));
  need(/take-one/.test(springs) && /Tal Siach/.test(springs) && /MIT/.test(springs) && /LICENSE\.take-one/.test(springs) && /claude-motion-design/.test(springs), 'motion.js: springs header');
  need(/^MIT License\s+Copyright \(c\) 2026 Tal Siach/.test(n.license ?? '') && /THE SOFTWARE IS PROVIDED "AS IS"/.test(n.license ?? ''), 'LICENSE.take-one: full MIT text');
  return out;
}
const noticeMutants: Record<string, (n: Notice) => Notice> = {
  'no springs entry': (n) => ({ ...n, notices: n.notices.replace('## take-one springs and claude-motion-design', '## springs') }),
  'entry drops claude-motion-design': (n) => ({ ...n, notices: n.notices.replace(/Raphael Aubry/g, 'someone') }),
  'motion.js says our own': (n) => ({ ...n, motion: n.motion.replace(/Adapted from take-one[\s\S]*?the rise\/pop defaults\./, 'Idea only; this code is our own.') }),
  'no licence file': (n) => ({ ...n, license: null }),
};
describe('explain-video audio, motion, speed: third-party notices', () => {
  it('credits the springs, with the MIT licence text', () => {
    expect(noticeProblems(SHIPPED_NOTICE)).toEqual([]);
  });
  it.each(Object.entries(noticeMutants))('mutant "%s" is caught', (_name, mutate) => {
    const mutated = mutate(SHIPPED_NOTICE);
    expect(JSON.stringify(mutated)).not.toBe(JSON.stringify(SHIPPED_NOTICE));
    expect(noticeProblems(mutated).length).toBeGreaterThan(0);
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
  rise: (e: El, t: number, s: number, o?: { d?: number }) => number;
  pop: (e: El, t: number, s: number, p?: string | number) => number;
  P: (t: number, s: number, d: number, e: (x: number) => number) => number;
  ease: Record<string, (x: number) => number>;
};
type El = { style: Record<string, string | number>; _o?: number };
const el = (): El => ({ style: {} });
type Mods = { audio: Audio; pieces: Pieces; motion: Motion };
const loadModule = async (name: string, src: string) => {
  const dir = tmp('vs-ams-mutant-');
  fs.copyFileSync(script('media.mjs'), path.join(dir, 'media.mjs'));
  fs.writeFileSync(path.join(dir, name), src);
  return import(pathToFileURL(path.join(dir, name)).href);
};
const loadMotion = (src: string): Motion => vm.runInNewContext(`${src};({ spring, springTo, settle, readTime, rise, pop, P, ease })`, {});
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
  'words: only the spoken form matches': (m) => m.audio.checkBeat('Kubernetes scales it.', 'koo ber net ees scales it.', 'koo ber net ees scales it').ok,
  'words: neighbouring numbers are not added up': (m) => !m.audio.checkBeat('two three four', 'two three four', 'nine').ok && !m.audio.checkBeat('one and two requests', 'one and two requests', 'three requests').ok,
  'words: "and" stays a word outside a number': (m) => m.audio.checkBeat('Use one and then stop', 'Use one and then stop', 'Use 1 and then stop').ok,
  'words: compounds join': (m) => m.audio.normalizeWords('one hundred five, twenty-three, one hundred and five').join() === '105,23,105' && m.audio.normalizeWords('ninety nine bottles').join() === '99,bottles',
  'words: the written form counts': (m) => m.audio.checkBeat('The CDN caches it.', 'The C D N caches it.', 'The CDN caches it.').ok,
  'words: numbers said in words match digits': (m) => m.audio.checkBeat('from eight hundred forty milliseconds to twelve', 'from eight hundred forty milliseconds to twelve', 'From 840 milliseconds to 12.').ok,
  'words: big numbers': (m) => m.audio.normalizeWords('two thousand and twenty six').join() === '2026',
  'transcripts: the cache key names audio, engine, model, language': (m) => {
    const k = (audio: string, model = 'base.en', lang = 'en', engine = 'whisper-cli') => m.audio.transcriptKey(Buffer.from(audio), { engine, model, lang });
    return k('a') === k('a') && new Set([k('a'), k('b'), k('a', 'small.en'), k('a', 'base.en', 'de'), k('a', 'base.en', 'en', 'whisper')]).size === 5;
  },
  'transcripts: an English model first, larger first': (m) => m.audio.pickModel(['ggml-base.bin', 'ggml-tiny.en.bin', 'ggml-base.en.bin', 'notes.txt']).join() === 'ggml-base.en.bin,ggml-tiny.en.bin,ggml-base.bin',
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
  'springs: an unknown preset names the presets': (m) => {
    try {
      m.motion.spring(1, 0, 'bouncy');
      return false;
    } catch (error) {
      return /unknown preset "bouncy"; use snappy, camera, heavy, playful/.test((error as Error).message);
    }
  },
  'rise springs by its length': (m) => {
    const at = (d: number) => m.motion.rise(el(), 0.5, 0.2, { d });
    return at(0.6) === m.motion.spring(0.5, 0.2, 'camera') && at(0.8) === m.motion.spring(0.5, 0.2, 'heavy') && at(0.4) === m.motion.spring(0.5, 0.2, 'snappy');
  },
  'pop springs playful by default': (m) => m.motion.pop(el(), 0.4, 0.1) === m.motion.spring(0.4, 0.1, 'playful'),
  'pop keeps a number 4th argument as its old length': (m) => {
    const e = el();
    const k = m.motion.pop(e, 0.3, 0, 0.55);
    return k === m.motion.P(0.3, 0, 0.55, m.motion.ease.back) && /scale\(/.test(String(e.style.transform));
  },
  'reads: 0.4 s + 0.2 s a word': (m) => Math.abs(m.motion.readTime('six words on this card here') - 1.6) < 1e-9,
  'pieces: every frame once, in order, balanced': (m) => {
    const plan = m.pieces.planPieces(1001, 3);
    return JSON.stringify(plan) === '[{"index":0,"first":0,"count":334},{"index":1,"first":334,"count":334},{"index":2,"first":668,"count":333}]';
  },
  'pieces: never more pieces than frames, never fewer than one': (m) => m.pieces.planPieces(2, 5).length === 2 && m.pieces.planPieces(90, 0).length === 1,
  'pieces: one core left free, at most 3': (m) => [1, 2, 3, 4, 8, 64].map((c) => m.pieces.defaultWorkers(c)).join() === '1,1,2,3,3,3',
  'boundaries: equal or noise-level frames pass': (m) => m.pieces.boundaryParity([{ frame: 30, equal: true, psnr: Infinity, changed: 0 }, { frame: 60, equal: false, psnr: 52, changed: 10 }]).ok,
  'boundaries: a frame that draws differently cold fails': (m) => {
    const r = m.pieces.boundaryParity([{ frame: 30, equal: true, psnr: Infinity, changed: 0 }, { frame: 60, equal: false, psnr: 31.2, changed: 9000 }]);
    return !r.ok && r.problems.length === 1 && /^frame 60 draws differently on a cold page/.test(r.problems[0]);
  },
  'boundaries: one changed word fails even at 55 dB': (m) => !m.pieces.boundaryParity([{ frame: 30, equal: false, psnr: 55, changed: 400 }]).ok,
  'boundaries: changed pixels skip noise under 32/255': (m) => m.pieces.changedPixels(Uint8Array.from([0, 0, 0, 9]), Uint8Array.from([32, 33, 200, 9])) === 2,
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
  'hundreds added, not multiplied': ['audio', '{ v: head.v * 100 + rest.v, n: rest.n }', '{ v: head.v + 100 + rest.v, n: rest.n }'],
  'neighbouring numbers summed': ['audio', '  if (one >= 0) return { v: one, n: i + 1 };', '  if (one >= 0) { const more = below100(words, i + 1); return more ? { v: one + more.v, n: more.n } : { v: one, n: i + 1 }; }'],
  '"and" dropped after a number word': ['audio', '      out.push(words[i]);\n      i += 1;', "      if (!(words[i] === 'and' && ONES.includes(words[i - 1]))) out.push(words[i]);\n      i += 1;"],
  'written form only': ['audio', 'const forms = [wordDiff(said, heard), wordDiff(written, heard)];', 'const forms = [wordDiff(written, heard)];'],
  'cache ignores the model': ['audio', '.update(`\\0${engine}\\0${model}\\0${lang}`)', '.update(`\\0${engine}\\0${lang}`)'],
  'model picked alphabetically': ['audio', '.sort((a, b) => a.en - b.en || (a.size < 0 ? 99 : a.size) - (b.size < 0 ? 99 : b.size) || a.f.localeCompare(b.f))', '.sort((a, b) => a.f.localeCompare(b.f))'],
  'target -23': ['audio', 'target: -16,', 'target: -23,'],
  'peak ceiling 0': ['audio', 'maxPeak: -1 }', 'maxPeak: 0 }'],
  'live line parsed': ['audio', "const summary = stderr.slice(stderr.lastIndexOf('Summary:'));", 'const summary = stderr;'],
  'peak ignored': ['audio', ' && truePeak <= LOUDNESS.maxPeak;\n  return inRange', ';\n  return inRange'],
  'no tolerance': ['audio', 'tolerance: 2,', 'tolerance: 0,'],
  'spring underdamped sign': ['motion', 'return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));', 'return 1 - Math.exp(-z * w * x) * Math.cos(wd * x);'],
  'spring starts early': ['motion', 'if (x <= 0) return 0;', 'if (x < -1) return 0;'],
  'springTo restarts': ['motion', 'v += (keys[i][1] - keys[i - 1][1]) * spring(t, keys[i][0], preset);', 'if (t >= keys[i][0]) v = keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * spring(t, keys[i][0], preset);'],
  'reads 0.3 a word': ['motion', 'const readTime = (text) => 0.4 + 0.2 *', 'const readTime = (text) => 0.4 + 0.3 *'],
  'heavy is bouncy': ['motion', 'heavy: { k: 120, c: 24 }', 'heavy: { k: 120, c: 14 }'],
  'playful is stiff': ['motion', 'playful: { k: 180, c: 12 }', 'playful: { k: 180, c: 30 }'],
  'unknown preset unchecked': ['motion', '  if (!named || !(named.k > 0) || !(named.c >= 0)) {', '  if (false) {'],
  'rise eased': ['motion', ": spring(t, s, sp ?? (d >= 0.75 ? 'heavy' : d <= 0.45 ? 'snappy' : 'camera'))", ': ease.out(clamp((t - s) / d))'],
  'pop eased': ['motion', 'const k = fixed ? P(t, s, preset, ease.back) : spring(t, s, preset);', 'const k = P(t, s, fixed ? preset : 0.55, ease.back);'],
  'pop drops its 4th argument': ['motion', "const fixed = typeof preset === 'number';", 'const fixed = false;'],
  'pieces drop the remainder': ['pieces', 'const count = base + (index < extra ? 1 : 0);', 'const count = base;'],
  'pieces overlap': ['pieces', '    first += count;\n', '    first += count - 1;\n'],
  'parity ignores the join': ['pieces', '  if (joined !== total) problems.push', '  if (false) problems.push'],
  'workers unbounded': ['pieces', 'Math.max(1, Math.min(3, Math.floor(cpus) - 1))', 'Math.max(1, cpus)'],
  'workers half the cores': ['pieces', 'Math.max(1, Math.min(3, Math.floor(cpus) - 1))', 'Math.max(1, Math.min(3, Math.floor(cpus / 2)))'],
  'boundary trusts any frame': ['pieces', '.filter(({ equal, psnr, changed }) => !equal && !(psnr > BOUNDARY.psnr && changed < BOUNDARY.area))', '.filter(() => false)'],
  'boundary needs equal bytes': ['pieces', '.filter(({ equal, psnr, changed }) => !equal && !(psnr > BOUNDARY.psnr && changed < BOUNDARY.area))', '.filter(({ equal }) => !equal)'],
  'boundary psnr only': ['pieces', '!(psnr > BOUNDARY.psnr && changed < BOUNDARY.area)', '!(psnr > BOUNDARY.psnr)'],
  'changed pixels count noise': ['pieces', 'if (Math.abs(a[i] - b[i]) > threshold) n += 1;', 'if (a[i] !== b[i]) n += 1;'],
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
// answers from a list, one line per word-check call (-otxt), in beat order.
function narrateWork(heard: string[] | null, flags: string[] = [], whisperExit = 0) {
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
if (${whisperExit}) { process.stderr.write('model failed to load'); process.exit(${whisperExit}); }
const args = process.argv.slice(2);
if (!args.includes('-otxt')) process.exit(1); // caption word times: not this stub's job
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
  const out = spawnSync(process.execPath, [script('narrate.mjs'), path.join(work, 'script.json'), '--engine', 'piper', ...flags], { encoding: 'utf8', env });
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
    expect(report.next).toMatch(/report the narration as not word-checked/);
    expect(report.warning).toMatch(/^WARNING: the words were not checked/);
    expect(out.stderr).toMatch(/WARNING: the words were not checked/);
  }, 60_000);

  it('warns when whisper fails, and --require-word-check exits 2', () => {
    const failed = narrateWork(['x', 'y'], [], 3);
    expect(failed.out.status, failed.out.stderr).toBe(0);
    const report = JSON.parse(failed.out.stdout);
    expect(report.words.status).toBe('failed');
    expect(report.warning).toMatch(/not checked \(failed:/);
    expect(report.next).toMatch(/The word check was failed/);
    expect(narrateWork(['x', 'y'], ['--require-word-check'], 3).out.status).toBe(2);
    expect(narrateWork(null, ['--require-word-check']).out.status).toBe(2);
    expect(narrateWork(['The fix drops the timestamp.', 'The search hits the cache.'], ['--require-word-check']).out.status).toBe(0);
  }, 120_000);
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
    const render = (workers: number, status = 0) => {
      const out = spawnSync(process.execPath, [script('render.mjs'), work, '--out', path.join(work, `w${workers}.mp4`), '--workers', String(workers)], { encoding: 'utf8', env: { ...process.env, VS_EXPLAIN_VIDEO_NO_INSTALL: '1' }, timeout: 180_000 });
      expect(out.status, out.stderr).toBe(status);
      return JSON.parse(out.stdout);
    };
    const one = render(1);
    const three = render(3);
    expect(one).toMatchObject({ workers: 1, frames: 90, framesMatch: true, frameProblems: [], boundariesMatch: true, durationMatches: true });
    expect(three).toMatchObject({ workers: 3, frames: 90, framesMatch: true, frameProblems: [], boundariesMatch: true, boundaryProblems: [], durationMatches: true });
    const psnr = spawnSync(FFMPEG, ['-i', path.join(work, 'w1.mp4'), '-i', path.join(work, 'w3.mp4'), '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
    const db = /average:(inf|[\d.]+)/.exec(psnr.stderr)?.[1];
    expect(db === 'inf' || Number(db) > 40, `psnr ${db}`).toBe(true);
    // A scene that keeps state between frames: the card counts its draws. A
    // cold page at a boundary has drawn few; the 1-worker page drew them all.
    fs.writeFileSync(path.join(work, 'scenes.js'), `scene('a', (R) => {
  const b = box(R, 160, 300, 600, 200, 'card pad', 'one card');
  let draws = 0;
  return (t) => { draws += 1; b.textContent = 'draw ' + draws; rise(b, t, 0.2); };
});`);
    const leaky = render(3, 1);
    expect(leaky.framesMatch).toBe(true);
    expect(leaky.boundariesMatch).toBe(false);
    expect(leaky.boundaryProblems[0]).toMatch(/^frame 30 draws differently on a cold page/);
  }, 300_000);
});
