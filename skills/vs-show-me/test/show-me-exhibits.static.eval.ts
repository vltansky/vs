import { pathToFileURL } from 'node:url';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const CATALOG_URL = pathToFileURL(
  path.resolve(__dirname, '../assets/definitions.mjs'),
).href;

type Node = {
  type: string;
  props: Record<string, unknown>;
  children: Array<Node | string | null | undefined>;
};

const stubReact = {
  createElement: (type: string, props: Record<string, unknown> | null, ...children: unknown[]) =>
    ({
      type,
      props: props ?? {},
      children: children.flat(Infinity),
    }) as Node,
};

function textOf(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  const el = node as Node;
  return (el.children ?? []).map(textOf).join('');
}

function walk(node: unknown, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  const el = node as Node;
  if (el.type) visit(el);
  (el.children ?? []).forEach((child) => walk(child, visit));
}

function findAll(root: unknown, pred: (n: Node) => boolean): Node[] {
  const out: Node[] = [];
  walk(root, (n) => {
    if (pred(n)) out.push(n);
  });
  return out;
}

function statefulReact(initial?: { selected?: string }) {
  const box: { selected?: string } = { ...initial };
  return {
    useState: <T,>(init: T): [T, (v: T | ((prev: T) => T)) => void] => {
      if (box.selected === undefined && typeof init === 'string') box.selected = init;
      const value = (box.selected as unknown as T) ?? init;
      return [
        value,
        (next) => {
          const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
          box.selected = resolved as unknown as string;
        },
      ];
    },
    createElement: stubReact.createElement,
    _box: box,
  };
}

describe('Machine — state machine with a screen per state', () => {
  const BODY = [
    '- state scheduled: Saved. Waiting for its time.',
    '- state sending: The worker holds it.',
    '- state sent final: Moved to Sent.',
    '- state failed: Kept, with the error.',
    '- state cancelled final: Back in Drafts.',
    '- scheduled -> sending: due',
    '- sending -> sent: ok',
    '- sending -> failed: fail',
    '- scheduled -> cancelled: cancel',
    '- failed -> cancelled: cancel',
    '- failed -> sending: retry',
    '- screen scheduled: Scheduled for Mon 8:00',
    '- screen sending: Sending…',
    '- screen sent: Sent',
    '- screen failed: Not sent',
    '- screen cancelled: Cancelled',
  ].join('\n');

  it('registers Machine next to Prediction in the catalog', async () => {
    const catalog = await import(CATALOG_URL);
    const names = catalog.components.map((c: { name: string }) => c.name);
    expect(names).toContain('Machine');
    expect(names.indexOf('Machine')).toBeLessThan(names.indexOf('Prediction'));
  });

  it('renders five states and shows exactly one screen for the default state', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const Machine = catalog.components.find((c: { name: string }) => c.name === 'Machine');
    expect(Machine).toBeTruthy();
    const element = Machine.Component({ initial: 'scheduled', body: BODY });
    const stateButtons = findAll(
      element,
      (n) => n.props?.['data-machine-state'] != null || n.props?.['data-state'] != null,
    );
    // Prefer dedicated state controls; fall back to any node tagged with a state id.
    const tagged = stateButtons.length
      ? stateButtons
      : findAll(element, (n) => typeof n.props?.['data-state'] === 'string');
    const ids = new Set(
      tagged.map((n) => String(n.props['data-machine-state'] ?? n.props['data-state'])),
    );
    expect(ids.size).toBe(5);
    expect(ids.has('failed')).toBe(true);

    const visibleScreens = findAll(
      element,
      (n) => n.props?.['data-machine-screen'] != null && n.props?.hidden !== true,
    );
    expect(visibleScreens).toHaveLength(1);
    expect(textOf(visibleScreens[0])).toContain('Scheduled for Mon 8:00');
  });

  it('shows only the failed screen after selecting failed', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const react = statefulReact();
    const catalog = vsCatalogFactory(react, vsLayoutCss);
    const Machine = catalog.components.find((c: { name: string }) => c.name === 'Machine');
    const first = Machine.Component({ initial: 'scheduled', body: BODY });
    const failedControl = findAll(
      first,
      (n) =>
        (n.props?.['data-machine-state'] === 'failed' || n.props?.['data-state'] === 'failed') &&
        typeof n.props?.onClick === 'function',
    )[0];
    expect(failedControl).toBeTruthy();
    (failedControl.props.onClick as () => void)();
    const after = Machine.Component({ initial: 'scheduled', body: BODY });
    const visibleScreens = findAll(
      after,
      (n) => n.props?.['data-machine-screen'] != null && n.props?.hidden !== true,
    );
    expect(visibleScreens).toHaveLength(1);
    expect(textOf(visibleScreens[0])).toContain('Not sent');
    expect(textOf(visibleScreens[0])).not.toContain('Scheduled for Mon 8:00');
  });

  it('raises when a named state has no screen', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const Machine = catalog.components.find((c: { name: string }) => c.name === 'Machine');
    const body = [
      '- state scheduled: Waiting.',
      '- state failed: Broken.',
      '- scheduled -> failed: fail',
      '- screen scheduled: ok',
    ].join('\n');
    const element = Machine.Component({ initial: 'scheduled', body });
    expect(textOf(element)).toMatch(/screen|no screen|missing/i);
    expect(findAll(element, (n) => n.props?.role === 'alert').length).toBeGreaterThan(0);
  });
});

