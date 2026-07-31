---
name: vs-shape-it
description: "Use when the user says shape it, brainstorm, explore this idea, grill this, or wants to turn an idea into a buildable design."
---

# Shape It

Turn loose ideas and rough plans into approved, buildable designs. Keep the
conversation short and decision-focused; the human makes strategic calls.

<HARD-GATE>
Do NOT write code, scaffold projects, create GitHub issues, or start
implementation workers. Planning-only research or critique subagents are
allowed for complex work. Output is questions, evidence, design, stress-test,
a decision record when one is warranted, and a goal-ready execution blueprint.
Writing an ADR is a decision record, not implementation, and is allowed.
</HARD-GATE>

## Route the input

Infer the route; do not ask the user to choose a mode.

- **Explore:** vague idea, open question, or no chosen approach. This is the
  default; follow the workflow below.
- **Challenge:** formed plan, spec, or RFC, or an explicit request to grill,
  challenge, or stress-test. Delegate to `/vs-pushback`; do not duplicate its
  scoring and verdict workflow here.

If the initial route was wrong, pivot immediately.

Both routes end in pushback. Explore runs it as the last step of independent
shaping; Challenge hands the whole session to it.

When Codex goal tools are available, follow
[Codex Goal Integration](../vs-internal-shared/references/codex-goal.md).
Shape-it owns only the planning goal, never the later implementation goal.
For work that may benefit from delegation, load and follow
[Subagent Orchestration](../vs-internal-shared/references/subagents.md).

## Long-horizon shaping

Shape-it still owns work whose strategic decisions cannot be resolved reliably
in one session. Treat this as long-horizon shaping, not a separate workflow.

Use the existing design spec as the durable source of truth. Create it during
independent shaping when necessary and mark it `Status: SHAPING`. Keep these
sections current alongside the normal design:

- **Open decisions** — unresolved strategic questions and their dependencies
- **Evidence** — paths and URLs that constrain those decisions
- **Next decision** — the single question the next shaping session should resolve

At a clean boundary, apply
[Phase Boundaries](../vs-internal-shared/references/phase-boundaries.md). Resume
by loading the spec first, then only the evidence needed for its Next decision;
do not reload the whole prior conversation. Keep open decisions out of
implementation issues and do not route to orchestrate until the Goal Contract
is approved. Once the open decisions are resolved, continue with the normal
spec approval and handoff.

## Explore workflow

The default cadence is **interaction -> independent -> interaction**. Align
while the user is present, do the substantive shaping without making them
babysit the process, then bring back a complete recommendation for decision.

### 1. Opening interaction

Assume the user is available and engaged at the start. Read the sources they
named and inspect only enough nearby context to avoid questions the repository
can answer. Do not begin broad research or produce a near-final design before
alignment.

Discover the active workspace, repository, and existing artifacts from the host
and current directory. Ask for an evidence location only when it cannot be
discovered or accessed and choosing the wrong one would materially change the
design; ordinary navigation is not a strategic question.

If intent, constraints, success criteria, or an expensive-to-reverse choice is
still unclear, ask up to 3 high-leverage strategic questions in one round. If
the request already settles those decisions, reflect the settled direction and
move directly into independent shaping.

- Render the round through the host's structured question tool when available
  (`request_user_input` in Codex, `AskUserQuestion` in Claude Code); see
  [internal-shared](../vs-internal-shared/SKILL.md) Structured questions. Fall
  back to the Markdown format below otherwise. In Codex, when
  `request_user_input` is listed, call it rather than rendering the fallback.
- Batch only independent questions; every question in the round must be
  answerable without the others' answers. If a question depends on an earlier
  answer, state the dependency inline or infer a reversible default later.
- Keep the question turn under about 60 words per question.
- Recommend a path for every choice; put it first and label it the default. In
  the text fallback, make it option `A`.
- Accept batched replies like `1A, 2B`; a bare `A` or `yes` accepts every
  recommendation.
- Infer tactical details and state safe defaults briefly.
- Spend one of the three questions on external research only when the design
  could proceed without it and the lookup would cost real time. When the need is
  clear, run it in the independent beat instead of asking.

