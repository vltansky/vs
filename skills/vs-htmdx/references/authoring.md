# HTMDX authoring

This reference is pinned to `@wix/htmdx@4.5.1`.

Before authoring, read the matching runtime manifest:

`https://cdn.jsdelivr.net/npm/@wix/htmdx@4.5.1/dist/components.json`

The manifest owns component names, purposes, props, body modes, and examples.
If it is unavailable, stay within the curated components below rather than
guessing a capitalized tag.

## Body modes

- `markdown`: accepts the declared Markdown grammar but no nested component
  tags. Follow the component's exact row or table format.
- `htmdx`: accepts Markdown, allowlisted HTML, and nested registered components.
- `none`: use an empty or self-closing tag.

Every component accepts `class`, `id`, `aria-*`, and `data-*`. Other attributes
must be declared in the manifest. Values are data, not expressions.

## The report components take no props

Most components carry no props at all in 4.5.1, including every report
component: `Callout`, `ExecutiveSummary`, `MetricStrip`, `DataTable`, `Compare`,
`Evidence`, `RiskTable`, `Timeline`, `Finding`, `Stat`, and the charts. Severity,
tone, and variant live in the body text, not in an attribute.

An attribute that reads plausibly by analogy with another design system is still
a compile error — `<Callout type="warning">` fails with
`unknown prop "type" for <Callout>`. Only the interactive components
(`Tabs`, `Accordion`, `Dialog`, `Popover`, `Tooltip`, `Badge`, `Button`,
`Separator`, `Progress`, table cells) declare props. Check the manifest entry
before writing any attribute; an absent `props` key means none are accepted.

## Body grammar is stricter than the manifest states

The 4.5.1 manifest reports `body: "markdown"` for components whose runtime
still enforces a specific row grammar, so the manifest under-specifies and the
mismatch surfaces at render rather than compile. Use this table, not the
manifest's `body` field:

| Component | Body grammar |
|---|---|
| `MetricStrip`, `Timeline` | `- label: value` rows only |
| `DataTable`, `DecisionMatrix` | a GFM table with a header separator row |
| `Compare`, `Evidence`, `RiskTable`, `Finding` | `- **Label:** text` list items |
| `ChartBar`, `ChartLine`, `ChartPie` | `- label: non-negative number` |
| `ExecutiveSummary`, `Callout`, `SourceQuote` | free Markdown |

A Markdown table inside `MetricStrip` fails with `Invalid body for <MetricStrip>
at body line 1: non-empty lines must be list items`. Tables belong in
`DataTable`; everything else in this family wants a list.

## Angle brackets are parsed as tags

Inside an `htmdx` body the runtime scans for nested components, and a code fence
does not protect its contents. `<observable outcome>` there compiles as a
component and fails with `unknown component <OBSERVABLE>`.

Placeholder-heavy content — contract templates, output shells, `<value>` slots —
belongs at the top level of the document, where fenced blocks are literal:

```mdx
### The handback block

```markdown
**Try it:** <preview URL> — or — http://localhost:<port>
```
```

Do not wrap that section in `Card`, `Tabs`, `Accordion`, or any other
`htmdx`-body component. If placeholders must appear inside one, rewrite them
without angle brackets — `PREVIEW_URL`, `{{port}}`, or *preview URL* in italics.

The same applies to bare comparisons and generics in prose: write `a < b` as
`` `a < b` `` at the top level, and avoid `Array<string>` inside an `htmdx`
body.

## Report components

```mdx
<ExecutiveSummary>
Ship **one HTML file** with editable HTMDX source.
</ExecutiveSummary>

<MetricStrip>
- ↑ Active users: **1,204** — up 12% month over month
- ↓ Failure rate: **0.3%** · below the 1% guardrail
</MetricStrip>

<Compare>
- **Current:** Manual component discovery
- **Proposed:** Versioned manifest
</Compare>

<DataTable>
| Plan | Users |
| --- | ---: |
| Free | 48 |
| Pro | 12 |
</DataTable>

<DecisionMatrix>
| Criterion | Keep | Change ✓ |
| --- | --- | --- |
| User fit | Partial | [green] Strong |
| Effort | [green] Low | [amber] Medium |
</DecisionMatrix>

<Timeline>
- July: Publish the manifest
- August: Adopt it in validators
</Timeline>

<ChartBar>
- Free users: 48
- Paid users: 12
</ChartBar>

<Evidence>
- **Runtime:** The exact-version manifest declares the component grammar.
</Evidence>

<RiskTable>
- **Must-have:** Preserve the source block.
- **Differentiator:** Make comparison faster.
- **Not now:** Add a custom runtime extension.
- **Won't do:** Generate a second Markdown copy.
</RiskTable>
```