describe('Code — line numbers, highlights, and notes', () => {
  const CODE_BODY = [
    'export async function assertUnderLimit(userId: string) {',
    '  const count = await store.countScheduled(userId)',
    '  if (count >= 50) {',
    '    throw new LimitError(50)',
    '  }',
    '  return count',
    '}',
    '',
    '// keep capacity headroom',
    'export const LIMIT = 50',
    '- @42 Throws when the user is already at the limit',
  ].join('\n');

  it('registers Code in the catalog', async () => {
    const catalog = await import(CATALOG_URL);
    expect(catalog.components.map((c: { name: string }) => c.name)).toContain('Code');
  });

  it('numbers the gutter from start and places a note after its line', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const Code = catalog.components.find((c: { name: string }) => c.name === 'Code');
    const element = Code.Component({
      start: '38',
      hl: '42',
      lang: 'ts',
      title: 'limits.ts',
      body: CODE_BODY,
    });
    const gutters = findAll(element, (n) => n.props?.['data-ln'] != null);
    const nums = gutters.map((n) => Number(n.props['data-ln']));
    expect(nums[0]).toBe(38);
    expect(nums[nums.length - 1]).toBe(47);
    expect(nums).toContain(42);

    const note = findAll(element, (n) => n.props?.['data-code-note'] === '42')[0];
    expect(note).toBeTruthy();
    expect(textOf(note)).toMatch(/Throws when the user is already at the limit/);

    // Highlighted line keeps its absolute number.
    const highlighted = findAll(
      element,
      (n) => n.props?.['data-ln'] === 42 || n.props?.['data-hl'] === true,
    );
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it('raises when a note cites a line outside the visible range', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const Code = catalog.components.find((c: { name: string }) => c.name === 'Code');
    const body = ['const x = 1', 'const y = 2', '- @99 outside'].join('\n');
    const element = Code.Component({ start: '10', body });
    expect(findAll(element, (n) => n.props?.role === 'alert').length).toBeGreaterThan(0);
    // The bad note must not render as a code-note; the alert may mention the range.
    expect(findAll(element, (n) => n.props?.['data-code-note'] != null)).toHaveLength(0);
    expect(textOf(element)).not.toMatch(/const x = 1/);
  });
});

