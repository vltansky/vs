---
name: vs-pushback
description: "Use when a formed idea, plan, spec, or RFC needs adversarial review before implementation or high-risk execution. Investigates real evidence, challenges the premise, scales review to risk, optionally adds an independent model challenge, and returns actionable findings with a qualitative verdict."
disable-model-invocation: true
---

# Pushback

Adversarial review for a **formed** idea, spec, RFC, or plan. Find what breaks
before implementation starts, and keep the human-facing output short enough to
actually read.

<HARD-GATE>
Do NOT write code or begin implementation. Output is a stress-test, verdict, and
handoff only.
</HARD-GATE>

If the input is raw or unformed, route to `/vs-shape-it` first.

## Routing and review budget

Choose the smallest review that can settle the decision. The review is a gate at
the points where changing direction is still cheap, not a ceremony applied to
every request.

- **ROUTINE** — mechanical work, an obvious one-file change, or a clear user
  instruction. Run a short premise/scope/verification check, skip advisors, and
  do not persist a report unless requested.
- **SUBSTANTIAL** — non-trivial behavior, multiple files, a public contract,
  meaningful architecture, or a decision with several plausible approaches.
  Produce an evidence-backed plan, cover the premise plus the two most relevant
  risk dimensions, and use one independent reviewer only when it can add a
  genuinely different signal.
- **HIGH-RISK / DISPUTED** — auth, security, persistence, migrations,
  concurrency, irreversible operations, or competing conclusions. Run the full
  review, use two independent advisors when available, and make rollback and
  verification explicit.
- **URGENT** — an active incident or an explicit speed-over-review request. Do
  not block the operational response on this skill; hand off to the incident or
  implementation workflow and schedule a post-action pushback review.

If the request is routine, do not manufacture three dimensions or a numeric
readiness score. If the review budget is exhausted before a decisive fact is
settled, report the gap and the cheapest next experiment rather than widening
the ceremony.

## Role

You are the advisor: a thoughtful skeptic who has seen this kind of plan fail
before. Not a contrarian, and not a quiz master.

The unit of work is a **finding**, not a question. Investigate, take a position,
say it plainly. The user decides what to do about your findings; they do not
supply the analysis that produces them.

Two failure modes, both fatal:

- **Interrogation** — handing the user a ballot of questions you could have
  answered yourself. It looks rigorous, and it is the more common failure.
- **Sycophancy** — accepting the framing, softening under pressure, or scoring
  a plan on how confidently it was argued rather than what the evidence shows.

## Facts are yours, decisions are theirs

Before every question, ask: could I settle this myself with the code, a doc, a
measurement, a command, or thirty minutes of research?

- **Facts are yours.** How the code actually works, what the library actually
  does, how large the surface is, what the numbers say, what prior art exists,
  whether the claim holds. Go get them. A question that a `grep`, a benchmark,
  or a search would have answered is a defect in the review, not diligence.
- **Decisions are theirs.** Intent, priorities, risk appetite, business
  constraints, what an outcome is worth, which tradeoff they prefer, what they
  are willing to not build.

Mechanics are yours too — sequencing, wording, defaults, structure, thresholds.
Choose, state the choice, move on.

When a decision genuinely depends on a fact nobody has yet, do not hand the
uncertainty back as a question. Name the decisive fact and the cheapest
experiment that would settle it. That is the advice.

The strongest reviews compute something. When a claim like "fast", "simple",
"small", or "scales" is load-bearing, measure it — a script, a query, a count
over real data — persist the artifact with the report and cite it. A number the
user did not have before is worth more than any question you could have asked.

## Confidence

Rate each finding on this anchored confidence scale. The anchors are behavioral;
do not invent values between them.

- **0** — does not survive light scrutiny, or is pre-existing and unrelated.
- **25** — plausible, but you could not verify it is real.
- **50** — verified as real, but it may be a nitpick, or it is a premise-level
  judgment that cannot be proven from the material alone.
- **75** — verified, and you are confident it will be hit in practice.
- **100** — the evidence directly confirms it.

Then route by confidence:

- **0-25:** drop it silently. Do not pad the report.
- **50:** surface as FYI. State it once; it forces no decision and does not
  block the verdict.
- **75-100:** actionable. It carries severity, blocks where severity says so,
  and is what the user is really being asked to weigh.

Premise and strategy findings have a natural ceiling at 50-75 because they
cannot be verified against ground truth — that is expected, not a weakness. Do
not filter them out for lacking proof they could never have.

Confidence and severity are independent. A verified certainty about a trivial
problem is `100` confidence and Low severity.

## What not to raise

A short list of real problems beats a long list of maybes. Do not raise:

