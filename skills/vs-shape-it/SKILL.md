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
a decision record when one is warranted, a goal-ready execution blueprint,
and a closing `/vs-eli5` HTMDX of the spec. Writing an ADR is a decision record, not implementation, and is allowed. The eli5 is a short review of the spec so the user can confirm it, not a replacement for the spec and not implementation.
</HARD-GATE>

## Route the input

Infer the route; do not ask the user to choose a mode.

- **Explore:** vague idea, open question, or no chosen approach. This is the
  default; follow the workflow below.
- **Guided Explore:** the user says `interview me`, `ask me questions`,
  `question me`, or `grill me` and wants to work through their own idea. Follow
  Explore, but use the adaptive interview cadence in the opening interaction.
- **Challenge:** formed plan, spec, or RFC, or an explicit request to grill,
  challenge, or stress-test the proposal itself. Delegate to `/vs-pushback`; do
  not duplicate its scoring and verdict workflow here. `Grill this plan` is
  Challenge; `grill me — question me` is Guided Explore.

If the initial route was wrong, pivot immediately.

All routes end in pushback. Explore and Guided Explore run it as the last step
of independent shaping, then the close-time eli5. Challenge hands the whole
session to pushback in interactive mode; pushback composes the close-time
`/vs-eli5`. Shape-it does not compose a second one.

For Explore, use the shared
[`context-docs.md`](../vs-internal-shared/references/context-docs.md) protocol
for project language. Shape-it owns the question rounds, design, ADR outcome,
and any resolved glossary updates; do not open a separate context interview.

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

Before asking the first question, resolve and read the applicable
`CONTEXT-MAP.md`/`CONTEXT.md` using the shared context-docs protocol, then use
its canonical language. Ask about unresolved strategic choices only; do not
ask the user to restate a term the glossary or nearby code already settles.

Discover the active workspace, repository, and existing artifacts from the host
and current directory. Ask for an evidence location only when it cannot be
discovered or accessed and choosing the wrong one would materially change the
design; ordinary navigation is not a strategic question.

Every Explore session crosses an explicit alignment checkpoint before
independent shaping. In the default route, ask up to 3 high-leverage strategic
questions in one round. Even when the direction sounds settled, ask one
question about the least-supported expensive-to-reverse assumption instead of
silently treating the agent's interpretation as alignment.

Skip the question only when the user explicitly asks for no questions, or the
current conversation already contains explicit answers for the outcome,
boundary, and proof of success. In that case, reflect those settled decisions
in one short alignment statement before independent shaping. Repository facts
and ordinary navigation never count as user alignment.

When choosing questions, use only the lenses that remain unresolved:

- **Problem and outcome** — what should change, for whom, and why it matters
- **System boundary and ownership** — where the responsibility belongs
- **Kill criterion** — what evidence would make this not worth building

Do not ask all three by rote or spend a slot on a lens the evidence already
settles.

#### Guided Explore interview

Use this cadence only for Guided Explore. It is deliberately more interactive
than the default batched checkpoint:

1. Start with a brief assessment of what is known, what remains undecided, and
   the likely decision areas. Show the compact phase map
   `Align → Evidence → Design → Challenge → Handoff`, with the current phase
   and the number of resolved and open decisions. Do not show a percentage,
   time estimate, target question count, or empty progress bar.
2. Ask one consequential strategic question at a time. Lead with a Why tldr
   (one line: what the user loses if they pick wrong), then the recommended
   answer, then wait. Always include Drill (`eli5`) as the last option.
   Compose `/vs-eli5` on that question's tradeoff only if they pick it.
3. Branch from each answer: skip decisions it settles and inspect the code or
   named evidence yourself when a fact can answer the next question.
4. Accept `done`, `skip`, `back`, `?`, and `eli5`. `skip` accepts the stated
   reversible default for the current question; `?` defers it as an open
   decision; `eli5` drills this question's tradeoff with `/vs-eli5` and waits
   for A/B after; `back` revisits the previous answer and updates dependent
   decisions. If the user says `done`, preserve remaining uncertainty as
   explicit open decisions with recommendations.
5. Stop interviewing once outcome, boundary, success proof, and the
   expensive-to-reverse choices are clear. Reflect the agreed mental model in
   no more than three bullets. If a fundamental part of that model remains
   ambiguous, ask a single confirmation question; otherwise state the aligned
   model and enter the uninterrupted independent beat without another gate.
6. Update progress only when a decision changes state. During alignment, show
   resolved and open decisions; do not turn progress into a fixed questionnaire.