describe('Tree — call-tree path column and mark counts', () => {
  it('puts @ path:line in its own cell and counts marks in the header', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const Tree = catalog.components.find((c: { name: string }) => c.name === 'Tree');
    const element = Tree.Component({
      body: '- + <SendLaterMenu/> @ web/a.tsx:12',
    });
    const header = findAll(element, (n) => n.props?.className?.toString().includes('vs-tree-stats'))[0];
    expect(header).toBeTruthy();
    expect(textOf(header)).toMatch(/\+1/);
    expect(textOf(header)).toMatch(/−0|−\s*0|-0/);
    expect(textOf(header)).toMatch(/~0/);

    const pathCell = findAll(element, (n) => n.props?.className?.toString().includes('vs-tree-path'))[0];
    expect(pathCell).toBeTruthy();
    expect(textOf(pathCell)).toBe('web/a.tsx:12');

    // Component name stays text in the label cell, not parsed as a nested tag.
    const label = findAll(element, (n) => n.props?.className?.toString().includes('vs-tree-label'))[0];
    expect(textOf(label)).toContain('<SendLaterMenu/>');
    // Path must not remain inline in the label.
    expect(textOf(label)).not.toContain('web/a.tsx:12');
  });

  it('does not throw when a row carries a Component-shaped name', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const Tree = catalog.components.find((c: { name: string }) => c.name === 'Tree');
    expect(() =>
      Tree.Component({
        body: '- + <SendLaterMenu/> @ web/a.tsx:12\n  - POST /api/scheduled @ web/api.ts:9',
      }),
    ).not.toThrow();
  });
});

describe('Mock — pins on markup mocks', () => {
  const MOCK_BODY = [
    '- markup: <div class="ui" style="position:relative;width:240px;height:48px"><button type="button" id="send-later" data-ref="send-later" style="position:absolute;left:120px;top:12px;width:96px;height:28px">Send later</button></div>',
    '- #send-later New button',
  ].join('\n');

  it('registers Mock in the catalog', async () => {
    const catalog = await import(CATALOG_URL);
    expect(catalog.components.map((c: { name: string }) => c.name)).toContain('Mock');
  });

  it('places marker 1 within 8px of the named element', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const Mock = catalog.components.find((c: { name: string }) => c.name === 'Mock');
    const element = Mock.Component({ body: MOCK_BODY });

    // Markers are injected into the mock markup so they ride the named element.
    const frame = findAll(element, (n) => n.props?.dangerouslySetInnerHTML != null)[0];
    expect(frame).toBeTruthy();
    const html = String((frame.props.dangerouslySetInnerHTML as { __html: string }).__html);
    expect(html).toMatch(/id=["']send-later["']/);
    const markerMatch = html.match(
      /<span class="vs-mock-marker"[^>]*data-pin-for="#send-later"[^>]*style="([^"]*)"[^>]*>\s*1\s*<\/span>/,
    );
    expect(markerMatch).toBeTruthy();
    const style = markerMatch![1];
    const offset = (prop: string) => {
      const m = style.match(new RegExp(prop + ':\\s*(-?\\d+(?:\\.\\d+)?)px'));
      return m ? Math.abs(Number(m[1])) : Infinity;
    };
    // Marker sits on the element's corner; reported offset must be ≤ 8px.
    expect(Math.min(offset('top'), offset('right'), offset('left'), offset('bottom'))).toBeLessThanOrEqual(8);
    // Marker appears inside the #send-later element, not as a free-floating overlay.
    expect(html.indexOf('id="send-later"')).toBeLessThan(html.indexOf('vs-mock-marker'));
    expect(html.indexOf('vs-mock-marker')).toBeLessThan(html.indexOf('</button>'));

    const legend = findAll(element, (n) => n.type === 'ol' || n.props?.className?.toString().includes('vs-mock-legend'))[0];
    expect(textOf(legend)).toMatch(/New button/);
  });

  it('raises when a pin names a missing element', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const Mock = catalog.components.find((c: { name: string }) => c.name === 'Mock');
    const body = [
      '- markup: <div class="ui"><span id="send">Send</span></div>',
      '- #send-later Missing target',
    ].join('\n');
    const element = Mock.Component({ body });
    expect(findAll(element, (n) => n.props?.role === 'alert').length).toBeGreaterThan(0);
    expect(textOf(element)).toMatch(/send-later|missing|no element/i);
  });
});
