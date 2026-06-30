---
name: vs-setup-adr
description: "Set up ADR support in the current repository. Creates an `adr/` directory with a README, adds an adoption ADR, and updates the repo's existing guidance surfaces so architecture-impacting or hard-to-reverse decisions live in ADRs. Use when user says 'setup adr', 'add adr support', 'adopt adrs', 'create adr directory', 'architecture decision records', or wants to bootstrap ADRs in a repo."
disable-model-invocation: true
metadata:
  verified: true
---

# Setup ADR

Install a minimal ADR surface for the current repo.

This skill is for one explicit job: make ADRs the durable home for repo-level decisions without turning the repo into a planning graveyard.

## Default outcome

Unless the user asks for something broader, set up ADRs with the smallest useful change set:

1. Add `adr/README.md`
2. Add one adoption ADR such as `adr/adopt-adrs-for-repo-level-decisions.md`
3. Update the repo's existing guidance files so they point architecture-impacting repo decisions at ADRs

Do **not** default to migrating or deleting old RFC/spec/planning docs in the same run.

## Phase 1: Inspect before editing

Before creating files:

- Check `git status --short` and treat unfamiliar edits as in-progress work from someone else
- Inspect the repo's existing guidance surfaces and contributor docs
- Inspect the repo root to see whether `adr/`, `docs/decisions/`, or another ADR-like location already exists
- Search for `ADR`, `decision record`, `RFC`, `design doc`, `adr/`, and `docs/decisions`

Goal: understand the repo's current document surfaces before you add a new one.

## Phase 2: Choose the target shape

Use these rules:

- If the repo already has a healthy ADR surface, do not create a duplicate. Fill the missing pieces instead.
- If the repo has repo-level policy scattered across root docs and PR lore, create `adr/` at the repo root.
- Default ADR filenames to lowercase, dash-separated, present-tense imperative verb phrases.
- Do not use numeric prefixes; use the slug alone as the identifier to avoid merge conflicts when multiple ADRs land in parallel.
- Do not add a `Status` field by default; treat merge as approval unless the repo already has a stronger existing ADR convention.

Do not ask the user for naming or template preferences unless the repo already has conflicting conventions that make the choice genuinely strategic.

## Phase 3: Add the ADR scaffolding

Read these bundled references before writing:

- [references/decisions-readme-template.md](references/decisions-readme-template.md)
- [references/adr-template.md](references/adr-template.md)
- [references/adopt-adrs-example.md](references/adopt-adrs-example.md)

Adapt them to the current repo rather than copying blindly.

Requirements:

- `adr/README.md` explains when an ADR is required, when it is not required, how ADRs are named, and how superseding works
- The adoption ADR explains why this repo is using ADRs and what kinds of decisions belong there
- Do not add a target-repo `template.md` file unless the user explicitly wants one

## Phase 4: Align root guidance

Update only the files that exist.

Priority order:

1. Repo-specific agent instructions if they exist (`AGENTS.md`, `CLAUDE.md`, or equivalent)
2. Contributor docs (`CONTRIBUTING.md` or equivalent)
3. The root `README.md`, only if it currently misdescribes the role of `adr/` or `docs/`

### Agent or repo instructions

Add or update concise rules that:

- point architecture-impacting or hard-to-reverse repo decisions at `adr/`
- keep session artifacts or temporary exploration out of ADRs
- keep the root file short and navigational

### Contributor docs

Add one concise contributor-facing rule:

- add or update an ADR when a change introduces a cross-cutting or hard-to-reverse repo decision

### Root `README.md`

Only touch the README if it currently misdescribes the role of `adr/` or if the repo layout section should mention ADRs separately from `docs/`.

Do not bloat the README with ADR process detail.

## Phase 5: Preserve scope

This skill sets up the ADR surface. It does **not** automatically:

- delete legacy RFC/spec docs
- migrate historical docs into ADRs
- add CI validation
- create a full governance framework

Those can be follow-up changes if the user asks.

## Verification

After editing:

- Re-run targeted searches for `adr/`, `ADR`, and root guidance mentions
- Review the diff for scope creep
- Confirm the setup is internally consistent: root docs, `adr/README.md`, and the adoption ADR should all say the same thing

## Output

Report:

- which files were added or updated
- whether the repo already had ADR-related conventions
- any legacy docs you intentionally left untouched
