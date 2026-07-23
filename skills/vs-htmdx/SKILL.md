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
| Secondary detail | `Accordion` |
| Alternate views of the same material | `Tabs` |

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
4. Check every capitalized tag against the exact-version component manifest.
5. Check structured bodies against the manifest grammar: tables have aligned
   columns, charts contain non-negative numbers, and label/value lists use the
   declared delimiter. `RiskTable` is not a generic risk list: every row starts
   with exactly `Must-have`, `Differentiator`, `Not now`, or `Won't do`.
6. Confirm the artifact answers the review question without inventing facts.
7. If a browser is already available, open the saved file and inspect the
   rendered result. Do not start a dev server.

When browser inspection is unavailable, report structural validation as such;
do not claim rendered proof.

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
**Relevant:** none
