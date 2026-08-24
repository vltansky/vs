// The vs catalog: the layout, palette, and report components every vs report
// renders against, loaded by the CLI via `--definitions` so lint, compile,
// and skill answer against the same catalog the artifact loads in the browser.
//
// The browser copy lives inline in artifact.html — a portable single-file
// artifact cannot import this module — and test/vs-catalog.static.eval.ts
// fails the build when the two drift (exact-substring on vsLayoutCss and on
// vsCatalogFactory.toString()).

// Written against the runtime's custom-layout DOM: markdown runs render as
// bare element groups (`> div`) and components as direct
// `section[data-htmdx-component]` children, with none of the default chrome.
export const vsLayoutCss = `
  /* vs: one column of source-order content, no rail, no hero, no section
     cards. Scoped to the layout so every other artifact this runtime renders
     keeps its stock look. */
  /* Corners come from two scales - the shadcn built-ins compile theirs from
     --radius, the runtime chrome reads --md-sys-shape-corner-* - so a tighter
     vs card has to move both. Overriding --radius-lg instead does nothing:
     Tailwind inlines the theme expression, so the utility ends up pointing at
     --radius directly. */
  .htmdx-app[data-htmdx-layout='vs'] {
    box-sizing: border-box;
    min-height: 100vh;
    padding: 44px 24px 64px;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    --radius: 4px;
    --md-sys-shape-corner-small: 3px;
    --md-sys-shape-corner-medium: 4px;
    --md-sys-shape-corner-large: 5px;
    --md-sys-shape-corner-extra-large: 5px;
    /* The vs palette: an ink accent on a neutral ladder, so the only color on
       the page is semantic (emerald/red/amber in the components). The runtime
       ships a purple primary and purple-tinted neutrals; the ladder is the
       wix-private/htmdx#5 consolidation, the ink primary replaces #5's
       leftover purple. Scoped to the layout. */
    --md-sys-color-primary: #111111;
    --md-sys-color-on-primary: #FFFFFF;
    --md-sys-color-primary-container: #F2F2F2;
    --md-sys-color-on-primary-container: #000000;
    --md-sys-color-secondary: #5C5C5C;
    --md-sys-color-on-secondary: #FFFFFF;
    --md-sys-color-secondary-container: #F2F2F2;
    --md-sys-color-on-secondary-container: #000000;
    --md-sys-color-tertiary: #5C5C5C;
    --md-sys-color-on-tertiary: #FFFFFF;
    --md-sys-color-tertiary-container: #F2F2F2;
    --md-sys-color-on-tertiary-container: #000000;
    --md-sys-color-surface: #FFFFFF;
    --md-sys-color-on-surface: #000000;
    --md-sys-color-surface-variant: #F2F2F2;
    --md-sys-color-on-surface-variant: #5C5C5C;
    --md-sys-color-outline: #B3B3B3;
    --md-sys-color-outline-variant: #E2E2E2;
    --md-sys-color-surface-container-lowest: #FFFFFF;
    --md-sys-color-surface-container-low: #FAFAFA;
    --md-sys-color-surface-container: #F7F7F7;
    --md-sys-color-surface-container-high: #F2F2F2;
    --md-sys-color-surface-container-highest: #EBEBEB;
    /* One soft shadow per level instead of Material's key + ambient pair: the
       flat surfaces separate with a hairline, so elevation only has to lift a
       floating element off the page. */
    --md-sys-elevation-level0: none;
    --md-sys-elevation-level1: 0 1px 2px rgb(0 0 0 / 5%);
    --md-sys-elevation-level2: 0 2px 6px rgb(0 0 0 / 7%);
    --md-sys-elevation-level3: 0 8px 24px rgb(0 0 0 / 9%);
    --md-sys-state-hover-opacity: 0.06;
    /* The runtime derives these aliases on :root, where custom properties
       compute once and inherit as values, not as var() references - so every
       alias is re-declared here to recompute against the scoped ladder. */
    --htmdx-bg: var(--md-sys-color-surface);
    --htmdx-ink: var(--md-sys-color-on-surface);
    --htmdx-body: var(--md-sys-color-on-surface-variant);
    --htmdx-soft: var(--md-sys-color-on-surface-variant);
    --htmdx-line: var(--md-sys-color-outline-variant);
    --htmdx-line-strong: var(--md-sys-color-outline);
    --htmdx-panel: var(--md-sys-color-surface-container);
    --htmdx-green: var(--md-sys-color-secondary);
    --htmdx-green-bg: var(--md-sys-color-secondary-container);
    --htmdx-amber: var(--md-sys-color-tertiary);
    --htmdx-amber-bg: var(--md-sys-color-tertiary-container);
    --htmdx-gray: var(--md-sys-color-on-surface-variant);
    --htmdx-gray-light: var(--md-sys-color-outline);
    --htmdx-gray-bg: var(--md-sys-color-surface-variant);
    --primary: var(--md-sys-color-primary);
    --primary-foreground: var(--md-sys-color-on-primary);
    --ring: var(--md-sys-color-primary);
    --accent: var(--md-sys-color-primary-container);
    --accent-foreground: var(--md-sys-color-on-primary-container);
  }
  .htmdx-app[data-htmdx-layout='vs'] > * {
    width: 100%;
    max-width: 60rem;
    margin-left: auto;
    margin-right: auto;
  }
  .htmdx-app[data-htmdx-layout='vs'] > .htmdx-component {
    margin-top: 20px;
    margin-bottom: 20px;
  }
  /* Text and a single figure share one measure so the left edge never breaks;
     only genuinely wide media (a Compare pair, a table) uses the full canvas. */
  .htmdx-app[data-htmdx-layout='vs'] > div > :is(p, ul, ol, blockquote, h1, h3, h4, h5, h6),
  .htmdx-app[data-htmdx-layout='vs'] > div .htmdx-image,
  .htmdx-app[data-htmdx-layout='vs'] > div > svg,
  .htmdx-app[data-htmdx-layout='vs'] > div .htmdx-code-figure,
  .htmdx-app[data-htmdx-layout='vs'] > div .htmdx-mermaid {
    max-width: 40rem;
  }
  .htmdx-app[data-htmdx-layout='vs'] > div .htmdx-mermaid svg { margin: 0; }
  .htmdx-app[data-htmdx-layout='vs'] > div > h1 {
    margin: 0 0 14px;
    font-family: var(--md-ref-typeface-brand);
    font-size: clamp(1.75rem, 3vw, 2.25rem);
    line-height: 1.12;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--md-sys-color-on-surface);
    text-wrap: balance;
  }
  /* The rule, not the whitespace, is what marks a section here. It buys the
     same separation as a 64px gap while keeping the next block on screen,
     which is the whole point of this layout. */
  .htmdx-app[data-htmdx-layout='vs'] > div h2 {
    margin: 40px 0 12px;
    padding-top: 20px;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    font-family: var(--md-ref-typeface-brand);
    font-size: 1.375rem;
    line-height: 1.3;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--md-sys-color-on-surface);
  }
  .htmdx-app[data-htmdx-layout='vs'] > div:first-child > h2:first-child {
    padding-top: 0;
    border-top: 0;
  }
  .htmdx-app[data-htmdx-layout='vs'] > div h3 {
    margin: 24px 0 8px;
    font-size: 1.0625rem;
    line-height: 1.35;
    font-weight: 600;
  }
  .htmdx-app[data-htmdx-layout='vs'] > div > :is(p, ul, ol) {
    font-size: 1rem;
    line-height: 1.6;
    margin: 0 0 14px;
  }
  .htmdx-app[data-htmdx-layout='vs'] > div :is(.htmdx-image, .htmdx-code-figure, .htmdx-mermaid),
  .htmdx-app[data-htmdx-layout='vs'] > div > svg {
    margin: 24px 0;
  }
  /* An authored graphic is a figure like any other, not an inline glyph. */
  .htmdx-app[data-htmdx-layout='vs'] > div > svg { display: block; height: auto; }
  .htmdx-app[data-htmdx-layout='vs'] > div:first-child > :first-child { margin-top: 0; }
  /* The default chrome restores what the utility reset removes; a custom
     layout starts from the reset, so lists, quotes, links, and tables get
     their document basics back here. */
  .htmdx-app[data-htmdx-layout='vs'] > div ul { list-style: disc; }
  .htmdx-app[data-htmdx-layout='vs'] > div ol { list-style: decimal; }
  .htmdx-app[data-htmdx-layout='vs'] > div :is(ul, ol) { padding-left: 1.5rem; }
  .htmdx-app[data-htmdx-layout='vs'] > div li { margin: 4px 0; }
  .htmdx-app[data-htmdx-layout='vs'] > div blockquote {
    margin: 16px 0;
    padding: 2px 0 2px 16px;
    border-left: 2px solid var(--md-sys-color-outline-variant);
    color: var(--md-sys-color-on-surface-variant);
  }
  .htmdx-app[data-htmdx-layout='vs'] > div a {
    color: var(--md-sys-color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .htmdx-app[data-htmdx-layout='vs'] > div table {
    margin: 20px 0 24px;
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9375rem;
  }
  .htmdx-app[data-htmdx-layout='vs'] > div :is(th, td) {
    padding: 8px 12px;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    text-align: left;
  }
  .htmdx-app[data-htmdx-layout='vs'] > div th { font-weight: 600; }
  /* vs documents are scanned, so the built-ins trade the default layout's ring
     of card padding for one more row on screen. Scoped to this layout: the
     same components keep their roomier shape everywhere else. */
  .htmdx-app[data-htmdx-layout='vs'] [data-htmdx-component] :is(.px-4, .px-5) { padding-left: 12px; padding-right: 12px; }
  .htmdx-app[data-htmdx-layout='vs'] [data-htmdx-component] :is(.p-3, .p-4) { padding: 8px 12px; }
  .htmdx-app[data-htmdx-layout='vs'] [data-htmdx-component] .py-3 { padding-top: 6px; padding-bottom: 6px; }
  .htmdx-app[data-htmdx-layout='vs'] [data-htmdx-component] .py-4 { padding-top: 10px; padding-bottom: 10px; }
  .htmdx-app[data-htmdx-layout='vs'] [data-htmdx-component] :is(.gap-3, .gap-4) { gap: 6px; }
  /* The pill track is the one shape --radius does not reach. Status chips and
     timeline dots keep their full round: they read as marks, not as bars. */
  .htmdx-app[data-htmdx-layout='vs'] [data-htmdx-component='Gauge'] .rounded-full { border-radius: 2px; }
  /* A Compare of two screenshots is a pair of figures, not a pair of cards: the
     border would frame the caption as well and read as two separate panels. A
     Compare of two claims keeps the card, which is the only thing separating
     one side from the other. */
  .htmdx-app[data-htmdx-layout='vs'] [data-htmdx-component='Compare'] .htmdx-evidence-card:has(.htmdx-image) {
    border: 0;
    border-radius: 0;
    background: none;
    padding: 0;
  }
  .htmdx-app[data-htmdx-layout='vs']
    [data-htmdx-component='Compare']
    .htmdx-evidence-card:has(.htmdx-image)
    > div:first-child {
    margin-bottom: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
  }
  .htmdx-app[data-htmdx-layout='vs'] [data-htmdx-component='Compare'] .htmdx-image { margin: 0; }
  @media (max-width: 720px) {
    .htmdx-app[data-htmdx-layout='vs'] { padding: 28px 20px 48px; }
    .htmdx-app[data-htmdx-layout='vs'] > div h2 { margin-top: 32px; padding-top: 16px; }
  }
`;

