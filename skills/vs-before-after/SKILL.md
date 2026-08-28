---
name: vs-before-after
description: "Use when asked for before and after, the functional difference, what behavior changed, or the user value of a branch, PR, commit, or working-tree diff. Translates code changes into a concise observable-behavior comparison; it is not a code walkthrough or review."
---

# Before & After

Translate an exact code diff into the functional change a person, caller, or
operator can observe. The diff is input evidence; the output describes behavior.

## Boundary

Use this skill for “before vs after,” “what is the value of this change?”, or
“what works differently?” Do not use it for a file inventory, code walkthrough,
review verdict, implementation explanation, release status, or general recap.

If the diff contains only refactoring, tests, generated output, lockfiles, or
other implementation churn with no supported behavior change, return
`NO_FUNCTIONAL_CHANGE` and one sentence explaining why. Do not manufacture a
user impact.

## 1. Pin the comparison

Resolve one exact comparison boundary before interpreting behavior:

- **PR:** use its exact base and head SHAs.
- **Branch or commit range:** use the merge base and exact head SHA.
- **Working tree:** compare tracked staged and unstaged changes against `HEAD`;
  name untracked files separately when they are in scope.
- **Supplied diff:** record the user-provided base/head or state labels.

Fail with `BLOCKED_NO_DIFF` when the boundary cannot be resolved or the diff is
empty. Do not silently substitute a different base.

Keep a large diff on disk and inspect bounded hunks through the shared
[`disk-backed evidence contract`](../vs-internal-shared/references/disk-backed-evidence.md).
For a local branch, capture the exact diff without printing it into chat:

```bash
UPSTREAM_REF=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD)
BASE=$(git merge-base HEAD "$UPSTREAM_REF")
RUN_DIR=$(mktemp -d)
DIFF_PATH="$RUN_DIR/before-after.diff"
git diff "$BASE"..HEAD --no-color > "$DIFF_PATH"
node <resolved-vs-internal-shared-skill-directory>/scripts/evidence-manifest.mjs \
  manifest "$DIFF_PATH"
```

## 2. Derive the functional delta

Read the affected flow once: changed entry points, relevant callers and callees,
tests, contracts, and the base and head versions needed to establish behavior.
Repository and PR prose can explain intent, but intent is not proof.

For each distinct outcome, compare the same actor, input, precondition, and
observable end state on both sides. Merge multiple implementation hunks that
produce one outcome. Omit internal mechanics unless they materially constrain
the behavior.

Classify what happened while reasoning:

- **Added:** a capability did not exist and now does.
- **Fixed:** the old behavior was wrong and now reaches the intended result.
- **Changed:** valid existing behavior now works differently.
- **Removed:** a capability or supported path no longer exists.
- **Breaking:** an existing caller or user must change how they interact.
- **Unchanged:** a relevant contract remains stable despite the implementation
  change.

Breaking, security, authorization, data-loss, and compatibility effects must be
stated explicitly. Preserve uncertainty instead of smoothing over it.

## 3. Separate evidence from inference

Label the strongest support for each comparison:

- **Observed:** matched before and after runtime evidence using the same setup.
- **Tested:** a named test or command demonstrates the stated behavior.
- **Source-derived:** behavior is inferred from the pinned base/head source or
  diff but was not executed.
- **Stated:** intent comes only from a PR, issue, or user description.

Passing current tests does not prove the before state. A source-derived claim is
useful, but it stays a proof gap until observed or tested at the relevant state.
Never describe an inferred outcome as verified.

## 4. Render only the behavioral comparison

Group closely related outcomes. Prefer one comparison; use more only when the
diff changes independently observable behaviors.

```markdown
## Before & After

**Before**
<What the actor experienced with the concrete input or precondition.>

**After**
<What that same actor experiences now.>

**Impact**
<Why the functional difference matters. Mark breaking behavior here.>

**Unchanged**
<Only the relevant preserved behavior; omit when none is material.>

**Evidence**
- <Observed or Tested evidence with the named command/artifact.>
- Proof gap: <Source-derived or Stated claim that was not demonstrated.>
```

Do not add a file inventory, diff stat, code walkthrough, architecture diagram,
review findings, screenshots, implementation plan, or next-step menu. Evidence
may cite the minimum exact path, test, command, or artifact needed to support a
claim; it must not turn into a changelog.

Apply the
[`shared output style`](../vs-internal-shared/references/output-style.md) to the
rendered comparison.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** branch, PR, commit, or working-tree diff
**Next:** done
**Relevant:** `/vs-pr-walkthrough` for a large code-reading aid | `/vs-recap` for current status
