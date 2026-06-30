---
name: vs-deslop
description: "Use when code works but feels AI-generated, bloated, repetitive, over-defensive, or needs cleanup before review or shipping."
---

# Deslop

Clean working code without changing behavior. This is the focused cleanup building block:
remove AI-ish noise, needless abstraction, duplicated logic, stale fallbacks, and
review-hostile clutter while preserving the product contract.

## Flow Contract

- **Kind:** Building block
- **Inputs:** Changed files or explicit scope, behavior that must stay unchanged, and available verification commands
- **Outputs:** Cleanup summary, changed files, behavior-preservation evidence, and deferred findings
- **Status:** `CLEAN`, `CLEANED`, `WARN`, `FAIL`, or `BLOCKED`
- **Consumers:** `vs:roast-review` Pass 1, `vs:build-it` Phase 4, `vs:ship-it` pre-PR review, standalone cleanup requests
- **Skip conditions:** Skip when the diff is trivial, generated-only, or the user explicitly asks for review-only/no edits

## Cleanup Targets

Inspect the requested scope for:

- structural simplifications that delete whole concepts, branches, modes,
  wrappers, or layers instead of merely polishing them
- duplicate logic or copy-paste with tiny variations
- pass-through wrappers that add no meaning
- defensive null checks on values proven non-null by types or callers
- fallback branches that hide primary-path failures
- comments that narrate obvious code instead of explaining why
- dead imports, stale flags, temporary debug leftovers, and unused helpers
- inconsistent naming or one-off conventions that fight the codebase
- ad-hoc conditionals bolted into busy flows where a typed model, dispatcher,
  policy object, or canonical helper would make the path easier to reason about
- cast-heavy or optionality-heavy boundaries that hide the real invariant

## Procedure

1. **Lock behavior first.** Identify the existing tests or direct checks that
   prove behavior. If none exist and cleanup could change behavior, add the
   narrowest regression test before editing.
2. **Create a cleanup list.** Name each smell and the file it affects. Do not
   broaden scope just because adjacent code is ugly.
3. **Look for the structural delete.** Before extracting a helper, ask whether
   a simpler state shape, ownership boundary, or default flow would remove the
   branch/helper/wrapper entirely.
4. **Edit in safe passes.** Prefer deletion and simplification over abstraction.
   Preserve public APIs unless the user explicitly asked for a breaking cleanup.
5. **Verify after cleanup.** Re-run the targeted proof and any required guardrail.
6. **Report deferred items.** If a cleanup is risky or architectural, leave it as
   a finding instead of sneaking it into the diff.

## Output

```markdown
## Deslop Result

- Status: CLEAN | CLEANED | WARN | FAIL | BLOCKED
- Scope: <files or diff range>
- Cleaned:
  - <change and why it preserved behavior>
- Deferred:
  - <risky or out-of-scope cleanup>
- Evidence:
  - `<command>` - <result>
```

## Workflow

**Prev:** `/vs-build-it`, `/vs-roast-review`, `/vs-qa`, direct implementation
**Next:** `/vs-verify`, `/vs-brief`, `/vs-ship-it`
