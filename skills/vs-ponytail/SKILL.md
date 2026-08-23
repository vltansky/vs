---
name: vs-ponytail
description: "Use when the user says ponytail, be lazy, YAGNI, do less, simplest or minimal solution, shortest path, stop overengineering, or complains about bloat, boilerplate, abstractions, or unnecessary dependencies."
---

# Ponytail

Choose the least machinery that completely solves the understood problem.
Efficient is not careless: Ponytail reduces the solution, never the work needed
to understand or prove it.

**Kind:** Building block. It can be invoked directly or composed by workflows
that shape, implement, clean, or review a solution.

## Contract

Read and apply [the canonical contract](references/contract.md). Check the
affected path before choosing a rung. Once the first complete rung is found,
choose it and stop comparing alternatives.

For every meaningful choice, retain this decision:

```text
Ponytail decision:
- Chosen rung: <avoid, repository, standard library, native platform,
  installed dependency, one clear expression, or local implementation>
- Avoided: <machinery not introduced or removed>
- Complete because: <observable requirement or verification>
- Deferred: <unrequested capability, or none>
```

Do not manufacture a decision report for a trivial choice. A meaningful choice
changes files, concepts, dependencies, branches, configuration, or delivery
scope.

## Standalone

When invoked directly, inspect the affected flow, make the requested change or
recommendation within the user's authority, and show the Ponytail decision. If
the request is only to assess complexity, stay read-only and identify the first
complete rung plus removable machinery.

## Composed

When another workflow loads Ponytail, return the decision to the caller. The
caller owns user interaction, implementation authority, verification, and final
wording. Do not open a second workflow or print a separate ceremony.

## Flow Contract

- **Kind:** Building block
- **Inputs:** Understood outcome, affected flow, explicit requirements, and available proof
- **Outputs:** Chosen rung, avoided machinery, completeness evidence, and explicit deferrals
- **Status:** `CHOSEN`, `NO_CHANGE`, `BLOCKED`, or `UNPROVEN`
- **Consumers:** hooks, `vs-shape-it`, `vs-pushback`, `vs-build-it`,
  `vs-roast-code`, and other solution-size decision points
- **Skip conditions:** Skip only when the caller makes no solution-size decision or the user explicitly disables Ponytail

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** an understood problem or implementation
**Next:** done
**Relevant:** none
