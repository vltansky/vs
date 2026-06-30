# adopt-adrs-for-repo-level-decisions

- Date: YYYY-MM-DD
- Owners: @owner
- Related: `AGENTS.md`, `CONTRIBUTING.md`, `README.md`

## Context

The repo needs one committed, skimmable surface for architecture-impacting or hard-to-reverse decisions about conventions, workflow policy, and contributor expectations.

Without that surface, rationale drifts into PR bodies, review threads, and scattered docs. Root guidance then grows longer while still failing to preserve the "why" behind repo-level decisions.

## Decision

We will use Architecture Decision Records in `adr/` for architecture-impacting or hard-to-reverse repo decisions.

ADRs are a durable record, not a working scratchpad. Temporary exploration and session artifacts stay elsewhere unless explicitly committed for another reason.

ADR filenames use `short-kebab-case.md` without numeric prefixes; the slug is the identifier.

## Alternatives Considered

- Keep rationale only in root guidance: rejected because root docs should stay short and navigational
- Keep relying on PR descriptions and review threads: rejected because they are weak long-term lookup surfaces
- Keep RFCs or plans as the default durable surface: rejected because they blur accepted policy with in-flight design work

## Consequences

- Positive: contributors and agents get a stable place to recover repo conventions
- Positive: root docs can stay short while still linking to durable rationale
- Negative: maintainers must decide when a change deserves an ADR
- Follow-up: start with docs and templates first; migrate or delete legacy planning surfaces only when there is a concrete reason

## Implementation Notes

- Store ADRs in `adr/`
- Use slug-only ADR filenames, for example `adopt-adrs-for-repo-level-decisions.md`
- Add lightweight references in root guidance so contributors can discover the ADR directory

## Links

- ADR directory: [README.md](./README.md)
