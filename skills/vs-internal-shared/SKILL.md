---
name: vs-internal-shared
description: "Internal reference for vs shared conventions: artifact paths, project ID resolution, storage preference, and skill taxonomy."
disable-model-invocation: true
user-invocable: false
---

# internal-shared — internal conventions for vs skills

This skill is a **reference library**, not an executable workflow. Other `skills` skills link to sections below instead of duplicating the rules.

## Project ID convention

Skills that write session artifacts (pushback reports, specs, RFCs, QA reports, GitHub research docs, briefs, steals, issue drafts) store them under `~/.vs/$PROJECT_ID/<kind>/...`.

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
├── verification/ # verification result summaries
├── perf/         # performance baselines and evaluator checkpoints
├── prototypes/   # prototype questions, decisions, and evidence
├── improve/      # improvement backlog plans and indexes
├── sessions/     # workflow session handoffs
├── issues/       # to-issues drafts / index
└── steals/       # steal reports
```

## What does NOT go here

Never write into the project tree (`docs/`, `.context/`, `.octocode/`) for session artifacts. Those are reserved for committed source-of-truth files: skill definitions (`skills/`), evals (`evals/`), and any RFC/spec the user explicitly asked to keep in the repo.

## Skill kinds

Each user-facing vs skill has a kind classification:

- **Workflow** — takes a loose human goal and drives a full outcome (`vs-shape-it`, `vs-improve`, `vs-build-it`, `vs-ship-it`, `vs-bugfix`, `vs-fix-pr`, `vs-afk`, `vs-baby-sit`)
- **Building block** — owns one bounded job and can be used directly or composed by workflows (`vs-tdd`, `vs-qa`, `vs-brief`, `vs-verify`, `vs-deslop`, `vs-second-opinion`, `vs-perf`, `vs-debug-mode`, `vs-roast-review`, `vs-github-research`, `vs-rfc-research`, `vs-pushback`, `vs-prototype`, `vs-to-issues`, `vs-steal`, `vs-setup-adr`, `vs-decide-for-me`, `vs-retro`, `vs-try-skill`)

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
