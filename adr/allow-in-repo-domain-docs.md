# Allow in-repo domain docs (CONTEXT.md) with a per-project storage preference

Status: accepted
Date: 2026-04-18

Plugin packaging note: this ADR is retained as source history. The AICM plugin currently excludes `domain-model`, so these storage rules are not active plugin behavior.

## Context

`domain-model` (see [`replace-grill-me-with-pushback-and-domain-model.md`](./replace-grill-me-with-pushback-and-domain-model.md)) produces two durable artifacts:

1. **`CONTEXT.md`** — a domain-model doc (entities, invariants, vocabulary, edge cases) written in plain prose, intended to be read by both humans and agents before touching code in that area.
2. **ADRs** — architecture decision records proposed when a decision passes the three-gate bar (hard-to-reverse + surprising + real tradeoff).

The project invariant in `CLAUDE.md` says session artifacts live under `~/.vs/$PROJECT_ID/`, not in the repo tree. `CONTEXT.md` and ADRs are borderline: they are durable enough that a team would want them committed and code-reviewed, but they are generated under the guidance of an agent skill and so look procedurally like session artifacts.

Two reasonable defaults exist:

- **In-repo** — the team owns the doc, it lives under version control, future agents on fresh checkouts see it automatically.
- **Per-user** — the doc lives under `~/.vs/$PROJECT_ID/context/`, the repo is not polluted with agent-generated files, and each user gets their own copy.

Neither is right for every project. A solo repo or a greenfield one benefits from in-repo docs; a shared repo with strict review gates may prefer per-user until the team has a policy. The choice is not obviously an ADR itself in every project — it's a preference.

## Decision

Allow `CONTEXT.md` and `domain-model`-proposed ADRs to be written **in-repo** as the default, but honor a per-project **storage preference** cached to user auto-memory.

The flow:

1. On first use of `domain-model` (or first ADR proposal in a project), the skill prompts: `Store CONTEXT.md and ADRs in the repo (versioned, visible to reviewers) or per-user at ~/.vs/$PROJECT_ID/ (private, not pushed)?`
2. The answer is cached to user auto-memory keyed by `$PROJECT_ID`, e.g. a `storage_pref_<project>.md` memory.
3. Subsequent runs in the same project read the cached preference and do not re-prompt.
4. The user can override at any time: `"store context in repo"` / `"store context per-user"` resets the cached value.

Paths by preference:

- **In-repo (default):** `CONTEXT.md` at the root (or under the nearest bounded-context directory); ADRs under `adr/`.
- **Per-user:** `~/.vs/$PROJECT_ID/context/CONTEXT.md`; ADRs under `~/.vs/$PROJECT_ID/adr/`.

The rest of the session-artifact invariant (grill reports, specs, briefs, QA reports, etc. live under `~/.vs/$PROJECT_ID/`) is unchanged. `CONTEXT.md` and ADRs are the only artifacts with a storage preference, because they are the only artifacts that a team might want to code-review.

## Consequences

- `CLAUDE.md` invariants clarify that `CONTEXT.md` and ADRs can live in-repo, controlled by the cached preference. Other session artifacts still never live in the project tree.
- `skills/vs-internal-shared/SKILL.md` gains a "Domain-doc storage preference" section that both `domain-model` and `vs-setup-adr` reference, so the prompt + cache logic lives in one place.
- First-time users get a one-question prompt. After that, the skill is silent.
- Users on a shared repo can pick per-user at install time and avoid polluting the team's tree without editing skills.
- If the cached preference drifts from what the user wants, a single natural-language override flips it.

## Alternatives considered

- **Always in-repo, no preference.** Rejected — this is what the existing invariant explicitly forbids for most artifacts, and forcing it for `CONTEXT.md` surprises users who expected per-user behavior.
- **Always per-user, no preference.** Rejected — the most common case in this codebase is a solo/small-team repo where the doc is genuinely team knowledge, and hiding it under `~/.vs/` loses that value.
- **Ask every run.** Rejected — the answer is almost always the same in a given project. Prompting each time is noise.
- **Per-skill preference instead of per-project.** Rejected — a user who wants `CONTEXT.md` in-repo also wants ADRs in-repo, and vice versa. One preference per project is enough.
