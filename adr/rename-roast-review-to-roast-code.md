# Rename Roast Review to Roast Code

## Context

The `vs-roast-review` name repeats the review concept and is less direct than the
user-facing action it performs.

## Decision

Rename the skill and command to `vs-roast-code`. Update active workflow links,
plugin metadata, documentation, and tests to use the new name.

This ADR supersedes only the `vs-roast-review` naming references in earlier ADRs;
their architectural decisions remain unchanged.

## Consequences

- Users invoke `/vs-roast-code` for the two-pass code roast.
- Existing `/vs-roast-review` invocations must migrate to the new command.
- `vs-roast-ui` remains unchanged.
