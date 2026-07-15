---
name: vs-rfc-research
description: "Use when asked to write an RFC, ADR, technical proposal, or research a technical decision with code evidence."
metadata:
  author: vltansky
  version: 1.0.0
  mcp-server: octocode
  category: research
  tags: [rfc, research, architecture, decision-record, proposal]
---

# RFC Research

You're landing this RFC on the desk of a chief architect who has no time and no patience. They reject two kinds of documents: shallow ones (hand-wavy claims, no evidence, "we should consider...") and bloated ones (walls of text, obvious statements, sections that exist to look thorough). You get one shot. The RFC must be deeply researched, grounded in real code, and dense enough that every paragraph teaches them something they didn't know. If it reads like filler, it gets rejected. If it lacks evidence, it gets rejected. Deliver a document that respects their time and earns their trust.

Before delegating, load and follow
[`../vs-internal-shared/references/subagents.md`](../vs-internal-shared/references/subagents.md).

## Phase 0: Pre-flight Check

Before starting, verify octocode MCP is available by checking if `mcp__octocode__githubSearchRepositories` (or any `mcp__octocode__*` tool) is in your available tools. The vs plugin includes `octocode` in its plugin `.mcp.json`, so absence usually means the host did not load plugin MCP config for this session.

**IF octocode tools are available:** proceed to Phase 1.

**IF octocode tools are NOT available:** check whether the user explicitly constrained the task to a local codebase / fixture and asked you to use standard local tools instead of GitHub research.

Use this **local-evidence mode** only when the instruction is explicit (for example: "the fixture is local", "analyze the current repo", "use Read/Grep/Glob tools", or equivalent). In that case:
- proceed with local repo analysis instead of stopping
- use local file evidence (`path:line`) rather than GitHub URLs
- say that prior-art scope is limited to the local codebase unless other external evidence is available
- do NOT invent or imply GitHub research you did not perform

**IF octocode tools are NOT available and the task is not explicitly local-only:** stop and tell the user:

```
Octocode MCP is not active in this session. The vs plugin ships an octocode MCP config in `.mcp.json`; reload or reinstall the plugin MCP config, then start a fresh session and re-run this skill.
```

Do NOT proceed without octocode MCP unless the user explicitly requested local-evidence mode. The skill cannot claim GitHub-backed research without it.

## Workflow

### Phase 1: Scope the RFC

Use the **ask user question tool** to clarify scope before researching. Only ask about what's missing or ambiguous from the user's request — skip questions you can infer. If the host has no such tool, use numbered or labeled reply options.

**Question 1 — Problem & scope** (ask if problem statement is vague):
- "What specific problem are you trying to solve?" with options based on what you inferred from their request

**Question 2 — Research targets** (ask if not obvious):
- "Which ecosystems/repos should I investigate?" with options like specific libraries, orgs, or "Open-ended — find the best options"

**Question 3 — Decision drivers** (always ask — priorities shape the RFC):
- "What matters most for this decision?" with options like: Performance, Developer experience, Compatibility/migration cost, Community/ecosystem size — allow multi-select

After answers, present a brief summary:

```
RFC: [Title]
Problem: [1-2 sentences]
Research targets: [repos/libraries to investigate]
Decision drivers: [ranked list]

Proceed?
```

### Phase 2: Research Plan

Break the RFC topic into 2-5 concrete research questions. Each question maps to octocode MCP tool calls.

Example research questions:
- "How does [library X] implement [feature]?" -> `githubSearchCode` + `githubGetFileContent`
- "What repos solve [problem]?" -> `githubSearchRepositories`
- "What changed when [library] adopted [pattern]?" -> `githubSearchPullRequests`
- "What's the directory structure of [project]?" -> `githubViewRepoStructure`

Present the plan to the user before executing:

```
## Research Plan
1. [Question] -> [tool] on [target repo/org]
2. [Question] -> [tool] on [target repo/org]
...

Proceed?
```

### Phase 3: Execute Research

Use Octocode MCP tools through bounded Explore children. Group related research
questions by evidence domain and dispatch one Explore child per evidence domain,
not one child per query or tool call. Separate children only when domains are
genuinely independent, such as repository implementation, migration history,
and ecosystem alternatives.

**Rules:**
- Use the Agent tool with `subagent_type="Explore"` for octocode MCP calls
- Apply the shared standard budget unless the user asks for deep research
- Reserve one child slot for Phase 5. Standard mode combines Phase 3 into one
  Explore batch; deep mode may use at most three research children plus the
  cold reviewer.
- Run discovery and shortlist queries before fetching full files or PR history
- Independent evidence domains may run in parallel; sequential dependencies stay together
- Every tool call MUST include `mainResearchGoal`, `researchGoal`, and `reasoning`
- Follow hints in tool responses
- Collect file:line references for every finding
- Return a compact evidence ledger: claim, URL or file:line, supporting excerpt
  summary, limitation, and relevance. Do not return source dumps.

