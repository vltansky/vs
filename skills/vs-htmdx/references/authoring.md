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
decoration. Their bodies are `htmdx`, so allowlisted components can nest inside.

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
