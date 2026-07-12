# Adopt ADRs for repo-level decisions

## Status

Accepted

## Context

We keep making durable architecture calls (skill layout, install mechanism) in
chat and losing the rationale. Future readers ask "why did we do it this way"
and there is no record.

## Decision

Record durable, repo-level decisions as ADRs under `adr/` with slug-only
filenames. ADRs are immutable once merged; a changed decision gets a new ADR
that supersedes the old one.

## Consequences

- Rationale is durable and reviewable.
- Parallel branches do not fight over numeric prefixes.
