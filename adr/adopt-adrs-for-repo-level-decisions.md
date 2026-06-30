# Adopt ADRs for repo-level decisions

- Date: 2026-04-15

## Context

vs already distinguishes between committed repo guidance and session artifacts. Session artifacts such as specs, RFCs, grill reports, QA reports, and research docs belong under `~/.vs/$PROJECT_ID/...`, not in the repo.

What the repo still needs is one committed, skimmable surface for architecture-impacting or hard-to-reverse decisions about workflow policy, runtime behavior, validation expectations, and other repo conventions.

Without that surface, rationale drifts into PR bodies, review threads, commits, and scattered docs.

## Decision

Use Architecture Decision Records in `adr/` for architecture-impacting or hard-to-reverse repo decisions.

ADRs are durable records, not working scratchpads. Session artifacts and exploratory design work remain outside the repo by default unless the user explicitly asks for a committed doc.

## Consequences

- Positive: future contributors and agents get a stable place to recover repo conventions quickly
- Positive: root guidance can stay short while still linking to durable rationale
- Positive: the repo aligns better with its existing rule that session artifacts live outside the tree
- Negative: maintainers must decide when a change is important enough to deserve an ADR
- Follow-up: start with guidance first; migrate or delete older in-repo planning surfaces only when there is a concrete reason

## Alternatives considered

- Keep repo-level rationale only in root guidance: rejected because `AGENTS.md` and `README.md` should stay short and navigational
- Keep relying on PR descriptions and review threads: rejected because they are poor long-term lookup surfaces for future contributors and agents
- Keep RFCs/specs in `docs/` as the default durable surface: rejected because it blurs transient design work with accepted repo policy
