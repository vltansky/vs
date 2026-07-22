---
name: vs-internal-shared
description: "Internal reference for vs shared conventions: artifact paths, project ID resolution, storage preference, and skill taxonomy."
disable-model-invocation: true
user-invocable: false
---

# internal-shared — internal conventions for vs skills

This skill is a **reference library**, not an executable workflow. Other `skills` skills link to sections below instead of duplicating the rules.

## Project ID convention

Skills that write session artifacts (pushback reports, specs, RFCs, QA reports,
GitHub research docs, briefs, steals, thread analyses, issue drafts) store them
under `~/.vs/$PROJECT_ID/<kind>/...`.

`$PROJECT_ID` resolves, in order:

1. Git remote slug — `owner-repo` parsed from `remote.origin.url` (handles both SSH `git@github.com:owner/repo.git` and HTTPS `https://github.com/owner/repo` forms, strips `.git`, replaces `/` with `-`).
2. Fallback — `$(basename "$PWD")` when no git remote is configured.

The git-slug form is stable across machines and disambiguates same-named repos under different parents (e.g. `alice/foo` vs `bob/foo`).

### Canonical snippet

```bash
PROJECT_ID=$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#; s#/#-#g')
[ -z "$PROJECT_ID" ] && PROJECT_ID=$(basename "$PWD")
ARTIFACTS_DIR="$HOME/.vs/$PROJECT_ID"
```

Paste this inline — skills must stay self-contained in case they're installed standalone outside the vs repo.

### Examples

| Context | `$PROJECT_ID` |
|---|---|
| `git@github.com:vltansky/vs.git` | `vltansky-vs` |
| `https://github.com/acme/foo` | `acme-foo` |
| No git remote, `pwd = /tmp/scratch` | `scratch` |

## Artifact tree layout

```
~/.vs/$PROJECT_ID/
├── pushback/     # pushback stress-test reports
├── specs/        # shape-it design docs
├── rfcs/         # rfc-research RFCs
├── qa-reports/   # qa QA reports + screenshots
├── github-research/ # github-research prior-art docs and landscape maps
├── briefs/       # brief outputs
├── reviews/      # code-review diffs, scans, and evidence
├── verification/ # verification result summaries
├── perf/         # performance baselines and evaluator checkpoints
├── prototypes/   # prototype questions, decisions, and evidence
├── improve/      # improvement backlog plans and indexes
├── sessions/     # workflow session handoffs
├── thread-analysis/ # cross-session thread comparison reports
├── issues/       # to-issues drafts / index
└── steals/       # steal reports
```

## Rich human-facing artifacts

Use [`references/rich-artifacts.md`](./references/rich-artifacts.md) when a
skill may produce an HTMDX report or dashboard. It defines the selection gate,
single-file source contract, pinned runtime, and sensitive-data fallback.

## Disk-backed evidence

Use [`references/disk-backed-evidence.md`](./references/disk-backed-evidence.md)
when screenshots, DOM snapshots, transcripts, diffs, logs, recordings, or other
large evidence could consume model context. It defines the content-addressed
manifest, bounded summaries, and targeted retrieval contract.

## What does NOT go here

Never write into the project tree (`docs/`, `.context/`, `.octocode/`) for session artifacts. Those are reserved for committed source-of-truth files: skill definitions (`skills/`), evals (`evals/`), and any RFC/spec the user explicitly asked to keep in the repo.

## Skill kinds

Each user-facing vs skill has a kind classification:

- **Workflow** — takes a loose human goal and drives a full outcome (`vs-shape-it`, `vs-improve`, `vs-build-it`, `vs-ship-it`, `vs-bugfix`, `vs-fix-pr`, `vs-baby-sit`, `vs-orchestrate`)
- **Building block** — owns one bounded job and can be used directly or composed by workflows (`vs-analyze-thread`, `vs-tdd`, `vs-qa`, `vs-brief`, `vs-verify`, `vs-deslop`, `vs-perf`, `vs-debug-mode`, `vs-roast-review`, `vs-roast-ui`, `vs-github-research`, `vs-rfc-research`, `vs-pushback`, `vs-prototype`, `vs-to-issues`, `vs-steal`, `vs-setup-adr`, `vs-decide-for-me`, `vs-recap`, `vs-retro`, `vs-try-skill`, `vs-write`)

`vs-internal-shared` is repo-local shared reference material, not a user-facing skill kind.

Keep kind classifications in skill body text or local references, not custom top-level frontmatter.

## Codex goal integration

Use [`references/codex-goal.md`](./references/codex-goal.md) for VS workflow
goal ownership, goal-ready output shape, completion rules, and handoff wording.
Workflow skills should link to that reference instead of duplicating the goal
contract in their always-loaded body.

## Subagent orchestration

Use [`references/subagents.md`](./references/subagents.md) for shared fanout,
context, ownership, and collection limits.

Use [`references/independent-advisors.md`](./references/independent-advisors.md)
for risk-gated cross-model review. It is an internal reusable mechanism owned
publicly by `vs-pushback`, not a separate user-facing skill.

## Structured questions

When the host exposes a structured question tool — Claude Code's
`AskUserQuestion`, or an equivalent multiple-choice prompt UI — present
clarifying and grill questions through it instead of plain chat text. One tool
call carries the batched round; each question lists its options with the
recommended one first, labeled the default. This is the default rendering in
Claude Code.

Fall back to the plain-text `Question N` / `Recommendation` / `Options: A) ...`
format only when no such tool is available (for example Codex today), or when a
question is genuinely open-ended (defend/modify/counter) rather than a choice
among known options. The batching limits and the recommendation-as-default rule
are identical in both renderings — only the surface changes.

## Chaining and invocation gates

Skills chain by loading a sibling's SKILL.md directly (`../vs-x/SKILL.md`), not
by invoking it through the host's skill command. A `disable-model-invocation`
flag blocks the host command only — it must never silently degrade a workflow:

- When a workflow's next step is another vs skill, load and follow that skill's
  SKILL.md file.
- If the host cannot resolve the file and the skill command is gated, tell the
  user the exact slash command to type and stop. Do not improvise a manual
  replacement for the gated workflow — a hand-rolled `gh pr create` is not
  ship-it, and the user cannot tell the difference from the output alone.

## Framework routing

Every user-facing skill ends with compact `Prev`, `Next`, and `Relevant` lines.
On standalone completion, emit only the `Next` line. When composed by another
workflow, return to the caller without emitting it. `Relevant` is lateral,
reciprocal, and limited to two skills; it is map metadata, not runtime output.

## Flow contracts

Public building blocks should include a short Flow Contract section so workflows
can consume them without copy-pasting their bodies.

Use this shape:

```markdown
## Flow Contract

- **Kind:** Building block
- **Inputs:** What the calling flow must provide
- **Outputs:** Chat section, artifact path, status label, or decision log entry
- **Status:** PASS | WARN | FAIL | BLOCKED, or the skill's equivalent labels
- **Consumers:** Workflows or building blocks that call or embed this contract
- **Skip conditions:** When the caller may safely skip the building block
```

The contract should stay small. Detailed execution belongs in the skill body;
the contract is the stable handshake between skills.
