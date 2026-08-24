// The vs catalog: the layout and stylesheet every vs report renders against,
// loaded by the CLI via `--definitions` so lint, compile, and skill answer
// against the same catalog the artifact loads in the browser.
//
// The browser copy lives inline in artifact.html — a portable single-file
// artifact cannot import this module — and test/vs-catalog.static.eval.ts
// fails the build when the two drift.

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

export const layouts = [
  // The runtime's custom-layout shell already renders blocks in source order
  // with no chrome, which is the vs design; the stylesheet carries the rest.
  { name: 'vs', Component: ({ children }) => children },
];

export const themes = [{ id: 'vs', css: vsLayoutCss }];