**Tool selection guide:**

| Research Need | Tool | When |
|---------------|------|------|
| Find repos | `githubSearchRepositories` | Discovering projects, comparing solutions |
| Find code patterns | `githubSearchCode` | Locating implementations, API usage |
| Read source | `githubGetFileContent` | Understanding implementation details |
| Explore structure | `githubViewRepoStructure` | Understanding project layout |
| Find PR history | `githubSearchPullRequests` | Understanding why decisions were made |
| Find packages | `packageSearch` | Looking up npm/pypi packages |

**Research depth:**
- For each research question, aim for 2-3 concrete code references
- Read actual implementations, not just READMEs
- Look at PRs for context on why patterns were adopted
- Compare at least 2 approaches when evaluating alternatives

### Phase 4: Synthesize RFC

Structure the output using the RFC template below. Every claim must link to evidence found in Phase 3.

**RFC Document Structure:**

```markdown
# RFC: [Title]

**Status:** Draft
**Date:** [today]
**Author:** [user or team]

## 1. Summary

[2-3 sentence overview of what this RFC proposes]

## 2. Problem

[What problem exists today? Why does it matter?]
[Include metrics, pain points, or user feedback if available]

## 3. Context & Prior Art

[What exists today in the ecosystem?]
[How do other projects/teams solve this?]

For each prior art finding:
- **[Project/Library]**: [How they solve it]
  - Evidence: [GitHub URL with line numbers]
  - Tradeoffs: [What they gain/lose]

## 4. Proposal

[Detailed description of the proposed solution]
[Include code examples, API sketches, or architecture diagrams]

### 4.1 Design Decisions

[Key decisions and their rationale, backed by research]

| Decision | Choice | Rationale | Evidence |
|----------|--------|-----------|----------|
| [What] | [Chosen approach] | [Why] | [link] |

### 4.2 Implementation Outline

[High-level steps to implement]

## 5. Alternatives Considered

For each alternative:
### 5.N [Alternative Name]
- **Description:** [What this approach does]
- **Pros:** [Advantages]
- **Cons:** [Disadvantages]
- **Evidence:** [Links to repos/code using this approach]
- **Why not:** [Specific reason for rejecting]

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk] | Low/Med/High | Low/Med/High | [How to address] |

## 7. Open Questions

[Unresolved items that need further discussion or decision]

## 8. References

[All GitHub URLs, docs, and sources cited in this RFC]
```

### Phase 4.5: Bias Guards

Before the roast subagent sees the draft, self-audit the RFC against six named cognitive traps. Each guard is a concrete question you must answer on the record — not a meta-mention. Mark each as `resisted`, `applied correction`, or `not applicable`, and briefly say why.

1. **Anchoring** — Did I fall in love with the first alternative I researched? If the recommendation is the *first* option I investigated, I must either re-research a competitor with equal rigor or explicitly note that the first option dominated on evidence.
2. **Confirmation bias** — Did I actively search for evidence *against* my recommendation? For the chosen option, name at least one real-world failure case or limitation I found and how it shapes the recommendation.
3. **Sunk cost** — Did I keep any recommendation only because I already spent tokens researching it? If so, cut it. A recommendation worth keeping stands on its own after the research is done.
4. **False dichotomy** — Is the RFC framed as "A vs B" when a hybrid, phased rollout, or "do nothing" is genuinely viable? Name the "do nothing" outcome explicitly and say why it's worse than the recommendation.
5. **Handwaving risks** — Is any risk marked "Low" without evidence? Either ground the "Low" rating in a measurement/benchmark/incident history, or reclassify as "Unknown" and move it to Open Questions.
6. **Appeal to popularity** — If the recommendation is "what everyone uses," name the specific requirement in *this* codebase that the popular option satisfies better than an alternative. "Industry standard" and "battle-tested" are NOT reasons — they are decorations on reasons.

Write the audit as a short section added to the RFC:

```markdown
## 9. Bias Guard Self-Audit

- **Anchoring:** [resisted|applied correction|not applicable] — [one-line reason tied to evidence]
- **Confirmation bias:** [status] — [one-line reason]
- **Sunk cost:** [status] — [one-line reason]
- **False dichotomy:** [status] — [one-line reason; name the "do nothing" outcome]
- **Handwaving risks:** [status] — [one-line reason]
- **Appeal to popularity:** [status] — [one-line reason tied to a codebase requirement]
```

If any guard catches a real correction, apply it to the RFC body *before* Phase 5. The self-audit documents the correction; it does not replace fixing it.

The Phase 5 roast subagent is instructed not to cut this section.

### Phase 5: Roast & Distill (Subagent)