```markdown
## Decisions needed

### 1. <short decision title>

<Why this decision belongs to the user.>

**Recommended: A — <choice>** — <one-clause rationale>

- A. <choice> — <consequence>
- B. <choice> — <consequence>
- C. <choice> — <consequence>

### 2. <short decision title>

...

Reply `A` to accept every recommendation, or specify changes such as `1B, 2A`.
```

### 2. Independent shaping

After the opening reply, assume the user may be away until the closing
interaction. Research, design, challenge, and synthesize autonomously. Do not
drip follow-up questions or pause at section-by-section gates. Resolve tactical
uncertainty with explicit, reversible defaults. Preserve genuinely strategic
uncertainty as an open decision with a recommendation and consequences, then
continue every safe part of the design.

Autonomous is not silent. Per
[`../vs-internal-shared/references/communication.md`](../vs-internal-shared/references/communication.md),
emit one line when this beat starts and one when it ends, so the user knows the
run is moving without being asked anything:

```text
[2/3] Shaping — reading <sources>; open decisions so far: <N>
```

Do not turn these into questions. They report state; they do not request input.

#### Gather evidence

Read relevant repository docs, nearby code, screenshots, and prior artifacts
needed to test the aligned direction. Check
`~/.vs/$PROJECT_ID/{pushback,specs,context,rfcs}/` when relevant, resolving
`$PROJECT_ID` per [internal-shared](../vs-internal-shared/SKILL.md).

Start with sources the user named and the nearest relevant implementation. Do
not inventory the repo or launch broad research until a specific design question
requires it. Stop when more reading is unlikely to change the next decision.

For multi-domain or high-risk work, delegate only independent planning lanes,
such as one bounded evidence inventory and one fresh adversarial critique. The
parent keeps user alignment, decisions, synthesis, and goal ownership. Do not
delegate the interview or ask several agents to design the same whole solution.

#### Research prior art

Repository evidence answers how this codebase works; it cannot tell you whether
the approach is the one the ecosystem already settled. Decide once, early in the
independent beat, whether an external research flow runs.

Run one without asking when the answer would change the recommendation and you
are confident which lookup produces it:

- the design depends on an external system's real API, limits, or semantics
- the user named an external project, tool, standard, or spec
- the chosen approach has well-known prior art whose tradeoffs are already known
- a build-vs-adopt call hinges on what an existing library actually does

Pick the narrowest flow and follow its SKILL.md file:
[`../vs-github-research/SKILL.md`](../vs-github-research/SKILL.md) for prior
art, ecosystem patterns, and landscape comparison;
[`../vs-rfc-research/SKILL.md`](../vs-rfc-research/SKILL.md) when the decision
is RFC- or ADR-grade and needs code-cited evidence;
[`../vs-steal/SKILL.md`](../vs-steal/SKILL.md) for one named external repo.
Scope it to the specific design question, not the whole topic.

Offer it as an opening-round choice when it would cost real time and the design
can proceed without it. Skip it, and say so in one clause, when named sources
and repository evidence already settle the decision — external reading is not a
default tax on every session.

Research is evidence, not authority. Cite what changed the design, and record a
prior-art finding you deliberately rejected as a decision with its rationale.

#### Design

Lead with the recommended approach and why. Keep the core chat design under
about 450 words, excluding a justified orchestration appendix, and include:

- the smallest valuable, deployable end-to-end slice
- scope and explicit non-goals
- terminology and system boundaries
- data/control flow and important interfaces
- 1-2 alternatives with concrete tradeoffs
- risks, success criteria, and verification

Do not make the first delivery absorb every useful capability discovered during
shaping. Separate what is required for the smallest complete outcome from later
reliability, scale, analytics, automation, and platform work. A larger first
slice needs evidence that the smaller slice cannot produce the approved outcome
or would create unacceptable risk.

The slice must advance the approved outcome beyond the confirmed baseline.
Re-auditing or hardening behavior that already works is not the first delivery
unless evidence shows that behavior is unreliable and correcting it is part of
the user's goal. When new value depends on user access or external ownership,
surface that dependency instead of silently substituting lower-value work.

