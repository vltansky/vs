---
name: vs-steal
description: "Use when asked to scan a named external repo for ideas worth porting. Produces a cited, ranked steals report."
disable-model-invocation: true
---

# Steal

Look at someone else's repo and bring back the ideas worth porting. Not a vendor audit, not a feature comparison — a forensic scan for **structural moves** that would improve this project if adapted.

<HARD-GATE>
Do NOT copy code verbatim, ignore licensing, or file PRs here. The output is a report with citations. Porting an idea is a separate decision taken later.
</HARD-GATE>

## When to use

- User points at a repo ("what's good in `anthropics/claude-code` we should borrow?") and wants a focused scan
- You noticed another project solving a problem this repo is also solving, and want a side-by-side of approaches
- Before writing a new skill / prompt / convention, look at 1-2 similar projects first

Compare with `/vs-github-research` — that skill builds a landscape of multiple competitors on shared axes. `/vs-steal` is one target, maximum depth.

## Phase 0: Scope the target

Confirm the target and the intent:

- `owner/repo` — exactly one. Multiple targets → use `/vs-github-research` instead.
- Scope — "skills and prompts", "workflow shape", "test patterns", "everything". Pick one to avoid a shallow scan over a huge repo.
- Anything known-irrelevant — language, runtime, domain mismatches — say so up front so the scan doesn't waste time on them.

If the user did not give a repo, ask for one. Do not pick one yourself.

## Phase 1: Pre-scan with octocode

Use the plugin-provided octocode MCP tools (prefer them over `gh` for read-only structural search):

1. `githubViewRepoStructure` — top-level layout, does the repo have skills/, prompts/, agents/, evals/, docs/?
2. `githubGetFileContent` on `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/index.md` — read the project's self-description.
3. `githubSearchCode` for scope-specific signals:
   - skills: search `name:` in `SKILL.md`, `frontmatter`, `/skills/`, `/prompts/`
   - workflow: search `workflow`, `pipeline`, `orchestrat`, `agent loop`
   - tests: look under `evals/`, `tests/`, `fixtures/`, `golden/`
   - tooling: search `package.json` / `pyproject.toml` / `Cargo.toml` scripts
4. `githubSearchPullRequests` (state: merged, last ~50) — what has this project been iterating on? PR titles reveal priorities a README does not.

If octocode isn't active in the current session, fall back to `gh` (`gh api repos/owner/repo/contents/path`) + `gh search code`. Note the degraded tooling in the report and mention that the vs plugin ships octocode via `.mcp.json`.

## Phase 2: Candidate list

Build a raw list of **candidate ideas** — things that look interesting, before judging them. Keep it wide at this stage. Each candidate gets:

- **Name** — one line, how you'd describe it to a colleague
- **Citation** — `owner/repo path/to/file.ext#Lstart-Lend` or a PR number
- **What it is** — 1-2 sentences, what the code/doc/pattern does
- **What drew your attention** — "they solve X differently" or "they have a convention we don't"

Cap the raw list at ~15 candidates. If more look interesting, tighten the scope (Phase 0) and rerun rather than producing a shallow 30-item list.

## Phase 3: Rank

Score each candidate on two axes:

- **Value if ported** — would this meaningfully improve this repo? (low / medium / high)
- **Cost to port** — how hard is it to adapt to this stack, including runtime/license/domain differences? (low / medium / high)

A single sentence per axis, not a rubric. If you can't justify high value in one sentence, it isn't high value.

Prioritize **high value + low cost**. Flag interesting but expensive ideas separately as "watchlist" — not in the main recommendation list.

## Phase 4: Write the steals report

HTMDX is the default because every steals report compares candidates across
value, cost, and citation evidence, so this report type satisfies the shared
rich-artifact selection gate. Resolve `$PROJECT_ID` (see
[../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md)), copy
`references/steals-report-template.html` to
`~/.vs/$PROJECT_ID/steals/YYYY-MM-DD-<target-slug>.html`, and edit only its
HTMDX source block. Produce one canonical artifact with no Markdown twin.
Follow the
[shared rich-artifact contract](../vs-internal-shared/references/rich-artifacts.md).

Derive the target slug from the full `owner/repo` identifier: lowercase it and
replace non-alphanumeric runs with hyphens, so repositories with the same name
under different owners cannot collide. If the output path already exists,
append a numeric suffix before the extension (`-2`, `-3`, and so on); never
overwrite an earlier scan.

Use Markdown only when the user explicitly requests Markdown or the report
cannot safely use the HTMDX runtime. Apply the security boundary to the actual
report content: redact credentials, secrets, PII, and sensitive values. A
sanitized report still uses HTMDX. If sensitive data must remain, use a trusted
local runtime mirror or remain in Markdown. The Markdown fallback keeps the
same TL;DR, recommended ports, watchlist, considered-and-skipped, and open
questions sections and uses
`~/.vs/$PROJECT_ID/steals/YYYY-MM-DD-<target-slug>.md`, with the same collision
suffix rule.

## Phase 5: Handoff

Print the report path + the top recommendation. Suggest next step:

- User wants to port a recommendation → frame it as a proper work item via `/vs-to-issues` or `/vs-shape-it` (not an ad-hoc patch)
- User wants another scan → rerun `/vs-steal` with a different target, or `/vs-github-research` for a landscape view
- Nothing worth stealing → say so directly. "Target scanned, nothing meets the value/cost bar" is a valid outcome.

## Guardrails

- **Cite always.** Every claim points at a file + line range or a PR number. Uncited observations are opinions, not steals.
- **Respect licensing.** Note the target repo's license in the report header. If copying code (not just ideas), the license decides whether it's legal.
- **Don't inflate value.** "High value" requires a one-sentence concrete improvement to this repo, not "interesting pattern."
- **One target per report.** Landscape comparisons belong in `/vs-github-research`.

## Verification

Blocked until all items pass:

- [ ] Scope confirmed (one repo, one focus)
- [ ] Pre-scan done with octocode (or fallback noted)
- [ ] Every candidate in the report carries a precise citation
- [ ] Value and cost scored per candidate
- [ ] Report written to `~/.vs/$PROJECT_ID/steals/YYYY-MM-DD-<target-slug>.html`, or the Markdown fallback is justified
- [ ] Target repo's license noted

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** (entry point — user points at an external repo)
**Next:** `/vs-shape-it`
**Relevant:** `/vs-github-research`
