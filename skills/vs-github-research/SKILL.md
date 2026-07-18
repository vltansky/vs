---
name: vs-github-research
description: "Use when the user asks how GitHub projects solve a problem, wants prior art, external code examples, ecosystem patterns, or a landscape comparison across parallel projects."
---

# GitHub Research

Answer the user's question by looking outward at real GitHub projects. Find how external projects solve the same kind of problem, then synthesize the patterns with citations.

This skill is for GitHub-backed prior art, examples, and landscape comparison. It is not a local call-graph tracer, rename blast-radius checker, or PR reviewer. If the user asks "where is this defined in this repo?", use normal local code search or a dedicated local research skill instead.

## Output Goal

Choose one output mode from the user's wording:

- **Prior-art answer:** compact synthesis of patterns, examples, tradeoffs, and takeaways.
- **Landscape report:** structured comparison across multiple parallel projects on fixed axes.

Do not turn the result into an RFC unless the user asks for one. Hand off to `/vs-rfc-research` when they want a decision document.

For a prior-art answer, stay in compact Markdown and give the user:

1. What patterns exist across external projects
2. Which examples are most relevant
3. What tradeoffs those examples reveal
4. What is worth borrowing, avoiding, or researching next

For a landscape report, produce a matrix-centered map of projects in the same space. Do not recommend a winner or propose copying everything the "best" project does; porting specific ideas belongs in `/vs-steal`, and architectural pivots belong in `/vs-shape-it`.

## Tool Source

The vs plugin includes `octocode` in its plugin `.mcp.json`. Use the MCP tools directly when available.

If octocode tools are not active in the current session, say that the plugin's octocode MCP server is not available and the host may need to reload/reinstall plugin MCP config. Stop rather than pretending web snippets or local files are equivalent evidence.

## Phase 1: Frame The Question

Translate the user's question into a broad search target.

Identify:

- **Problem:** what behavior, architecture, API, workflow, or convention are we researching?
- **Search domain:** likely languages, ecosystems, repo types, or organizations
- **Comparison axes:** 3-6 dimensions that will make examples comparable
- **Exclusions:** things that would be irrelevant or misleading
- **Mode:** prior-art answer or landscape report

If the user gives a vague question, choose a reasonable starting frame and state it. Ask only when the missing detail changes the search domain or the output mode.

Good broad-search questions:

- "How do other agent frameworks organize skills and commands?"
- "Find examples of projects using ADRs with AI coding instructions."
- "How do TypeScript CLIs manage plugin manifests?"
- "What patterns do repos use for eval fixtures next to skills?"
- "Compare how AI-agent frameworks organize skills, prompts, and commands."

Not this skill:

- "Where is `validateToken` defined in this repo?"
- "What breaks if I rename this function?"
- "Review this PR."

## Phase 2: Search Plan

Before calling research tools, write a short plan and proceed immediately:

```markdown
## GitHub Research Plan
**Question:** <user question>
**Mode:** <prior-art answer | landscape report>
**Search domain:** <ecosystem / repo family / language>
**Axes:** <axis 1>, <axis 2>, <axis 3>
**Steps:**
1. Discover candidate projects.
2. Inspect representative implementations.
3. Compare patterns and tradeoffs.
4. Summarize with citations.
```

Do not wait for approval. If the user interrupts, adapt.

## Phase 3: Discover Candidate Projects

Use external search first. Prefer several smaller searches over one giant query.

Typical octocode tool choices:

| Need | Tool |
|---|---|
| Find candidate repos | `githubSearchRepositories` |
| Find implementation examples | `githubSearchCode` |
| Inspect project layout | `githubViewRepoStructure` |
| Read source/docs | `githubGetFileContent` |
| Understand adoption/history | `githubSearchPullRequests` |
| Find package ecosystem signals | `packageSearch` |

Every tool call should include:

- `mainResearchGoal`: the user's full question
- `researchGoal`: the specific thing this call is trying to learn
- `reasoning`: why this search/read is the right next step

Follow hints in tool responses. If a tool suggests narrowing, pagination, related files, or a better next call, use that guidance unless you have a clear reason not to.

## Phase 4: Inspect Representative Examples

Select a small, useful sample rather than collecting endless links.

Default sample:

- 3-5 candidate projects for normal questions
- 5-8 candidate projects for ecosystem landscape questions
- 2-3 deep reads when examples are complex

For each representative example, capture:

- Repo/project name
- What problem it solves
- The concrete file, config, API, or workflow pattern
- Why it is relevant to the user's question
- Tradeoff or caveat
- Full GitHub URL with line numbers when available

Favor implementation files and committed docs over README claims. README-only evidence is allowed, but label it as documentation evidence.

## Phase 5A: Synthesize Prior-Art Answers