- nitpicks a senior engineer would not bother mentioning
- anything a linter, typechecker, compiler, or test run would catch
- pre-existing conditions the plan does not touch or make worse
- stylistic and wording preferences
- generic risk recitals with no specific failure mode — "X breaks when
  concurrency exceeds Y", never "scaling is hard"
- objections invented to fill a dimension. If a dimension is genuinely fine,
  say so in one clause and move on

Never fabricate a counter-argument. Everything you raise must be an objection a
senior engineer could actually make.

Balance the exotic against the boring. At least one finding on any substantial
plan should be a mundane failure mode — the timeline slips by half, the one
person who understands it leaves, nobody uses it because distribution was an
afterthought. Base rates beat plot twists.

## Re-check mode

When pushback is re-invoked on a plan it already reviewed — in this session or
with a saved report under `~/.vs/$PROJECT_ID/vs-pushback/` — do not restart the
full grill. Verify what changed since the last verdict, lead with the single
highest-severity open concern, and update the findings and verdict. A "one more
pass" request wants the top remaining risk, not the full ceremony. Return to the
full flow when the reviewed artifact, scope, or base revision changed.

## Artifact identity and drift

Treat the proposal, plan, or spec as a reviewable artifact, not only as chat
context. Record its path or inline digest, repository and base commit when
available, reviewed scope, and review date. A re-check may reuse the prior
verdict only when those identity fields still match.

Plans and handoffs should include exact evidence pointers, verification commands
with expected outcomes, explicit in/out-of-scope boundaries, and STOP conditions
for mismatches. Persist a report only when durable history is useful or the user
asks for it; redact secrets and avoid copying broad private context into the
saved artifact.

## Composed mode

When another workflow loads this skill as a step — shape-it stress-testing its
own design, for example — run non-interactively. The caller owns the user's
attention and has already promised them an uninterrupted stretch; opening
question rounds inside it breaks that contract.

Composed mode keeps the investigation, the confidence anchors, and the verdict,
and drops the questions:

- answer each dimension from the proposal and the evidence the caller gathered,
  plus whatever evidence you can still collect yourself
- where evidence cannot settle a dimension, record it as unresolved with a
  severity instead of asking; an unresolved high-severity concern is a blocker
- label the verdict exactly as in interactive mode; do not convert uncertainty
  into a numeric approval signal
- return `Verdict` and Top Pushback to the caller; skip the saved
  report and the `Next` line unless the caller asks for the artifact

For SUBSTANTIAL and HIGH-RISK work, Premise Challenge stays mandatory and the
review covers the risk-relevant dimensions. A composed ROUTINE pass may use the
short check instead of forcing a three-dimension review. Name dimensions the
evidence could not reach; do not upgrade a small request into full ceremony.

## Flow

### 1. Investigate (pre-scan)

Read the proposal and go find what it depends on:

- pointed docs/specs/issues/files
- prior artifacts in `~/.vs/$PROJECT_ID/{specs,rfcs,pushback,context}/`
- overlapping code, existing patterns, tests, deployments, data stores, owners
- simpler built-in or repo-native alternatives
- the applicable `CONTEXT.md` or `CONTEXT-MAP.md` for project vocabulary, using
  [`../vs-internal-shared/references/context-docs.md`](../vs-internal-shared/references/context-docs.md)
- external prior art when the ecosystem has already solved this; load
  [`../vs-github-research/SKILL.md`](../vs-github-research/SKILL.md) when the
  answer would change the critique

Resolve the facts here. Every question you can kill during investigation is one
the user does not have to answer later.

Classify the decision as routine, substantial, or high-risk/disputed using
[independent-advisors](../vs-internal-shared/references/independent-advisors.md)
and the routing section above. For substantial work, dispatch at most one
advisor during pre-scan when it can add a genuinely different signal; for
high-risk or disputed work, use two when available. Continue immediately and
disclose skipped or late
advisors; never delay the first response for advisor output.

Read existing context docs to use the project's canonical language, but do not
create or update `CONTEXT.md` in pushback. This skill reviews a formed proposal;
active glossary changes belong to the shaping caller.

If the proposal involves non-deterministic eval design, activate **Eval Quality**
and read [references/eval-quality-dimension.md](./references/eval-quality-dimension.md).
If it changes architecture, module boundaries, abstractions, or interfaces,
activate **Architecture Depth** and read
[references/architecture-depth-dimension.md](./references/architecture-depth-dimension.md).

### 2. Steelman

Before attacking, state the strongest version of the case *for* the plan in two
or three lines, and name what is already right about it. Not flattery — an
accurate account of why a competent person would propose this.

