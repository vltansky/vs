import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const ARTIFACT = fs.readFileSync(
  path.join(SKILL_DIR, 'assets', 'artifact.html'),
  'utf8',
);
const CATALOG_URL = pathToFileURL(
  path.join(SKILL_DIR, 'assets', 'definitions.mjs'),
).href;

describe('the vs catalog is one source the CLI and the browser both load', () => {
  it('exports the vs layout and theme as data the CLI can register', async () => {
    const catalog = await import(CATALOG_URL);
    expect(catalog.layouts.map((l: { name: string }) => l.name)).toEqual(['vs']);
    expect(typeof catalog.layouts[0].Component).toBe('function');
    expect(catalog.themes).toHaveLength(1);
    expect(catalog.themes[0].id).toBe('vs');
    expect(catalog.themes[0].css).toBe(catalog.vsLayoutCss);
  });

  it('exports the four vs report components with their authoring contract', async () => {
    const catalog = await import(CATALOG_URL);
    expect(catalog.components.map((c: { name: string }) => c.name)).toEqual([
      'Delta',
      'Gauge',
      'Tradeoff',
      'Verdict',
    ]);
    for (const component of catalog.components) {
      expect(component.body).toBe('markdown');
      expect(component.purpose).toBeTruthy();
      expect(component.example).toContain(`<${component.name}`);
      expect(typeof component.Component).toBe('function');
    }
  });

  it('renders each component inside its own data-htmdx-component section', async () => {
    // This repo installs no react, so the factory gets a stub createElement;
    // the shape check is what matters - components own their wrapper because
    // the runtime only auto-wraps its built-ins.
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    for (const component of catalog.components) {
      const element = component.Component({ body: '- Save p95: 480ms → 120ms' });
      expect(element.type).toBe('section');
      expect(element.props['data-htmdx-component']).toBe(component.name);
      expect(element.props.className).toBe('htmdx-component');
    }
  });

  it('degrades to the body text when no React is available', async () => {
    // The plugin cache ships this skill without node_modules; lint never
    // renders, so a text fallback keeps the CLI path working there.
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const catalog = vsCatalogFactory(null, vsLayoutCss);
    const delta = catalog.components.find((c: { name: string }) => c.name === 'Delta');
    expect(delta.Component({ body: '- Save p95: 480ms → 120ms' })).toBe(
      '- Save p95: 480ms → 120ms',
    );
  });

  it('inlines the identical stylesheet and factory in the artifact shell', async () => {
    // Exact substring: any edit to one copy without the other fails here.
    // assets/sync-artifact-catalog.mjs regenerates the inline copy. The factory
    // is compared as raw file text, not Function.prototype.toString - vitest's
    // module transform rewrites the imported source, sync-artifact-catalog runs
    // under plain node where toString returns the file slice verbatim.
    const { vsLayoutCss } = await import(CATALOG_URL);
    expect(ARTIFACT).toContain(vsLayoutCss);
    const definitions = fs.readFileSync(
      path.join(SKILL_DIR, 'assets', 'definitions.mjs'),
      'utf8',
    );
    const start = definitions.indexOf('(React, css) => {');
    const end = definitions.indexOf('\n};', start) + 2;
    expect(start).toBeGreaterThan(-1);
    const factorySource = definitions.slice(start, end);
    expect(factorySource.length).toBeGreaterThan(1000);
    expect(ARTIFACT).toContain(factorySource);
  });

  it('registers the same components, layout, and theme in the browser', () => {
    expect(ARTIFACT).toContain('window.Htmdx.registerLayout');
    expect(ARTIFACT).toContain("name: 'vs'");
    expect(ARTIFACT).toContain('window.Htmdx.registerTheme');
    expect(ARTIFACT).toContain("id: 'vs'");
    expect(ARTIFACT).toContain('window.Htmdx.registerComponents');
    expect(ARTIFACT).toContain('vsCatalogFactory(window.Htmdx.React, vsLayoutCss)');
    // Registration must wait for the runtime; a bare call would throw before
    // the deferred browser.js defines window.Htmdx.
    expect(ARTIFACT).toContain("addEventListener('htmdx:ready'");
  });

  it('loads the Figtree face the vs tokens name', () => {
    // The runtime names Figtree in --md-ref-typeface-brand but never loads it;
    // without this link every artifact silently falls back to the system stack.
    expect(ARTIFACT).toContain('fonts.googleapis.com/css2?family=Figtree');
  });

  it('names the vs layout in the template frontmatter', () => {
    expect(ARTIFACT).toMatch(/^layout: vs$/m);
    expect(ARTIFACT).not.toMatch(/^layout: default$/m);
  });

  it('passes the catalog to every command that reads the registry', () => {
    // The CLI reads a bare "assets/definitions.mjs" as a package name and
    // rejects it; only the ./-prefixed form loads the file.
    expect(SKILL).toContain(
      'npx -y @wix/htmdx@4 skill --definitions ./assets/definitions.mjs',
    );
    expect(SKILL).toContain(
      'npx -y @wix/htmdx@4 lint "$ARTIFACT_PATH" --strict --definitions ./assets/definitions.mjs',
    );
    expect(SKILL).not.toContain('--definitions assets/');
  });

  it('routes pins that predate the flag instead of dead-ending', () => {
    expect(SKILL).toMatch(/`--definitions` exists from 4\.15\.0/);
    expect(SKILL).toMatch(/drop the flag there/);
  });
});