Do not turn Guided Explore into a fixed questionnaire. Progress means resolved
decisions, not a target question count. The user supplies priorities and
trade-offs; the agent supplies facts, code reading, and recommendations.

For either cadence, render questions through the host's structured question
tool when available
  (`request_user_input` in Codex, `AskUserQuestion` in Claude Code); see
  [internal-shared](../vs-internal-shared/SKILL.md) Structured questions. Fall
  back to the Markdown format below otherwise. In Codex, when
  `request_user_input` is listed, call it rather than rendering the fallback.

For the default batched checkpoint:

- Batch only independent questions; every question in the round must be
  answerable without the others' answers. If a question depends on an earlier
  answer, state the dependency inline or infer a reversible default later.
- Keep the question turn under about 60 words per question.
- State the decision in everyday language before presenting options. Make clear
  what changes for the user; do not make them decode architecture or workflow
  labels to answer.
- Every question has a Why tldr: one line, user-world stake if they pick
  wrong. It is not a call to `/vs-tldr`.
- Every question ends with the same Drill option: compose `/vs-eli5` on
  that question's tradeoff and open the html. Do not open it unless they
  pick Drill. In the text fallback it is always `D. Drill — /vs-eli5 this
  tradeoff`. In the structured tool it is the last option, same label.
  `1D` or `eli5` drills that question, then wait for A/B/C.
- Recommend a path for every choice; put it first and label it the default. In
  the text fallback, make it option `A`.
- Accept batched replies like `1A, 2B`; a bare `A` or `yes` accepts every
  recommendation.
- Infer tactical details and state safe defaults briefly.
- Spend one of the three questions on external research only when the design
  could proceed without it and the lookup would cost real time. When the need is
  clear, run it in the independent beat instead of asking.

Guided Explore calls the structured tool once per question and waits for the
answer. It does not use the batched-reply shortcut or the multi-question
fallback below.

```markdown
## Decisions needed

### 1. <short decision title>

**Why:** <one-line tldr of the user-world stake if they pick wrong>

**Recommended: A — <choice>** — <one-clause rationale>

- A. <choice> — <consequence>
- B. <choice> — <consequence>
- C. <choice> — <consequence>
- D. Drill — `/vs-eli5` this tradeoff

### 2. <short decision title>

...

Reply `A` to accept every recommendation, `1D` to drill question 1, or
specify changes such as `1B, 2A`.
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
[2/3] I’m checking <sources> and comparing the viable options; <N> decisions still need you.
```

Do not turn these into questions. They report state; they do not request input.

#### Gather evidence

Read relevant repository docs, nearby code, screenshots, and prior artifacts
needed to test the aligned direction. Check
`~/.vs/$PROJECT_ID/{pushback,specs,context,rfcs}/` when relevant, resolving
`$PROJECT_ID` per [internal-shared](../vs-internal-shared/SKILL.md).
When the topic has project-specific language, also read the applicable
`CONTEXT.md` or `CONTEXT-MAP.md` using
[`../vs-internal-shared/references/context-docs.md`](../vs-internal-shared/references/context-docs.md).
If a term resolves during this session, update the selected glossary inline
according to the shared context-docs protocol; do not create an empty context
file merely because context support was loaded.

Start with sources the user named and the nearest relevant implementation. Do
not inventory the repo or launch broad research until a specific design question
requires it. Stop when more reading is unlikely to change the next decision.

For multi-domain or high-risk work, delegate only independent planning lanes,
such as one bounded evidence inventory and one fresh adversarial critique. The
parent keeps user alignment, decisions, synthesis, and goal ownership. Do not
delegate the interview or ask several agents to design the same whole solution.

#### Architecture evidence

Before Design, load and follow
[`../vs-architect/SKILL.md`](../vs-architect/SKILL.md) in composed mode when all
of these are true:

- an existing implementation is in scope;
- the design changes module responsibilities, interfaces, seams, coupling, or
  consolidation;
- the recommendation depends on understanding current callers and tests;
- no current architect result already covers the scoped area.

Scope architect to the affected flow or package. It returns evidence and vetted
candidates to shape-it; it does not open its standalone candidate-selection gate.
Use the top candidate as evidence, preserve credible alternatives, and surface
only strategic candidate choice through shape-it's normal interaction.

Skip architect for greenfield work, local implementation choices, and an
already approved design or spec. A recorded design is the source of truth until
the user requests a revision or implementation evidence invalidates it.

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

Load and apply the shared
[`minimum-solution` gate](../vs-internal-shared/references/minimum-solution.md).
Use it to minimize concepts, interfaces, dependencies, and coordination in the
first slice; never use it to reduce evidence, verification, safety, or an
explicit requirement.

