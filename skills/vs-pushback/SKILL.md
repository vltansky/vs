---
name: vs-pushback
description: "Use when a formed idea, plan, spec, RFC, or agent-made decision needs skeptical review before implementation or high-risk execution. Investigates evidence, challenges premise and scope, asks targeted decision questions, applies Ponytail to find a smaller complete alternative, and returns concise actionable findings with a qualitative verdict."
disable-model-invocation: true
---

# Pushback

Pressure-test a formed proposal while changing direction is still cheap. Find
the few things that could make it wrong, wasteful, or aimed at the wrong goal.

<HARD-GATE>
Do not implement, edit the proposal, or begin delivery. Review it and return a
verdict. If the input is still a raw idea, route to `/vs-shape-it`.
</HARD-GATE>

## Core contract

Lead with findings first. The unit of work is a finding, not a questionnaire.
Facts are the reviewer's job; decisions are the user's.

For every review:

1. Inspect the proposal and the evidence it depends on.
2. Steelman the strongest version of the proposal in one or two sentences.
3. Challenge its premise, audience, scope, failure modes, and proof.
4. Apply Ponytail and name the smaller complete alternative.
5. Return at most three material findings and a qualitative verdict.
6. Ask only targeted user questions that could change the result.

A plan that survives is allowed to pass. Do not invent findings, restate lint or
compiler failures, or raise generic risks without a specific failure mode.

## Review depth

**Quick review** is the default. Inspect the relevant evidence, run the core
contract, and keep the response compact.

**Deep review** is for auth, security, data loss, migration, concurrency,
irreversible operations, or an explicitly disputed decision. Add blast radius,
rollback, and verification gaps. An independent advisor is optional in a deep
review when it can add a genuinely different signal; use
[`independent-advisors.md`](../vs-internal-shared/references/independent-advisors.md).
Do not upgrade a small request into full ceremony.

For an active incident, do not block mitigation. State the most consequential
risk briefly and recommend a deeper review after stabilization.

## Investigate before judging

Read the proposal, relevant code and tests, prior decisions, and available
measurements. Check claims such as “simple,” “fast,” “safe,” or “already
supported” instead of repeating them. Do not ask the user to discover
repository facts you can inspect yourself.

Read the applicable `CONTEXT.md` or `CONTEXT-MAP.md` for project language when
present, but do not create or update `CONTEXT.md` or `CONTEXT-MAP.md` in
pushback.

Classify each surviving finding by evidence:

- **VERIFIED** — directly supported by code, measurement, documentation, or an
  observed result.
- **INFERENCE** — a reasoned premise, audience, strategy, or maintainability
  judgment whose basis is stated.
- **UNRESOLVED** — the decisive evidence is missing; name the cheapest check
  that could settle it.

Use High, Medium, or Low severity only to express impact. Numeric confidence
adds false precision and is not part of the verdict.

## Ponytail is part of pushback

Load and apply [`../vs-ponytail/SKILL.md`](../vs-ponytail/SKILL.md). Every review
must test whether the proposal can stop at an earlier complete rung by avoiding
new work, reusing the repository, using existing platform capability, or
removing speculative machinery.

Return the result as one normal review field:

```text
Smaller complete alternative: <the reduced proposal, or “none; the current
proposal is already the first complete rung”>
```

Ponytail reduces solution size, never requirements, safety, evidence, or
verification. Do not print a separate Ponytail ceremony.

## Ask questions that improve the pushback

After investigating and stating the provisional findings, ask up to 3 focused
questions when an answer could change a finding, recommendation, scope, or
verdict. Zero questions is valid when the evidence settles the review.

Good questions probe decisions the reviewer cannot infer:

- **Audience:** `Is <X> really the intended audience?`
- **Edge-case value:** `Is the <Y> edge case actually relevant to this release?`
- **Scope:** `Is <capability> required now, or can it be deferred?`
- **Tradeoff:** `Is <benefit> worth <cost or risk>, given the smaller option?`
- **Risk appetite:** `Is <named failure mode> acceptable for this stage?`

Each question must convey:

```text
Finding: <what the evidence currently suggests>
Recommendation: <the reviewer's preferred answer and why>
Impact: <what changes in the proposal or verdict>
```

Do not ask the user to discover repository facts, choose implementation
mechanics, or grade the review. Do not offer “defend the plan” or “skip” as
options. Use `request_user_input` in Codex or the host's structured question
tool when available. Offer two or three real alternatives, recommended option
first. In a text fallback, put one option per line.

Process answers as evidence: update the affected finding and say what changed.
Reasoning alone does not retire a verified problem. Never answer on the user's
behalf or record a decision they did not make.

## Findings and verdict

Keep only findings that could change the proposal or its acceptance. For each:

- concern and specific failure mode
- evidence state and exact pointer
- severity
- what to do instead

Premise challenge stays mandatory: confirm the problem, audience, do-nothing
baseline, and success signal before optimizing the solution. Prefer mundane,
likely failures over exotic hypotheticals.

Use one verdict:

- `READY` — evidence supports the proposal and no material unresolved risk
  remains.
- `READY_WITH_RISKS` — no blocker remains, but named tradeoffs or checks stay
  open.
- `NOT_READY` — the premise is unsupported, a high-impact problem remains, or
  decisive evidence is missing.

Do not raise the verdict because the author argues confidently. Retire a
finding only by naming the new evidence or user decision that changed it.

## Output

Return this compact shape; omit empty optional lines:

```text
Verdict: READY | READY_WITH_RISKS | NOT_READY
What holds up: <steelman and verified strengths>
Top pushback:
- [severity, evidence state] <failure mode> — <evidence> — <recommendation>
Smaller complete alternative: <Ponytail result>
Open decision: <targeted user decision, or none>
Verification gap: <cheapest decisive check, or none>
```

Do not create a report or eli5 artifact by default. Create one only when the
user explicitly requests it or a deep review needs a durable handoff. Keep any
artifact outside the project tree and redact secrets.

Passing tests alone does not prove a user-visible or production claim. Name any
manual, deployment, or served-behavior gap without turning pushback into the
post-implementation verification workflow.

## Composed mode

When another workflow loads pushback, run non-interactively and return the same
compact contract to the caller. Keep the evidence work, Ponytail alternative,
and verdict. Do not open question rounds, create artifacts, or invoke eli5.

Return useful candidate questions under `Open decision` so the caller can ask
them. If a missing user decision affects the verdict, record the decision as
unresolved; never answer on the user's behalf.

## Conditional depth

If the proposal changes architecture, module boundaries, abstractions, or
interfaces, read
[`architecture-depth-dimension.md`](references/architecture-depth-dimension.md).
When Architecture Depth was active, add a short options comparison only when a
real architectural choice survives Ponytail.

If it changes a non-deterministic evaluation, read
[`eval-quality-dimension.md`](references/eval-quality-dimension.md).

## Flow Contract

- **Kind:** Building block
- **Inputs:** Formed proposal, relevant evidence, and caller-known constraints
- **Outputs:** Compact verdict, strengths, up to three findings, smaller complete
  alternative, open decisions, and verification gaps
- **Status:** `READY`, `READY_WITH_RISKS`, or `NOT_READY`
- **Consumers:** `vs-shape-it`, `vs-rfc-research`, `vs-build-it`
- **Skip conditions:** raw ideas route to `vs-shape-it`; active incidents get a
  brief risk note and post-stabilization review

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md).

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-shape-it` | `/vs-rfc-research` | formed proposal
**Next:** `/vs-build-it`
**Relevant:** `/vs-roast-code`