Despite its name, `RiskTable` is a four-tier scope classifier. Do not use it for
generic risks, blockers, decisions, confidence, or severity levels. Use
`Callout`, `Evidence`, a Markdown list, or a `DataTable` for those shapes.

`ChartLine` and `ChartPie` use the same `- label: non-negative number` grammar
as `ChartBar` in runtime 4.5.1. The current renderer uses the shared chart
visualization for all three, so choose by semantic intent rather than assuming
their visual marks differ.

## Composable components

Use `Card`, `Tabs`, and `Accordion` for genuine grouping or alternate views, not
decoration. Their bodies are `htmdx`, so allowlisted components can nest inside —
and so the angle-bracket rule above applies to everything they contain.

These are compound components: the parent is invalid without its full child set,
and the runtime rejects an incomplete one at compile time rather than degrading.

| Parent | Required props | Required children |
|---|---|---|
| `Tabs` | `defaultValue`, matching one `TabsTrigger` value | `TabsList` > `TabsTrigger`, plus one `TabsContent` per trigger |
| `Accordion` | `type` | `AccordionItem` > `AccordionTrigger` + `AccordionContent` |
| `Card` | none | `CardContent`; `CardHeader` > `CardTitle` when titled |

Every `value` pairs a trigger with its content — `Tabs` needs each `value` to
appear exactly twice. Author the whole set in one edit; a parent alone fails with
`required prop "defaultValue" is missing for <Tabs>` or the equivalent.

Prefer plain `###` sections. Reach for `Tabs` only when the reader would look at
one panel *instead of* another. Sequential sections that are all read in order —
three phases of one workflow, three stages of a migration — are not alternate
views, and tabbing them hides content behind clicks for no gain.

```mdx
<Card>
  <CardHeader>
    <CardTitle>Recommendation</CardTitle>
    <CardDescription>Decision needed by Friday</CardDescription>
  </CardHeader>
  <CardContent>
    Adopt the pinned manifest. <Badge variant="secondary">proposed</Badge>
  </CardContent>
</Card>

<Tabs defaultValue="summary">
  <TabsList>
    <TabsTrigger value="summary">Summary</TabsTrigger>
    <TabsTrigger value="evidence">Evidence</TabsTrigger>
  </TabsList>
  <TabsContent value="summary">The compact view.</TabsContent>
  <TabsContent value="evidence">The supporting detail.</TabsContent>
</Tabs>

<Accordion type="single" collapsible>
  <AccordionItem value="risks">
    <AccordionTrigger>Key risks</AccordionTrigger>
    <AccordionContent>Runtime drift and unsupported tags.</AccordionContent>
  </AccordionItem>
</Accordion>
```

## Reader self-check questions

There is no quiz component. When an artifact should let the reader test their own
understanding, use one `AccordionItem` per question: the question in
`AccordionTrigger`, the answer and its reasoning in `AccordionContent`. Give each
item a distinct `value`.

```mdx
<Accordion type="single" collapsible>
  <AccordionItem value="q1">
    <AccordionTrigger>Why does the retry keep the original deadline?</AccordionTrigger>
    <AccordionContent>
      Because the deadline belongs to the caller's request, not the attempt. A
      per-attempt deadline would let three retries take three times as long as
      the caller allowed.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="q2">
    <AccordionTrigger>What happens on the first attempt after the deadline passes?</AccordionTrigger>
    <AccordionContent>
      It is not attempted. The check runs before the call, so an expired
      deadline short-circuits to the timeout error.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

This is reveal-on-click. Nothing records the reader's answer or scores it, so do
not describe it as a graded quiz.

## Design restraint

Prefer the default document hierarchy and theme. Tailwind classes are available,
but use them for one meaningful emphasis or layout adjustment rather than
restyling every component. Keep the palette to the selected HTMDX theme plus one
semantic accent.

Use frontmatter fields when they help:

```mdx
---
title: Product strategy
project: Checkout
owner: Payments team
phase: Decision
updated: 2026-07-24
theme: teal
layout: default
---
```

Built-in themes in 4.5.1 are `blue`, `purple`, `green`, `teal`, `amber`,
`magenta`, `fuchsia`, `rose`, `lime`, and `coral`. Unknown themes fall back to
`blue`.
