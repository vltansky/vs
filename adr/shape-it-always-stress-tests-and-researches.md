# Shape-it always stress-tests and considers research

Date: 2026-07-26

Builds on `prioritize-risk-and-vertical-slices-in-orchestration.md` and
`execution-blueprints-govern-delegation.md`; both remain in force. Depends on
the composed mode introduced in `pushback-advises-rather-than-interrogates.md`.

## Context

`vs-shape-it` had two gaps at the edges of its explore workflow.

Its evidence gathering was entirely repo-inward: read the named sources, read
nearby code, check prior artifacts. Nothing in the skill ever named
`vs-github-research`, `vs-rfc-research`, or `vs-steal`, so a design could be
shaped to completion without once checking whether the ecosystem had already
settled the question. Repository evidence answers how this codebase works; it
cannot say whether the approach is the right one.

Its stress test was optional and off the main path: "For large, cross-domain, or
expensive-to-reverse work, use a fresh planning critic before final approval."
Size thresholds like that are self-assessed, and a design confident enough to
skip the critic is exactly the one that needed it. The critic also produced no
verdict or score, so nothing comparable came back to the user at the approval
gate.

The tension is the tested interaction -> independent -> interaction cadence.
`vs-pushback` is an interactive multi-round grill; running it inside the
independent beat would break the promise that the user is not asked anything
between alignment and the closing recommendation.

## Decision

Both flows become part of the explore workflow, at opposite ends of the
independent beat.

**Research prior art** runs early in the independent beat and is decided once:

- Run one without asking when the answer would change the recommendation and it
  is clear which lookup produces it — the design depends on an external system's
  real API or limits, the user named an external project or spec, the approach
  has well-known prior art, or a build-vs-adopt call hinges on what a library
  actually does.
- Offer it as an opening-round choice when it would cost real time and the
  design can proceed without it.
- Skip it with a stated reason when named sources and repository evidence
  already settle the decision. External reading is not a default tax.

Findings are evidence, not authority; a rejected prior-art finding is recorded
as a decision with its rationale.

**Pushback** runs last, as the final step of the independent beat, with no size
threshold. It runs in composed (non-interactive) mode over the finished design,
Goal Contract, and execution strategy, so the cadence is preserved. Supported
findings are folded into the design rather than appended as a critique the user
must reconcile. The closing interaction shows the verdict as one line
(`Pushback: READY_WITH_RISKS (72/100) — <weakest dimension>`) plus surviving
high and medium findings.

A `NOT_READY` verdict does not block the approval gate — it changes what is
being approved. Shape-it leads with the blocking finding, recommends reworking
before `/vs-build-it`, and offers a full interactive `/vs-pushback` for a user
who wants to defend the design in rounds.

Chaining is file-based per `invocation-gates-do-not-degrade-workflows.md`:
shape-it loads the sibling `SKILL.md` rather than invoking a gated command.

## Consequences

- Every shaped design arrives with a verdict and a score attached, so the
  approval gate has a calibrated signal instead of the author's own confidence.
- Running pushback after the execution strategy, rather than mid-design, means
  it grills a whole artifact; a critic run against a half-formed design
  generates objections the remaining shaping would have answered anyway.
- Small work now pays for one short composed pass it previously skipped. That is
  the intended trade: the pass is cheap and the skipped sessions were the ones
  that needed it.
- Shape-it sessions get slower and more expensive when research runs. The
  stated-skip requirement keeps that from becoming automatic.
- Composed mode cannot use the user's answers, so a verdict from shaping is
  strictly weaker than an interactive grill. The closing interaction says so and
  offers the interactive path.

## Alternatives considered

- **Keep the size threshold on the stress test.** Rejected. Self-assessed
  thresholds fail in exactly the direction that hurts, and the critic's cost is
  small relative to a shaping session.
- **Run pushback interactively inside shaping.** Rejected. It breaks the
  interaction -> independent -> interaction cadence that
  `interaction-cadence.static.eval.ts` protects, and reintroduces the
  question-drip the cadence exists to prevent.
- **Run pushback before finalizing the spec.** Rejected. The Goal Contract and
  execution strategy are among the most valuable things to challenge; grilling
  before they exist leaves them unreviewed.
- **Always run external research.** Rejected. Most shaping questions are settled
  by the repository, and a mandatory lookup taxes every session to catch a
  minority.
- **Let shape-it duplicate a lightweight critique inline.** Rejected. It would
  drift from pushback's dimensions, scoring, and verdict, leaving two review
  vocabularies to keep in sync.