// One factory both loaders call with their own React: the CLI copy below
// resolves react from the consuming repo when it has one, the browser copy in
// artifact.html passes window.Htmdx.React. Everything the factory needs comes
// in as a parameter, so its source is byte-identical in both files and
// test/vs-catalog.static.eval.ts compares it with Function.prototype.toString.
//
// The four components are ported from wix-private/htmdx#5 (closed unmerged),
// rebuilt on the public contract: each renders its own
// section[data-htmdx-component] wrapper and parses its `body` prop itself.
// Without a React (the plugin cache installs no node_modules) every component
// degrades to its body text - lint never renders, so the catalog still lints.
export const vsCatalogFactory = (React, css) => {
  const h = React && React.createElement;
  const wrap = (name, children) =>
    h('section', { 'data-htmdx-component': name, className: 'htmdx-component' }, children);
  const plain = (text) => String(text).replace(/\*\*([^*]+)\*\*/g, '$1');
  const rows = (body) =>
    String(body)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim());
  const labelValue = (row) => {
    const at = row.indexOf(':');
    return at < 0
      ? { label: row, value: '' }
      : { label: row.slice(0, at).trim(), value: row.slice(at + 1).trim() };
  };

  // Direction is already on the card - the reader sees both numbers - so the
  // marker carries the one thing arithmetic cannot supply: whether the move
  // was good. A fall in latency and a fall in signups are the same sign and
  // opposite news, so the author says which, in the same +/- grammar
  // <Tradeoff> uses.
  const valence = (label) => {
    const trimmed = label.trimStart();
    if (trimmed.startsWith('+')) return { kind: 'gain', rest: trimmed.slice(1).trim() };
    if (trimmed.startsWith('−') || trimmed.startsWith('-')) {
      return { kind: 'cost', rest: trimmed.slice(1).trim() };
    }
    return { rest: label };
  };
  const VALENCE_CLASS = {
    gain: 'bg-emerald-50 text-emerald-700',
    cost: 'bg-red-50 text-red-700',
  };
  const changePercent = (before, after) => {
    const from = Number((before.match(/-?\d+(?:\.\d+)?/) || [])[0]);
    const to = Number((after.match(/-?\d+(?:\.\d+)?/) || [])[0]);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return undefined;
    const change = ((to - from) / Math.abs(from)) * 100;
    const rounded = Math.abs(change) >= 10 ? Math.round(change) : Math.round(change * 10) / 10;
    return (rounded > 0 ? '+' : '') + rounded + '%';
  };
  const DELTA_ARROW = /\s*(?:→|->)\s*/;
  const Delta = ({ body = '' }) =>
    wrap(
      'Delta',
      h(
        'div',
        { className: 'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3' },
        rows(body).map((row, index) => {
          const { label, value } = labelValue(row);
          const [before, after] = value.split(DELTA_ARROW);
          if (!after) {
            return h('div', { key: index, className: 'rounded-lg border bg-card px-4 py-3 text-sm' }, plain(row));
          }
          const { kind, rest } = valence(label);
          const percent = changePercent(before, after);
          return h(
            'div',
            { key: index, className: 'rounded-lg border bg-card px-4 py-3' },
            h('div', { className: 'text-xs text-muted-foreground' }, plain(rest)),
            h(
              'div',
              { className: 'mt-1 flex flex-wrap items-baseline gap-2' },
              h('span', { className: 'text-sm text-muted-foreground line-through' }, plain(before)),
              h('span', { 'aria-hidden': 'true', className: 'text-muted-foreground' }, '→'),
              h('span', { className: 'text-2xl font-medium text-card-foreground' }, plain(after)),
              percent
                ? h(
                    'span',
                    {
                      className:
                        'rounded px-1.5 py-0.5 text-xs font-semibold ' +
                        (kind ? VALENCE_CLASS[kind] : 'bg-muted text-muted-foreground'),
                    },
                    percent,
                  )
                : null,
            ),
          );
        }),
      ),
    );

  const GAUGE_RATIO = /^(\d+(?:[\d,]*\d)?(?:\.\d+)?)\s*\/\s*(\d+(?:[\d,]*\d)?(?:\.\d+)?)\s*(.*)$/;
  const Gauge = ({ body = '' }) =>
    wrap(
      'Gauge',
      h(
        'div',
        { className: 'flex flex-col gap-4 rounded-lg border bg-card px-4 py-4' },
        rows(body).map((row, index) => {
          const { label, value } = labelValue(row);
          const match = value.match(GAUGE_RATIO);
          const used = match && Number(match[1].replaceAll(',', ''));
          const limit = match && Number(match[2].replaceAll(',', ''));
          if (!match || !Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
            return h('div', { key: index, className: 'text-sm' }, plain(row));
          }
          const percent = (used / limit) * 100;
          const rounded = Math.round(percent);
          const fill =
            rounded > 100 ? 'bg-red-500' : rounded >= 90 ? 'bg-amber-500' : 'bg-[var(--md-sys-color-primary)]';
          const unit = match[3].trim();
          return h(
            'div',
            { key: index },
            h(
              'div',
              { className: 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1' },
              h('span', { className: 'text-sm text-card-foreground' }, plain(label)),
              h(
                'span',
                { className: 'text-xs tabular-nums text-muted-foreground' },
                used.toLocaleString('en-US') +
                  ' / ' +
                  limit.toLocaleString('en-US') +
                  (unit ? ' ' + unit : '') +
                  ' · ' +
                  rounded +
                  '%',
              ),
            ),
            h(
              'div',
              { 'aria-hidden': 'true', className: 'mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted' },
              h('div', {
                className: 'h-full rounded-full ' + fill,
                style: { width: Math.min(100, percent) + '%' },
              }),
            ),
          );
        }),
      ),
    );

  // Segments split on the same middot the metric captions use, so an option
  // reads as one line of prose in the source and as paired columns on the page.
  const feature = (item) => {
    const match = item.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/);
    return match ? { title: match[1].replace(/:$/, ''), text: match[2] } : { text: item };
  };
  const SEGMENT_CLASS = {
    gain: 'text-emerald-700',
    cost: 'text-red-700',
    plain: 'text-muted-foreground',
  };
  const SEGMENT_GLYPH = { gain: '+', cost: '−', plain: '' };
  const segments = (text) =>
    text
      .split(/\s+·\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        if (part.startsWith('+')) return { kind: 'gain', text: part.slice(1).trim() };
        if (part.startsWith('−') || part.startsWith('-')) {
          return { kind: 'cost', text: part.slice(1).trim() };
        }
        return { kind: 'plain', text: part };
      });
  const Tradeoff = ({ body = '' }) =>
    wrap(
      'Tradeoff',
      h(
        'div',
        { className: 'divide-y rounded-lg border bg-card' },
        rows(body).map((row, index) => {
          const { title, text } = feature(row);
          return h(
            'div',
            { key: index, className: 'px-4 py-3' },
            title ? h('div', { className: 'text-sm font-semibold text-card-foreground' }, plain(title)) : null,
            h(
              'div',
              { className: 'mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm' },
              segments(text).map((segment, segmentIndex) =>
                h(
                  'span',
                  { key: segmentIndex, className: SEGMENT_CLASS[segment.kind] },
                  SEGMENT_GLYPH[segment.kind]
                    ? h('span', { 'aria-hidden': 'true', className: 'mr-1 font-medium' }, SEGMENT_GLYPH[segment.kind])
                    : null,
                  plain(segment.text),
                ),
              ),
            ),
          );
        }),
      ),
    );

  const STATUS_TONE = {
    Draft: 'bg-muted text-muted-foreground',
    Proposed: 'bg-blue-50 text-blue-700',
    Accepted: 'bg-emerald-50 text-emerald-700',
    Rejected: 'bg-red-50 text-red-700',
    Superseded: 'bg-amber-50 text-amber-700',
  };
  const Verdict = ({ body = '', status = 'Proposed' }) =>
    wrap(
      'Verdict',
      h(
        'div',
        { className: 'rounded-lg border bg-card px-4 py-4' },
        h(
          'span',
          {
            className:
              'inline-flex w-fit items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap ' +
              (STATUS_TONE[status] || STATUS_TONE.Draft),
          },
          status,
        ),
        h(
          'ul',
          { className: 'mt-3 flex flex-col gap-1.5', style: { listStyle: 'none', margin: '12px 0 0', padding: 0 } },
          rows(body).map((item, index) =>
            h(
              'li',
              { key: index, className: 'flex gap-2.5 text-sm text-card-foreground' },
              h('span', { 'aria-hidden': 'true', className: 'text-muted-foreground' }, '—'),
              h('span', null, plain(item)),
            ),
          ),
        ),
      ),
    );

  const asComponent = (Component) => (props) => (h ? Component(props) : props.body || '');

  const components = [
    {
      name: 'Delta',
      body: 'markdown',
      purpose:
        "Show what a measured number moved from and to, written as '- label: before → after' rows. The percentage change is computed from the leading number on each side. A leading + or − on the label says whether the move was good or bad and colors that percentage green or red; without one it stays neutral. Both values must be observed - a projection rendered here reads as a result.",
      example:
        '<Delta>\n- +Save p95: 480ms → 120ms\n- −Weekly active editors: 3,900 → 1,240\n</Delta>',
      Component: asComponent(Delta),
    },
    {
      name: 'Gauge',
      body: 'markdown',
      purpose:
        "Show consumption against a ceiling, written as '- label: used / limit unit' rows. The bar turns amber at 90% and red above 100%, so a budget, quota, or SLO reads at a glance. Use it only where the limit is a real published number the reader could look up; inventing a denominator to fill the bar states a constraint that does not exist. A count with no ceiling belongs in <Stat>, and a value of 0 renders as an empty bar - write it as prose instead.",
      example: '<Gauge>\n- gzip bundle: 158 / 160 KB\n- Error budget: 43 / 100 min\n</Gauge>',
      Component: asComponent(Gauge),
    },
    {
      name: 'Tradeoff',
      body: 'markdown',
      purpose:
        'State what each option buys and what it costs. Write one `- **Option:** …` row per option; split the detail into ` · ` segments and start each with `+` for a gain (green) or `−` for a cost (red). Every option must carry at least one of the two. List only options still open at this point in the document - an option ruled out earlier reads as live again here, and its gains argue for it.',
      example:
        '<Tradeoff>\n- **CDN renderer:** +interactive · −1MB on every page\n- **Paste exported SVG:** +0 bytes · +ships today · −not live\n</Tradeoff>',
      Component: asComponent(Tradeoff),
    },
    {
      name: 'Verdict',
      body: 'markdown',
      purpose:
        'Open a proposal with its decision and the two or three lines behind it. `status` carries the state; the body is one `- item` row per point. Put it above the first heading — it is what a reader skims before deciding to read the rest.',
      example:
        '<Verdict status="Accepted">\n- Ship the SVG import path, not an embedded renderer.\n- Costs 0 bytes and works today.\n- Revisit if a live canvas is ever asked for.\n</Verdict>',
      props: [
        {
          name: 'status',
          type: 'string',
          values: ['Draft', 'Proposed', 'Accepted', 'Rejected', 'Superseded'],
          default: 'Proposed',
          description: 'The decision state shown as a chip above the points.',
        },
      ],
      Component: asComponent(Verdict),
    },
  ];

  const layouts = [
    // The runtime's custom-layout shell already renders blocks in source order
    // with no chrome, which is the vs design; the stylesheet carries the rest.
    { name: 'vs', Component: (props) => props.children },
  ];

  const themes = [{ id: 'vs', css }];

  return { components, layouts, themes };
};

// The CLI resolves react from wherever this module lives; the repo installs
// one for development, the plugin cache does not - the factory handles both.
let react = null;
try {
  const mod = await import('react');
  react = mod.default ?? mod;
} catch {
  react = null;
}

const catalog = vsCatalogFactory(react, vsLayoutCss);

export const components = catalog.components;
export const layouts = catalog.layouts;
export const themes = catalog.themes;
