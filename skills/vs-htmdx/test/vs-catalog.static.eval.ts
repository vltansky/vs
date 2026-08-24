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

  it('inlines the identical stylesheet in the artifact shell', async () => {
    // Exact substring: any edit to one copy without the other fails here.
    const { vsLayoutCss } = await import(CATALOG_URL);
    expect(ARTIFACT).toContain(vsLayoutCss);
  });

  it('registers the same layout and theme names in the browser', () => {
    expect(ARTIFACT).toContain('window.Htmdx.registerLayout');
    expect(ARTIFACT).toContain("name: 'vs'");
    expect(ARTIFACT).toContain('window.Htmdx.registerTheme');
    expect(ARTIFACT).toContain("id: 'vs'");
    // Registration must wait for the runtime; a bare call would throw before
    // the deferred browser.js defines window.Htmdx.
    expect(ARTIFACT).toContain("addEventListener('htmdx:ready'");
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