Use this phase when the mode is **prior-art answer**. Group findings by pattern, not by search order.

Use this output shape:

```markdown
## TL;DR
<2-4 sentences answering the question directly.>

## Patterns
- **<Pattern name>:** <what multiple projects do and why it matters>
  - Evidence: <repo/file citation>
  - Tradeoff: <cost or limitation>

## Examples
| Project | Pattern | Why it matters | Evidence |
|---|---|---|---|
| <repo> | <short pattern> | <relevance> | <URL> |

## Takeaways
1. <actionable synthesis>
2. <actionable synthesis>
3. <actionable synthesis>

## Gaps
<What was not proven, weakly evidenced, or worth a follow-up search.>
```

For small answers, keep it shorter, but always include citations.

## Phase 5B: Write Landscape Reports

Use this phase when the mode is **landscape report**.

Before characterizing any project, lock 4-7 structural axes. Default axes for an agent/skills framework:

- **Runtime / host** — Claude Code? Codex? custom CLI? language runtime?
- **Invocation model** — slash commands? model auto-invocation? both? how is ambiguity resolved?
- **Taxonomy** — how are skills/prompts/agents organized? explicit levels? flat?
- **Artifact output** — in-repo? per-user? session-only? how is it cleaned up?
- **Evaluation** — LLM-as-judge? scripted? regression over fixtures? none?
- **Distribution** — package? symlink? pointer files? copy-paste from docs?
- **Composition** — can skills call other skills? how? explicit vs implicit?

Write the axes down before searching. Revising axes after you've characterized a project biases the comparison.

Aim for 5-10 projects, not 30. Prefer projects that are active, show real usage, and are structural rather than one-off prompt dumps.

For each project, fill in each axis in one sentence. Cite a file/line when a sentence describes a concrete mechanism. Uncited axis values get flagged as `[inference]`.

The multi-project matrix and cross-linked evidence justify a visual artifact.
Resolve `$PROJECT_ID` (see
[../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md)) and write one
HTMDX artifact to
`~/.vs/$PROJECT_ID/vs-github-research/YYYY-MM-DD-landscape.html`. Follow the
[shared rich-artifact contract](../vs-internal-shared/references/rich-artifacts.md):
pin its exact runtime, keep all editable content in the HTMDX source block, and
create no Markdown twin.

```mdx
---
title: GitHub landscape
updated: YYYY-MM-DD
---

# GitHub landscape — YYYY-MM-DD

<ExecutiveSummary>
TODO: Write two to four sentences describing the main clusters and where this
project sits.
</ExecutiveSummary>

## Axes
- **Runtime / host** — ...
- **Invocation model** — ...
- **Taxonomy** — ...

## Projects

### owner/repo — one-line positioning
- Runtime / host: ...
- Invocation model: ...
- Taxonomy: ...
- Artifact output: ...
- Evaluation: ...
- Distribution: ...
- Composition: ...
- Notable choices: ...
- Stars / activity: ... (as of YYYY-MM-DD)

## Matrix

<DataTable>
| Project | Runtime | Invocation | Taxonomy | Artifacts | Evaluation | Distribution | Composition |
|---------|---------|------------|----------|-----------|------------|--------------|-------------|
| owner/repo | ... | ... | ... | ... | ... | ... | ... |
| **this project: vs** | ... | ... | ... | ... | ... | ... | ... |
</DataTable>

## Clusters and outliers
- Cluster 1: projects that chose X for axis Y (list)
- Outlier: ... (why they're different)
- Where this project sits: ... (one or two sentences)

## Where this project is differentiated
- ... (axes where this project makes a non-obvious choice — evidence-backed)

## Where this project is lagging
- ... (axes where a clear better choice exists in the ecosystem — honest)

## Open questions
- [ ] ...
```

Print the report path plus a short clusters summary.

## Evidence Rules

- Use full GitHub URLs with line numbers for external code.
- Separate direct evidence from inference.
- Do not claim popularity or best practice from one repo.
- Do not recommend copying code verbatim.
- If evidence is thin, say so.
- If examples disagree, explain the split instead of forcing consensus.

## Relationship To Nearby Skills

- `/vs-github-research` answers broad GitHub-backed questions and can create a landscape map across multiple projects.
- `/vs-steal` deeply inspects one named repo for portable ideas.
- `/vs-rfc-research` turns evidence into a formal proposal or decision document.

## Workflow

**Prev:** user question, `/vs-shape-it` needing prior art, or `/vs-pushback` needing external evidence.
**Next:** `/vs-rfc-research` (formalize decision), `/vs-steal` (deep dive one repo), `/vs-github-research` in landscape mode (broaden the scan), or `/vs-shape-it` (turn findings into design).
