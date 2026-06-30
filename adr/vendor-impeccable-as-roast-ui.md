# Vendor Impeccable as roast-ui

- Date: 2026-06-15

## Context

The `vs` plugin needs a frontend/design review skill that can be used as a
building block alongside `vs-roast-review`, `vs-qa`, and `vs-verify`. Paul Bakaus'
Impeccable skill already provides the desired depth: command-specific
references, deterministic detector scripts, live-mode helpers, project context
scripts, and nested helper agents.

Using only a summarized prompt would lose the behavior that makes the skill
valuable. Depending on users to install Impeccable separately would also make
`vs:roast-ui` unreliable in environments where the `vs` plugin is expected to be
self-contained.

## Decision

Vendor the Impeccable skill tree into `plugins/vs/skills/vs-roast-ui` and adapt the
install-facing skill name and command wording to `vs-roast-ui`.

The vendored tree includes:

- `SKILL.md`
- `reference/`
- `scripts/`
- nested helper agents
- `LICENSE.impeccable`

Keep the upstream credit explicit in both the skill and `plugins/vs/README.md`.
Preserve the Apache-2.0 license copy in the skill directory.

Treat `vs-roast-ui` as a `vs` building block. It can be invoked directly for
frontend/design work or composed by future `vs` workflows, but it should not
become a second top-level workflow system inside `vs`.

## Consequences

- Positive: `vs:roast-ui` is self-contained and retains Impeccable's full
  reference/script behavior.
- Positive: users get one install surface through the `vs` plugin instead of a
  separate Impeccable setup requirement.
- Negative: vendoring creates drift from upstream Impeccable; future upstream
  changes need an explicit sync/update pass.
- Negative: the skill is large compared with most `vs` building blocks.
- Follow-up: if `vs-roast-ui` becomes hard to keep current, consider converting it
  to a distributed-plugin or sync-manifest workflow instead of manually
  vendoring updates.

## Alternatives Considered

- Summarize Impeccable into a small roast-only prompt. Rejected because it drops
  the references, scripts, detector, live-mode, and setup behavior that motivated
  adding the skill.
- Depend on `npx impeccable` or a separate Impeccable install. Rejected because
  `vs` skills should work from the plugin source without asking users to install
  another skill system first.
- Add Impeccable as a standalone CAP plugin instead of a `vs` skill. Deferred
  because the current request is specifically for a `vs` skill, and `vs-roast-ui`
  fits the building-block taxonomy.
