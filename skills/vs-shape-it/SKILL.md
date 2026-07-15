---
name: vs-shape-it
description: "Use when the user says shape it, brainstorm, explore this idea, grill this, or wants to turn an idea into a buildable design."
---

# Shape It

Turn loose ideas and rough plans into approved, buildable designs. Keep the
conversation short and decision-focused; the human makes strategic calls.

<HARD-GATE>
Do NOT write code, scaffold projects, create issues or parallel work sessions,
or invoke implementation skills. Output is questions, design, stress-test, or
an optional handoff recommendation.
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

## Explore workflow

### 1. Gather evidence

Read relevant repository docs, nearby code, screenshots, and prior artifacts
before asking anything they can answer. Check
`~/.vs/$PROJECT_ID/{pushback,specs,context,rfcs}/` when relevant, resolving
`$PROJECT_ID` per [internal-shared](../vs-internal-shared/SKILL.md).

Start with sources the user named and the nearest relevant implementation. Do
not inventory the repo or launch broad research until a specific design question
requires it. Stop when more reading is unlikely to change the next decision.

### 2. Clarify once

If intent, constraints, success criteria, or an expensive-to-reverse choice is
still unclear, ask 1-2 strategic questions in one round. Otherwise state the
assumptions and continue without interviewing again.

- Keep the first question turn under about 120 words.
- Recommend a path for every choice; make it option `A` and the default.
- Infer tactical details and state safe defaults briefly.
- After the reply, move to design unless a real contradiction remains.

```text
Question 1 of N: ...
Recommendation: A
Options: A) [recommended default] B) ... C) ...
```

### 3. Design

Lead with the recommended approach and why. Keep the default chat design under
about 450 words and include:

- scope and explicit non-goals
- terminology and system boundaries
- data/control flow and important interfaces
- 1-2 alternatives with concrete tradeoffs
- risks, success criteria, and verification

When a cheap prototype would answer a costly design question, recommend
`/vs-prototype`. When a performance claim shapes the design, use `/vs-perf` to
define the metric and evaluator before calling it build-ready.

For an expensive-to-reverse repo-level decision, recommend an ADR. Follow the
repo convention, or suggest slug-only files under `adr/` and `/vs-setup-adr`.
Name the decision, alternatives, and rationale so implementation can record it.

### 4. Finalize the spec

Do not restart the interview. Synthesize the conversation and repository
evidence into the design:

- Small work: the approved chat design is enough.
- Medium or large work: write
  `~/.vs/$PROJECT_ID/specs/YYYY-MM-DD-<topic>-design.md`.
- Include Problem, Solution, Terminology, Boundaries, Decisions, Testing,
  Out of Scope, Risks, and Success Criteria.
- In Testing, prefer the highest existing behavioral seam. Name relevant test
  prior art; propose a new seam only when existing seams cannot prove success.

Ask for approval once, after the whole design. For large work, route the
approved design through `/vs-pushback` before implementation.

### 5. Recommend the handoff

Default to the smallest handoff: approved design or spec, then `/vs-build-it`.
Recommend extra coordination only when it materially helps:

- **Durability:** propose issues when work spans sessions or people, needs a
  shared dependency graph, or must survive chat context. Distinguish unresolved
  decision issues from ready-to-build implementation issues; route only the
  latter to `/vs-to-issues`.
- **Parallelism:** propose host-native workers only for independent, bounded
  lanes. In Codex, propose tasks/threads. In Claude Code, propose subagents. If
  the host has no parallel primitive, recommend sequential execution. Name the
  concrete primitive; do not stop at generic “sessions,” “lanes,” or “agents.”
- **Both:** issues remain the source of truth; each worker references one issue.

These are recommendations, not the default. Never create issues or workers
without explicit user approval.

```text
Coordination: none | issues | issues + Codex tasks/threads | issues + Claude subagents — <why>
```

## Confusion

When strategic signals conflict, stop and name the conflict with recommended
options. Do not silently choose between materially different outcomes.

## Verification

Before finishing, check:

- no implementation, issues, or parallel workers were created
- evidence was read before asking answerable questions
- the design has one approval gate and a behavioral verification seam
- unresolved strategic ambiguity is explicit
- the handoff is minimal; extra coordination is justified and optional

## Workflow

**Prev:** idea, rough plan, or question
**Next:** `/vs-build-it` by default; `/vs-pushback`, `/vs-prototype`, or
`/vs-to-issues` when the shaped work warrants it
