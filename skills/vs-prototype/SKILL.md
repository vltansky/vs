---
name: vs-prototype
description: "Use when the user wants to prototype, spike, sanity-check a state model, or compare UI directions before committing to production implementation. In existing projects, chooses the easiest trustworthy seam: wire into the app or recreate a lightweight lookalike."
---

# Prototype

Build the smallest throwaway implementation that lets the human answer one
expensive-to-reason-about design question.

This is a **building block**, not a delivery workflow. A prototype learns; it
does not quietly become production code.

<HARD-GATE>
Before editing, state the question the prototype will answer in one sentence.
If no concrete question can be named, return to `/vs-shape-it` instead of
building speculative code.
</HARD-GATE>

## Choose the branch

Infer the branch from the question and nearby code:

- **UI:** "What should this look or feel like?" Build three structurally
  different variants in the real product context.
- **Logic:** "Does this state model, API, or transition feel right?" Build one
  interactive harness that exposes the complete relevant state.

Ask only when both branches remain plausible after reading the relevant docs and
code. If the user is unavailable, choose from the surrounding code and state the
assumption.

## Choose the easiest seam

In an existing project, optimize for **time to a useful comparison**, not maximum
reuse. After inspecting the relevant route and its runtime dependencies, choose:

- **Wire into the app** when the project already runs, the target surface is easy
  to reach, and a dev-only variant or harness can be added without threading
  prototype concerns through production code.
- **Build a lookalike** when app startup, auth, backend dependencies, routing, or
  component wiring would take longer than recreating the relevant surface. Make
  a small standalone project or file that matches only the product context that
  affects the question.

Mock data is allowed in either path. Prefer a few representative fixtures over
wiring real services when live data does not affect the answer. Keep fixtures
obviously synthetic and include the edge states the human needs to compare.

State the choice in one line before editing:

```text
Prototype seam: existing app | lookalike — <why this is the fastest trustworthy path>
```

Do not ask the user to choose the seam unless both paths have similar cost and
different fidelity tradeoffs. This is normally a tactical decision for the agent.

## Shared rules

1. **Explore before editing.** Read repository docs and inspect the nearest real
   implementation, route, components, data shapes, and task-runner conventions.
   Reuse the project's runtime and dependencies.
2. **Keep the question narrow.** Prototype one uncertain decision. Split
   unrelated questions into separate prototypes.
3. **Mark it as disposable.** Put the word `prototype` in new route, file, and
   script names. Keep an in-app prototype close to the code it informs. Keep a
   lookalike isolated from production source under the repo's prototype location,
   or `~/.vs/$PROJECT_ID/prototypes/<topic>/` when none exists.
4. **One command to run.** Add a narrowly named script to the existing task
   runner, or give the exact direct command when no task runner exists.
5. **No production hardening.** Skip tests, persistence, migrations, analytics,
   broad error handling, abstractions, and accessibility polish unless one is
   the question being tested. Do not alter production behavior outside the
   explicit prototype seam.
6. **No surprise runtime.** Do not start a dev server unless the user explicitly
   asks. If the app is already running, inspect it in the browser after editing.
7. **Keep evidence visible.** The user must be able to see the relevant state,
   compare alternatives, and reproduce the observation.

## UI prototype

For an in-app prototype, keep the real shell, density, params, and relevant data
shape; swap only the subtree under evaluation. For a lookalike, reproduce those
same contextual constraints with the least code possible. Do not recreate parts
of the product that cannot change the answer.

Create three variants by default, capped at five when the user asks for broader
exploration. Each variant must disagree about structure, information hierarchy,
or primary interaction—not merely color, spacing, or copy.

Derive the directions problem-first:

- one follows the stated direction closely
- the others follow the same user intent while challenging the prescribed UI
- name each direction for the product idea it tests, not a generic pattern

Wire variants through a shareable URL parameter such as `?variant=a`. Add a
small fixed switcher with previous/next controls, current label, and left/right
keyboard navigation. Do not intercept keys inside inputs, textareas, selects, or
editable content. Gate the switcher and prototype-only branches out of production
builds using the project's existing environment convention.

Keep mutations stubbed or isolated unless mutation behavior is the question.
Use the project's real component library and styling system so comparisons happen
inside product reality.

## Logic prototype

Put the logic behind the smallest portable interface that fits the question:

- pure reducer for discrete actions over one state value
- explicit state machine when legal transitions are the question
- pure functions for stateless transformations
- small stateful module only when ongoing internal state is essential

Keep I/O in a thin interactive shell. After every action, replace the terminal
frame and render the full relevant state plus available controls. Prefer native
terminal input and ANSI styling over a new dependency.

Use in-memory state. If persistence itself is under evaluation, use a clearly
named scratch store that cannot be mistaken for production data.

## Handoff and decision

Return:

- `Question:` the single question being tested
- `Prototype seam:` `existing app` or `lookalike`, with the reason
- `Run:` the exact command, plus variant URLs or controls
- `Changed:` prototype-only files and any temporary seam in existing code
- `Review:` what the human should compare or try
- `Status: READY_FOR_REVIEW`

Do not declare a winner for a taste or product decision. After the user reviews
the prototype, record the answer at
`~/.vs/$PROJECT_ID/prototypes/YYYY-MM-DD-<topic>.md`, resolving `$PROJECT_ID`
with the convention in [../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md).
Include the question, chosen direction, rejected directions, evidence, and the
production work implied by the answer.

The reviewed prototype has only two valid next states:

- **Promote the decision:** hand the decision note to `/vs-shape-it` if design
  remains, or `/vs-build-it` to rewrite the chosen behavior with production
  tests, error handling, and cleanup.
- **Keep exploring:** revise the same prototype around the user's feedback; do
  not widen it into a production implementation.

Do not commit, branch, delete, or convert prototype code without the user's
explicit direction.

## Flow Contract

- **Kind:** Building block
- **Inputs:** one design question plus a repository or runtime context
- **Outputs:** runnable throwaway code, exact review instructions, then a decision note
- **Status:** `READY_FOR_REVIEW | ANSWERED | BLOCKED`
- **Consumers:** `/vs-shape-it`, `/vs-build-it`, direct human invocation
- **Skip conditions:** the answer is already cheap to prove from existing code,
  tests, docs, or a reversible implementation

## Verification

Before finishing, check:

- the question is explicit and the artifact answers only that question
- the chosen seam is the fastest trustworthy path and its reason is stated
- prototype names make throwaway status obvious
- UI variants are structurally distinct, or logic is isolated from its shell
- the prototype has one exact run command
- no dev server was started without explicit instruction
- no production hardening or unrelated cleanup slipped in
- handoff tells the human exactly what to evaluate

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-shape-it` or a concrete implementation uncertainty
**Next:** `/vs-shape-it`
**Relevant:** `/vs-perf`
