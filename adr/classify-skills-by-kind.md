# Classify skills by kind

Status: accepted
Date: 2026-04-18

## Context

Skills in `./skills/` vary by role. Some start a full workflow (`shape-it`, `ship-it`), and others own one bounded job: a workflow phase, a behavior mode, a decision helper, or a meta workflow (`tdd`, `roast-review`, `autoanswer`, `caveman`, `retro`, `try-skill`). Nothing in the codebase currently says this out loud, which makes three things harder:

1. **Authoring** — a new skill proposal has no clear home, so new skills over-generalize into the "full workflow" shape even when they are really phase tools.
2. **Invocation policy** — disable-model-invocation, user-invocable, and trigger breadth all depend on what role a skill plays. Without a taxonomy, each skill re-decides from scratch.
3. **Documentation** — we keep saying "use `/pushback`, which is itself called from `/shape-it`" in prose, with no shared vocabulary for which skill is the caller and which is the callee.

Internal conversations have been referring to skill layers, but the mapping only lived in chat.

## Decision

Classify user-facing skills by kind using plain-language labels recorded in the skill body or local references rather than custom top-level frontmatter:

- **Workflow.** Takes a loose human goal and drives it to a shippable outcome. Composes building blocks. Examples: `shape-it`, `build-it`, `ship-it`, `bugfix`, `fix-pr`, `afk`, `baby-sit`.
- **Building block.** Owns one phase, mode, decision helper, or meta job (`tdd`, `roast-review`, `brief`, `verify`, `deslop`, `second-opinion`, `perf`, `qa`, `debug-mode`, `github-research`, `rfc-research`, `pushback`, `to-issues`, `steal`, `setup-adr`, `autoanswer`, `caveman`, `retro`, `try-skill`). Called directly by humans mid-session or composed by a workflow.

Shared reference material such as `internal-shared` is not a user-facing skill kind. It is repo-local guidance consumed by the other skills.

The taxonomy, self-check questions, and drift rules should stay near the skills that use them.

## Consequences

- Every user-facing skill gets a `Workflow` or `Building block` classification. Initial classification is included in the same change that adds the rule.
- The done-criteria in `AGENTS.md` / `CLAUDE.md` gains a line requiring kind classification.
- Reviewers of new skills can push back on misclassification without it being subjective ("this says workflow but it has no orchestration — should be building block").
- Future invocation-policy decisions (e.g. "workflows should always be manual-only") have a handle to attach to.

## Alternatives considered

- **Leave it undocumented, keep using the terms in chat.** Rejected — the vocabulary has already drifted into skill docs without a definition, and new skill authors had no anchor.
- **Three levels.** Rejected — the proposed L3 bucket mixed unlike things: real user-invocable workflows (`retro`, `try-skill`), behavior modes (`caveman`), decision helpers (`autoanswer`), and shared references (`internal-shared`). That made L3 less useful than a broader L2 plus explicit descriptions.
- **L1/L2.** Rejected — preserves the workflow signal, but the numeric hierarchy made building blocks sound less real than workflows.
- **Atoms and molecules.** Rejected — charming, but less obvious to a new reader than workflow/building block.
- **Essential vs optional.** Rejected — loses the workflow signal. A workflow is qualitatively different from a building block, not just "more important."
- **Four or more categories.** Rejected — extra granularity would be overfitting.