**Why a subagent:** The main agent is biased — it spent tokens researching, has sunk-cost attachment to findings, and sees every detail as important. A fresh subagent reads the draft cold.

Write the draft to its intended RFC path, or to a temporary file outside the
project when the final path is not available yet. Give the reviewer the draft
file path; do not paste the full RFC into the child prompt. Ask for at most 15
specific edit directives rather than another full copy of the RFC. The parent
owns the document and applies accepted edits.

Spawn a subagent with the following prompt:

```
You are a senior staff engineer reviewing an RFC you've never seen before. Read
the RFC at [draft file path]. You have 5 minutes. Identify what to cut or tighten
so only decision-relevant evidence remains.

## Kill on sight
- Obvious statements ("We need good performance", "Security is important")
- Generic risks that apply to any project ("Team needs to learn new tool", "Migration takes time")
- Filler prior art that doesn't inform the decision — if removing it doesn't change the recommendation, cut it
- Hedging language ("It might be worth considering", "One could argue") — take a position or delete
- Redundant alternatives where "Why not" is obvious from the proposal
- Open questions that are just rephrased risks

## Protected (do NOT cut)
- The "Bias Guard Self-Audit" section — it documents reasoning discipline and must remain visible to the reviewer

## Compress
- Prior Art: max 3-4 entries that directly shaped the proposal
- Alternatives: only 1-2 strongest contenders a reviewer might push back with
- Risks: max 3 rows. Low-likelihood AND low-impact = cut
- Implementation: bullet points only, max 5-7 steps
- Design decisions: every row needs an evidence link. No link = cut or flag

## Shorten without losing substance
- Rewrite paragraphs as single sentences
- Replace prose with tables or bullet lists
- Merge sections that say the same thing from different angles
- Inline tiny sections into their parent heading
- Code snippets over prose for behavior ("returns X when Y" → show code)
- Cut transitions ("Now let's look at...", "As mentioned above...")

## Targets
- Summary: exactly 2-3 sentences
- Problem: max 1 paragraph (3 sentences to feel the pain)
- Total: under 500 lines of markdown

## Output
Return at most 15 edit directives, ordered by impact. Each directive names the
heading or exact passage, the action (cut, compress, restore evidence, or
rewrite), and why it improves the decision. Do not return the complete RFC.

If any section makes you think "obviously" — that section shouldn't exist.
```

After the subagent returns, verify each directive against the evidence and apply
accepted edits in the parent. Reject cuts that remove decision-critical context.
The edited draft becomes the final RFC.

For high-risk RFCs or disputed tradeoffs, use a second opinion through
`../vs-second-opinion/SKILL.md` only when child budget remains after research
and the cold review. Otherwise
test the central decision in the parent against the strongest contrary evidence;
do not exceed the shared budget. If the RFC contains a performance claim, load
`../vs-perf/SKILL.md` when available and include the evaluator or
benchmark contract before recommending implementation.

### Phase 6: Deliver

1. Resolve `$PROJECT_ID` (see [../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md)):

   ```bash
   PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
     | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
   [ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
   ```

   Save the RFC to `~/.vs/$PROJECT_ID/rfcs/NNNN-[slug].md` (create the directory if missing; pick `NNNN` as the next sequential number in that folder)
2. If the user explicitly asked for the RFC itself in the response, output the full final RFC markdown in chat. Otherwise present a concise summary with key findings and the file path.
3. Suggest `/vs-pushback` to stress-test the proposal before committing to it — the RFC is a plan, and plans benefit from adversarial review

## Research Quality Gates

Before completing each research question, verify:
- [ ] At least 2 concrete code references (file:line or GitHub URL)
- [ ] Actual source code was read, not just repo descriptions
- [ ] Both positive evidence (this works) and negative evidence (this doesn't) considered

Before completing the RFC, verify:
- [ ] Every claim in "Prior Art" has a GitHub link
- [ ] "Alternatives Considered" has real-world examples, not hypotheticals
- [ ] "Risks" are grounded in evidence, not speculation
- [ ] "Open Questions" are genuine unknowns, not lazy gaps

## Troubleshooting

**No results from octocode:**
- Broaden search terms, try synonyms
- Search by topic instead of keyword
- Try a different owner/repo combination

**Too many results:**
- Add `owner` and `repo` filters
- Use `path` filter to narrow to specific directories
- Filter by `stars` for quality signal

**Can't find prior art:**
- This is a valid finding - document it as "novel approach" in the RFC
- Search for the problem being solved, not the specific solution
- Look at adjacent ecosystems (e.g., if no React solution, check Vue/Angular)

## References

- For the full RFC template, see [references/rfc-template.md](references/rfc-template.md)

## Workflow

**Prev:** `/vs-github-research` (deep-dive GitHub research that feeds the RFC)
**Next:** `/vs-pushback` (stress-test the RFC) | `/vs-build-it` (implement the approved RFC)