When a cheap prototype would answer a costly design question, recommend
`/vs-prototype`. When a performance claim shapes the design, use `/vs-perf` to
define the metric and evaluator before calling it build-ready.

#### Record the decision

The record precedes the implementation it governs, per
[Record repo-level decisions before implementation](../../adr/record-repo-level-decisions-before-implementation.md).
Resolve the ADR question once, here, with a stated outcome. Silence is not an
allowed outcome.

An ADR is warranted when the design settles a decision that is expensive to
reverse and that future readers will ask "why did we do it this way" about:
cross-cutting workflow or runtime behavior, a convention contributors and agents
must follow, an enforcement or validation policy, or a build-vs-adopt call that
locks in a dependency or integration boundary. It is not warranted for feature
work, local refactors, or tactical implementation choices that a later session
can change freely.

When it is warranted, write `adr/<slug>.md` now, before the closing interaction:

- Follow the repo's existing ADR convention. Absent one, use `adr/` at the repo
  root with a slug-only filename — lowercase, dash-separated, present-tense
  imperative, no numeric prefix.
- Include Date, Context, Decision, Consequences, and the alternatives actually
  evaluated with the reason each was rejected. Carry over prior art you rejected
  during research; that rationale is intact now and expensive to reconstruct
  later.
- Leave it uncommitted and add no `Status` field. Approval happens at PR merge.
- Never edit a merged ADR. When this design changes an existing decision, add a
  new ADR that names the one it supersedes.

When the repo has no ADR surface and the decision qualifies, recommend
`/vs-setup-adr` in the closing interaction rather than inventing an ADR
convention the repo never adopted.

When no repo-level decision was settled, say so in one clause with the reason.

Either way, the Goal Contract's `ADR` line records the result.

#### Finalize the spec

Do not restart the interview. Synthesize the conversation and repository
evidence into the design:

- Small work: the final chat design is enough.
- Medium or large work: write
  `~/.vs/$PROJECT_ID/specs/YYYY-MM-DD-<topic>-design.md`.
- Include Problem, Solution, Terminology, Boundaries, Decisions, Testing,
  Out of Scope, Risks, Success Criteria, Goal Contract, and Execution Strategy.
- In Testing, prefer the highest existing behavioral seam. Name relevant test
  prior art; propose a new seam only when existing seams cannot prove success.

The Goal Contract is the stable handoff from shaping to building:

```markdown
## Goal Contract
- Implementation objective: <one observable outcome for /vs-build-it>
- Scope: <surfaces, workflows, files, or systems>
- Success criteria: <observable completion conditions>
- Verification: <tests, runtime evidence, CI, review, or acceptance checks>
- Evidence plan: <surface + route or command + state or fixture that will prove
  the outcome, or OPEN DECISION when no surface exists today>
- ADR: <path(s) to the decision record(s) build-it must honor, or None — reason>
- Constraints and approvals: <hard boundaries and human gates>
```

The Evidence plan is what the user is really deciding: how the result will be
judged. Name the concrete thing build-it will point a browser or a command at.
"Tests pass" is a guardrail, not evidence of the outcome.

If nothing today can prove the outcome, that is a strategic open decision — the
options are building a surface, accepting a weaker proof, or descoping. Carry it
into the closing interaction with a recommendation. Do not defer it to build-it
as a tactical detail; build-it will then head its handoff `UNPROVEN`.

Do not describe activities such as "implement the plan" as the objective. State
the achieved product or system outcome. A build agent should be able to create
or reuse its implementation goal from this section without reinterpreting the
conversation.

#### Design the execution strategy

Order work by what can invalidate or block delivery, not by architectural
layering:

1. Surface strategic decisions, user-provided access, credentials, approvals,
   and external ownership needed for proof before broad internal work.
2. Run the cheapest safe test of the assumption most likely to invalidate or
   reorder the design.
3. Deliver the smallest deployable vertical slice across the real integration
   boundary.
4. Deepen reliability, scale, and optional capabilities only after that slice
   is observable.

