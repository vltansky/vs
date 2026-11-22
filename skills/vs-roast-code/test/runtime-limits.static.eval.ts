import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// mt-reports failure class: scheduled Cloud Functions shipped on the platform default
// memory and were OOM-killed. Review (roast-code) must flag a function with no memory set
// either on the function or as a repo-level default, and build-it must set one when it writes
// the function without re-adding overrides a repo default already covers. `problems` returns
// every broken rule; the shipped skills return none, and each mutant must return some.

const SKILLS = path.resolve(__dirname, '..', '..');
const ROAST = fs.readFileSync(path.join(SKILLS, 'vs-roast-code', 'SKILL.md'), 'utf8');
const BUILD = fs.readFileSync(path.join(SKILLS, 'vs-build-it', 'SKILL.md'), 'utf8');
const FIXTURES = path.join(__dirname, 'fixtures');

function section(text: string, from: string, to: string) {
  const a = text.indexOf(from);
  if (a === -1) return '';
  const b = text.indexOf(to, a + from.length);
  return text.slice(a, b === -1 ? undefined : b);
}

function lensOf(roast: string) {
  const parent = section(roast, '### Parent Roast', '### Ponytail pass');
  return section(parent, '- **Runtime limits (serverless deploy config)**', '\n\n');
}

// The two `rg -n '<pattern>'` sweeps the lens tells the reviewer to run, as JS regexes.
function sweeps(lens: string) {
  return [...lens.matchAll(/`rg -n '([^']+)' [^`]+`/g)].map((m) => new RegExp(m[1].replace(/\\\(/g, '\\(')));
}

function hits(re: RegExp, dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => re.test(l) && out.push(`${path.relative(dir, p)}:${i + 1}`));
    }
  };
  walk(dir);
  return out;
}

function problems(roast: string, build: string): string[] {
  const out: string[] = [];
  const lens = lensOf(roast);
  const pass1 = section(roast, '## Pass 1: Simplify', '## Pass 2:');
  if (!lens) return ['roast: parent roast has no serverless runtime-limits lens'];
  if (/memory/i.test(pass1)) out.push('roast: platform-specific memory rule sits in the generic pass-1 checklist');
  if (!/only when scope defines a\s+Cloud Function, Lambda, Cloud Run service, or scheduled job/.test(lens)) out.push('roast: lens not scoped to serverless code');
  const globalAt = lens.search(/Check the repo-level default first/);
  const perFnAt = lens.search(/Then find each\s+definition in scope/);
  if (globalAt === -1 || perFnAt === -1 || globalAt > perFnAt) out.push('roast: per-function sweep before the repo-level default check');
  if (!/A repo-level default\s+counts as explicit: do not ask for per-function overrides/.test(lens)) out.push('roast: global default not treated as explicit');
  if (!/setGlobalOptions\(\{ memory \}\)/.test(lens)) out.push('roast: no Firebase global-default example');
  if (!/Cite each function that has neither at file:line as a FELONY/.test(lens)) out.push('roast: not cited or ranked');
  if (/(?:platform|provider) default (?:memory )?is (?:fine|acceptable|safe)/i.test(roast)) out.push('roast: default memory accepted');

  // Executable: the sweeps the lens prints must find what they claim on the fixtures.
  const [globalRe, defRe] = sweeps(lens);
  if (!globalRe || !defRe) out.push('roast: lens lost its rg sweeps');
  else {
    if (hits(globalRe, path.join(FIXTURES, 'functions-memory-global')).filter((h) => h.startsWith('src/index.ts')).length < 1)
      out.push('roast: global-default sweep misses setGlobalOptions');
    if (hits(globalRe, path.join(FIXTURES, 'functions-memory')).length !== 0) out.push('roast: global-default sweep false-positives');
    if (hits(defRe, path.join(FIXTURES, 'functions-memory', 'src')).filter((h) => h.startsWith('schedulers.ts')).length < 2)
      out.push('roast: definition sweep misses scheduled functions');
  }

  const step = section(build, '### Step 1f: Set runtime limits explicitly', '## Phase 1: Roast the Plan');
  if (!step) return [...out, 'build-it: no runtime-limits step'];
  if (!/When the repo sets a default \(`setGlobalOptions\(\{ memory \}\)` or an equivalent\),\s+the function inherits it: do not add a per-function override/.test(step))
    out.push('build-it: re-adds overrides over a repo default');
  if (!/With no repo-level default, set `memory`\s+explicitly/.test(step)) out.push('build-it: memory not set explicitly');
  if (!/and the\s+source of that value, in the plan/.test(step)) out.push('build-it: value not recorded in plan');
  if (!/a function on it is an unfinished step/.test(step)) out.push('build-it: default memory counts as done');
  return out;
}

type Pair = [string, string];
const mutants: Record<string, (p: Pair) => Pair> = {
  'roast lens removed': ([r, b]) => [r.replace(/- \*\*Runtime limits \(serverless deploy config\)\*\*[\s\S]*?preferably once at repo level\.\n/, ''), b],
  'roast accepts default': ([r, b]) => [r.replace('gets OOM-killed as the bundle or data grows', 'the platform default memory is fine'), b],
  'roast demands per-function overrides': ([r, b]) => [r.replace('A repo-level default\n  counts as explicit: do not ask for per-function overrides.', 'Every function needs its own `memory`.'), b],
  'roast sweeps functions before the global default': ([r, b]) => [r.replace('Check the repo-level default first', 'After the definitions, check the repo-level default'), b],
  'roast skips file:line': ([r, b]) => [r.replace('Cite each function that has neither at file:line as a FELONY', 'Mention it'), b],
  'global sweep loses setGlobalOptions': ([r, b]) => [r.replace("`rg -n 'setGlobalOptions|Globals:|MemorySize' .`", "`rg -n 'Globals:|MemorySize' .`"), b],
  'definition sweep loses onSchedule': ([r, b]) => [r.replace("`rg -n 'onSchedule|onRequest", "`rg -n 'onRequest"), b],
  'rule back in pass-1 checklist': ([r, b]) => [r.replace('7. Reading entire files when only a portion is needed\n', '7. Reading entire files when only a portion is needed\n8. Serverless functions with no explicit memory limit\n'), b],
  'build-it step removed': ([r, b]) => [r, b.replace(/### Step 1f: Set runtime limits explicitly[\s\S]*?not a done one\.\n/, '')],
  'build-it re-adds overrides': ([r, b]) => [r, b.replace('the function inherits it: do not add a per-function override unless measurement\nshows this function needs more', 'still add a per-function `memory` override')],
  'build-it leaves default as done': ([r, b]) => [r, b.replace('a function on it is an unfinished step,\nnot a done one.', 'the default memory is fine for a first cut.')],
  'build-it does not record the value': ([r, b]) => [r, b.replace(', and the source of that value, in the plan', '')],
};

describe('runtime limits contract (roast-code + build-it)', () => {
  it('the shipped skills have no problems', () => {
    expect(problems(ROAST, BUILD)).toEqual([]);
  });
  it.each(Object.entries(mutants))('mutant "%s" is caught', (_n, mutate) => {
    const [r, b] = mutate([ROAST, BUILD]);
    expect(r + b).not.toBe(ROAST + BUILD);
    expect(problems(r, b).length).toBeGreaterThan(0);
  });
});
