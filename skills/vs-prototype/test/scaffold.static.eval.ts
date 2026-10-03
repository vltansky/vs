import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { afterAll, describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');
const SCAFFOLD = path.join(DIR, 'scripts', 'scaffold-prototype.mjs');
const SWITCHER = fs.readFileSync(path.join(DIR, 'assets', 'variant-switcher.js'), 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-prototype-scaffold-'));

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function scaffold(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return spawnSync(process.execPath, [SCAFFOLD, ...args], { encoding: 'utf8', ...options });
}

type Listener = (event: unknown) => void;

// Minimal DOM shim: enough surface for the switcher to init, publish its
// variant, and receive keydown events, without adding a DOM dependency.
function loadSwitcher(search: string) {
  const listeners = new Map<string, Listener[]>();
  const attrs = new Map<string, string>();
  const shadow = {
    innerHTML: '',
    querySelector: () => ({ textContent: '' }),
    querySelectorAll: () => [],
  };
  const context: Record<string, unknown> = {
    URL,
    URLSearchParams,
    AbortController,
    CustomEvent: class {
      type: string;
      detail: unknown;
      constructor(type: string, init: { detail: unknown }) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    location: { href: `file:///tmp/x-prototype.html${search}`, search },
    history: { state: null, replaceState: () => {} },
    prototypeVariants: [
      { id: 'a', label: 'Inline' },
      { id: 'b', label: 'Panel' },
      { id: 'c', label: 'Wizard' },
    ],
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    dispatchEvent: (event: { type: string }) => {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      return true;
    },
    document: {
      currentScript: null,
      readyState: 'complete',
      activeElement: null,
      documentElement: { setAttribute: (key: string, value: string) => attrs.set(key, value) },
      body: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, attachShadow: () => shadow, remove: () => {} }),
      querySelectorAll: () => [],
      addEventListener: () => {},
    },
  };
  context.window = context;
  vm.runInNewContext(SWITCHER, context);
  const events: string[] = [];
  (context.addEventListener as (t: string, fn: Listener) => void)('prototype:variant', (event) =>
    events.push((event as { detail: { id: string } }).detail.id),
  );
  const press = (key: string, target: object) => {
    let prevented = false;
    for (const fn of listeners.get('keydown') ?? [])
      fn({ key, target, composedPath: () => [target], preventDefault: () => (prevented = true) });
    return prevented;
  };
  const current = () => (context.prototypeVariant as { id: string }).id;
  return { press, current, attrs, events };
}

const el = (tagName: string, extra: object = {}) => ({ nodeType: 1, tagName, closest: () => null, ...extra });

describe('vs-prototype scaffold', () => {
  it('scaffolds a single-file ui lookalike with capped variants and the switcher inlined', () => {
    const out = path.join(TMP, 'ui');
    const run = scaffold(['--kind', 'ui', '--topic', 'checkout', '--variants', '9', '--labels', 'Inline,Panel', '--out', out]);
    expect(run.status).toBe(0);
    expect(run.stderr).toMatch(/Capping variants at 5/);
    const file = path.join(out, 'checkout-prototype.html');
    expect(run.stdout).toContain(file);
    expect(fs.readdirSync(out)).toEqual(['checkout-prototype.html']);
    const html = fs.readFileSync(file, 'utf8');
    // Line-anchored so the inlined switcher's doc comment does not count as a slot.
    const slots = [...html.matchAll(/^\s*<template data-variant="([a-z])"/gm)].map((m) => m[1]);
    expect(slots).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(html).toContain('data-label="Inline"');
    expect(html).toContain('data-label="Direction C"');
    expect(html).not.toMatch(/\[\[|variant-slot:|src="\.\/variant-switcher\.js"/);
    expect(html).toContain('window.prototypeVariantSwitcher');
    expect(html).toMatch(/PROTOTYPE · checkout/);
    expect(html).toContain('id="prototype-state-json"');
    expect(html).not.toMatch(/^\s*<script[^>]+src=/m);
  });

  it('refuses to overwrite an existing prototype', () => {
    const out = path.join(TMP, 'ui');
    const file = path.join(out, 'checkout-prototype.html');
    fs.writeFileSync(file, 'edited by hand');
    const run = scaffold(['--kind', 'ui', '--topic', 'checkout', '--out', out]);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Refusing to overwrite/);
    expect(fs.readFileSync(file, 'utf8')).toBe('edited by hand');
  });

  it('scaffolds a logic harness that runs under node with piped input', () => {
    const out = path.join(TMP, 'logic');
    const run = scaffold(['--kind', 'logic', '--topic', 'sync-queue', '--out', out]);
    expect(run.status).toBe(0);
    const file = path.join(out, 'sync-queue-prototype.ts');
    expect(run.stdout).toContain(`Run: node "${file}"`);
    const harness = spawnSync(process.execPath, [file], { input: 's\na 4\ns\nq\n', encoding: 'utf8', timeout: 10_000 });
    expect(harness.status).toBe(0);
    expect(harness.stdout).toMatch(/PROTOTYPE · sync-queue prototype/);
    expect(harness.stdout).toMatch(/"count": 4/);
    expect(harness.stdout).toMatch(/Rejected: cannot start from running/);
  });

  it('defaults to ~/.vs/$PROJECT_ID/prototypes/<topic>/ and rejects bad usage', () => {
    const home = path.join(TMP, 'home');
    const cwd = path.join(TMP, 'no-remote-project');
    fs.mkdirSync(home);
    fs.mkdirSync(cwd);
    const env = { ...process.env, HOME: home, GIT_CEILING_DIRECTORIES: TMP };
    const run = scaffold(['--kind', 'logic', '--topic', 'flow'], { cwd, env });
    expect(run.status).toBe(0);
    expect(fs.existsSync(path.join(home, '.vs', 'no-remote-project', 'prototypes', 'flow', 'flow-prototype.ts'))).toBe(true);
    expect(scaffold(['--kind', 'nope', '--topic', 'x', '--out', TMP]).status).toBe(2);
    expect(scaffold(['--kind', 'ui', '--topic', 'Bad Topic', '--out', TMP]).status).toBe(2);
  });
});

describe('vs-prototype variant switcher', () => {
  it('reads ?variant= and publishes it on window, <html>, and the event', () => {
    const s = loadSwitcher('?variant=b');
    expect(s.current()).toBe('b');
    expect(s.attrs.get('data-variant')).toBe('b');
    s.press('ArrowRight', el('DIV'));
    expect(s.current()).toBe('c');
    expect(s.events).toEqual(['c']);
    s.press('ArrowRight', el('DIV'));
    expect(s.current()).toBe('a');
    s.press('ArrowLeft', el('DIV'));
    expect(s.current()).toBe('c');
  });

  it('ignores arrow keys inside inputs, textareas, selects, and contenteditable', () => {
    const s = loadSwitcher('');
    for (const target of [
      el('INPUT'),
      el('TEXTAREA'),
      el('SELECT'),
      el('DIV', { isContentEditable: true }),
      el('SPAN', { closest: () => ({ getAttribute: () => 'true' }) }),
    ]) {
      expect(s.press('ArrowRight', target)).toBe(false);
    }
    expect(s.current()).toBe('a');
    expect(s.events).toEqual([]);
  });
});

describe('vs-prototype SKILL points at the shipped assets', () => {
  it('scaffolds instead of hand-writing switcher and harness', () => {
    expect(SKILL).toMatch(/Do\s+not\s+hand-write\s+the\s+switcher/);
    expect(SKILL).toMatch(/scripts\/scaffold-prototype\.mjs\s+--kind\s+ui/);
    expect(SKILL).toMatch(/scripts\/scaffold-prototype\.mjs\s+--kind\s+logic/);
    expect(SKILL).toMatch(/copy\s+`assets\/variant-switcher\.js`/);
    expect(SKILL).toMatch(/behind\s+the\s+dev\s+gate/);
    expect(SKILL).toMatch(/It\s+never\s+overwrites/);
    expect(SKILL).toMatch(/Gate\s+the\s+switcher\s+and\s+prototype-only\s+branches\s+out\s+of\s+production/);
  });
});
