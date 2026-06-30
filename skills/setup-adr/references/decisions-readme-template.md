# ADR Directory

This directory stores Architecture Decision Records (ADRs) for architecture-impacting or hard-to-reverse repo decisions.

## Naming convention

- Use lowercase, dash-separated names.
- Use present-tense imperative verb phrases.
- Do not use numeric prefixes; the slug is the identifier.
- Examples: `adopt-adrs-for-repo-level-decisions.md`, `use-runtime-specific-watch-primitives.md`

## ADR required

Create an ADR when a change introduces one or more of the following:

- cross-cutting repo workflow or runtime behavior changes
- validation or enforcement policy that changes how contributors or agents work
- repo conventions that are expensive or annoying to reverse later

## ADR not required

An ADR is usually not needed for:

- session artifacts, working notes, or temporary exploration
- small bug fixes or local refactors
- minor implementation details that do not change repo-level behavior

## Minimum structure

Each ADR should include:

- `Date`
- `Owners` (optional, when the repo uses explicit ownership)
- `Related` (optional, when useful)
- `Context`
- `Decision`
- `Consequences`
- `Alternatives considered` (optional, only when meaningful alternatives were actually evaluated)
- `Implementation Notes` (optional, when rollout details matter)
- `Links` (optional, when there are follow-up PRs, superseding ADRs, or supporting docs)

Do not add a `Status` field. ADR approval happens through PR review and merge.

## Superseding rule

Do not rewrite old ADRs. When a decision changes, add a new ADR and mark the previous ADR as superseded.
