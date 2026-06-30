---
name: internal-shared
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
├── improve/      # improvement backlog plans and indexes
├── sessions/     # workflow session handoffs
├── issues/       # to-issues drafts / index
└── steals/       # steal reports
```

## What does NOT go here

Never write into the project tree (`docs/`, `.context/`, `.octocode/`) for session artifacts. Those are reserved for committed source-of-truth files: skill definitions (`skills/`), evals (`evals/`), and any RFC/spec the user explicitly asked to keep in the repo.

## Skill kinds

Each user-facing vs skill has a kind classification:

- **Workflow** — takes a loose human goal and drives a full outcome (`shape-it`, `improve`, `build-it`, `ship-it`, `bugfix`, `fix-pr`, `afk`, `baby-sit`)
- **Building block** — owns one bounded job and can be used directly or composed by workflows (`tdd`, `qa`, `brief`, `verify`, `deslop`, `second-opinion`, `perf`, `debug-mode`, `roast-review`, `github-research`, `rfc-research`, `pushback`, `to-issues`, `steal`, `setup-adr`, `decide-for-me`, `caveman`, `retro`, `try-skill`)

`internal-shared` is repo-local shared reference material, not a user-facing skill kind.

Keep kind classifications in skill body text or local references, not custom top-level frontmatter.

## Codex goal integration

Use [`references/codex-goal.md`](./references/codex-goal.md) for VS workflow
goal ownership, goal-ready output shape, completion rules, and handoff wording.
Workflow skills should link to that reference instead of duplicating the goal
contract in their always-loaded body.

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