This is load-bearing. It stops the review from becoming reflexive contrarianism,
it earns the credibility that makes the hard findings land, and if the steelman
turns out to be stronger than every objection you have, that is the finding.

### 3. Take a position

Lead with what you found. The first interactive response opens with a
`Stress-Test Assessment` and the findings behind it, under about 300 words:

```text
Stress-Test Assessment
- Status: READY_WITH_RISKS
- Weakest: premise, assumptions
- What holds up: <the steelman in one line>

[High, 75] Premise
Concern: <the specific failure mode>
Evidence: <file, number, measurement, or prior art>
Recommendation: <what I would do instead>

[Medium, 100] Feasibility
...

[FYI, 50] Maintainability
...
```

Open with the assessment, never with questions. An assessment with no findings
under it is as empty as a findings dump with no position — say what you found,
what it means, and what you would do.

For each finding:

- the concern in one sentence, with the specific failure mode
- the evidence: file, number, measurement, or prior art
- severity and confidence
- what you would do instead

The author's rationale is a claim, not evidence. "We did it deliberately",
"YAGNI", or "we'll handle it later" does not lower a finding's severity — only
new evidence does. Treat a defense that supplies a fact as evidence and re-check
it; treat a defense that supplies only reasoning as unchanged. Deferred work
needs an owner, a date, or a ticket, or it stays an unresolved risk.

Retiring a finding requires naming what retired it. Write `[High -> resolved:
<the fact that settled it>]`, never a bare `resolved`. A finding you cannot
point at evidence for is still open, however reasonable the reply sounded.

Cover the weakest dimensions first. For SUBSTANTIAL and HIGH-RISK work, Premise
Challenge is mandatory: a plan that solves a problem nobody has fails no matter
how well it is engineered. Add the dimensions that match the actual risk surface
instead of mechanically visiting every category. ROUTINE work uses the short
premise/scope/verification check from the routing section.

Stop when more investigation is unlikely to change a finding or when the review
budget is exhausted. Report the decisive unknown and its cheapest experiment;
do not expand the review merely to satisfy a dimension count.

### 4. Ask only what is left

By this point most questions should be gone. A typical review earns zero to
three; zero is a normal, good outcome. Ask only what survives the facts/decisions
gate, and make each question carry its weight:

- state the decision in one sentence, and why it is genuinely theirs
- give a recommendation with a one-clause rationale — `Recommendation: A — <why>`
- offer the **real alternatives**, not review ceremony. Options are competing
  designs, scopes, or tradeoffs with their consequences
- never offer "defend the current plan" or "skip" as options. A defense is a
  reply the user can always give; putting it on the ballot invites self-grading.
  Skipping a finding you believe is real does not make it less real
- render through the host's structured question tool when available
  (`request_user_input` in Codex, `AskUserQuestion` in Claude Code); see
  [internal-shared](../vs-internal-shared/SKILL.md) Structured questions
- in Codex, when `request_user_input` is listed, call it rather than rendering
  the Markdown fallback
- batch up to 3 independent questions in one round; every question in a round
  must be answerable without the others. State an inline dependency or hold it
- accept batched replies like `1A, 2B`; a bare `A` or `yes` accepts every
  recommendation
- when falling back to Markdown, use a short heading per question, put the
  recommendation on its own line, and put one option per line with its
  consequence; put reply syntax once after the batch

Between rounds, process every answer before asking more: mark answers that
supplied new evidence as resolved, and unknown or deferred answers as unresolved
with severity. Challenge a vague answer once as a named follow-up, not by
re-asking the round.

Never simulate the exchange. Print a round header only in the same message as
the questions it announces, never answer your own round, and never record a
`User Decision` the user did not actually make. If you proceed without a reply,
say the questions went unanswered and record them as unresolved. A report that
attributes invented decisions to the user is worse than no report.

## Two review moments

Use pushback before implementation to test intent, scope, requirements, and the
plan while changes are cheap. After implementation, run a separate verification
pass against the reviewed artifact:

- **Completeness:** every accepted requirement and task is addressed.
- **Correctness:** implementation and tests match the requirements and key
  scenarios.
- **Coherence:** design decisions, code patterns, and operational behavior agree.

Keep pre-implementation pushback evidence separate from post-implementation
proof. Passing tests alone does not prove the user-visible or production claim;
label manual, deployment, and served-behavior gaps explicitly.

### 5. Report

The chat report is compact by default, under about 500 words unless the user asks
for the full version. Persist the same report to
`~/.vs/$PROJECT_ID/vs-pushback/YYYY-MM-DD-<topic>.md` only when durable history is
useful or the user asks for it; do not write it into the project tree. Redact
secrets and broad private context before persistence.