"Risk first" means retire delivery uncertainty early; it does not mean build
the largest defensive subsystem first. An inventory or foundation is an early
workstream only when its result changes a decision or unblocks the vertical
slice.

Every design names its execution class:

- **Direct:** one parent, one session, tightly coupled work. No issues or
  workers. This is the default for small work.
- **Orchestrated:** multiple independent domains, more than one session, risky
  evidence collection, or durable coordination. Include the blueprint below.

For orchestrated work, make the execution plan runnable rather than saying only
"use agents" or "parallelize":

1. Choose the source of truth. Use the spec alone for one durable orchestrator;
   add GitHub issues when work must be independently claimed, reviewed, or
   resumed by different people/sessions. Issues describe ready work, not open
   product decisions.
2. Choose concrete host primitives. Prefer subagents for bounded internal work
   under one orchestrator. Recommend Codex tasks/threads for durable user-visible
   ownership or long-running independent work; recommend Claude Code subagents
   in Claude Code. Do not invent a primitive the host does not provide.
3. Define workstreams with stable IDs. For each, name its outcome, owner
   primitive, reasoning effort, inputs, outputs, dependencies, write scope, and
   verification. Use low effort for deterministic inventory, medium for scoped
   implementation, and high or xhigh for ambiguous architecture, integration,
   security, or independent criticism. Name a specific model only when the host
   supports it and the choice materially helps.
4. Arrange waves. Parallelize only work with stable inputs and disjoint write
   scopes. Put foundations, integration, approval, and final verification behind
   explicit sequential merge gates. Fresh critics should run after evidence is
   normalized so they do not inherit worker assumptions.
5. Include copyable worker briefs for every delegated lane: objective, exact
   scope, evidence paths, constraints, expected return shape, and stop
   conditions. The parent owns integration, user communication, goal state, and
   final verification.
6. Render a Mermaid flowchart when there are at least three workstreams or two
   execution waves. Show parallel branches, merge gates, approval gates, and the
   final verification/handoff path.

Use this compact table in the spec:

```markdown
| ID | Outcome | Primitive | Effort | Inputs | Output | Depends on | Write scope | Verification |
|---|---|---|---|---|---|---|---|---|
```

The blueprint is a plan, not authorization. Do not create the issues, tasks,
threads, or implementation workers during shape-it.

#### Stress-test with pushback

Every explore session ends its independent beat by loading
[`../vs-pushback/SKILL.md`](../vs-pushback/SKILL.md) and running its composed
mode over the finished design, Goal Contract, and execution strategy. There is
no size threshold: a design small enough to survive the grill costs one short
pass, and the sessions that skip it are the ones that needed it.

Run it last, once the design is whole. Grilling a half-formed design produces
objections the remaining shaping would have answered anyway.

Composed mode is non-interactive by contract — it must not open question rounds
inside the independent beat. It answers its own dimensions from the design and
the evidence already gathered, records what the evidence cannot settle as
unresolved with severity, and returns `Verdict`, `Score`, and Top Pushback.

Then integrate before returning:

- fold supported findings into the design, spec, and Goal Contract rather than
  appending a critique section the user has to reconcile
- keep a finding you reject, with the reason it does not hold
- carry an unresolved high-severity finding, or any finding that exposes a
  strategic contradiction, into the closing interaction as a decision with a
  recommendation

Shape-it still owns synthesis, user communication, and the design. Pushback
supplies the verdict, not the plan.

### 3. Closing interaction

Return with the complete recommendation, evidence-driven changes from the
stress test, the Goal Contract, any drafted ADR, and any execution blueprint.
Show the ADR as a path plus its one-line decision, or state in one clause why
none was warranted; it is part of what the approval gate covers, not a follow-up
task. Make unresolved
strategic decisions conspicuous; for each, recommend one path and explain how
the alternatives change the outcome. Do not restart the interview or expose a
trail of tactical questions the independent phase already resolved.

Show the pushback result as one compact line — `Pushback: READY_WITH_RISKS
(72/100) — <weakest dimension>` — with the surviving high and medium findings.
Report it as the state of the design, not as a separate review to read.

