import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';

const SKILL_DIR = path.resolve(__dirname, '..');
const SKILL = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const TEMPLATES = Object.fromEntries(
  ['artifact.html', 'proposal.html'].map((name) => [
    name,
    fs.readFileSync(path.join(SKILL_DIR, 'assets', name), 'utf8'),
  ]),
);
const ARTIFACT = TEMPLATES['artifact.html'];
const PROPOSAL = TEMPLATES['proposal.html'];
const CATALOG_URL = pathToFileURL(
  path.join(SKILL_DIR, 'assets', 'definitions.mjs'),
).href;

describe('the vs catalog is one source the CLI and the browser both load', () => {
  it('exports the vs layouts and theme as data the CLI can register', async () => {
    const catalog = await import(CATALOG_URL);
    expect(catalog.layouts.map((l: { name: string }) => l.name)).toEqual([
      'vs',
      'vs-proposal',
    ]);
    for (const layout of catalog.layouts) {
      expect(typeof layout.Component).toBe('function');
    }
    expect(catalog.themes).toHaveLength(1);
    expect(catalog.themes[0].id).toBe('vs');
    expect(catalog.themes[0].css).toBe(catalog.vsLayoutCss);
  });

  it('maps the proposal hero slots from frontmatter fields lint accepts', async () => {
    // Only lint-known frontmatter fields may feed slots; an unknown field
    // would fail every --strict lint of a proposal artifact.
    const catalog = await import(CATALOG_URL);
    const proposal = catalog.layouts.find(
      (l: { name: string }) => l.name === 'vs-proposal',
    );
    expect(proposal.slots).toEqual({
      title: { from: 'title' },
      project: { from: 'project' },
      owner: { from: 'owner' },
      phase: { from: 'phase' },
      updated: { from: 'updated' },
    });
  });

  it('exports the vs report components with their authoring contract', async () => {
    const catalog = await import(CATALOG_URL);
    expect(catalog.components.map((c: { name: string }) => c.name)).toEqual([
      'Delta',
      'Gauge',
      'Share',
      'Tradeoff',
      'Verdict',
      'Flow',
      'Figure',
      'Catalog',
      'Gallery',
      'Bars',
      'Trend',
      'Chart',
      'Tree',
      'Sequence',
      'ApiDiff',
      'Options',
      'Scope',
      'Risks',
      'Impact',
      'Questions',
      'Compat',
      'Signoff',
      'History',
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

  it('renders one Flow stage per row with arrow connectors between', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const flow = catalog.components.find((c: { name: string }) => c.name === 'Flow');
    const element = flow.Component({ body: '- Input: source\n- Output: compiled\n- Install: native' });
    const strip = element.children[0];
    const stages = strip.children.filter((child: { props: { className: string } }) =>
      child.props.className.includes('vs-flow-stage'),
    );
    const arrows = strip.children.filter((child: { props: { className: string } }) =>
      child.props.className.includes('vs-flow-arrow'),
    );
    expect(stages).toHaveLength(3);
    expect(arrows).toHaveLength(2);
    expect(stages[0].children[0].children).toEqual(['1 · INPUT']);
  });

  it('pins a Figure marker per @x,y row and keeps prefix-less rows legend-only', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const figure = catalog.components.find((c: { name: string }) => c.name === 'Figure');
    const element = figure.Component({
      body: '- @21,58 Step rail\n- Legend-only note',
      src: './shot.png',
      caption: 'The setup flow',
    });
    const figureChildren = element.children[0].children.filter(Boolean);
    // The plate is the fixed frame between figure and canvas: it is what makes
    // a column of differently sized screenshots share one width and one left
    // edge, so the width modifier has to survive on it.
    const plate = figureChildren.find(
      (child: { props: { className?: string } }) => child.props.className === 'vs-figure-plate',
    );
    expect(element.children[0].props.className).toBe('vs-figure vs-figure--full');
    const canvas = plate.children
      .filter(Boolean)
      .find((child: { props: { className?: string } }) => child.props.className === 'vs-figure-canvas');
    const markers = canvas.children
      .filter(Boolean)
      .filter((child: { props: { className?: string } }) => child.props.className === 'vs-figure-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0].props.style).toEqual({ left: '21%', top: '58%' });
    const legend = figureChildren.find((child: { type: string }) => child.type === 'ol');
    expect(legend.children).toHaveLength(2);
  });

  it('groups Catalog field rows under the record above them and tones the chip', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const component = catalog.components.find((c: { name: string }) => c.name === 'Catalog');
    const element = component.Component({
      body: [
        '- orphan field before any record',
        '- **Agent View** [adopt now]',
        '- Slack: `features.agent_view` classifies the app',
        '- a note with no label',
        '- **Slackbot MCP** [wont do]',
        '- Kyber: owns the selector',
      ].join('\n'),
    });
    const records = element.children[0].children.filter(Boolean);
    expect(records).toHaveLength(2);
    // Two grid cells per record - name column, field column - is what keeps the
    // names on one left edge and the labels on one middle edge down the page.
    const [name, fields] = records[0].children.filter(Boolean);
    expect(records[0].props.className).toBe('vs-catalog-record');
    const head = name.children[0];
    expect(head.children[0].children[0]).toBe('Agent View');
    expect(head.children[1].children[0]).toBe('adopt now');
    expect(head.children[1].props.className).toContain('emerald');
    // A labelled row becomes dt+dd; a row with no colon spans both columns, so
    // an author's aside never gets promoted into a fake field label.
    expect(fields.children.map((c: { type: string }) => c.type)).toEqual(['dt', 'dd', 'dd']);
    expect(fields.children[2].props.className).toContain('vs-catalog-note');
    expect(records[1].children[0].children[0].children[1].props.className).toContain('red');
  });

  it('renders every Gallery tile at one box size and takes the caption after the dash', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const component = catalog.components.find((c: { name: string }) => c.name === 'Gallery');
    const element = component.Component({
      body: '- ![Split view](./split.png) — Agent beside current work\n- ![Prompts](./prompts.png)',
    });
    const tiles = element.children[0].children;
    expect(tiles).toHaveLength(2);
    for (const tile of tiles) {
      expect(tile.children[0].props.className).toBe('htmdx-image vs-gallery-image');
    }
    expect(tiles[0].children[1].children[0]).toBe('Agent beside current work');
    expect(tiles[1].children[1].children[0]).toBe('Prompts');
  });

  it('scales Bars to the largest value and drops Trend to text below two points', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const bars = catalog.components.find((c: { name: string }) => c.name === 'Bars');
    const barsElement = bars.Component({ body: '- /api/search: 4,000 req\n- /api/export: 1,000 req' });
    const barRows = barsElement.children[0].children;
    const fillOf = (row: { children: Array<{ children: Array<{ props: { style: { width: string } } }> }> }) =>
      row.children[1].children[0].props.style.width;
    expect(fillOf(barRows[0])).toBe('100%');
    expect(fillOf(barRows[1])).toBe('25%');

    const trend = catalog.components.find((c: { name: string }) => c.name === 'Trend');
    const chart = trend.Component({ body: '- 4.14: 380ms\n- 4.15: 210ms' });
    expect(chart.children[0].type).toBe('figure');
    const svg = chart.children[0].children.find((child: { type: string }) => child.type === 'svg');
    expect(svg.children.flat().filter((child: { type: string }) => child.type === 'circle')).toHaveLength(2);
    const onePoint = trend.Component({ body: '- 4.15: 210ms' });
    expect(onePoint.children[0].type).toBe('div');
  });

  it('reduces a Share ratio to countable cells and caps an awkward denominator', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const share = catalog.components.find((c: { name: string }) => c.name === 'Share');
    type Cell = { props: { 'data-lit'?: string } };
    const cellsOf = (row: { children: Array<{ children: Cell[] }> }) => row.children[1].children;
    const litOf = (row: { children: Array<{ children: Cell[] }> }) =>
      cellsOf(row).filter((cell) => cell.props['data-lit']).length;

    const element = share.Component({ body: '- Canary: 5 / 100 percent\n- Incidents: 2 / 3' });
    const shareRows = element.children[0].children;
    // 5/100 reduces to 1/20, which is the whole point: a bar shows a sliver,
    // twenty cells show one lit square the reader can count.
    expect(cellsOf(shareRows[0])).toHaveLength(20);
    expect(litOf(shareRows[0])).toBe(1);
    expect(cellsOf(shareRows[1])).toHaveLength(3);
    expect(litOf(shareRows[1])).toBe(2);

    // A prime denominator past the counting limit falls back to twentieths
    // rather than drawing 97 cells nobody can count.
    const awkward = share.Component({ body: '- Sampled: 9 / 97 requests' });
    expect(cellsOf(awkward.children[0].children[0])).toHaveLength(20);
    expect(litOf(awkward.children[0].children[0])).toBe(2);

    // A share above its whole is a typo, not a 110% bar: fall back to the row.
    const overflowing = share.Component({ body: '- Broken: 7 / 3' });
    expect(overflowing.children[0].children[0].type).toBe('div');
    expect(overflowing.children[0].children[0].children[0]).toBe('Broken: 7 / 3');
  });

  it('draws Tree guides from row depth and colors diff marks', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const tree = catalog.components.find((c: { name: string }) => c.name === 'Tree');
    const element = tree.Component({
      body: '- plugins/\n  - + plugin/: installable\n  - project.json\n- − tests/',
    });
    const treeRows = element.children[0].children;
    const text = (row: { children: Array<{ props: { className: string }; children: string[] } | null> }) =>
      row.children.filter(Boolean).map((child) => child!.children.join(''));
    expect(text(treeRows[0])).toEqual(['plugins/']);
    expect(text(treeRows[1])).toEqual(['├─ ', '+ ', 'plugin/', '  — installable']);
    expect(text(treeRows[2])).toEqual(['└─ ', 'project.json']);
    const removed = treeRows[3].children.filter(Boolean);
    expect(removed[1].props.className).toContain('line-through');
  });

  it('lays Sequence actors as columns and needs two of them to draw', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const sequence = catalog.components.find((c: { name: string }) => c.name === 'Sequence');
    const element = sequence.Component({
      body: '- CLI -> Registry: resolve\n- Registry --> CLI: tarball',
    });
    const figure = element.children[0];
    expect(figure.type).toBe('figure');
    const svg = figure.children.find((child: { type: string }) => child.type === 'svg');
    const groups = svg.children.filter(Boolean).filter((child: { type: string }) => child.type === 'g');
    // two actor groups + two message groups
    expect(groups).toHaveLength(4);
    const reply = groups[3].children.find((child: { type: string }) => child.type === 'line');
    expect(reply.props.strokeDasharray).toBe('5 4');
    const onlyProse = sequence.Component({ body: '- no arrows here' });
    expect(onlyProse.children[0].type).toBe('div');
  });

  it('chips Options dispositions, Risks levels, and Flow stage status', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const options = catalog.components.find((c: { name: string }) => c.name === 'Options');
    const optionRow = options.Component({ body: '- [rejected] Root tests: breaks locality' }).children[0].children[0];
    expect(optionRow.children[0].children[0].children).toEqual(['rejected']);

    const risks = catalog.components.find((c: { name: string }) => c.name === 'Risks');
    const riskRow = risks.Component({
      body: '- Consumers pin the old layout: medium × high — keep an alias',
    }).children[0].children[0];
    const chips = riskRow.children[0].children.map((chip: { children: string[] }) => chip.children.join(''));
    expect(chips).toEqual(['Consumers pin the old layout', 'likelihood medium', 'impact high']);
    expect(riskRow.children[1].children).toEqual(['keep an alias']);

    const flow = catalog.components.find((c: { name: string }) => c.name === 'Flow');
    const strip = flow.Component({ body: '- Land [done]: merged\n- Verify [active]: running' }).children[0];
    const stages = strip.children.filter((child: { props: { className: string } }) =>
      child.props.className.includes('vs-flow-stage'),
    );
    expect(stages[0].props['data-status']).toBe('done');
    expect(stages[0].children[0].children).toEqual(['✓ · LAND']);
    expect(stages[1].props['data-status']).toBe('active');
  });

  it('marks Compat cells from column headings and degrades without them', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const compat = catalog.components.find((c: { name: string }) => c.name === 'Compat');
    const element = compat.Component({ columns: 'lint, render', body: '- 4.15: ✓ · partial' });
    const table = element.children[0].children[0];
    expect(table.type).toBe('table');
    const bodyRow = table.children[1].children[0];
    const cells = bodyRow.children.map((cell: { children: string[] }) => cell.children.join(''));
    expect(cells).toEqual(['4.15', '✓', '±']);
    const noColumns = compat.Component({ body: '- 4.15: ✓' });
    expect(noColumns.children[0].type).toBe('div');
  });

  it('states a Delta change in the unit the reader is looking at', async () => {
    const { vsCatalogFactory, vsLayoutCss } = await import(CATALOG_URL);
    const stubReact = {
      createElement: (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
        type,
        props,
        children: children.flat(Infinity),
      }),
    };
    const catalog = vsCatalogFactory(stubReact, vsLayoutCss);
    const delta = catalog.components.find((c: { name: string }) => c.name === 'Delta');
    const badges = (body: string) =>
      delta
        .Component({ body })
        .children[0].children.map(
          (card: { children: { children: { children: string[] }[] }[] }) =>
            card.children[1].children.at(-1).children.join(''),
        );
    expect(
      badges(
        [
          // A grouped thousand must not be read as its first group.
          '- Queue depth: 240 → 3,100',
          // Two rates differ by points; their ratio is a number nobody can act on.
          '- Hit rate: 71% → 94%',
          '- Hit rate: 94% → 89%',
          // A four-digit percentage off two-significant-figure inputs is
          // precision the reader cannot check.
          '- Footprint: 2.1 GB → 0.3 GB',
          // Inside 5x a percentage still reads, so it stays one.
          '- Save p95: 480ms → 120ms',
        ].join('\n'),
      ),
    ).toEqual(['13× higher', '+23 points', '-5 points', '7× lower', '-75%']);
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
    // The proposal layout needs hooks for its TOC; without them it must pass
    // the document through rather than crash the CLI's registry load.
    const proposal = catalog.layouts.find(
      (l: { name: string }) => l.name === 'vs-proposal',
    );
    expect(proposal.Component({ children: 'body', slots: {} })).toBe('body');
  });

  it('inlines the identical stylesheet and factory in every template shell', async () => {
    // Exact substring: any edit to one copy without the other fails here.
    // assets/sync-artifact-catalog.mjs regenerates the inline copies. The factory
    // is compared as raw file text, not Function.prototype.toString - vitest's
    // module transform rewrites the imported source, sync-artifact-catalog runs
    // under plain node where toString returns the file slice verbatim.
    const { vsLayoutCss } = await import(CATALOG_URL);
    const definitions = fs.readFileSync(
      path.join(SKILL_DIR, 'assets', 'definitions.mjs'),
      'utf8',
    );
    const start = definitions.indexOf('(React, css) => {');
    const end = definitions.indexOf('\n};', start) + 2;
    expect(start).toBeGreaterThan(-1);
    const factorySource = definitions.slice(start, end);
    expect(factorySource.length).toBeGreaterThan(1000);
    for (const shell of Object.values(TEMPLATES)) {
      expect(shell).toContain(vsLayoutCss);
      expect(shell).toContain(factorySource);
    }
  });

  it('registers the same components, layouts, and theme in the browser', () => {
    for (const shell of Object.values(TEMPLATES)) {
      expect(shell).toContain('window.Htmdx.registerLayout');
      expect(shell).toContain("name: 'vs'");
      expect(shell).toContain("name: 'vs-proposal'");
      expect(shell).toContain('window.Htmdx.registerTheme');
      expect(shell).toContain("id: 'vs'");
      expect(shell).toContain('window.Htmdx.registerComponents');
      expect(shell).toContain('vsCatalogFactory(window.Htmdx.React, vsLayoutCss)');
      // Registration must wait for the runtime; a bare call would throw before
      // the deferred browser.js defines window.Htmdx.
      expect(shell).toContain("addEventListener('htmdx:ready'");
    }
  });

  it('loads the Figtree face the vs tokens name', () => {
    // The runtime names Figtree in --md-ref-typeface-brand but never loads it;
    // without this link every artifact silently falls back to the system stack.
    for (const shell of Object.values(TEMPLATES)) {
      expect(shell).toContain('fonts.googleapis.com/css2?family=Figtree');
    }
  });

  it('names its own vs layout in each template frontmatter', () => {
    expect(ARTIFACT).toMatch(/^layout: vs$/m);
    expect(PROPOSAL).toMatch(/^layout: vs-proposal$/m);
    for (const shell of Object.values(TEMPLATES)) {
      expect(shell).not.toMatch(/^layout: default$/m);
    }
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