Lead with the recommended approach and why. Keep the core chat design under
about 450 words, excluding a justified orchestration appendix, and include:

- the smallest valuable, deployable end-to-end slice
- scope and explicit non-goals
- terminology and system boundaries
- data/control flow and important interfaces
- failure modes, degradation/recovery, and ownership when the design crosses a
  runtime or operational boundary
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

For an ADR connected to a context decision, also follow the context-document
storage rules so an existing in-repo or per-user preference is not overridden.
The glossary records vocabulary; the ADR records the durable trade-off.

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
- Context: <glossary path(s) updated or read, or None — reason>
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

#### Self-review the design

Review the final integrated design, Goal Contract, any ADR, and execution
strategy. Fix issues directly rather than handing editorial cleanup to the user:

- **Placeholder scan** — remove any TBD, TODO, placeholder, or incomplete
  section
- **Internal consistency** — align the architecture, Goal Contract, ADR, and
  execution strategy
- **Scope check** — keep one buildable outcome or decompose work that cannot
  share one contract
- **Ambiguity check** — choose one interpretation or surface a strategic open
  decision

Do not repeat the review after fixing these issues; continue to the closing
interaction.

### 3. Closing interaction

Explore and Guided Explore only. Challenge does not compose `/vs-eli5` here;
pushback does that close.

Before composing the closing interaction, follow
[`../vs-internal-shared/references/explanation-surfaces.md`](../vs-internal-shared/references/explanation-surfaces.md)
for chat TLDR vs artifact. The close-time eli5 is required even when that
complexity test would keep the answer in chat: the user is confirming a spec.

On Explore and Guided Explore, always compose [`/vs-eli5`](../vs-eli5/SKILL.md) on the spec or plan, including
a `NOT_READY` close — the pictures should show the block. Do not skip the eli5
for a small or routine shape. The eli5 is a short picture review of that spec
so the user can confirm it. The Markdown spec, Goal Contract, and any ADR stay
the thing they approve and the machine source of truth; link them from the
eli5. Do not treat the eli5 as a replacement contract.

After `/vs-eli5` returns `Saved:`, open that `.html` immediately. Do not wait
for the user to click the path:

```bash
open "$ARTIFACT_PATH" 2>/dev/null || xdg-open "$ARTIFACT_PATH"
```

If open fails, say so in one line and still give the `file://` path.

Chat is only this exclusive 4-item close, in this order:

1. The first sentence is the TLDR: the recommendation in plain English and why it is the
   best fit. Translate verdicts and agent terms into what changes for the user.
2. The opened eli5.
3. `Handoff: Goal Contract ready | <N> open decisions` (or the missing field).
4. One `Your action` approval line, plus the shortest exact reply that accepts.

Do not paste the Goal Contract, ADR, pushback report, execution blueprint, or
the `Execution:` block into chat. Those live in the linked files and the eli5.
Routing metadata does not replace or suppress the closing design.

Put the complete recommendation and all of the following in the linked files, not in chat:

- the complete recommendation, stress-test changes, and any ADR (path plus
  one-line decision, or one clause why none was warranted)
- unresolved strategic decisions, each with one recommended path and how
  alternatives change the outcome
- the pushback result as the state of the design, one compact sentence plus
  surviving high and medium findings (`The design is ready to build, with one
  open rollout risk (READY_WITH_RISKS).`)
- the sharpest supported reason the recommendation can fail, with cause and user consequence; a generic risk label is not enough
- a `NOT_READY` verdict does not block the approval gate; the spec and eli5 lead with the blocking finding and recommend rework
  before `/vs-build-it`; offer interactive `/vs-pushback` if they want to
  defend it in rounds
- the smallest handoff that can execute the approved Goal Contract, default
  `/vs-build-it`, plus the execution class below

Keep one approval request. Ask for approval once, after the whole design, Goal Contract, any ADR, and any
execution blueprint are visible in those files. Approval means ready for
`/vs-build-it`; it does not start implementation. If an unresolved strategic
decision remains and each option is already shaped, combine it with this gate.
If their pick needs redesign, return a revised complete design.

Default to the approved spec, then `/vs-build-it`. Extra coordination follows
the execution class written in the spec, not in chat:

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

Write that block in the spec. Do not print it in chat.

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
- the completed design passed placeholder, consistency, scope, and ambiguity review
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
- resolved project vocabulary was written inline to the applicable glossary,
  or no context file was created because no term crystallised
- `CONTEXT.md` contains vocabulary only, with no implementation detail or spec
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
**Relevant:** `/vs-improve` | `/vs-eli5`
