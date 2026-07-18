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
and a goal-ready execution blueprint.
</HARD-GATE>

## Route the input

Infer the route; do not ask the user to choose a mode.

- **Explore:** vague idea, open question, or no chosen approach. This is the
  default; follow the workflow below.
- **Challenge:** formed plan, spec, or RFC, or an explicit request to grill,
  challenge, or stress-test. Delegate to `/vs-pushback`; do not duplicate its
  scoring and verdict workflow here.

If the initial route was wrong, pivot immediately.

When Codex goal tools are available, follow
[Codex Goal Integration](../vs-internal-shared/references/codex-goal.md).
Shape-it owns only the planning goal, never the later implementation goal.
For work that may benefit from delegation, load and follow
[Subagent Orchestration](../vs-internal-shared/references/subagents.md).

## Explore workflow

### 1. Gather evidence

Read relevant repository docs, nearby code, screenshots, and prior artifacts
before asking anything they can answer. Check
`~/.vs/$PROJECT_ID/{pushback,specs,context,rfcs}/` when relevant, resolving
`$PROJECT_ID` per [internal-shared](../vs-internal-shared/SKILL.md).

Start with sources the user named and the nearest relevant implementation. Do
not inventory the repo or launch broad research until a specific design question
requires it. Stop when more reading is unlikely to change the next decision.

For multi-domain or high-risk work, delegate only independent planning lanes,
such as one bounded evidence inventory and one fresh adversarial critique. The
parent keeps user alignment, decisions, synthesis, and goal ownership. Do not
delegate the interview or ask several agents to design the same whole solution.

### 2. Clarify once

If intent, constraints, success criteria, or an expensive-to-reverse choice is
still unclear, ask up to 3 strategic questions in one round. Otherwise state
the assumptions and continue without interviewing again.

- Render the round through the host's structured question tool when available
  (`AskUserQuestion` in Claude Code); see [internal-shared](../vs-internal-shared/SKILL.md)
  Structured questions. Fall back to the text format below otherwise.
- Batch only independent questions; every question in the round must be
  answerable without the others' answers. If a question depends on an earlier
  answer, state the dependency inline or save it for a rare second round.
- Keep the question turn under about 60 words per question.
- Recommend a path for every choice; make it option `A` and the default.
- Accept batched replies like `1A, 2B`; a bare `A` or `yes` accepts every
  recommendation.
- Infer tactical details and state safe defaults briefly.
- After the reply, move to design unless a real contradiction remains.

```text
Question 1 of N: ...
Recommendation: A
Options: A) [recommended default] B) ... C) ...

Question 2 of N (independent of Q1): ...
...
```

### 3. Design

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

For an expensive-to-reverse repo-level decision, recommend an ADR. Follow the
repo convention, or suggest slug-only files under `adr/` and `/vs-setup-adr`.
Name the decision, alternatives, and rationale so implementation can record it.

### 4. Stress-test alignment

For large, cross-domain, or expensive-to-reverse work, use a fresh planning
critic before final approval. Give it the proposed design, evidence paths, and
the exact uncertainties to attack; do not give it implementation ownership.
Integrate supported findings into the design. Ask the user again only when a
finding exposes a strategic contradiction or materially different outcome.

Use `/vs-pushback` for a formed proposal that needs the full interactive verdict
workflow. Shape-it still owns synthesis of an explore-session design.

### 5. Finalize the spec

Do not restart the interview. Synthesize the conversation and repository
evidence into the design:

- Small work: the approved chat design is enough.
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
- Constraints and approvals: <hard boundaries and human gates>
```

Do not describe activities such as "implement the plan" as the objective. State
the achieved product or system outcome. A build agent should be able to create
or reuse its implementation goal from this section without reinterpreting the
conversation.

### 6. Design the execution strategy

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

### 7. Approve and hand off

Ask for approval once, after the whole design, Goal Contract, and any execution
blueprint are visible. Approval means the artifact is ready for `/vs-build-it`;
it does not itself start implementation.

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

When strategic signals conflict, stop and name the conflict with recommended
options. Do not silently choose between materially different outcomes.

## Verification

Before finishing, check:

- no implementation, issues, tasks/threads, or implementation workers were created
- evidence was read before asking answerable questions
- the design has one approval gate and a behavioral verification seam
- the first delivery is the smallest complete vertical slice, with later
  capabilities explicitly deferred
- the first delivery advances the approved outcome beyond the confirmed baseline
- user-dependent blockers and plan-invalidating assumptions are tested before
  broad internal foundations
- the Goal Contract states an observable outcome, scope, success, and proof
- unresolved strategic ambiguity is explicit
- direct work has no coordination overhead
- orchestrated work has bounded workstreams, effort, dependencies, merge gates,
  worker briefs, and a diagram when the topology is non-trivial
- the handoff is runnable by build-it without relying on hidden chat context

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** idea, rough plan, or question
**Next:** `/vs-build-it`
**Relevant:** `/vs-improve`
