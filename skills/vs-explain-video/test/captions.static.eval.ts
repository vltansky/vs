// Word captions: the aligner, the pages, the timing sources, and the SKILL
// contract. Every checker below also runs against mutants of the modules; a
// mutant the checkers do not catch fails the suite.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const CAPTIONS_REF = fs.readFileSync(path.join(DIR, 'references', 'captions.md'), 'utf8');
const NARRATE = fs.readFileSync(path.join(DIR, 'scripts', 'narrate.mjs'), 'utf8');
const MOTION = fs.readFileSync(path.join(DIR, 'assets', 'motion.js'), 'utf8');
const STAGE = fs.readFileSync(path.join(DIR, 'assets', 'stage.html'), 'utf8');
const INIT = fs.readFileSync(path.join(DIR, 'scripts', 'init.mjs'), 'utf8');
const NODE_SRC = fs.readFileSync(path.join(DIR, 'scripts', 'captions.mjs'), 'utf8');
const BROWSER_SRC = fs.readFileSync(path.join(DIR, 'assets', 'captions.js'), 'utf8');
const MEDIA_SRC = fs.readFileSync(path.join(DIR, 'scripts', 'media.mjs'), 'utf8');
const AUDIO_SRC = fs.readFileSync(path.join(DIR, 'scripts', 'audio.mjs'), 'utf8');

type Word = { text: string; from: number; to: number };
type Page = { from: number; to: number; words: [number, number, string][] };
type NodeMod = {
  align: (w: string[], s: (x: string) => string, h: { text: string | null; start: number; end: number }[]) =>
    { ok: boolean; words?: Word[]; unmatched?: string[] };
  estimateWords: (w: string[], s: (x: string) => string, seconds: number) => Word[];
  paginate: (w: Word[], o: { beatEnd: number; fps: number }) => Page[];
  buildCaptions: (beats: unknown[], o: Record<string, unknown>) => { caps: Page[]; meta: { sources: Record<string, number>; estimated: string[] } };
  parseWhisperJson: (j: unknown) => { text: string; start: number; end: number }[];
  LIMITS: { words: number; chars: number; hold: number };
};
type BrowserMod = { state: (caps: Page[], T: number) => { page: number; word: number } };

let counter = 0;
async function loadNode(src: string): Promise<NodeMod> {
  const dir = mkdtempSync(path.join(tmpdir(), 'vs-captions-mod-'));
  writeFileSync(path.join(dir, 'media.mjs'), MEDIA_SRC);
  writeFileSync(path.join(dir, 'audio.mjs'), AUDIO_SRC);
  const file = path.join(dir, `captions-${(counter += 1)}.mjs`);
  writeFileSync(file, src);
  return (await import(pathToFileURL(file).href)) as NodeMod;
}
function loadBrowser(src: string): BrowserMod {
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  return sandbox.VSCaptions as BrowserMod;
}

const pronounce: Record<string, string> = { AICM: 'A I C M' };
const spokenOf = (w: string) => w.replace(/AICM/g, pronounce.AICM);
const near = (a: number | undefined, b: number, eps = 0.011) => typeof a === 'number' && Math.abs(a - b) <= eps;

