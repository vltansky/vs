import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// Static evals for the over-time checks (check.mjs), the fresh-reviewer pack
// (pack.mjs + references/reviewer-brief.md), and the Playwright lookup order.
// `problems()` reads the shipped text; mutants must each break a rule. The
// behaviour suites feed fixtures to the pure rules in checks.mjs, and run each
// rule mutant through the same probes. Browser and ffmpeg runs skip when the
// tool is not there (CI has neither).

const DIR = path.resolve(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(DIR, ...p), 'utf8');
const SKILL = read('SKILL.md');
const BRIEF = read('references', 'reviewer-brief.md');
const FIXES = read('references', 'checks.md');
const RULES_SRC = read('scripts', 'checks.mjs');
const CHECK = read('scripts', 'check.mjs');
const PACK = read('scripts', 'pack.mjs');
const MEDIA = read('scripts', 'media.mjs');
const script = (name: string) => path.join(DIR, 'scripts', name);
const tmp = (prefix: string) => fs.mkdtempSync(path.join(tmpdir(), prefix));

type Files = { skill: string; brief: string; fixes: string; rules: string; check: string; pack: string; media: string };
const SHIPPED: Files = { skill: SKILL, brief: BRIEF, fixes: FIXES, rules: RULES_SRC, check: CHECK, pack: PACK, media: MEDIA };

