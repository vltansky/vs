---
name: vs-htmdx
description: "Use when the user asks to create, visualize, render, or edit an HTMDX artifact, or wants a decision brief, comparison, timeline, report, or dashboard delivered as HTMDX. Produces one portable HTML file with editable HTMDX source."
---

# HTMDX

Turn source material into one visual artifact that a human can review in a
browser and an agent can edit without touching generated markup.

This is a **building block**, not a research workflow. Preserve the supplied
facts and conclusions. If the content is still unknown, gather it with the
appropriate workflow first.

## Boundary

Use this skill when the user explicitly requests HTMDX or when HTMDX is the
requested delivery format. For an unqualified request to "visualize" a complex
relationship, use the host's visualization capability instead. For routine
prose, plans, and machine-consumed state, use Markdown.

An HTMDX deliverable is:

- one portable `.html` file;
- one editable `<script type="text/htmdx">` source block;
- a pinned browser runtime;
- no generated HTML body and no Markdown twin.

The source is declarative. Do not add imports, exports, brace expressions,
event handlers, function-valued props, or arbitrary JavaScript.

## Start

State the artifact's review question in one sentence:

```text
Review question: <what should become easier to understand or decide?>
```

Then determine the mode:

- **Create:** turn supplied files, notes, or results into a new artifact.
- **Edit:** update an existing file containing `type="text/htmdx"`.

Read every source the user identifies before choosing a layout. Separate
verified facts from inference and preserve links, labels, units, dates, and
uncertainty.

## Choose the visual grammar

Use ordinary Markdown for the narrative and add components only when they make
the review question easier to answer.

| Information shape | Prefer |
|---|---|
| Bottom line or recommendation | `ExecutiveSummary` |
| 2-6 headline values | `MetricStrip` |
| Comparable records | `DataTable` |
| Alternatives or before/after | `Compare` or `DecisionMatrix` |
| Ordered events or milestones | `Timeline` |
| Quantitative distribution or trend | `ChartBar`, `ChartLine`, or `ChartPie` |
| Supporting proof | `Evidence` |
| Blocker, warning, or general risk | `Callout` or ordinary Markdown |
| Scope classification by the runtime's four fixed tiers | `RiskTable` |
| Secondary detail, or a question whose answer the reader should try first | `Accordion` |
| Views the reader picks between, rather than reads in order | `Tabs` |

Default to ordinary `###` sections. `Card`, `Tabs`, and `Accordion` are compound
components with required children, and their bodies parse `<angle brackets>` as
component tags even inside a code fence — so wrapping placeholder-heavy or
sequential content in them adds compile failures without adding clarity.

Read [references/authoring.md](references/authoring.md) before authoring. It
contains the pinned manifest URL, body-shape rules, and component examples.
Use the versioned manifest as the source of truth whenever network access is
available.

Choose `layout: default` for reports and decision briefs. Choose
`layout: blank` only when source-order composition matters more than document
chrome. Do not register custom layouts, components, or themes unless the user
asks for a host integration rather than a portable artifact.

## Create

1. Resolve the destination:
   - use the exact path when the user supplies one;
   - otherwise resolve `$PROJECT_ID` with
     [../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md) and write
     `~/.vs/$PROJECT_ID/vs-htmdx/YYYY-MM-DD-<slug>.html`.
2. Start from [assets/artifact.html](assets/artifact.html). Copy the complete
   shell; replace the title, frontmatter, and primary source placeholders.
3. Keep `@wix/htmdx@4.5.1` pinned in both the renderer metadata and script URL.
4. Build a reading sequence:
   - conclusion first;
   - decisive metrics, comparison, or timeline second;
   - evidence and caveats next;
   - detailed reference material last.
5. Remove every placeholder and unused section.

Do not put a literal `</script>` sequence inside the source block, including in
a code fence. Write it as `<\/script>` in an example.

## Edit

Treat the source block as the canonical document.

1. Confirm the file contains exactly one `script[type="text/htmdx"]`. A legacy
   `template[type="text/htmdx"]` artifact may be edited in place without
   migration.
2. Preserve the doctype, runtime pin, shell markup, source container, and its
   attributes.
3. Edit only the source block. The text inside the existing `<title>` may also
   change when needed to keep the browser title accurate.
4. Preserve the artifact's current runtime and component contract. Do not
   silently upgrade an existing artifact.

If an `.html` file has no HTMDX source block, it is ordinary HTML. Stop and say
that converting it requires a new HTMDX artifact rather than an in-place edit.

## Verify

Before presenting the artifact:

1. Read back the saved file.
2. Confirm one doctype, one pinned runtime URL, and one editable source block.
3. Confirm there are no placeholders, imports, exports, brace expressions,
   event handlers, or literal `</script>` sequences inside the source.
4. Check every capitalized tag *and every attribute on it* against the
   exact-version component manifest. The report components accept no props; an
   attribute that reads plausibly by analogy with another design system is a
   compile error.
5. Check every compound component is complete: `Tabs` has `defaultValue` and one
   `TabsContent` per `TabsTrigger` with each `value` appearing exactly twice,
   `Accordion` has `type` and `AccordionItem` > `AccordionTrigger` +
   `AccordionContent`. A parent without its children is a compile error, not a
   degraded render.
6. Check no `<angle bracket>` placeholder sits inside an `htmdx` body. Code
   fences do not protect their contents there. Placeholder-heavy blocks belong
   at the top level, outside `Card`, `Tabs`, and `Accordion`.
7. Check structured bodies against the grammar table in
   [references/authoring.md](references/authoring.md), which is stricter than
   the manifest's `body` field. A Markdown table only belongs in `DataTable` or
   `DecisionMatrix`; `MetricStrip`, `Timeline`, `Compare`, `Evidence`, and
   `RiskTable` take list rows. `RiskTable` is not a generic risk list: every row
   starts with exactly `Must-have`, `Differentiator`, `Not now`, or `Won't do`.
8. Confirm the artifact answers the review question without inventing facts.
9. Render the saved file and confirm it compiled. An artifact is a thing the
   user looks at, so a structural check alone does not establish that it
   renders, and the grammar errors above surface only at render time.

```bash
node assets/render-check.mjs "$ARTIFACT_PATH"
```

The runtime replaces the document with its own diagnostic page on failure, so
`Failed step: compile` or `Failed step: render` in the output names the exact
component and reason. Fix and re-run until it passes; each pass reveals one
error, so expect to iterate rather than assume the first fix was the last.

Exit `2` means the check could not run, not that the artifact is fine. Fall back
to the host's browser tooling, or open the `file://` path — no server is needed.
When nothing can render it, report structural validation as such and do not
claim rendered proof.

## Handoff

Return:

- `Review question:` the question the artifact helps answer
- `Saved:` a clickable absolute path to the `.html`
- `Source:` the inputs used
- `Verified:` structural checks and, separately, rendered browser proof
- `Status: READY_FOR_REVIEW`

Do not echo the file body into chat. Do not commit unless the caller or user
requested a commit.

## Flow Contract

- **Kind:** Building block
- **Inputs:** source material or an existing HTMDX artifact
- **Outputs:** one portable `.html` artifact
- **Status:** `READY_FOR_REVIEW | BLOCKED`
- **Consumers:** direct human invocation and workflows that need a rich deliverable
- **Skip conditions:** Markdown or a native visualization answers the question
  more directly

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** research, analysis, or supplied source material
**Next:** done
**Relevant:** `/vs-explain-diff`