// ---------- checkers: each returns the problems it finds (none = pass)
function alignerProblems(m: NodeMod): string[] {
  const p: string[] = [];
  const a = m.align(['AICM', 'ships', 'fast.'], spokenOf, [
    { text: 'A', start: 0, end: 0.1 }, { text: 'I', start: 0.1, end: 0.2 }, { text: 'C', start: 0.2, end: 0.3 },
    { text: 'M', start: 0.3, end: 0.4 }, { text: 'ships', start: 0.5, end: 0.8 }, { text: 'fast.', start: 0.9, end: 1.2 },
  ]);
  if (!a.ok) p.push('pronounce: spoken letters did not align');
  else {
    const [aicm, ships] = a.words!;
    if (aicm.text !== 'AICM') p.push('pronounce: shows the spoken form');
    if (!near(aicm.from, 0) || !near(aicm.to, 0.4)) p.push(`pronounce: AICM spans ${aicm.from}-${aicm.to}, not 0-0.4`);
    if (!near(ships.from, 0.5)) p.push('pronounce: next word shifted');
  }
  const shared = m.align(['non', 'blocking', 'io'], (x) => x, [
    { text: 'nonblocking', start: 0, end: 1 }, { text: 'IO', start: 1.1, end: 1.4 },
  ]);
  if (!shared.ok) p.push('shared: did not align');
  else {
    const [non, blocking] = shared.words!;
    if (!(non.to > non.from && blocking.from >= non.to - 1e-9 && near(blocking.to, 1))) p.push('shared: one heard word is not split in order');
  }
  const missing = m.align(['send', 'the', '42', 'bytes.'], (x) => x, [
    { text: 'send', start: 0, end: 0.3 }, { text: 'the', start: 0.3, end: 0.4 }, { text: 'forty', start: 0.5, end: 0.7 },
    { text: 'two', start: 0.7, end: 0.9 }, { text: 'bytes', start: 1.0, end: 1.3 },
  ]);
  if (!missing.ok) p.push('missing: did not align');
  else {
    const n = missing.words![2];
    if (!(typeof n.from === 'number' && n.from >= 0.4 - 1e-9 && n.to <= 1.0 + 1e-9 && n.to > n.from)) p.push('missing: unmatched word not placed between neighbours');
    if (!missing.unmatched?.includes('42')) p.push('missing: unmatched word not reported');
  }
  if (m.align(['the', 'cache', 'misses'], (x) => x, [{ text: 'banana', start: 0, end: 1 }]).ok) p.push('garbage: accepted');
  const ph = (n: number) => Array.from({ length: n }, (_, i) => ({ text: null, start: i * 0.2, end: i * 0.2 + 0.15 }));
  if (m.align(['AICM', 'ships.'], spokenOf, ph(4)).ok) p.push('position: count mismatch accepted');
  const pos = m.align(['AICM', 'ships.'], spokenOf, ph(5));
  if (!pos.ok || !near(pos.words![0].to, 0.75) || !near(pos.words![1].from, 0.8)) p.push('position: wrong mapping');
  const est = m.estimateWords(['a', 'considerably', 'longer', 'word.'], (x) => x, 2);
  if (!near(est[0].from, 0) || !near(est.at(-1)!.to, 2)) p.push('estimate: does not cover the beat');
  if (!(est[1].to - est[1].from > est[0].to - est[0].from)) p.push('estimate: long word not longer');
  return p;
}