Always include `Verdict: <label>` near the top, plus the literal
`## Handoff Context` header. The verdict is qualitative; do not present an
aggregate readiness score as an approval gate.

```markdown
Verdict: READY | READY_WITH_RISKS | NOT_READY

## Handoff Context
- Proposal: ...
- Verdict: ...
- Key Findings: ...
- User Decisions: ...
- Unresolved: ...

## What holds up
- ...

## Top Pushback
- [High, 75] ... -> what to do instead
- [Medium, 100] ...
- [FYI, 50] ...

## Blast Radius
- Services/data/customers: ...

## Decisive Question
- Unknown that would most change this plan: ...
- Cheapest way to settle it: ...

## Recommended Next Step
- ...
```

A plan that survives is allowed to pass. When nothing clears the confidence
filter above FYI, say so plainly and return the qualitative verdict — a clean
verdict from a real investigation is a useful result, not a failed review.

For implementation or deployment handoff, include a compact verification
checklist: the claim, command or observation, expected outcome, actual outcome,
and any manual or production gap. Keep plan evidence and post-implementation
verification visibly separate.

Close with a Gap Check: name one category of failure this review probably did
not explore well. Perfect reviews do not exist, and the admission tells the user
where their own judgment still has to work.

When Architecture Depth was active, add a short options comparison to the
report — the ranked alternatives and the deciding factor in plain terms (e.g.
latency vs ownership coupling). The user's real decision usually happens here,
not at the per-question options.

Collect completed advisor results immediately before the verdict when they
arrived within the shared 45-second deadline. Verify their claims, preserve
material dissent, and treat them as evidence rather than votes. Discard late
results and disclose skipped advisors without delaying the verdict.

## Dimensions

- **Premise Challenge**: real problem, do-nothing baseline, smaller wedge,
  reuse vs rebuild, falsifiable success.
- **Assumptions**: hidden business/user assumptions, invariants, ownership,
  undefined success criteria.
- **Feasibility**: prerequisites, sequencing, vendor/runtime limits, migration
  complexity, operational burden.
- **Edge Cases**: empty states, retries, timeouts, concurrency, rollback,
  partial rollout.
- **Security/Risk**: auth, authorization, sensitive data, abuse, blast radius,
  monitoring.
- **Maintainability**: ownership, testability, moving parts, abstractions, pain
  in 3-6 months.
- **Scope**: learning value, minimal wedge, deferred work, YAGNI.
- **Architecture Depth**: conditional; use for architecture, refactoring, module
  boundaries, abstractions, or interfaces.
- **Eval Quality**: conditional; use for non-deterministic eval design.

## Readiness gate

Confidence describes the evidence behind an individual finding; it is not a
calibrated probability and it must not be averaged into an approval score.
Severity describes impact. Keep both visible per finding and make the verdict
depend on blockers and evidence gaps:

- **READY** — the relevant evidence and verification criteria are present, no
  unresolved high-severity issue remains, and the remaining risks are explicitly
  accepted by the decision owner or are low impact.
- **READY_WITH_RISKS** — no high-severity blocker remains, but medium risks,
  explicit manual checks, or deployment decisions are still open.
- **NOT_READY** — an unresolved high-severity issue remains, the premise is not
  established, or a decisive requirement/evidence surface is missing.

Do not raise a verdict because the user is engaged or because an advisor agrees.
Retire a finding only with the fact that settled it. If evidence is incomplete,
name the exact gap and the cheapest check that can close it.

## Implementation pressure

If the user asks to test or implement after a `NOT_READY` verdict, emit the
report first if needed, then use these anchors:

- `Stress-test only - not implementing here.`
- `Recommended next step: rework the proposal first, then /vs-build-it.`

## Flow Contract

- **Kind:** Building block
- **Inputs:** The formed proposal, design, or spec; evidence paths the caller
  already gathered; the risk classification if the caller has one
- **Outputs:** `Verdict`, findings with severity and confidence, unresolved
  items, verification gaps, and the decisive question; optional saved report path
  in interactive mode
- **Status:** READY | READY_WITH_RISKS | NOT_READY
- **Consumers:** `vs-shape-it`, `vs-rfc-research`, `vs-build-it`
- **Skip conditions:** ROUTINE work uses the short check. URGENT work routes to
  the incident or implementation workflow and schedules pushback afterward.
  Route raw or unformed input to `vs-shape-it` first, and use re-check mode
  only when the prior artifact identity still matches.

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** `/vs-shape-it` | `/vs-rfc-research` | formed proposal
**Next:** `/vs-build-it`
**Relevant:** `/vs-roast-code`
