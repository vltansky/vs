---
name: vs-deslop
description: "Use when code works but feels AI-generated, bloated, repetitive, over-defensive, or needs cleanup before review or shipping."
---

# Deslop

Clean working code without changing behavior. This is the focused cleanup
building block: remove AI-ish noise, needless abstraction, duplicated logic,
stale fallbacks, and review-hostile clutter while preserving the product
contract.

Use the shared
[`minimum-solution` gate](../vs-internal-shared/references/minimum-solution.md)
to prefer structural deletion and native or existing capabilities over a new
cleanup abstraction.

## Flow Contract

- **Kind:** Building block
- **Inputs:** Changed files or explicit scope, behavior that must stay unchanged, and available verification commands
- **Outputs:** Cleanup summary, changed files, behavior-preservation evidence, and deferred findings
- **Status:** `CLEAN`, `CLEANED`, `WARN`, `FAIL`, or `BLOCKED`
- **Consumers:** `vs:roast-code` Pass 1, `vs:build-it` Phase 4, `vs:ship-it` pre-PR review, standalone cleanup requests
- **Skip conditions:** Skip when the diff is trivial, generated-only, or the user explicitly asks for review-only/no edits

## Cleanup Targets

Inspect the requested scope for:

- flatten first: delete down to one layer. A new wrapper, helper, file,
  or mode flag is not a cleanup
- structural simplifications that delete whole concepts, branches, modes,
  wrappers, or layers instead of merely polishing them
- duplicate logic or copy-paste with tiny variations
- one job per unit: do not restate the same logic in many layers
- unnecessary `async`/`await` or Promise wrapping around sync work
- pass-through wrappers that add no meaning
- ceremony types and files (`Manager`, `Service`, `Factory`, `Helper`,
  `Utils`) that exist for a single call, plus config objects wrapping two
  or three parameters and boolean mode flags that split one path
- a single-use extract: a helper with one call site that only moved lines
- a helper or type that fails the **portability test**: if it could move to
  another repo unchanged, it is generic filler, not this product's logic
- synonym cycling of the same domain concept (rotating the name across
  layers: user / account / customer for one entity)
- defensive null checks on values proven non-null by types or callers
- fallback branches that hide primary-path failures
- silent defaults and optional chaining that hide missing required data:
  `?.` on a required field, `?? []`, `?? {}`, or `|| default` that papers
  over an invariant the caller should have supplied
- try/catch theater: a try/catch around non-throwing code, an empty catch,
  or a catch that logs and swallows a real failure
- `any` and an uncommented type assertion that fabricates evidence
- comments that narrate obvious code, hand-holding notes, and JSDoc that
  is only restating the signature
- dead imports, stale flags, temporary debug leftovers, `console.log` /
  `console.debug` / `console.info` left in production paths, and a stale
  TODO fossil
- inconsistent naming or one-off conventions that fight the codebase
- ad-hoc conditionals bolted into busy flows where a typed model, dispatcher,
  policy object, or canonical helper would make the path easier to reason about
- cast-heavy or optionality-heavy boundaries that hide the real invariant,
  in particular:
  - `unknown` or `object` in a signature where the caller already knows the type
  - `Record<string, unknown>` and equivalents standing in for an owned contract
  - chained assertions (`value as object as User`) that fabricate evidence
  - widening a known value and asserting it back later
  - a broad annotation where `satisfies` would preserve the inferred keys
  - ad-hoc `typeof` narrowing where the value should be parsed once at the
    boundary

Run `skills/vs-deslop/scripts/reject-code-slop.mjs` on each in-scope file
before reporting `CLEAN` or `CLEANED`. Exit 1 is a catalog fail.

## Procedure

**Exclusive order:** Lock behavior first, then collect →
validate/discard FP → surgical delete → verify → rescan.
Do not skip or invert these.

1. **Lock behavior first.** Identify the existing tests or direct checks that
   prove behavior. If none exist and cleanup could change behavior, add the
   narrowest regression test before editing. Do not invent types, files,
   flags, or behavior "for cleanliness."
2. **Collect candidates. Do not edit yet.** Name each smell, its category,
   the invariant or call site, and the file it affects. Do not broaden
   scope just because adjacent code is ugly.
3. **Validate each candidate.** Keep a change only when it is formula, not a
   necessary defense (auth, validation at a trust boundary, required error
   handling). A false positive that deletes a real guard is worse than one
   leftover tell. Discard it and say why.
4. **Flatten first.** The first cleanup move is one-layer delete. Before
   extracting a helper, ask whether a simpler state shape, ownership
   boundary, or default flow would remove the branch/helper/wrapper
   entirely. One clean delete beats three clumsy rewrites. Do not clean
   by adding a wrapper, helper, file, or mode flag.
5. **Edit in safe, surgical passes.** Take the minimum effective edit.
   Leave strong local code alone. Prefer deletion and simplification over
   abstraction. Do not restructure modules or reorder files for aesthetics
   unless a concept disappears. Preserve public APIs unless the user
   explicitly asked for a breaking cleanup. Preserve local idiom: flattening
   working house style into a generic house style is a cleanup defect. Cleanup
   must not add a file, wrapper, interface, flag, or helper that did not
   exist; do not introduce new slop while removing old.
6. **Verify after cleanup.** Re-run the targeted proof and any required
   guardrail.
7. **Rescan, then stop.** Walk the cleanup targets and the quick checks
   again. The deslop run ends the pass. At most 2 rescans. Then stop.
   `CLEAN` / `CLEANED` means no in-scope leftover is still cuttable.
   If the leftover is only deferred (risky / out of scope): WARN, not
   another rescan. Do not keep looping.

### Quick checks before reporting `CLEAN` or `CLEANED`

- try/catch around non-throwing work, empty catch, or swallow?
- `?.` / `?? []` / `?? {}` hiding a required value?
- unnecessary `async`/`await` or Promise wrapping?
- `any` or uncommented type assertion?
- hand-holding comment or JSDoc restating the signature?
- `console.log` / stale TODO fossil / dead import?
- synonym cycling of one domain name?
- still cuttable concept left in scope after one flatten pass?
- `skills/vs-deslop/scripts/reject-code-slop.mjs` exit 1 after that pass?

## Output

```markdown
## Deslop Result

- Status: CLEAN | CLEANED | WARN | FAIL | BLOCKED
- Scope: <files or diff range>
- Cleaned:
  - <change, smell category, and why it preserved behavior>
- Deferred:
  - <risky, false-positive, or out-of-scope cleanup>
- Evidence:
  - `<command>` - <result>
```

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-build-it` | `/vs-roast-code` | `/vs-qa`
**Next:** `/vs-verify`
**Relevant:** `/vs-roast-ui`