function pageProblems(m: NodeMod): string[] {
  const p: string[] = [];
  const fps = 30;
  const seq = (texts: string[], step = 0.25, gapAt: Record<number, number> = {}) => {
    let t = 10;
    return texts.map((text, i) => {
      t += gapAt[i] ?? 0;
      const w = { text, from: t, to: t + step * 0.9 };
      t += step;
      return w;
    });
  };
  const long = seq('one two three four five six seven eight nine ten eleven twelve thirteen fourteen'.split(' '));
  const pages = m.paginate(long, { beatEnd: long.at(-1)!.to, fps });
  if (pages.some((pg) => pg.words.length > 6)) p.push('limit: more than 6 words on a page');
  if (pages.map((pg) => pg.words.length).join(',') !== '5,5,4') p.push(`limit: pages not even (${pages.map((pg) => pg.words.length)})`);
  const wide = seq(Array.from({ length: 6 }, () => 'internationalization'));
  if (m.paginate(wide, { beatEnd: 20, fps }).some((pg) => pg.words.map((w) => w[2]).join(' ').length > 60)) p.push('limit: page over 60 chars');
  if (m.paginate(seq(['One', 'two.', 'Three', 'four.']), { beatEnd: 20, fps }).length !== 2) p.push('break: sentence end');
  if (m.paginate(seq(['a', 'b', 'c', 'd'], 0.25, { 2: 0.35 }), { beatEnd: 20, fps }).length !== 2) p.push('break: a 0.35 s gap');
  const commas = m.paginate(seq('We will follow one request, a search for nile, through it.'.split(' ')), { beatEnd: 20, fps });
  if (commas.map((pg) => pg.words.length).join(',') !== '5,4,2') p.push(`break: comma (${commas.map((pg) => pg.words.length)})`);
  if (m.paginate(seq(['Yes,', 'we', 'can.']), { beatEnd: 20, fps }).length !== 1) p.push('break: comma on a short page');
  if (m.paginate(seq(['a', 'b', 'c', 'd'], 0.25, { 2: 0.1 }), { beatEnd: 20, fps }).length !== 1) p.push('break: a short gap split the page');
  const fast = m.paginate([{ text: 'a', from: 1, to: 1.01 }, { text: 'b', from: 1.01, to: 1.02 }, { text: 'c', from: 1.02, to: 1.5 }], { beatEnd: 1.5, fps });
  const starts = fast.flatMap((pg) => pg.words.map((w) => w[0]));
  if (starts.some((s, i) => i && s - starts[i - 1] < 2 / fps)) p.push('min: a word is lit for under 2 frames');
  const end = m.paginate(seq(['a', 'b']), { beatEnd: 12, fps }).at(-1)!;
  if (!near(end.to, 12 + m.LIMITS.hold, 0.002)) p.push('hold: last page does not stay to the beat end + hold');
  const built = m.buildCaptions([
    { scene: 's', index: 0, text: 'AICM ships the fix', at: 1, seconds: 1.2, audio: '/nonexistent/a.wav' },
    { scene: 's', index: 1, text: 'and it works', at: 2.65, seconds: 0.9, audio: '/nonexistent/b.wav' },
  ], { spokenOf, whisper: null });
  if (built.caps.some((pg) => pg.words.some((w) => w[0] < 2.65) && pg.words.some((w) => w[0] >= 2.65))) p.push('beats: a page crosses a beat');
  if (!built.caps.some((pg) => pg.words.some((w) => w[2] === 'AICM'))) p.push('written: pages show the spoken form');
  if (built.meta.sources.estimated !== 2 || built.meta.estimated.join() !== 's#0,s#1') p.push('estimated: not labelled');
  return p;
}

function stateProblems(b: BrowserMod): string[] {
  const p: string[] = [];
  const caps: Page[] = [
    { from: 1, to: 2, words: [[1, 1.2, 'a'], [1.5, 1.7, 'b']] },
    { from: 2, to: 3, words: [[2, 2.4, 'c'], [2.5, 2.9, 'd']] },
  ];
  const at = (T: number) => JSON.stringify(b.state(caps, T));
  if (at(0.99) !== '{"page":-1,"word":-1}') p.push('state: page shown before it starts');
  if (at(1) !== '{"page":0,"word":0}') p.push('state: first word not lit at its start');
  if (at(1.3) !== '{"page":0,"word":0}') p.push('state: word not held through a short gap');
  if (at(1.5) !== '{"page":0,"word":1}') p.push('state: next word late');
  if (at(2) !== '{"page":1,"word":0}') p.push('state: page boundary off by one');
  if (at(3) !== '{"page":-1,"word":-1}') p.push('state: page shown after it ends');
  return p;
}

const problems = async (nodeSrc: string, browserSrc: string) => {
  const m = await loadNode(nodeSrc);
  return [...alignerProblems(m), ...pageProblems(m), ...stateProblems(loadBrowser(browserSrc))];
};

const MUTANTS: [string, 'node' | 'browser', string, string][] = [
  ['7 words a page', 'node', 'words: 6,', 'words: 7,'],
  ['no 2-frame minimum', 'node', 'prev.from + minLit', 'prev.from'],
  ['no hold after the beat', 'node', 'end + limits.hold', 'end'],
  ['no sentence break', 'node', 'sentenceEnd(w.text) || ', ''],
  ['no comma break', 'node', '|| comma)', ')'],
  ['comma break on any page', 'node', 'runs.at(-1).length >= 3', 'runs.at(-1).length >= 1'],
  ['no gap break', 'node', 'next.from - w.to >= limits.gap', 'next.from - w.to >= 10'],
  ['no gap filling', 'node', '  fillGaps(words, timed[0].start, timed.at(-1).end);\n', ''],
  ['spoken text on screen', 'node', 'const absolute = words.map((w) => ({ text: w.text,', 'const absolute = words.map((w) => ({ text: spokenOf(w.text),'],
  ['no shared split', 'node', '  splitShared(words, spokenOf);\n', ''],
  ['word dark in a gap', 'browser', 'if (words[i][0] <= T) word = i;', 'if (words[i][0] <= T && T < words[i][1]) word = i;'],
  ['page boundary off by one', 'browser', 'if (caps[i].from > T) break;', 'if (caps[i].from >= T) break;'],
];