A `NOT_READY` verdict does not block the approval gate, but it changes what is
being approved. Lead with the blocking finding and recommend reworking it before
`/vs-build-it`. Offer a full interactive `/vs-pushback` when the user wants to
defend the design in rounds; composed mode scored it without their answers.

Ask for approval once, after the whole design, Goal Contract, any ADR, and any
execution blueprint are visible. Approval means the artifact is ready for
`/vs-build-it`;
it does not itself start implementation.
Routing metadata does not replace or suppress the closing design.

If an unresolved strategic decision remains, combine it with this closing gate
when each option's consequences are already fully shaped: ask the user to
approve the recommendation or select an alternative. If their selection
requires redesign, return the revised complete design for approval rather than
pretending the earlier gate approved unseen work.

Recommend the smallest handoff that can execute the approved Goal Contract.

Default to the approved design or spec, then `/vs-build-it`. Extra coordination
must follow the execution class and blueprint above:

- **Durability:** propose issues when work spans sessions or people, needs a
  shared dependency graph, or must survive chat context. Distinguish unresolved
  decision issues from ready-to-build implementation issues; route only the
  latter to `/vs-to-issues`.
- **Parallelism:** propose host-native workers only for independent, bounded
  lanes. In Codex, prefer subagents under one orchestrator; propose tasks/threads
  for durable user-visible ownership. In Claude Code, propose subagents. If the
  host has no parallel primitive, recommend sequential execution. Name the
  concrete primitive; do not stop at generic “sessions,” “lanes,” or “agents.”
- **Both:** issues remain the source of truth; each worker references one issue.
- **Multi-milestone:** when the spec has several milestones expected to span
  hours or days and surface new facts, recommend `/vs-orchestrate`. It seeds a
  living GOALS.md from this spec's Goal Contract and Execution Strategy and
  drives one milestone at a time. The spec stays frozen; GOALS.md tracks the
  changing state.

```text
Execution: direct | orchestrated — <why>
Source of truth: spec | spec + GitHub issues — <why>
Runtime: parent only | parent + subagents | Codex tasks/threads | Claude subagents — <why>
Next: /vs-build-it with implementation objective: <objective>
      (or /vs-orchestrate when the spec is multi-milestone)
```

## Confusion

When strategic signals conflict during the opening or closing interaction, name
the conflict with recommended options. During independent shaping, record the
conflict, use a clearly provisional recommendation where safe, and continue
work that does not depend on it. Stop early only when no useful safe shaping can
continue. Do not silently choose between materially different outcomes.

## Verification

Before finishing, check:

- no implementation, issues, tasks/threads, or implementation workers were created
- named sources and enough nearby evidence were read before asking answerable questions
- external research either ran with its finding cited, or was skipped with a stated reason
- pushback ran in composed mode over the finished design and returned a verdict
  and score, and its supported findings were folded into the design
- the cadence was opening interaction, uninterrupted independent shaping, then closing interaction
- the design has one approval gate and a behavioral verification seam
- the first delivery is the smallest complete vertical slice, with later
  capabilities explicitly deferred
- the first delivery advances the approved outcome beyond the confirmed baseline
- user-dependent blockers and plan-invalidating assumptions are tested before
  broad internal foundations
- the Goal Contract states an observable outcome, scope, success, and proof
- the Goal Contract names an Evidence plan, or marks it OPEN DECISION and
  surfaces it in the closing interaction
- the ADR question was resolved with a stated outcome: a drafted `adr/<slug>.md`
  named in the Goal Contract, or a one-clause reason none was warranted
- unresolved strategic ambiguity is explicit
- direct work has no coordination overhead
- orchestrated work has bounded workstreams, effort, dependencies, merge gates,
  worker briefs, and a diagram when the topology is non-trivial
- the handoff is runnable by build-it without relying on hidden chat context

Before the final handoff, apply
[Phase Boundaries](../vs-internal-shared/references/phase-boundaries.md). Keep
`Next` below as the semantic route; report a session action only when required
by that contract.

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** idea, rough plan, or question
**Next:** `/vs-build-it`
**Relevant:** `/vs-improve`