function problems(f: Files): string[] {
  const out: string[] = [];
  const need = (ok: boolean, name: string) => { if (!ok) out.push(name); };
  // SKILL.md: the order of work and the review loop.
  need(/node <skill-dir>\/scripts\/check\.mjs "\$WORK"/.test(f.skill), 'skill runs check.mjs');
  need(f.skill.includes('references/checks.md'), 'skill links the fix table');
  need(/node <skill-dir>\/scripts\/pack\.mjs "\$WORK" "\$WORK\/<topic>\.mp4"/.test(f.skill), 'skill builds the pack');
  need(/new agent that has seen\s+none of the work/.test(f.skill), 'skill: reviewer saw none of the work');
  need(/A new agent every round/.test(f.skill), 'skill: new agent every round');
  need(/PASS needs 8 or more on every\s+axis/.test(f.skill), 'skill: bar of 8');
  need(/RETURN goes back to `scenes\.js`/.test(f.skill), 'skill: RETURN loop to scenes.js');
  need(/Three rounds at most/.test(f.skill), 'skill: at most 3 rounds');
  need(/Never report a pass that did not\s+happen/.test(f.skill), 'skill: no invented pass');
  need(/not reviewed by fresh eyes/.test(f.skill), 'skill: handoff says when unreviewed');
  need(f.skill.indexOf('## 7. Check, then render') < f.skill.indexOf('## 8. Fresh review') && f.skill.indexOf('## 8. Fresh review') < f.skill.indexOf('## 9. Handoff'), 'skill: check, review, handoff order');
  // The brief.
  const block = f.brief.slice(f.brief.indexOf('<!-- brief -->'), f.brief.indexOf('<!-- /brief -->'));
  need(block.length > 100, 'brief block missing');
  need(/Do not open any other file/.test(block), 'brief: pack only');
  need(/retold in one sentence/.test(block), 'brief: retell');
  need(/three worst problems, each with a timestamp/.test(block), 'brief: three problems with times');
  need(/Verdict: PASS if every score is 8 or more, otherwise RETURN/.test(block), 'brief: verdict rule');
  for (const axis of ['answer', 'example', 'builds', 'readability', 'pacing', 'sync']) need(new RegExp(`- ${axis}:`).test(block), `brief: axis ${axis}`);
  need(/\[pack folder\]/.test(block) && /\[video\]/.test(block), 'brief: placeholders');
  need(/\*\*A new agent every round\.\*\*/.test(f.brief), 'brief rules: new agent');
  need(/\*\*Three rounds at most\.\*\*/.test(f.brief), 'brief rules: 3 rounds');
  need(/no `scenes\.js`/.test(f.brief), 'brief rules: no code');
  // The fix table names every issue kind.
  for (const kind of ['CONTRACT', 'DETERMINISM', 'NO-BUILD', 'FLASH', 'SMALL', 'LONG', 'OVERLAP']) need(f.fixes.includes(`\`${kind}\``), `fix table: ${kind}`);
  // The rules.
  for (const [key, value] of [['minPx', '20'], ['flashBase', '0.4'], ['flashPerWord', '0.2'], ['flashFail', '0.6'], ['longPx', '54'], ['longHold', '6'], ['overlapHold', '0.3'], ['minChange', '0.005'], ['psnr', '45']]) {
    need(new RegExp(`\\b${key}: ${value.replace('.', '\\.')},`).test(f.rules), `rule ${key} = ${value}`);
  }
  // check.mjs: forward cold, reverse warm, fresh pages to name the culprit, chrome hidden for builds.
  need(/for \(const t of \[\.\.\.times\]\.reverse\(\)\)/.test(f.check), 'check: reverse pass');
  need(/const cold = await newPage\(\)/.test(f.check) && /const p = await newPage\(\);\s+await seek\(p, other\)/.test(f.check), 'check: culprit on fresh pages');
  need(/#progress,#sub,#chap,#brand,#glow\{visibility:hidden!important\}/.test(f.check), 'check: chrome hidden for builds');
  need(/closest\('\[data-vs-tid\]'\)/.test(f.check), 'check: text grouped by owner element');
  need(/process\.exit\(fails \? 1 : 0\)/.test(f.check), 'check: exit 1 on FAIL');
  need(/scanScenes\(readFileSync\(path\.join\(work, 'scenes\.js'\)/.test(f.check), 'check: contract scan');
  // pack.mjs.
  need(/export const MAX_ROUNDS = 3;/.test(f.pack), 'pack: 3 rounds');
  need(/if \(round > MAX_ROUNDS\)[\s\S]{0,400}process\.exit\(1\)/.test(f.pack), 'pack: refuses round 4');
  need(/phone-360\.png/.test(f.pack) && /tile=12x1/.test(f.pack) && /fps=1,scale=320/.test(f.pack), 'pack: sheets, strips, phone');
  need(/reviewer-brief\.md/.test(f.pack) && /BRIEF\.md/.test(f.pack), 'pack: writes the brief');
  // media.mjs: lookup order and no parent-directory walk.
  need(/const explicit = process\.env\.PLAYWRIGHT_MODULE;\s+if \(explicit\)/.test(f.media), 'media: PLAYWRIGHT_MODULE first');
  need(/\[\.\.\.extraRoots, toolingDir\(\), process\.cwd\(\)\]\.map\(\(root\) => path\.join\(root, 'node_modules'\)\)/.test(f.media), 'media: work dir, tool cache, cwd order');
  need(/existsSync\(path\.join\(dir, 'package\.json'\)\)/.test(f.media), 'media: only a root\'s own node_modules');
  return out;
}

const swap = (key: keyof Files, from: string | RegExp, to: string) => (f: Files): Files => ({ ...f, [key]: f[key].replace(from, to) });
const mutants: Record<string, (f: Files) => Files> = {
  'skill skips check.mjs': swap('skill', 'node <skill-dir>/scripts/check.mjs "$WORK"\n', ''),
  'skill skips the pack': swap('skill', /node <skill-dir>\/scripts\/pack\.mjs[^\n]*\n/, ''),
  'skill reuses the reviewer': swap('skill', 'A new agent every round.', 'Reuse the reviewer.'),
  'skill bar of 7': swap('skill', 'PASS needs 8 or more on every', 'PASS needs 7 or more on every'),
  'skill RETURN not looped': swap('skill', 'RETURN goes back to `scenes.js`', 'RETURN is noted'),
  'skill unlimited rounds': swap('skill', 'Three rounds at most', 'Repeat until it passes'),
  'skill allows an invented pass': swap('skill', /Never report a pass that did not\s+happen\./, ''),
  'skill handoff hides no review': swap('skill', ' (or "not reviewed by fresh eyes")', ''),
  'skill review after handoff': swap('skill', '## 8. Fresh review', '## 10. Fresh review'),
  'brief may read code': swap('brief', 'Do not open any other file.', 'Open scenes.js if it helps.'),
  'brief no verdict rule': swap('brief', 'Verdict: PASS if every score is 8 or more, otherwise RETURN.', 'Verdict: your call.'),
  'brief drops builds axis': swap('brief', /   - builds:[^\n]*\n/, ''),
  'brief drops pacing axis': swap('brief', /   - pacing:[^\n]*\n[^\n]*\n/, ''),
  'brief no timestamps': swap('brief', 'three worst problems, each with a timestamp', 'three worst problems'),
  'brief rules reuse agent': swap('brief', '**A new agent every round.**', '**One agent for all rounds.**'),
  'fix table drops NO-BUILD': swap('fixes', '`NO-BUILD`', 'no build'),
  'rule small 18px': swap('rules', 'minPx: 20,', 'minPx: 18,'),
  'rule flash per word 0.1': swap('rules', 'flashPerWord: 0.2,', 'flashPerWord: 0.1,'),
  'rule beat change 0.05%': swap('rules', 'minChange: 0.005,', 'minChange: 0.0005,'),
  'rule psnr 30': swap('rules', 'psnr: 45,', 'psnr: 30,'),
  'check no reverse pass': swap('check', 'for (const t of [...times].reverse())', 'for (const t of times)'),
  'check culprit on the warm page': swap('check', 'const p = await newPage();', 'const p = page;'),
  'check keeps the chrome in builds': swap('check', "await page.addStyleTag({ content: '#progress,#sub,#chap,#brand,#glow{visibility:hidden!important}' });", ''),
  'check never fails': swap('check', 'process.exit(fails ? 1 : 0)', 'process.exit(0)'),
  'check skips the contract scan': swap('check', "scanScenes(readFileSync(path.join(work, 'scenes.js'), 'utf8'))", '[]'),
  'pack 5 rounds': swap('pack', 'export const MAX_ROUNDS = 3;', 'export const MAX_ROUNDS = 5;'),
  'pack no phone sheet': swap('pack', /phone-360\.png/g, 'phone.png'),
  'media cwd first': swap('media', '[...extraRoots, toolingDir(), process.cwd()]', '[process.cwd(), ...extraRoots, toolingDir()]'),
  'media walks parents': swap('media', "existsSync(path.join(dir, 'package.json'))", 'true'),
};

describe('explain-video checks: contract', () => {
  it('shipped files break no rule', () => {
    expect(problems(SHIPPED)).toEqual([]);
  });
  it.each(Object.entries(mutants))('mutant "%s" is caught', (_name, mutate) => {
    const mutated = mutate(SHIPPED);
    expect(JSON.stringify(mutated)).not.toBe(JSON.stringify(SHIPPED));
    expect(problems(mutated).length).toBeGreaterThan(0);
  });
  it('keeps SKILL.md under 200 lines', () => {
    expect(SKILL.split('\n').length).toBeLessThan(200);
  });
  it('credits take-one and copies none of its Apache-2.0 files', () => {
    for (const src of [CHECK, PACK, BRIEF]) expect(src).toMatch(/take-one/);
    const all = fs.readdirSync(path.join(DIR, 'scripts')).map((f) => read('scripts', f)).join('\n');
    expect(all).not.toMatch(/anidoodle|Apache License/);
  });
});

// ---------- the pure rules, through fixtures
type Mod = typeof import('../scripts/checks.mjs');
const load = async (src: string): Promise<Mod> => {
  const file = path.join(tmp('vs-checks-mutant-'), 'checks.mjs');
  fs.writeFileSync(file, src);
  return import(pathToFileURL(file).href);
};
type Item = { id: string; text: string; px: number; x: number; y: number; w: number; h: number; scene: string; ok?: boolean };
// Text `item` on screen from `from` to `to` (exclusive), sampled every `step`.
const series = (step: number, end: number, shows: Array<{ from: number; to: number; item: Item | ((t: number) => Item) }>) => {
  const out = [];
  for (let t = 0; t < end - 1e-9; t = Number((t + step).toFixed(3))) {
    out.push({ t, items: shows.filter((s) => t >= s.from - 1e-9 && t < s.to - 1e-9).map((s) => (typeof s.item === 'function' ? s.item(t) : s.item)) });
  }
  return out;
};
const item = (id: string, text: string, extra: Partial<Item> = {}): Item => ({ id, text, px: 30, x: 200, y: 200, w: 400, h: 40, scene: 's', ...extra });
const kinds = (m: Mod, s: ReturnType<typeof series>, end: number) =>
  m.textIssues(m.textSpans(s, 0.1), { step: 0.1, end }).map((i: { level: string; kind: string }) => `${i.level} ${i.kind}`);

// Each probe returns true when the rule behaves; every rule mutant must fail one.
const probes: Record<string, (m: Mod) => boolean> = {
  'FLASH fails a 6-word card up 0.5 s': (m) => kinds(m, series(0.1, 5, [{ from: 1, to: 1.5, item: item('a', 'six words on this card here') }]), 5).includes('FAIL FLASH'),
  'FLASH warns just under the need': (m) => kinds(m, series(0.1, 5, [{ from: 1, to: 2.2, item: item('a', 'six words on this card here') }]), 5).includes('WARN FLASH'),
  'FLASH passes text held long enough': (m) => kinds(m, series(0.1, 5, [{ from: 1, to: 2.8, item: item('a', 'six words on this card here') }]), 5).length === 0,
  'FLASH ignores text still up at the end': (m) => kinds(m, series(0.1, 5, [{ from: 4.6, to: 5, item: item('a', 'six words on this card here') }]), 5).length === 0,
  'a typed line is one piece from its first letter': (m) => {
    const typed = (t: number) => item('term', 'npm install nile'.slice(0, Math.max(1, Math.round((t - 1) * 10))));
    const spans = m.textSpans(series(0.1, 6, [{ from: 1, to: 4, item: typed }]), 0.1);
    return spans.length === 1 && spans[0].from === 1 && spans[0].text === 'npm install nile';
  },
  'SMALL fails 18px held a second': (m) => kinds(m, series(0.1, 5, [{ from: 1, to: 2, item: item('a', 'label', { px: 18 }) }]), 5).includes('FAIL SMALL'),
  'SMALL passes 20px': (m) => !kinds(m, series(0.1, 5, [{ from: 1, to: 3, item: item('a', 'label', { px: 20 }) }]), 5).includes('FAIL SMALL'),
  'SMALL ignores a pop that settles at 20px': (m) => !kinds(m, series(0.1, 5, [{ from: 1, to: 3, item: (t) => item('a', 'label', { px: t < 1.3 ? 12 : 20 }) }]), 5).includes('FAIL SMALL'),
  'LONG warns a 120px title held 8 s': (m) => kinds(m, series(0.1, 12, [{ from: 1, to: 9, item: item('a', 'Title', { px: 120 }) }]), 12).includes('WARN LONG'),
  'LONG leaves a changing counter alone': (m) => !kinds(m, series(0.1, 12, [{ from: 1, to: 9, item: (t) => item('a', String(Math.round(840 - t * 50)), { px: 72 }) }]), 12).includes('WARN LONG'),
  'LONG leaves body copy alone': (m) => !kinds(m, series(0.1, 12, [{ from: 1, to: 9, item: item('a', 'Body copy', { px: 30 }) }]), 12).includes('WARN LONG'),
  'OVERLAP fails two still texts on each other': (m) => kinds(m, series(0.1, 5, [{ from: 1, to: 3, item: item('a', 'first label') }, { from: 1, to: 3, item: item('b', 'second label', { x: 220, y: 210 }) }]), 5).includes('FAIL OVERLAP'),
  'OVERLAP warns when one moves across': (m) => kinds(m, series(0.1, 5, [{ from: 1, to: 3, item: item('a', 'first label') }, { from: 1, to: 3, item: (t) => item('b', 'second label', { x: 100 + t * 60, y: 210 }) }]), 5).includes('WARN OVERLAP'),
  'OVERLAP respects data-overlap-ok': (m) => !kinds(m, series(0.1, 5, [{ from: 1, to: 3, item: item('a', 'first label', { ok: true }) }, { from: 1, to: 3, item: item('b', 'second label', { x: 220, y: 210 }) }]), 5).some((k) => k.endsWith('OVERLAP')),
  'OVERLAP ignores side-by-side texts': (m) => !kinds(m, series(0.1, 5, [{ from: 1, to: 3, item: item('a', 'first label') }, { from: 1, to: 3, item: item('b', 'second label', { x: 700 }) }]), 5).some((k) => k.endsWith('OVERLAP')),
  'contract scan names the line': (m) => {
    const found = m.scanScenes("scene('a', (R) => {\n  // Math.random() in a comment is fine\n  const j = Math.random();\n  e.style.transition = 'opacity 1s';\n  setTimeout(() => {}, 10);\n  const now = Date.now();\n});");
    return JSON.stringify(found.map((i: { line: number }) => i.line)) === '[3,4,5,6]';
  },
  'contract scan passes the example scenes': (m) => m.scanScenes(read('assets', 'scenes.example.js')).length === 0,
  'determinism accepts equal draws and >45 dB': (m) => m.compareDraws({ 0: 'a', 1: 'b' }, { 0: 'a', 1: 'c' }, () => 50).length === 0,
  'determinism fails a 30 dB mismatch': (m) => JSON.stringify(m.compareDraws({ 0: 'a', 1: 'b' }, { 0: 'a', 1: 'c' }, () => 30)) === '[{"t":1,"psnr":30}]',
  'sample times cover 0 and the last frame': (m) => {
    const ts = m.sampleTimes(10, 12, 30);
    return ts.length === 12 && ts[0] === 0 && ts[11] === 9.967;
  },
  'changed fraction counts pixels above 4/255': (m) => m.changedFraction(Uint8Array.from([0, 0, 10, 10]), Uint8Array.from([4, 5, 10, 30])) === 0.5,
  'NO-BUILD fails a beat under 0.5%': (m) => {
    const TL = { scenes: [{ id: 's', start: 0, dur: 10, beats: [{ t: 0.7, d: 3, text: 'one' }, { t: 4.2, d: 3, text: 'two' }] }] };
    const w = m.beatWindows(TL);
    return m.beatIssues(w, [0.02, 0.002]).map((i: { kind: string; at: number }) => `${i.kind}@${i.at}`).join() === 'NO-BUILD@4.2';
  },
  'NO-BUILD passes a declared hold': (m) => {
    const TL = { scenes: [{ id: 's', start: 0, dur: 10, beats: [{ t: 0.7, d: 3, text: 'one' }, { t: 4.2, d: 3, text: 'two' }] }] };
    return m.beatIssues(m.beatWindows(TL, ['s:1']), [0.02, 0.002]).length === 0;
  },
  'beat windows skip the crossfades': (m) => {
    const TL = { scenes: [{ id: 's', start: 10, dur: 8, beats: [{ t: 0.7, d: 3, text: 'one' }, { t: 4.2, d: 3, text: 'two' }] }] };
    return JSON.stringify(m.beatWindows(TL).map((w: { from: number; to: number }) => [w.from, w.to])) === '[[10.45,14.2],[14.2,17.55]]';
  },
  'pack plan times beats and cuts': (m) => {
    const TL = { total: 50, scenes: [{ id: 'a', start: 0, dur: 10, beats: [{ t: 0.7, d: 3, text: 'x' }] }, { id: 'b', start: 10, dur: 40, beats: [{ t: 0.7, d: 3, text: 'y' }] }] };
    const plan = m.packPlan(TL);
    return plan.beats.map((b: { t: number }) => b.t).join() === '3.7,13.7' && plan.cuts[0].from === 9.8 && plan.sheets === 2;
  },
};
const ruleMutants: Record<string, [string | RegExp, string]> = {
  'flash rule off': ['if (span.words > 0 && held < need && !atEnd)', 'if (false)'],
  'flash fails everything': ["held < need * RULES.flashFail ? 'FAIL' : 'WARN'", "'FAIL'"],
  'flash ignores the end': ['const atEnd = span.to >= end - step;', 'const atEnd = false;'],
  'typed text splits per letter': ['if (span && t - span.last <= step * 1.5 + 1e-9) {', 'if (span && span.text === item.text && t - span.last <= step * 1.5 + 1e-9) {'],
  'small uses the smallest size': ['span.maxPx = Math.max(span.maxPx, item.px);', 'span.maxPx = Math.min(span.maxPx, item.px);'],
  'small threshold 16': ['minPx: 20,', 'minPx: 16,'],
  'long off': ["add('WARN', 'LONG', span,", "void ('WARN', 'LONG', span,"],
  'long counts a changing counter': ['held > RULES.longHold && !span.changed', 'held > RULES.longHold'],
  'overlap off': ['if (held + 1e-9 < RULES.overlapHold) continue;', 'continue;'],
  'overlap ignores ok': ['if (a.ok || b.ok || a.text === b.text', 'if (a.text === b.text'],
  'overlap never warns': ["level: still(hits) && still(both) ? 'FAIL' : 'WARN',", "level: 'FAIL',"],
  'overlap any distance': ['return x >= 0.2 * Math.min(a.w, b.w) && y >= 0.25 * Math.min(a.h, b.h) && x > 0 && y > 0;', 'return true;'],
  'scan reads comments': ['stripComments(source).split', 'source.split'],
  'scan misses transitions': ["|\\.(animation|transition)\\w*\\s*=", ''],
  'determinism trusts any psnr': ['.filter(({ psnr: db }) => !(db > RULES.psnr));', ';'],
  'change threshold 0': ['if (Math.abs(a[i] - b[i]) > threshold) changed += 1;', 'if (Math.abs(a[i] - b[i]) >= threshold) changed += 1;'],
  'holds ignored': ['w.hold || fractions[i] >= RULES.minChange', 'fractions[i] >= RULES.minChange'],
  'windows include the fade': ['const from = i === 0 ? Math.min(0.45, beat.t) : beat.t;', 'const from = i === 0 ? 0 : beat.t;'],
  'last sample dropped': ['const last = Math.max(0, total - 1 / fps);', 'const last = Math.max(0, total - 1);'],
};

describe('explain-video checks: rules on fixtures', () => {
  it.each(Object.entries(probes))('%s', async (_name, probe) => {
    expect(probe(await load(RULES_SRC))).toBe(true);
  });
  it.each(Object.entries(ruleMutants))('rule mutant "%s" fails a probe', async (_name, [from, to]) => {
    const src = RULES_SRC.replace(from, to);
    expect(src).not.toBe(RULES_SRC);
    const m = await load(src);
    const broken = Object.entries(probes).filter(([, probe]) => {
      try {
        return !probe(m);
      } catch {
        return true;
      }
    });
    expect(broken.length).toBeGreaterThan(0);
  });
});

// ---------- Playwright lookup order
describe('explain-video Playwright lookup', () => {
  const fakePkg = (modules: string, name = 'playwright-core') => {
    const dir = path.join(modules, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, main: 'index.js' }));
    fs.writeFileSync(path.join(dir, 'index.js'), '');
    return fs.realpathSync(path.join(dir, 'index.js'));
  };
  const lookup = (cwd: string, work: string, tooling: string, explicit?: string) => {
    const code = `import(${JSON.stringify(pathToFileURL(script('media.mjs')).href)}).then((m) => process.stdout.write(String(m.resolvePlaywright([${JSON.stringify(work)}]))))`;
    const out = spawnSync(process.execPath, ['-e', code], {
      cwd,
      encoding: 'utf8',
      env: { PATH: '/nonexistent', HOME: tmpdir(), VS_TOOLING_DIR: tooling, ...(explicit ? { PLAYWRIGHT_MODULE: explicit } : {}) },
    });
    const found = out.stdout.trim();
    return found === 'null' ? null : fs.realpathSync(found);
  };
  it('prefers PLAYWRIGHT_MODULE, then the work dir, then the tool cache, then cwd', () => {
    const root = tmp('vs-pw-order-');
    const parent = path.join(root, 'parent');
    const cwd = path.join(parent, 'project');
    const work = path.join(root, 'work');
    const tooling = path.join(root, 'tooling');
    for (const d of [cwd, work, tooling]) fs.mkdirSync(d, { recursive: true });
    // A parent directory's node_modules never counts.
    fakePkg(path.join(parent, 'node_modules'));
    expect(lookup(cwd, work, tooling)).toBeNull();
    const inCwd = fakePkg(path.join(cwd, 'node_modules'));
    expect(lookup(cwd, work, tooling)).toBe(inCwd);
    const inTooling = fakePkg(path.join(tooling, 'node_modules'));
    expect(lookup(cwd, work, tooling)).toBe(inTooling);
    const inWork = fakePkg(path.join(work, 'node_modules'));
    expect(lookup(cwd, work, tooling)).toBe(inWork);
    const explicitDir = path.join(root, 'explicit', 'node_modules');
    const inExplicit = fakePkg(explicitDir);
    expect(lookup(cwd, work, tooling, path.join(explicitDir, 'playwright-core'))).toBe(inExplicit);
  });
});

// ---------- end to end: the real page, when Chrome and Playwright are here
const resolved = spawnSync(process.execPath, ['-e', `import(${JSON.stringify(pathToFileURL(script('media.mjs')).href)}).then((m) => process.stdout.write(String(m.resolvePlaywright([]))))`], { encoding: 'utf8' }).stdout.trim();
const hasFfmpeg = spawnSync('/bin/sh', ['-c', 'command -v ffmpeg && command -v ffprobe']).status === 0;
const hasChrome = spawnSync('/bin/sh', ['-c', 'command -v google-chrome || command -v chromium || test -d "/Applications/Google Chrome.app"']).status === 0;
const canBrowse = resolved !== 'null' && resolved !== '' && hasFfmpeg && hasChrome;
const ENV = { ...process.env, VS_EXPLAIN_VIDEO_NO_INSTALL: '1' };

// A timeline without TTS: about 2.6 words a second, the narrate.mjs gaps.
function fakeWork(scenesJs?: string, scriptJson?: object): string {
  const home = tmp('vs-check-home-');
  const fonts = path.join(home, '.cache', 'vs-explain-video', 'fonts');
  fs.mkdirSync(fonts, { recursive: true });
  for (const f of ['SpaceGrotesk.ttf', 'JetBrainsMono.ttf']) fs.writeFileSync(path.join(fonts, f), '');
  const work = path.join(home, 'work');
  expect(spawnSync(process.execPath, [script('init.mjs'), work], { env: { ...process.env, HOME: home } }).status).toBe(0);
  if (scenesJs) fs.writeFileSync(path.join(work, 'scenes.js'), scenesJs);
  if (scriptJson) fs.writeFileSync(path.join(work, 'script.json'), JSON.stringify(scriptJson));
  const s = JSON.parse(fs.readFileSync(path.join(work, 'script.json'), 'utf8'));
  const r = (x: number) => Number(x.toFixed(3));
  let clock = 0;
  const subs: Array<[number, number, string]> = [];
  const scenes = s.scenes.map((scene: { id: string; title?: string; beats: string[] }) => {
    const start = clock;
    clock += 0.7;
    const beats = scene.beats.map((text, i) => {
      const d = text.split(/\s+/).length / 2.6;
      const beat = { t: r(clock - start), d: r(d), text };
      subs.push([r(clock), r(clock + d), text.slice(0, 58)]);
      clock += d + (i < scene.beats.length - 1 ? 0.45 : 1);
      return beat;
    });
    return { id: scene.id, title: scene.title ?? scene.id, start: r(start), dur: r(clock - start), beats };
  });
  fs.writeFileSync(path.join(work, 'timeline.js'), `window.TL = ${JSON.stringify({ title: s.title, brand: s.brand, fps: 30, total: r(clock), scenes, subs })};\n`);
  return work;
}
const check = (work: string, ...flags: string[]) => {
  const out = spawnSync(process.execPath, [script('check.mjs'), work, ...flags], { encoding: 'utf8', env: ENV, timeout: 240_000 });
  return { status: out.status, report: out.stdout ? JSON.parse(out.stdout) : null, stderr: out.stderr };
};

describe.skipIf(!canBrowse)('explain-video check.mjs on a real page', () => {
  it('passes the worked example with no FAIL', () => {
    const { status, report, stderr } = check(fakeWork());
    expect(status, stderr).toBe(0);
    expect(report.fails).toBe(0);
    expect(report.gate.mismatched).toEqual([]);
    expect(report.gate.beats.length).toBe(7);
  }, 240_000);

  it('fails random draws, a slide beat, a flashed card, small text, and overlap', () => {
    const work = fakeWork(`
scene('a', (R) => {
  const t1 = box(R, 160, 300, 0, 0, 'h2', 'A title');
  const n = box(R, 160, 500, 0, 0, 'h3', '');
  const flashCard = box(R, 1000, 300, 0, 0, 'h3', 'six words flash by too fast');
  const tiny = box(R, 1000, 600, 0, 0, '', 'tiny print');
  tiny.style.fontSize = '14px';
  const l1 = box(R, 160, 700, 0, 0, 'h3', 'first label');
  const l2 = box(R, 170, 705, 0, 0, 'h3', 'second label');
  return (t, B) => {
    rise(t1, t, 0.1);
    n.textContent = String(Math.floor(Math.random() * 1000));
    flashCard.style.opacity = t > B[0] && t < B[0] + 0.5 ? 1 : 0;
    tiny.style.opacity = 1;
  };
});`, { scenes: [{ id: 'a', beats: ['The first line is spoken here for a while.', 'The second line changes nothing on the screen at all.'] }] });
    const { status, report } = check(work);
    expect(status).toBe(1);
    const found = new Set(report.issues.map((i: { kind: string }) => i.kind));
    for (const kind of ['CONTRACT', 'DETERMINISM', 'NO-BUILD', 'FLASH', 'SMALL', 'OVERLAP']) expect(found, kind).toContain(kind);
  }, 240_000);

  it('names the frame that leaves state behind', () => {
    const work = fakeWork(`
scene('a', (R) => {
  const b = box(R, 160, 300, 600, 200, 'card', '');
  return (t) => {
    if (t > 3) b.style.background = '#ff6b5b';
    rise(b, t, 0.1);
  };
});`, { scenes: [{ id: 'a', beats: ['A card turns red after three seconds and stays that way for good.'] }] });
    const { status, report } = check(work, '--gate');
    expect(status).toBe(1);
    const det = report.issues.find((i: { kind: string }) => i.kind === 'DETERMINISM');
    expect(det.detail).toMatch(/ORDER-DEPENDENT: drawing [\d.]+s first changes the frame at [\d.]+s/);
  }, 240_000);
});

describe.skipIf(!hasFfmpeg)('explain-video pack.mjs', () => {
  it('writes the reviewer pack, numbers rounds, and refuses a fourth', () => {
    const work = fakeWork();
    const TL = JSON.parse(fs.readFileSync(path.join(work, 'timeline.js'), 'utf8').replace(/^window\.TL = /, '').replace(/;\s*$/, ''));
    const video = path.join(work, 'v.mp4');
    expect(spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc=size=1920x1080:rate=30:duration=${TL.total}`, '-pix_fmt', 'yuv420p', video]).status).toBe(0);
    for (const round of [1, 2, 3]) {
      const out = spawnSync(process.execPath, [script('pack.mjs'), work, video], { encoding: 'utf8' });
      expect(out.status, out.stderr).toBe(0);
      const report = JSON.parse(out.stdout);
      expect(report.round).toBe(round);
      const files = fs.readdirSync(report.pack);
      for (const f of ['sheet-1fps-1.png', 'beats-1.png', 'phone-360.png', 'strip-cut-miss.png', 'strip-cut-fix.png', 'WORDS.md', 'BRIEF.md']) expect(files, f).toContain(f);
      const brief = fs.readFileSync(report.brief, 'utf8');
      expect(brief).toContain(report.pack);
      expect(brief).toContain(`round ${round} of 3`);
      expect(brief).not.toMatch(/\[pack folder\]|\[video\]|<!--/);
      const words = fs.readFileSync(path.join(report.pack, 'WORDS.md'), 'utf8');
      expect(words).toContain('Why does the same search miss the CDN cache every time');
      expect(words).toMatch(/- 0:00\.7 Search answers slowly/);
    }
    const fourth = spawnSync(process.execPath, [script('pack.mjs'), work, video], { encoding: 'utf8' });
    expect(fourth.status).toBe(1);
    expect(JSON.parse(fourth.stdout).next).toMatch(/Never report a pass that did not happen/);
  }, 120_000);
});
