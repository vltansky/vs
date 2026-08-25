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
     cards. vs-proposal: the same tokens and components under a proposal
     shell - dark hero, sticky contents rail. Scoped to the layouts so every
     other artifact this runtime renders keeps its stock look; the ^= prefix
     match is the sharing seam - it reaches both 'vs' and 'vs-proposal'. */
  /* Corners come from two scales - the shadcn built-ins compile theirs from
     --radius, the runtime chrome reads --md-sys-shape-corner-* - so a tighter
     vs card has to move both. Overriding --radius-lg instead does nothing:
     Tailwind inlines the theme expression, so the utility ends up pointing at
     --radius directly. */
  .htmdx-app[data-htmdx-layout^='vs'] {
    box-sizing: border-box;
    min-height: 100vh;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    --radius: 4px;
    --md-sys-shape-corner-small: 3px;
    --md-sys-shape-corner-medium: 4px;
    --md-sys-shape-corner-large: 5px;
    --md-sys-shape-corner-extra-large: 5px;
    /* The vs palette: a cobalt accent on a neutral ladder. The neutrals are
       the wix-private/htmdx#5 consolidation; the runtime's purple primary is
       replaced by cobalt, which carries links, code spans, gauge fills, and
       the contents-rail numbers. Everything else stays monochrome so the
       semantic colors (emerald/red/amber in the components) keep their
       meaning. Scoped to the layout. */
    --md-sys-color-primary: #1D4ED8;
    --md-sys-color-on-primary: #FFFFFF;
    --md-sys-color-primary-container: #E8EEFF;
    --md-sys-color-on-primary-container: #14337D;
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
    --vs-mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
  }
  .htmdx-app[data-htmdx-layout='vs'] { padding: 44px 24px 64px; }
  .htmdx-app[data-htmdx-layout='vs'] > * {
    width: 100%;
    max-width: 60rem;
    margin-left: auto;
    margin-right: auto;
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > .htmdx-component {
    margin-top: 20px;
    margin-bottom: 20px;
  }
  /* Text and a single figure share one measure so the left edge never breaks;
     only genuinely wide media (a Compare pair, a table) uses the full canvas. */
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div > :is(p, ul, ol, blockquote, h1, h3, h4, h5, h6),
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div .htmdx-image,
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div > svg,
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div .htmdx-code-figure,
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div .htmdx-mermaid {
    max-width: 40rem;
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div .htmdx-mermaid svg { margin: 0; }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div > h1 {
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
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div h2 {
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
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div:first-child > h2:first-child {
    padding-top: 0;
    border-top: 0;
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div h3 {
    margin: 24px 0 8px;
    font-size: 1.0625rem;
    line-height: 1.35;
    font-weight: 600;
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div > :is(p, ul, ol) {
    font-size: 1rem;
    line-height: 1.6;
    margin: 0 0 14px;
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div :is(.htmdx-image, .htmdx-code-figure, .htmdx-mermaid),
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div > svg {
    margin: 24px 0;
  }
  /* An authored graphic is a figure like any other, not an inline glyph. */
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div > svg { display: block; height: auto; }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div:first-child > :first-child { margin-top: 0; }
  /* The default chrome restores what the utility reset removes; a custom
     layout starts from the reset, so lists, quotes, links, and tables get
     their document basics back here. */
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div ul { list-style: disc; }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div ol { list-style: decimal; }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div :is(ul, ol) { padding-left: 1.5rem; }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div li { margin: 4px 0; }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div blockquote {
    margin: 16px 0;
    padding: 2px 0 2px 16px;
    border-left: 2px solid var(--md-sys-color-outline-variant);
    color: var(--md-sys-color-on-surface-variant);
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div a {
    color: var(--md-sys-color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  /* Monospace at 1em reads larger than the prose around it; 0.875em brings
     inline code back to the surrounding x-height. */
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div :not(pre) > code {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    border-radius: 3px;
    padding: 1px 4px;
    font-family: var(--vs-mono);
    font-size: 0.875em;
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div table {
    margin: 20px 0 24px;
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9375rem;
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div :is(th, td) {
    padding: 8px 12px;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    text-align: left;
  }
  :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div th { font-weight: 600; }
  /* vs documents are scanned, so the built-ins trade the default layout's ring
     of card padding for one more row on screen. Scoped to this layout: the
     same components keep their roomier shape everywhere else. */
  .htmdx-app[data-htmdx-layout^='vs'] [data-htmdx-component] :is(.px-4, .px-5) { padding-left: 12px; padding-right: 12px; }
  .htmdx-app[data-htmdx-layout^='vs'] [data-htmdx-component] :is(.p-3, .p-4) { padding: 8px 12px; }
  .htmdx-app[data-htmdx-layout^='vs'] [data-htmdx-component] .py-3 { padding-top: 6px; padding-bottom: 6px; }
  .htmdx-app[data-htmdx-layout^='vs'] [data-htmdx-component] .py-4 { padding-top: 10px; padding-bottom: 10px; }
  .htmdx-app[data-htmdx-layout^='vs'] [data-htmdx-component] :is(.gap-3, .gap-4) { gap: 6px; }
  /* The pill track is the one shape --radius does not reach. Status chips and
     timeline dots keep their full round: they read as marks, not as bars. */
  .htmdx-app[data-htmdx-layout^='vs'] [data-htmdx-component='Gauge'] .rounded-full { border-radius: 2px; }
  /* A Compare of two screenshots is a pair of figures, not a pair of cards: the
     border would frame the caption as well and read as two separate panels. A
     Compare of two claims keeps the card, which is the only thing separating
     one side from the other. */
  .htmdx-app[data-htmdx-layout^='vs'] [data-htmdx-component='Compare'] .htmdx-evidence-card:has(.htmdx-image) {
    border: 0;
    border-radius: 0;
    background: none;
    padding: 0;
  }
  .htmdx-app[data-htmdx-layout^='vs']
    [data-htmdx-component='Compare']
    .htmdx-evidence-card:has(.htmdx-image)
    > div:first-child {
    margin-bottom: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
  }
  .htmdx-app[data-htmdx-layout^='vs'] [data-htmdx-component='Compare'] .htmdx-image { margin: 0; }
  /* Flow: stage cards joined by arrows on one line; the strip is the diagram,
     so the arrow is a connector glyph, not content - hidden from readers. */
  .htmdx-app[data-htmdx-layout^='vs'] .vs-flow { display: flex; align-items: stretch; gap: 10px; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-flow-stage { flex: 1; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-flow-arrow {
    align-self: center;
    flex: none;
    color: var(--md-sys-color-outline);
  }
  /* Rollout progress on the strip: done recedes, active carries the accent;
     next needs no mark - it is the default card. */
  .htmdx-app[data-htmdx-layout^='vs'] .vs-flow-stage[data-status='done'] {
    background: var(--md-sys-color-surface-container-low);
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-flow-stage[data-status='done'] > div:first-child {
    color: var(--md-sys-color-on-surface-variant);
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-flow-stage[data-status='active'] {
    border-color: var(--md-sys-color-primary);
    box-shadow: inset 0 0 0 1px var(--md-sys-color-primary);
  }
  /* Trend: the SVG strokes and fills currentColor, so one color declaration
     here is the entire chart theme. The label row mirrors the plotted points
     - same count, same order - which is what makes the chart readable without
     an axis. */
  .htmdx-app[data-htmdx-layout^='vs'] .vs-trend { margin: 0; color: var(--md-sys-color-primary); }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-trend svg { display: block; width: 100%; height: auto; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-trend-points {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-trend-point {
    min-width: 0;
    text-align: center;
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-trend-point:first-child { text-align: left; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-trend-point:last-child { text-align: right; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-trend-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-trend-label {
    font-family: var(--vs-mono);
    font-size: 0.6875rem;
    color: var(--md-sys-color-on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Tree: a monospace hierarchy with drawn guides; a wrapped row would break
     the guide alignment, so rows keep their whitespace and the block scrolls. */
  .htmdx-app[data-htmdx-layout^='vs'] .vs-tree {
    overflow-x: auto;
    font-family: var(--vs-mono);
    font-size: 0.8125rem;
    line-height: 1.8;
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-tree-row { white-space: pre; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-tree-guide { color: var(--md-sys-color-outline); }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-tree-note { color: var(--md-sys-color-on-surface-variant); }
  /* Sequence: like Trend, currentColor on the wrapper is the entire message
     theme; actors and lifelines carry their own classes inside the SVG. */
  .htmdx-app[data-htmdx-layout^='vs'] .vs-seq { margin: 0; color: var(--md-sys-color-primary); }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-seq svg { display: block; width: 100%; height: auto; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-seq-actor {
    fill: var(--md-sys-color-on-surface);
    font-family: var(--vs-mono);
    font-size: 11px;
    font-weight: 700;
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-seq-life { stroke: var(--md-sys-color-outline-variant); }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-seq-msg { fill: var(--md-sys-color-on-surface); font-size: 11px; }
  /* Figure: the marker layer must track the rendered image exactly, so the
     canvas shrinks to the image and the percent-positioned chips ride it
     through every viewport. Markers stay out of hit-testing: a click lands on
     the image and opens the lightbox. */
  .htmdx-app[data-htmdx-layout^='vs'] .vs-figure { margin: 0; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-figure-canvas { position: relative; width: fit-content; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-figure-canvas img {
    display: block;
    max-width: 100%;
    margin: 0;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 4px;
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-figure-marker {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    font-size: 12px;
    line-height: 22px;
    font-weight: 700;
    text-align: center;
    box-shadow: 0 0 0 2px var(--md-sys-color-surface);
    pointer-events: none;
  }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-figure-caption { margin: 8px 0 0; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-figure-legend { list-style: none; margin: 8px 0 0; padding: 0; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-figure-legend li { display: flex; gap: 8px; margin: 4px 0; }
  .htmdx-app[data-htmdx-layout^='vs'] .vs-figure-num {
    display: inline-flex;
    justify-content: center;
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    font-size: 11px;
    line-height: 18px;
    font-weight: 700;
  }
  /* The lightbox overlay is appended to body, outside the layout element, so
     its rules cannot sit under the layout scope. The white plate keeps
     transparent-background SVG diagrams readable on the dark scrim. */
  .htmdx-app[data-htmdx-layout^='vs'] img.htmdx-image { cursor: zoom-in; }
  .vs-lightbox {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background: rgba(17, 17, 17, 0.88);
    cursor: zoom-out;
  }
  .vs-lightbox img {
    max-width: min(1400px, 100%);
    max-height: 100%;
    background: #FFFFFF;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
  }
  @media (max-width: 720px) {
    .htmdx-app[data-htmdx-layout='vs'] { padding: 28px 20px 48px; }
    :is(.htmdx-app[data-htmdx-layout='vs'], .vs-p-main) > div h2 { margin-top: 32px; padding-top: 16px; }
    .htmdx-app[data-htmdx-layout^='vs'] .vs-flow { flex-direction: column; }
    .htmdx-app[data-htmdx-layout^='vs'] .vs-flow-arrow { transform: rotate(90deg); }
  }
  /* vs-proposal shell: the report tokens and components above, under a
     proposal chrome - one dark hero surface carrying title, eyebrow, and
     phase, then a sticky contents rail beside the ruled document. The main
     column is a content root: the :is() rules above reach it via .vs-p-main,
     and the component rules via the ^= layout match. */
  .htmdx-app[data-htmdx-layout='vs-proposal'] { padding: 0 0 72px; }
  /* The hero is navy ink with a cobalt glow, not the primary token: a full
     cobalt surface would shout, and the pills need a dark ground to read on. */
  .vs-p-hero {
    background:
      radial-gradient(circle at 82% -20%, #2E5BFF 0, transparent 46%),
      #0B1633;
    color: #F5F8FF;
  }
  .vs-p-hero-inner { max-width: 54rem; margin: 0 auto; padding: 30px 28px 26px; }
  .vs-p-eyebrow {
    margin: 0 0 8px;
    font-family: var(--vs-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8FB0FF;
  }
  .vs-p-title {
    margin: 0;
    max-width: 44rem;
    font-family: var(--md-ref-typeface-brand);
    font-size: clamp(1.5rem, 3vw, 2rem);
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .vs-p-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .vs-p-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border: 1px solid rgb(255 255 255 / 24%);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--md-sys-color-outline-variant);
  }
  /* The phase pill is the one colored mark on the hero: the lifecycle state
     is semantic, everything else on the dark surface stays monochrome. */
  .vs-p-pill[data-phase] { border-color: transparent; }
  .vs-p-pill[data-phase='Draft'] { background: rgb(255 255 255 / 14%); }
  .vs-p-pill[data-phase='Proposed'] { background: #1D4ED8; color: #DBEAFE; }
  .vs-p-pill[data-phase='Accepted'] { background: #047857; color: #D1FAE5; }
  .vs-p-pill[data-phase='Rejected'] { background: #B91C1C; color: #FEE2E2; }
  .vs-p-pill[data-phase='Superseded'] { background: #B45309; color: #FEF3C7; }
  .vs-p-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 36px;
    max-width: 54rem;
    margin: 0 auto;
    padding: 32px 28px 0;
  }
  .vs-p-body:has(> .vs-p-toc) { grid-template-columns: 150px minmax(0, 1fr); }
  .vs-p-toc {
    position: sticky;
    top: 24px;
    align-self: start;
    padding-top: 12px;
    border-top: 2px solid var(--md-sys-color-on-surface);
  }
  .vs-p-toc-label {
    display: block;
    margin-bottom: 8px;
    font-family: var(--vs-mono);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--md-sys-color-outline);
  }
  .vs-p-toc a {
    display: flex;
    gap: 8px;
    padding: 4px 0;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.8125rem;
    line-height: 1.4;
    text-decoration: none;
  }
  .vs-p-toc a:hover { color: var(--md-sys-color-on-surface); }
  .vs-p-toc-num { font-family: var(--vs-mono); font-size: 0.6875rem; color: var(--md-sys-color-primary); }
  .vs-p-main { min-width: 0; }
  /* The lede: the opening paragraph before any section is the pitch, so it
     reads one step larger and quieter than body text. */
  .vs-p-main > div:first-child > p:first-child {
    font-size: 1.125rem;
    line-height: 1.55;
    color: var(--md-sys-color-on-surface-variant);
  }
  /* Rail links jump to sections; without the offset the ruled h2 lands flush
     against the viewport edge. Smooth scroll is scoped through :has so only
     proposal documents change the document's scroll behavior. */
  .vs-p-main > div h2 { scroll-margin-top: 24px; }
  html:has(.htmdx-app[data-htmdx-layout='vs-proposal']) { scroll-behavior: smooth; }
  @media (max-width: 860px) {
    .vs-p-hero-inner { padding: 24px 20px 22px; }
    .vs-p-body,
    .vs-p-body:has(> .vs-p-toc) { grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 24px 20px 0; }
    .vs-p-toc {
      position: static;
      display: flex;
      flex-wrap: wrap;
      column-gap: 16px;
      padding: 0 0 8px;
      border-top: 0;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }
    .vs-p-toc-label { display: none; }
  }
  @media print {
    .vs-p-hero { background: none; color: var(--md-sys-color-on-surface); border-bottom: 2px solid var(--md-sys-color-on-surface); }
    .vs-p-eyebrow, .vs-p-pill { color: var(--md-sys-color-on-surface-variant); }
    .vs-p-pill { border-color: var(--md-sys-color-outline); }
    .vs-p-pill[data-phase] { background: none; border-color: var(--md-sys-color-outline); }
    .vs-p-toc { display: none; }
    .vs-p-body,
    .vs-p-body:has(> .vs-p-toc) { grid-template-columns: minmax(0, 1fr); }
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

  // A [done]/[active]/[next] suffix on the stage label marks rollout progress;
  // the number gives way to a check so a finished stage reads at a glance.
  const FLOW_STAGE_STATUS = /^(.*?)\s*\[(done|active|next)\]$/i;
  const Flow = ({ body = '' }) =>
    wrap(
      'Flow',
      h(
        'div',
        { className: 'vs-flow' },
        rows(body).flatMap((row, index) => {
          const { label, value } = labelValue(row);
          const statusMatch = label.match(FLOW_STAGE_STATUS);
          const name = statusMatch ? statusMatch[1] : label;
          const status = statusMatch ? statusMatch[2].toLowerCase() : undefined;
          const stage = h(
            'div',
            {
              key: 'stage' + index,
              className: 'vs-flow-stage rounded-lg border bg-card px-4 py-3',
              'data-status': status,
            },
            h(
              'div',
              { className: 'font-mono text-xs font-bold tracking-widest text-card-foreground' },
              (status === 'done' ? '✓' : index + 1) + ' · ' + plain(name).toUpperCase(),
            ),
            value ? h('div', { className: 'mt-1 text-sm text-muted-foreground' }, plain(value)) : null,
          );
          return index
            ? [h('span', { key: 'arrow' + index, 'aria-hidden': 'true', className: 'vs-flow-arrow' }, '→'), stage]
            : [stage];
        }),
      ),
    );

  const FIGURE_MARKER = /^@(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\s+(.*)$/;
  const Figure = ({ body = '', src = '', caption = '' }) => {
    const notes = rows(body).map((row) => {
      const match = row.match(FIGURE_MARKER);
      return match ? { x: Number(match[1]), y: Number(match[2]), text: match[3] } : { text: row };
    });
    return wrap(
      'Figure',
      h(
        'figure',
        { className: 'vs-figure' },
        h(
          'div',
          { className: 'vs-figure-canvas' },
          src ? h('img', { src, alt: plain(caption) || 'figure', className: 'htmdx-image' }) : null,
          notes.map((note, index) =>
            note.x == null
              ? null
              : h(
                  'span',
                  { key: index, className: 'vs-figure-marker', style: { left: note.x + '%', top: note.y + '%' } },
                  String(index + 1),
                ),
          ),
        ),
        caption
          ? h('figcaption', { className: 'vs-figure-caption text-sm italic text-muted-foreground' }, plain(caption))
          : null,
        notes.length
          ? h(
              'ol',
              { className: 'vs-figure-legend' },
              notes.map((note, index) =>
                h(
                  'li',
                  { key: index, className: 'text-sm' },
                  h('span', { className: 'vs-figure-num' }, String(index + 1)),
                  h('span', null, plain(note.text)),
                ),
              ),
            )
          : null,
      ),
    );
  };

  // Bars compares magnitudes with no ceiling: every bar is scaled to the
  // largest value in the set, so it answers "which is bigger and by how much",
  // not "how close to a limit" - that is <Gauge>'s question.
  const firstNumber = (text) => {
    const match = String(text).match(/-?\d+(?:[\d,]*\d)?(?:\.\d+)?/);
    return match ? Number(match[0].replaceAll(',', '')) : NaN;
  };
  const Bars = ({ body = '' }) => {
    const parsed = rows(body).map((row) => {
      const { label, value } = labelValue(row);
      return { label, value, numeric: firstNumber(value) };
    });
    const max = Math.max(0, ...parsed.map((row) => (Number.isFinite(row.numeric) ? Math.abs(row.numeric) : 0)));
    return wrap(
      'Bars',
      h(
        'div',
        { className: 'flex flex-col gap-3 rounded-lg border bg-card px-4 py-4' },
        parsed.map((row, index) => {
          if (!Number.isFinite(row.numeric) || max <= 0) {
            return h('div', { key: index, className: 'text-sm' }, plain(row.label + (row.value ? ': ' + row.value : '')));
          }
          return h(
            'div',
            { key: index },
            h(
              'div',
              { className: 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1' },
              h('span', { className: 'text-sm text-card-foreground' }, plain(row.label)),
              h('span', { className: 'text-xs tabular-nums text-muted-foreground' }, plain(row.value)),
            ),
            h(
              'div',
              { 'aria-hidden': 'true', className: 'mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted' },
              h('div', {
                className: 'h-full rounded-full bg-[var(--md-sys-color-primary)]',
                style: { width: (Math.abs(row.numeric) / max) * 100 + '%' },
              }),
            ),
          );
        }),
      ),
    );
  };

  // Trend draws the series itself: an inline SVG so the artifact stays
  // portable - no chart library, no canvas. Points scale to the min/max of
  // the set; with fewer than two numeric rows there is no line to draw, so
  // the rows render as text instead of an axis with one dot.
  const Trend = ({ body = '', caption = '' }) => {
    const points = rows(body)
      .map((row) => {
        const { label, value } = labelValue(row);
        return { label, value, numeric: firstNumber(value) };
      })
      .filter((point) => Number.isFinite(point.numeric));
    if (points.length < 2) {
      return wrap('Trend', h('div', { className: 'rounded-lg border bg-card px-4 py-3 text-sm' }, plain(body)));
    }
    const WIDTH = 560;
    const HEIGHT = 120;
    const PAD = 8;
    const min = Math.min(...points.map((point) => point.numeric));
    const max = Math.max(...points.map((point) => point.numeric));
    const span = max - min || 1;
    const px = (index) => PAD + (index * (WIDTH - 2 * PAD)) / (points.length - 1);
    const py = (value) => HEIGHT - PAD - ((value - min) * (HEIGHT - 2 * PAD)) / span;
    const line = points
      .map((point, index) => (index ? 'L' : 'M') + px(index).toFixed(1) + ' ' + py(point.numeric).toFixed(1))
      .join(' ');
    const area =
      line + ' L' + px(points.length - 1).toFixed(1) + ' ' + (HEIGHT - PAD) + ' L' + PAD + ' ' + (HEIGHT - PAD) + ' Z';
    return wrap(
      'Trend',
      h(
        'figure',
        { className: 'vs-trend rounded-lg border bg-card px-4 py-4' },
        h(
          'svg',
          { viewBox: '0 0 ' + WIDTH + ' ' + HEIGHT, role: 'img', 'aria-label': plain(caption) || 'trend chart' },
          h('path', { d: area, fill: 'currentColor', opacity: 0.08 }),
          h('path', { d: line, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
          points.map((point, index) =>
            h(
              'circle',
              { key: index, cx: px(index), cy: py(point.numeric), r: 3.5, fill: 'currentColor' },
              h('title', null, plain(point.label) + ': ' + plain(point.value)),
            ),
          ),
        ),
        h(
          'div',
          { className: 'vs-trend-points', 'aria-hidden': 'true' },
          points.map((point, index) =>
            h(
              'div',
              { key: index, className: 'vs-trend-point' },
              h('div', { className: 'vs-trend-value tabular-nums' }, plain(point.value)),
              h('div', { className: 'vs-trend-label' }, plain(point.label)),
            ),
          ),
        ),
        caption
          ? h('figcaption', { className: 'mt-2 text-sm italic text-muted-foreground' }, plain(caption))
          : null,
      ),
    );
  };

  const NOTE_SPLIT = /\s+(?:—|--)\s+/;

  // Tree shows a hierarchy the way a terminal does - drawn guides, two-space
  // indents - plus diff marks so one tree carries a proposal's before/after
  // layout instead of two panes the reader must diff by eye.
  const TREE_MARKS = { '+': 'add', '−': 'remove', '~': 'change' };
  const TREE_TONE = { add: 'text-emerald-700', remove: 'text-red-700', change: 'text-amber-700' };
  const TREE_GLYPH = { add: '+', remove: '−', change: '~' };
  const treeRows = (body) =>
    String(body)
      .split('\n')
      .map((line) => line.match(/^(\s*)- (.*)$/))
      .filter(Boolean)
      .map((match) => {
        let text = match[2].trim();
        const key = text[0] === '-' ? '−' : text[0];
        const mark = text[1] === ' ' && TREE_MARKS[key] ? TREE_MARKS[key] : null;
        if (mark) text = text.slice(2).trim();
        return { depth: Math.floor(match[1].length / 2), mark, text };
      });
  // A level continues while a later row still sits on it; the guide glyph per
  // level is decided by looking ahead to where the depth next drops below it.
  const treeGuide = (parsed, index) => {
    const depth = parsed[index].depth;
    let guide = '';
    for (let level = 1; level <= depth; level++) {
      let joins = false;
      for (let next = index + 1; next < parsed.length; next++) {
        if (parsed[next].depth < level) break;
        if (parsed[next].depth === level) {
          joins = true;
          break;
        }
      }
      guide += level === depth ? (joins ? '├─ ' : '└─ ') : joins ? '│  ' : '   ';
    }
    return guide;
  };
  const Tree = ({ body = '' }) => {
    const parsed = treeRows(body);
    return wrap(
      'Tree',
      h(
        'div',
        { className: 'vs-tree rounded-lg border bg-card px-4 py-3' },
        parsed.map((row, index) => {
          const { label, value } = labelValue(row.text);
          const guide = treeGuide(parsed, index);
          return h(
            'div',
            { key: index, className: 'vs-tree-row' },
            guide ? h('span', { 'aria-hidden': 'true', className: 'vs-tree-guide' }, guide) : null,
            row.mark ? h('span', { className: 'font-bold ' + TREE_TONE[row.mark] }, TREE_GLYPH[row.mark] + ' ') : null,
            h(
              'span',
              {
                className: row.mark
                  ? TREE_TONE[row.mark] + (row.mark === 'remove' ? ' line-through' : '')
                  : 'text-card-foreground',
              },
              plain(label),
            ),
            value ? h('span', { className: 'vs-tree-note' }, '  — ' + plain(value)) : null,
          );
        }),
      ),
    );
  };

  // Sequence draws who-calls-whom as actor columns and ordered messages, all
  // inline SVG like <Trend> - no library, portable. Height grows one step per
  // message so the diagram scales with the exchange it shows.
  const SEQ_MESSAGE = /^(.+?)\s*(-->|->)\s*(.+?):\s*(.*)$/;
  const Sequence = ({ body = '', caption = '' }) => {
    const messages = rows(body)
      .map((row) => {
        const match = row.match(SEQ_MESSAGE);
        return match
          ? { from: match[1].trim(), to: match[3].trim(), text: match[4].trim(), dashed: match[2] === '-->' }
          : null;
      })
      .filter(Boolean);
    const actors = [];
    for (const message of messages) {
      for (const name of [message.from, message.to]) {
        if (!actors.includes(name)) actors.push(name);
      }
    }
    if (actors.length < 2) {
      return wrap('Sequence', h('div', { className: 'rounded-lg border bg-card px-4 py-3 text-sm' }, plain(body)));
    }
    const WIDTH = 560;
    const SIDE = 70;
    const TOP = 30;
    const STEP = 34;
    const height = TOP + messages.length * STEP + 10;
    const ax = (name) => SIDE + (actors.indexOf(name) * (WIDTH - 2 * SIDE)) / (actors.length - 1);
    return wrap(
      'Sequence',
      h(
        'figure',
        { className: 'vs-seq rounded-lg border bg-card px-4 py-4' },
        h(
          'svg',
          { viewBox: '0 0 ' + WIDTH + ' ' + height, role: 'img', 'aria-label': plain(caption) || 'sequence diagram' },
          actors.map((name) =>
            h(
              'g',
              { key: name },
              h('text', { x: ax(name), y: 12, textAnchor: 'middle', className: 'vs-seq-actor' }, name),
              h('line', {
                x1: ax(name),
                y1: TOP - 10,
                x2: ax(name),
                y2: height - 4,
                className: 'vs-seq-life',
                strokeDasharray: '3 4',
              }),
            ),
          ),
          messages.map((message, index) => {
            const y = TOP + index * STEP + 14;
            const x1 = ax(message.from);
            const x2 = ax(message.to);
            if (message.from === message.to) {
              return h(
                'g',
                { key: index },
                h('path', {
                  d: 'M' + x1 + ' ' + (y - 8) + ' h26 v12 h-20',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 1.5,
                }),
                h('polygon', {
                  points: x1 + 6 + ',' + (y + 4) + ' ' + (x1 + 13) + ',' + y + ' ' + (x1 + 13) + ',' + (y + 8),
                  fill: 'currentColor',
                }),
                h('text', { x: x1 + 32, y: y, className: 'vs-seq-msg' }, plain(message.text)),
              );
            }
            const sign = x2 > x1 ? 1 : -1;
            return h(
              'g',
              { key: index },
              h('line', {
                x1,
                y1: y,
                x2: x2 - 8 * sign,
                y2: y,
                stroke: 'currentColor',
                strokeWidth: 1.5,
                strokeDasharray: message.dashed ? '5 4' : undefined,
              }),
              h('polygon', {
                points: x2 + ',' + y + ' ' + (x2 - 8 * sign) + ',' + (y - 4) + ' ' + (x2 - 8 * sign) + ',' + (y + 4),
                fill: 'currentColor',
              }),
              h('text', { x: (x1 + x2) / 2, y: y - 6, textAnchor: 'middle', className: 'vs-seq-msg' }, plain(message.text)),
            );
          }),
        ),
        caption ? h('figcaption', { className: 'mt-2 text-sm italic text-muted-foreground' }, plain(caption)) : null,
      ),
    );
  };

  // ApiDiff reads like a diff because that is what a consumer scans for: what
  // appeared, what vanished, what moved under them.
  const API_MARKS = { '+': 'add', '−': 'remove', '-': 'remove', '~': 'change' };
  const API_TONE = {
    add: 'bg-emerald-50 text-emerald-700',
    remove: 'bg-red-50 text-red-700',
    change: 'bg-amber-50 text-amber-700',
  };
  const API_GLYPH = { add: '+', remove: '−', change: '~' };
  const ApiDiff = ({ body = '' }) =>
    wrap(
      'ApiDiff',
      h(
        'div',
        { className: 'divide-y rounded-lg border bg-card' },
        rows(body).map((row, index) => {
          const mark = row[1] === ' ' ? API_MARKS[row[0]] : undefined;
          const rest = mark ? row.slice(2).trim() : row;
          const [signature, ...noteParts] = rest.split(NOTE_SPLIT);
          return h(
            'div',
            { key: index, className: 'flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2' },
            h(
              'span',
              {
                'aria-hidden': 'true',
                className: 'inline-flex w-5 justify-center rounded text-xs font-bold ' + (mark ? API_TONE[mark] : 'text-muted-foreground'),
              },
              mark ? API_GLYPH[mark] : '·',
            ),
            h(
              'span',
              {
                className:
                  'font-mono text-sm ' +
                  (mark === 'remove' ? 'text-muted-foreground line-through' : 'text-card-foreground'),
              },
              plain(signature),
            ),
            noteParts.length
              ? h('span', { className: 'text-sm text-muted-foreground' }, plain(noteParts.join(' — ')))
              : null,
          );
        }),
      ),
    );

  // Options closes alternatives; Tradeoff weighs open ones. The chip is the
  // disposition, the reason is the sentence that stops the debate reopening.
  const bracketTag = (text) => {
    const match = text.match(/^\[([a-z]+)\]\s+(.*)$/i);
    return match ? { tag: match[1].toLowerCase(), rest: match[2] } : { rest: text };
  };
  const OPTION_TONE = {
    chosen: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    deferred: 'bg-amber-50 text-amber-700',
    open: 'bg-muted text-muted-foreground',
  };
  const Options = ({ body = '' }) =>
    wrap(
      'Options',
      h(
        'div',
        { className: 'divide-y rounded-lg border bg-card' },
        rows(body).map((row, index) => {
          const { tag, rest } = bracketTag(row);
          const disposition = OPTION_TONE[tag] ? tag : 'open';
          const { label, value } = labelValue(rest);
          return h(
            'div',
            { key: index, className: 'px-4 py-3' },
            h(
              'div',
              { className: 'flex flex-wrap items-center gap-2' },
              h(
                'span',
                { className: 'rounded-full px-2 py-0.5 text-xs font-semibold ' + OPTION_TONE[disposition] },
                disposition,
              ),
              h('span', { className: 'text-sm font-semibold text-card-foreground' }, plain(label)),
            ),
            value ? h('div', { className: 'mt-1 text-sm text-muted-foreground' }, plain(value)) : null,
          );
        }),
      ),
    );

  // Scope renders the exclusions beside the inclusions on purpose: what a
  // proposal deliberately leaves out is where review arguments start.
  const Scope = ({ body = '' }) => {
    const items = rows(body).map((row) => {
      if (row.startsWith('+')) return { inside: true, text: row.slice(1).trim() };
      if (row.startsWith('−') || row.startsWith('-')) return { inside: false, text: row.slice(1).trim() };
      return { inside: true, text: row };
    });
    const column = (title, list, glyph, tone) =>
      h(
        'div',
        { className: 'rounded-lg border bg-card px-4 py-3' },
        h('div', { className: 'text-xs font-semibold tracking-wider text-muted-foreground uppercase' }, title),
        h(
          'ul',
          { className: 'flex flex-col gap-1.5', style: { listStyle: 'none', margin: '8px 0 0', padding: 0 } },
          list.map((item, index) =>
            h(
              'li',
              { key: index, className: 'flex gap-2 text-sm text-card-foreground' },
              h('span', { 'aria-hidden': 'true', className: 'font-bold ' + tone }, glyph),
              h('span', null, plain(item.text)),
            ),
          ),
        ),
      );
    return wrap(
      'Scope',
      h(
        'div',
        { className: 'grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3' },
        column('In scope', items.filter((item) => item.inside), '✓', 'text-emerald-700'),
        column('Out of scope', items.filter((item) => !item.inside), '✕', 'text-red-700'),
      ),
    );
  };

  // Risks pairs every worry with its mitigation on one row; the two chips make
  // an unmitigated high × high impossible to bury in prose.
  const RISK_LEVELS = /\b(high|medium|low)\s*[×x]\s*(high|medium|low)\b/i;
  const RISK_TONE = {
    high: 'bg-red-50 text-red-700',
    medium: 'bg-amber-50 text-amber-700',
    low: 'bg-emerald-50 text-emerald-700',
  };
  const Risks = ({ body = '' }) =>
    wrap(
      'Risks',
      h(
        'div',
        { className: 'divide-y rounded-lg border bg-card' },
        rows(body).map((row, index) => {
          const { label, value } = labelValue(row);
          const match = value.match(RISK_LEVELS);
          if (!match) {
            return h('div', { key: index, className: 'px-4 py-3 text-sm' }, plain(row));
          }
          const likelihood = match[1].toLowerCase();
          const impact = match[2].toLowerCase();
          const mitigation = value
            .slice(match.index + match[0].length)
            .replace(/^\s*(?:—|--|-)\s*/, '');
          return h(
            'div',
            { key: index, className: 'px-4 py-3' },
            h(
              'div',
              { className: 'flex flex-wrap items-center gap-2' },
              h('span', { className: 'text-sm font-semibold text-card-foreground' }, plain(label)),
              h(
                'span',
                { className: 'rounded px-1.5 py-0.5 text-xs font-semibold ' + RISK_TONE[likelihood] },
                'likelihood ' + likelihood,
              ),
              h(
                'span',
                { className: 'rounded px-1.5 py-0.5 text-xs font-semibold ' + RISK_TONE[impact] },
                'impact ' + impact,
              ),
            ),
            mitigation ? h('div', { className: 'mt-1 text-sm text-muted-foreground' }, plain(mitigation)) : null,
          );
        }),
      ),
    );

  // Impact is the blast-radius ledger: one row per audience, what the change
  // costs them, nothing else.
  const Impact = ({ body = '' }) =>
    wrap(
      'Impact',
      h(
        'div',
        { className: 'divide-y rounded-lg border bg-card' },
        rows(body).map((row, index) => {
          const { label, value } = labelValue(row);
          return h(
            'div',
            { key: index, className: 'grid grid-cols-[minmax(120px,180px)_1fr] gap-3 px-4 py-2.5' },
            h('span', { className: 'font-mono text-xs font-bold text-card-foreground' }, plain(label)),
            h('span', { className: 'text-sm text-muted-foreground' }, plain(value)),
          );
        }),
      ),
    );

  // Questions keeps settled rows on the page: the settled-to-open ratio is
  // how a living proposal shows convergence across revisions.
  const QUESTION_TONE = {
    open: 'bg-amber-50 text-amber-700',
    settled: 'bg-emerald-50 text-emerald-700',
  };
  const Questions = ({ body = '' }) =>
    wrap(
      'Questions',
      h(
        'div',
        { className: 'divide-y rounded-lg border bg-card' },
        rows(body).map((row, index) => {
          const { tag, rest } = bracketTag(row);
          const status = tag === 'settled' ? 'settled' : 'open';
          const [question, ...ownerParts] = rest.split(NOTE_SPLIT);
          return h(
            'div',
            { key: index, className: 'flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5' },
            h('span', { className: 'rounded-full px-2 py-0.5 text-xs font-semibold ' + QUESTION_TONE[status] }, status),
            h('span', { className: 'text-sm text-card-foreground' }, plain(question)),
            ownerParts.length
              ? h('span', { className: 'font-mono text-xs text-muted-foreground' }, plain(ownerParts.join(' — ')))
              : null,
          );
        }),
      ),
    );

  // Compat is a support matrix, not a data table: the marks are semantic and
  // colored, and anything that is not a mark passes through as text.
  const COMPAT_MARKS = {
    '✓': ['✓', 'text-emerald-700'],
    yes: ['✓', 'text-emerald-700'],
    '✗': ['✗', 'text-red-700'],
    '✕': ['✗', 'text-red-700'],
    no: ['✗', 'text-red-700'],
    partial: ['±', 'text-amber-700'],
    '±': ['±', 'text-amber-700'],
  };
  const Compat = ({ body = '', columns = '' }) => {
    const heads = String(columns)
      .split(',')
      .map((head) => head.trim())
      .filter(Boolean);
    if (!heads.length) {
      return wrap('Compat', h('div', { className: 'rounded-lg border bg-card px-4 py-3 text-sm' }, plain(body)));
    }
    const parsed = rows(body).map((row) => {
      const { label, value } = labelValue(row);
      return { label, cells: value.split(/\s+·\s+/).map((cell) => cell.trim()) };
    });
    return wrap(
      'Compat',
      h(
        'div',
        { className: 'overflow-x-auto rounded-lg border bg-card' },
        h(
          'table',
          { className: 'w-full text-sm', style: { borderCollapse: 'collapse', margin: 0 } },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', { className: 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground' }, ''),
              heads.map((head, index) =>
                h(
                  'th',
                  { key: index, className: 'px-3 py-2 text-center text-xs font-semibold text-muted-foreground' },
                  head,
                ),
              ),
            ),
          ),
          h(
            'tbody',
            null,
            parsed.map((row, rowIndex) =>
              h(
                'tr',
                { key: rowIndex, style: { borderTop: '1px solid var(--md-sys-color-outline-variant)' } },
                h('td', { className: 'px-3 py-2 font-medium text-card-foreground' }, plain(row.label)),
                heads.map((head, cellIndex) => {
                  const cell = row.cells[cellIndex] || '';
                  const mark = COMPAT_MARKS[cell.toLowerCase()];
                  return h(
                    'td',
                    {
                      key: cellIndex,
                      className:
                        'px-3 py-2 text-center ' + (mark ? 'font-bold ' + mark[1] : 'text-muted-foreground'),
                    },
                    mark ? mark[0] : plain(cell),
                  );
                }),
              ),
            ),
          ),
        ),
      ),
    );
  };

  // vs-proposal chrome. The hero carries what frontmatter declares - title,
  // eyebrow, owner, phase, updated - and the contents rail is scanned from
  // the mounted h2s, so it can never drift from the document's sections. The
  // scan needs hooks, so a hookless host (the CLI lint path, a stub React)
  // gets the document without the chrome instead of a crash.
  const PROPOSAL_PHASES = ['Draft', 'Proposed', 'Accepted', 'Rejected', 'Superseded'];
  const headingId = (text, index) => {
    const slug = String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'section-' + (index + 1);
  };
  const ProposalLayout = ({ children, slots = {} }) => {
    const mainRef = React.useRef(null);
    const [contents, setContents] = React.useState([]);
    React.useEffect(() => {
      if (!mainRef.current) return;
      const headings = Array.from(mainRef.current.querySelectorAll('h2'));
      setContents(
        headings.map((heading, index) => {
          if (!heading.id) heading.id = headingId(heading.textContent, index);
          return { id: heading.id, text: heading.textContent || '' };
        }),
      );
    }, [children]);
    const phase = slots.phase;
    return h(
      'div',
      { className: 'vs-p' },
      h(
        'header',
        { className: 'vs-p-hero' },
        h(
          'div',
          { className: 'vs-p-hero-inner' },
          slots.project ? h('p', { className: 'vs-p-eyebrow' }, slots.project) : null,
          h('h1', { className: 'vs-p-title' }, slots.title || ''),
          phase || slots.owner || slots.updated
            ? h(
                'div',
                { className: 'vs-p-meta' },
                phase
                  ? h(
                      'span',
                      {
                        className: 'vs-p-pill',
                        'data-phase': PROPOSAL_PHASES.includes(phase) ? phase : 'Draft',
                      },
                      phase,
                    )
                  : null,
                slots.owner ? h('span', { className: 'vs-p-pill' }, slots.owner) : null,
                slots.updated ? h('span', { className: 'vs-p-pill' }, 'Updated ' + slots.updated) : null,
              )
            : null,
        ),
      ),
      h(
        'div',
        { className: 'vs-p-body' },
        contents.length
          ? h(
              'nav',
              { className: 'vs-p-toc', 'aria-label': 'Contents' },
              h('span', { className: 'vs-p-toc-label' }, 'Contents'),
              contents.map((entry, index) =>
                h(
                  'a',
                  { key: entry.id, href: '#' + entry.id },
                  h('span', { className: 'vs-p-toc-num', 'aria-hidden': 'true' }, String(index + 1).padStart(2, '0')),
                  entry.text,
                ),
              ),
            )
          : null,
        h('main', { className: 'vs-p-main', ref: mainRef }, children),
      ),
    );
  };

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
    {
      name: 'Flow',
      body: 'markdown',
      purpose:
        "Show a linear pipeline, rollout, or lifecycle as stage cards joined by arrows, written as '- Stage: detail' rows in order. A stage label may end with [done], [active], or [next] to mark rollout progress on the strip. Three to six stages read best; the strip collapses to a column on narrow screens. It renders straight-line flow only - branching, cycles, or fan-out belong in a mermaid diagram.",
      example:
        '<Flow>\n- Input: standard source package\n- Output: preserved package + compatibility files\n- Install: native plugin installation\n</Flow>',
      Component: asComponent(Flow),
    },
    {
      name: 'Figure',
      body: 'markdown',
      purpose:
        "Point at places in an image: a captioned figure whose '- @x,y note' rows pin numbered markers at percent coordinates and repeat below as a numbered legend. Verify every coordinate against a rendered screenshot before shipping - a marker on the wrong element misleads more than no marker. A row without the @x,y prefix appears in the legend only. The image zooms in the lightbox like any other; markers stay on the page.",
      example:
        '<Figure src="./onboarding.png" caption="Setup step 2 — connect payments">\n- @21,58 Step rail: payments not yet connected\n- @44,34 Accept Payments — the merchant entry point\n</Figure>',
      props: [
        {
          name: 'src',
          type: 'string',
          description: 'Image path relative to the artifact, or a data URI.',
        },
        {
          name: 'caption',
          type: 'string',
          description: 'One-line caption rendered under the image.',
        },
      ],
      Component: asComponent(Figure),
    },
    {
      name: 'Bars',
      body: 'markdown',
      purpose:
        "Compare magnitudes across a set, written as '- label: value' rows; the first number in each value sizes the bar and every bar scales to the largest in the set. Use it where the question is relative size - requests per route, cost per team, count per category. A value measured against a real published ceiling belongs in <Gauge>; a change between two moments belongs in <Delta>.",
      example: '<Bars>\n- /api/search: 4,120 req/min\n- /api/detail: 2,880 req/min\n- /api/export: 310 req/min\n</Bars>',
      Component: asComponent(Bars),
    },
    {
      name: 'Trend',
      body: 'markdown',
      purpose:
        "Show how one measure moved across ordered points, written as '- label: value' rows in sequence - releases, weeks, milestones. The first number in each value plots the line; labels and values repeat under the chart in order. It draws one series; two measures that move together are two <Trend>s or a table. Fewer than two numeric rows render as text - there is no trend in one point.",
      example: '<Trend caption="p95 render time by release">\n- 4.12: 610ms\n- 4.13: 540ms\n- 4.14: 380ms\n- 4.15: 210ms\n</Trend>',
      props: [
        {
          name: 'caption',
          type: 'string',
          description: 'One-line caption rendered under the chart.',
        },
      ],
      Component: asComponent(Trend),
    },
    {
      name: 'Tree',
      body: 'markdown',
      purpose:
        "Show a file or module hierarchy, written as nested '- name' rows indented two spaces per level. A leading '+' marks an addition (green), '−' a removal (red, struck through), '~' a change (amber); unmarked rows are unchanged context. Text after ':' renders as a muted note. This is the component for a proposal's before/after layout - one tree with marks, not two panes the reader must diff by eye.",
      example:
        '<Tree>\n- plugins/\n  - my-project/\n    - + plugin/: the installable package\n    - + tests/: plugin-only tests\n    - project.json\n- − tests/: moved into the project\n</Tree>',
      Component: asComponent(Tree),
    },
    {
      name: 'Sequence',
      body: 'markdown',
      purpose:
        "Show who calls whom in what order, written as '- Actor -> Actor: message' rows; '-->' draws a dashed reply. Actors become columns in order of first appearance and messages run top to bottom, so the exchange reads without prose. Two to five actors fit; a row without an arrow is ignored. It renders request/reply order only - branching and state belong in a mermaid diagram.",
      example:
        '<Sequence caption="Plugin install flow">\n- CLI -> Registry: resolve plugin\n- Registry --> CLI: tarball\n- CLI -> Disk: unpack the plugin leaf only\n</Sequence>',
      props: [
        {
          name: 'caption',
          type: 'string',
          description: 'One-line caption rendered under the diagram.',
        },
      ],
      Component: asComponent(Sequence),
    },
    {
      name: 'ApiDiff',
      body: 'markdown',
      purpose:
        "List public-surface changes the way a diff reads: '- + signature' added (green), '- − signature' removed (red, struck through), '- ~ signature' changed (amber); text after ' — ' renders as a muted note. Use it for the API, CLI, or config surface a consumer must react to. A behavior change with no surface change belongs in prose.",
      example:
        '<ApiDiff>\n- + createThread(options) — opens a review thread\n- ~ search(query) — result shape gains highlights\n- − legacyPost() — removed, use createThread\n</ApiDiff>',
      Component: asComponent(ApiDiff),
    },
    {
      name: 'Options',
      body: 'markdown',
      purpose:
        "Record the disposition of each alternative considered, written as '- [chosen] Name: reason' rows with chosen, rejected, or deferred in the bracket. The reason is the sentence a future reader needs before reopening the debate. Weighing options that are still open belongs in <Tradeoff> - this component closes them.",
      example:
        '<Options>\n- [chosen] Package subdirectory: tests stay local without shipping to consumers\n- [rejected] Root tests directory: breaks project locality\n- [deferred] Creator Kit migration: revisit once the boundary lands\n</Options>',
      Component: asComponent(Options),
    },
    {
      name: 'Scope',
      body: 'markdown',
      purpose:
        "Draw the boundary of the change: '- + item' rows are in scope, '- − item' rows are out, side by side. The out column is the point - what a proposal deliberately excludes is where review arguments start, so an empty one is a smell. Unmarked rows count as in scope.",
      example:
        '<Scope>\n- + Package boundary and install path\n- + Plugin-only test placement\n- − Creator Kit migration\n- − Registry protocol changes\n</Scope>',
      Component: asComponent(Scope),
    },
    {
      name: 'Risks',
      body: 'markdown',
      purpose:
        "Register what could go wrong, written as '- risk: likelihood × impact — mitigation' rows with high, medium, or low on each side of the ×. Both levels render as colored chips and the mitigation as the row body. A risk with no mitigation is a decision to accept it - say that in the row rather than leaving the tail empty.",
      example:
        '<Risks>\n- Consumers pin the old layout: medium × high — keep a compatibility alias for one release\n- Install size grows: low × low — accepted, the delta is 40KB\n</Risks>',
      Component: asComponent(Risks),
    },
    {
      name: 'Impact',
      body: 'markdown',
      purpose:
        "State the blast radius per audience, written as '- audience: what they must do' rows - the consumers, teams, and systems the change reaches. It answers the reviewer's first question: who is affected and what does it cost them. When a reader would ask about an audience, list it even if the action is none.",
      example:
        '<Impact>\n- plugin consumers: re-install once, no config change\n- CI pipelines: update the cache key to the new path\n- docs: two pages reference the old layout\n</Impact>',
      Component: asComponent(Impact),
    },
    {
      name: 'Questions',
      body: 'markdown',
      purpose:
        "Track what the proposal has not settled, written as '- [open] question — owner' rows; '[settled]' closes one. Keep settled rows on the page instead of deleting them - the settled-to-open ratio is how a living proposal shows convergence across revisions.",
      example:
        '<Questions>\n- [open] Include and exclude semantics in the Agent Plugins spec — vlad\n- [settled] Where plugin-only tests live — resolved by this proposal\n</Questions>',
      Component: asComponent(Questions),
    },
    {
      name: 'Compat',
      body: 'markdown',
      purpose:
        "Show what works where as a support matrix: `columns` names the capabilities and each '- row: cell · cell' row fills one line with ✓, ✗, partial, or free text. Use it for version × feature or platform × capability support. Past roughly four columns it stops fitting a half-width window - use a markdown table instead. Without `columns` the body renders as text.",
      example:
        '<Compat columns="lint, render, skill">\n- 4.14: ✓ · ✗ · ✓\n- 4.15: ✓ · ✓ · partial\n- 4.16: ✓ · ✓ · ✓\n</Compat>',
      props: [
        {
          name: 'columns',
          type: 'string',
          description: 'Comma-separated column headings, one per cell position in each row.',
        },
      ],
      Component: asComponent(Compat),
    },
  ];

  const layouts = [
    // The runtime's custom-layout shell already renders blocks in source order
    // with no chrome, which is the vs design; the stylesheet carries the rest.
    { name: 'vs', Component: (props) => props.children },
    {
      name: 'vs-proposal',
      // Slots stay inside the runtime's known frontmatter vocabulary
      // (title/project/owner/phase/updated) so a proposal lints clean; phase
      // carries the lifecycle state in the same words <Verdict> uses.
      slots: {
        title: { from: 'title' },
        project: { from: 'project' },
        owner: { from: 'owner' },
        phase: { from: 'phase' },
        updated: { from: 'updated' },
      },
      Component: React && React.useState ? ProposalLayout : (props) => props.children,
    },
  ];

  const themes = [{ id: 'vs', css }];

  // Click-to-zoom for content images. The factory is the only code both
  // loaders run, so the listener attaches here: a no-op under the CLI's node
  // context, and guarded per document because a rerender re-registers the
  // catalog and must not stack listeners.
  if (
    typeof document !== 'undefined' &&
    !document.documentElement.hasAttribute('data-vs-lightbox')
  ) {
    document.documentElement.setAttribute('data-vs-lightbox', 'true');
    const closeLightbox = () => {
      const open = document.querySelector('.vs-lightbox');
      if (open) open.remove();
      return Boolean(open);
    };
    document.addEventListener('click', (event) => {
      if (closeLightbox()) return;
      const target = event.target instanceof Element ? event.target : null;
      const image =
        target && target.closest(".htmdx-app[data-htmdx-layout^='vs'] img.htmdx-image");
      if (!image) return;
      const overlay = document.createElement('div');
      overlay.className = 'vs-lightbox';
      const zoomed = document.createElement('img');
      zoomed.src = image.src;
      zoomed.alt = image.alt;
      overlay.append(zoomed);
      document.body.append(overlay);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLightbox();
    });
  }

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
