# Replace grill-me with pushback and domain-model

Status: accepted
Date: 2026-04-18

Plugin packaging note: this ADR is retained as source history. The AICM plugin currently excludes `domain-model`; fuzzy idea shaping is handled by `shape-it`.

## Context

`grill-me` tried to do two very different jobs with one skill:

1. **Attack a formed plan** — push back on framing, stress-test assumptions, score readiness across dimensions, produce a verdict.
2. **Sharpen a raw idea** — elicit the problem statement, smallest wedge, prior art, and unknowns when the input is "I want to build X" with no structure.

These are not the same shape of work:

- Attacking a formed plan is adversarial, time-bounded, produces a score + verdict, and hands off to `/build-it` on READY.
- Sharpening a raw idea is exploratory, iterative, produces domain vocabulary and an ADR-shaped decision log, and hands off back to design or planning, not to implementation.

Trying to do both under one skill led to:

- Prompts that fired the wrong mode — raw ideas got scored against the readiness rubric before there was anything scorable; formed plans got the "let me ask about your problem" intake when the problem was already clear.
- A long SKILL.md that tried to cover both flows with mode-branching, which models handled unreliably.
- Confused handoff semantics (`Recommended next step` could mean "implement now" or "keep thinking" depending on which mode fired).

Separately, the Matt Pocock DDD-for-AI material reframes the "sharpen a raw idea" job as domain modeling — producing `CONTEXT.md` domain docs in-repo and proposing ADRs for hard-to-reverse decisions. That is a different artifact shape than a readiness-score report.

## Decision

Split `grill-me` into two skills and delete the original:

- **`pushback`** — adversarial review of a formed plan. Inherits the dimensions, pushback style, premise challenge, and readiness scoring from the old `grill-me`. Produces `~/.vs/$PROJECT_ID/pushback/YYYY-MM-DD-<topic>.md` and a READY / READY_WITH_RISKS / NOT_READY verdict.
- **`domain-model`** — inline domain modeling + ADR proposal. Expands unknowns, names the core concepts, writes `CONTEXT.md` in-repo (with `/setup-adr`-style storage preference), and proposes ADRs for decisions that pass the three-gate bar.

Routing between them lives in `/shape-it`:

- **Challenge mode** with a formed plan → `/pushback`.
- **Explore mode** with a raw idea, fuzzy terminology, or unresolved core concepts → `/domain-model`.

`grill-me` is hard-deleted — no alias, no redirect, no back-compat stub. The two successor skills cover the old coverage and more; keeping a third skill around as a thin shim would re-introduce the confusion the split is meant to remove.

## Consequences

- All existing runtime-skill references to `grill-me` must be rewritten to point at `pushback` or the relevant shaping flow.
- Evals under `evals/grill-me/` move to `evals/pushback/`, with the pushback-specific test cases kept and the "raw idea sharpening" cases moved (or rewritten) under `evals/domain-model/`.
- Skill authors who had muscle memory for `/grill-me` need to learn the split. The split is announced in the ADR and in `CLAUDE.md`.
- Users who had open `~/.vs/$PROJECT_ID/grill-me/` reports keep them — the directory isn't deleted, just no longer written to.

## Alternatives considered

- **Keep one skill with a mode field.** Rejected — mode branching under one SKILL.md is what produced the misfires in the first place.
- **Keep `grill-me` as an alias.** Rejected — aliases hide the split from new authors, who end up reading the wrong doc. Hard-delete forces updated callers.
- **Put the domain-modeling work into `shape-it` directly.** Rejected — `shape-it` already spans mode selection, clarifying questions, research, and proposal. Adding a full DDD+ADR loop inside would exceed what a single SKILL.md can stay coherent about.