describe('vs-explain-video word captions', () => {
  it('aligns, pages, and marks words as the timestamps say', async () => {
    expect(await problems(NODE_SRC, BROWSER_SRC)).toEqual([]);
  });

  it.each(MUTANTS)('catches the mutant: %s', async (_name, where, from, to) => {
    const src = where === 'node' ? NODE_SRC : BROWSER_SRC;
    expect(src, 'mutation target moved').toContain(from);
    const mutated = src.replace(from, to);
    const found = await problems(where === 'node' ? mutated : NODE_SRC, where === 'browser' ? mutated : BROWSER_SRC);
    expect(found.length).toBeGreaterThan(0);
  });

  it('reads whisper.cpp full JSON word times', async () => {
    const m = await loadNode(NODE_SRC);
    const words = m.parseWhisperJson({ transcription: [
      { text: ' The', offsets: { from: 0, to: 220 } }, { text: '', offsets: { from: 220, to: 230 } },
      { text: ' cache.', offsets: { from: 230, to: 610 } },
    ] });
    expect(words).toEqual([{ text: 'The', start: 0, end: 0.22 }, { text: 'cache.', start: 0.23, end: 0.61 }]);
  });

  it('prefers whisper DTW token times over segment offsets', async () => {
    const m = await loadNode(NODE_SRC);
    const words = m.parseWhisperJson({ transcription: [
      { text: '', offsets: { from: 0, to: 300 }, tokens: [{ text: '[_BEG_]', t_dtw: -1 }] },
      { text: ' The', offsets: { from: 300, to: 320 }, tokens: [{ text: ' The', t_dtw: 34 }] },
      { text: ' timestamp.', offsets: { from: 320, to: 4000 }, tokens: [{ text: ' timestamp', t_dtw: 52 }, { text: '.', t_dtw: 120 }, { text: '[_TT_200]', t_dtw: -1 }] },
    ] });
    expect(words).toEqual([{ text: 'The', start: 0.34, end: 0.52 }, { text: 'timestamp.', start: 0.52, end: 4 }]);
    const { dtwPreset } = (await loadNode(NODE_SRC)) as unknown as { dtwPreset: (m: string) => string | null };
    expect(dtwPreset('/x/ggml-base.en.bin')).toBe('base.en');
    expect(dtwPreset('/x/ggml-large-v3-turbo-q5_0.bin')).toBe('large.v3.turbo');
    expect(dtwPreset('/x/my-model.bin')).toBeNull();
  });

  it('prefers kokoro word times, then whisper per beat, then the estimate', async () => {
    const m = await loadNode(NODE_SRC);
    const work = mkdtempSync(path.join(tmpdir(), 'vs-captions-src-'));
    const audio = (n: string) => {
      const f = path.join(work, `${n}.wav`);
      writeFileSync(f, '');
      return f;
    };
    const k = audio('k');
    writeFileSync(`${k}.words.json`, JSON.stringify([{ text: 'cache', start: 0.1, end: 0.4 }, { text: 'hit', start: 0.5, end: 0.7 }]));
    const w = audio('w');
    // A fake whisper-cli that writes the -ojf JSON whisper.cpp writes.
    const bin = path.join(work, 'whisper-cli');
    writeFileSync(bin, `#!/bin/sh\nwhile [ "$1" ]; do [ "$1" = -of ] && out="$2"; shift; done\nprintf '%s' '{"transcription":[{"text":" cache","offsets":{"from":200,"to":500}},{"text":" miss","offsets":{"from":600,"to":900}}]}' > "$out.json"\n`, { mode: 0o755 });
    const e = audio('e');
    const beats = [
      { scene: 's', index: 0, text: 'Cache hit.', at: 1, seconds: 1, audio: k },
      { scene: 's', index: 1, text: 'Cache miss.', at: 3, seconds: 1, audio: w },
      { scene: 's', index: 2, text: 'Nothing timed here.', at: 5, seconds: 1, audio: e },
    ];
    const ffmpegOk = spawnSync('/bin/sh', ['-c', 'command -v ffmpeg']).status === 0;
    const { caps, meta } = m.buildCaptions(beats, { spokenOf: (x: string) => x, whisper: { cli: bin, model: '/dev/null' } });
    expect(caps[0].words[0]).toEqual([1.1, 1.4, 'Cache']);
    // The fake whisper reads no audio, but ffmpeg must convert the empty file
    // first; without a decodable file the beat falls back to the estimate.
    expect(meta.sources.kokoro).toBe(1);
    expect(meta.sources.whisper + meta.sources.estimated).toBe(2);
    expect(meta.estimated).toContain('s#2');
    if (!ffmpegOk) return;
    const ok = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '1', w]);
    expect(ok.status).toBe(0);
    const again = m.buildCaptions(beats, { spokenOf: (x: string) => x, whisper: { cli: bin, model: '/dev/null' } });
    expect(again.meta.sources).toEqual({ kokoro: 1, whisper: 1, estimated: 1 });
    expect(again.caps.find((pg) => pg.words.some((x) => x[2] === 'miss.'))!.words[0]).toEqual([3.2, 3.5, 'Cache']);
    expect(fs.existsSync(`${w}.wtimes.json`)).toBe(true);
  });

  it('rejects an unknown style before speaking anything', () => {
    const work = mkdtempSync(path.join(tmpdir(), 'vs-captions-style-'));
    writeFileSync(path.join(work, 'script.json'), JSON.stringify({ captions: 'karaoke', scenes: [{ id: 'a', beats: ['Hi.'] }] }));
    const r = spawnSync(process.execPath, [path.join(DIR, 'scripts', 'narrate.mjs'), path.join(work, 'script.json'), '--dry-run'], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/"captions" must be one of pill, colour, pop, line/);
  });
});

describe('vs-explain-video word captions contract', () => {
  it('documents the styles, the default, and the timing sources in order', () => {
    expect(SKILL.split('\n').length).toBeLessThan(200);
    expect(SKILL).toContain('[references/captions.md](references/captions.md)');
    expect(CAPTIONS_REF).toMatch(/`captions`[\s\S]{0,80}`pill`\s+\(default\)/);
    for (const style of ['colour', 'pop', 'line']) expect(CAPTIONS_REF).toContain(`\`${style}\``);
    expect(CAPTIONS_REF).toMatch(/1\.\s+kokoro[\s\S]{0,600}2\.\s+`whisper-cli`[\s\S]{0,300}3\.\s+estimated/);
    expect(CAPTIONS_REF).toMatch(/estimated beats\.\s+Report their word sync as not checked/);
    expect(CAPTIONS_REF).toMatch(/at\s+most\s+6\s+words/);
  });

  it('keeps the hook small: one module, one call in seek, one script tag, one copy', () => {
    expect(MOTION).toMatch(/window\.VSCaptions\.draw\(sub, TL, T\)/);
    expect(MOTION).toMatch(/TL\.subs/);
    expect(STAGE).toMatch(/<script src="captions\.js"><\/script>\s*<script src="motion\.js">/);
    expect(INIT).toMatch(/'captions\.js'/);
    expect(NARRATE).toMatch(/from '\.\/captions\.mjs'/);
    expect(NARRATE).toMatch(/caps: captions\.caps, captions: captions\.meta/);
    expect(BROWSER_SRC).not.toMatch(/requestAnimationFrame\(|setTimeout\(|setInterval\(|Date\.now\(/);
  });

  it('credits the aligner idea without copying code', () => {
    expect(NODE_SRC).toMatch(/HyperFrames[\s\S]{0,80}Apache-2\.0[\s\S]{0,120}separate implementation/);
  });
});
