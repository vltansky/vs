---
name: vs-decide-for-me
description: "Use when the user says decide-for-me, answer it yourself, or only ask strategic questions. Resolves tactical uncertainty before interrupting."
---

# VS Decide For Me

Meta-skill for preserving user attention. Resolve what you can yourself. Ask only when the user is the only correct source of truth.

This skill layers onto the active task. It does not replace the domain skill. It changes the escalation threshold.

## Principle

Treat the user's attention as scarce and expensive.

- Tactical questions are the agent's job.
- Factual questions should be verified, not offloaded.
- Strategic questions belong to the user.

## Decision Ladder

For every uncertainty, use this order:

1. **Decide locally**
2. **Verify locally**
3. **Verify with a subagent**
4. **Ask the user**

Do not skip straight to step 4 unless the issue is clearly strategic.

## Core Behavior

For each open question, do two things:

1. **Analyze whether the answer can be produced responsibly**
2. **Choose the owner of the decision**

Decision rule:

- If the question can be answered from local evidence, direct verification, or subagent research, answer it yourself.
- If the question cannot be answered objectively and it changes intent or tradeoffs, escalate it to the user.

The skill is not just "ask less." It is "decide who should answer, then either decide locally or escalate cleanly."

## Flow Contract

- **Kind:** Building block
- **Inputs:** Active task context plus the uncertainty, decision, or potential user question that would otherwise interrupt the workflow
- **Outputs:** Either a compact decision log entry, or a `Strategic question:` escalation block
- **Status:** `DECIDED` when the agent proceeds, `DECIDED_WITH_RISK` when the agent proceeds with a reversible caveat, `ESCALATED` when user judgment is required, `BLOCKED` when a stricter task boundary forbids proceeding
- **Consumers:** `vs:build-it`, `vs:afk`, `vs:fix-pr`, `vs:shape-it`, and any workflow that promises low user interruption
- **Skip conditions:** Skip when the active skill has a stricter explicit ask-before-action rule, or when the user has asked for interactive planning/review

Calling flows should log decide-for-me decisions in their own decision log or handoff so the user can audit what happened without being interrupted.

## Step 1: Classify the question

Classify every uncertainty before deciding:

- **Tactical** — implementation mechanics, naming, fixture shape, sequencing, cheap defaults
- **Evidential** — answerable by reading files, running commands, checking docs, or asking a subagent
- **Strategic** — changes product intent, behavior semantics, success criteria, or business tradeoffs
- **Dangerous** — writes outside the repo, costs money, posts externally, changes production, deletes data, rewrites history, or creates visible side effects for other people
- **Blocked** — cannot be resolved because permissions, missing credentials, unavailable services, or stricter task boundaries forbid progress

### Ask the user only if it changes:

- product intent
- behavior semantics
- evaluation philosophy
- success criteria
- business tradeoffs
- expensive-to-reverse architecture or scope
- dangerous or externally visible operations not already approved

### Do NOT ask the user about:

- fixture layout
- eval file structure
- wording tweaks
- prompt placement
- iteration tactics
- sequencing
- implementation mechanics
- cheap, reversible defaults

If it is tactical, own it.

If it is dangerous, escalate unless the current task explicitly pre-approves that category and scope.

## Step 2: Resolve it yourself first

Use the cheapest sufficient method.

### Local verification

Use this first for cheap questions:

- read the relevant files
- search the codebase
- inspect existing patterns
- run one targeted command
- run one eval or test
- compare nearby implementations

If a 2-minute check answers it, do not escalate.

### Subagent verification

Bias toward using subagents when these are true:

- **Independent** — the subtask can be answered without back-and-forth with the main reasoning thread
- **Objective** — the output is evidence, not taste or product judgment
- **Token-saving** — delegation is cheaper than the main agent doing the same exploration inline

If a question fits this shape, prefer delegating it instead of asking the user.

Good subagent cases:

- edge-case discovery
- prior art lookup
- existing pattern search across a repo
- interaction risk between two changes
- blast-radius analysis
- "what assumption am I missing?"

Subagents are for evidence gathering, not for punting judgment.

Do not use a subagent for:

- obvious tactical choices you can make yourself
- questions about user taste or business preference
- issues that one direct verification run can settle
- tightly coupled reasoning where the main agent still has to reconstruct the whole chain
- exploratory delegation that costs more tokens than it saves

## Step 2.5: Decide when evidence is sufficient

After local checks or subagent research, explicitly decide:

- **Can I answer this now with evidence?**
- **Would asking the user add signal or just move work onto them?**

If the answer is evidential and sufficiently supported, decide it.

Use this compact decision log pattern:

```text
Decision:
- Split the evals by concern.

Classification:
- Evidential / tactical.

Status:
- DECIDED.

Why:
- Shared fixtures create scorer coupling and make autoresearch optimize two concerns at once.

Evidence:
- The redaction and taxonomy changes use different prompts, success criteria, and optimization paths.

Risk:
- Low. Reversible file organization choice.

Proceeding without user interruption.
```

## Step 3: Make a default when safe

If the choice is reversible or cheap to verify:

- choose the most conservative reasonable default
- state the assumption briefly
- mark the status as `DECIDED` or `DECIDED_WITH_RISK`
- continue

Do not stop the workflow just to externalize uncertainty.

### Workaround equivalence test

When the direct path is blocked, use a workaround only if all are true:

- it preserves the user's intended outcome
- it does not create a dangerous or externally visible side effect
- it is easy to reverse or clearly documented
- it does not hide a failure the user needs to know about

If the workaround changes the outcome materially, mark `BLOCKED` or `ESCALATED` instead of silently proceeding.

### High-stakes doubt gate

Before deciding alone on a non-trivial high-stakes issue, run a quick adversarial check yourself or with a subagent.

Use this gate when a decision:

- affects security, privacy, data integrity, production, billing, or public API behavior
- crosses a module, service, or ownership boundary
- depends on an invariant the type system or tests cannot prove
- is expensive to reverse

If the doubt pass finds a real unresolved risk, escalate. If the risk is real but reversible and proceeding still matches the user's intent, mark `DECIDED_WITH_RISK` and log the risk.

## Step 4: When you finally ask the user

Ask only if all of these are true:

- the issue is strategic
- local verification did not settle it
- a subagent would not settle it cheaply
- a wrong assumption would be costly

Always ask when the unresolved choice is dangerous and not pre-approved.

When asking:

- ask at most 1-2 questions in a turn
- include your recommendation
- explain why the question is worth user time
- separate strategic choices from implementation details

Escalation format:

```text
Strategic decision needed:
- [the question]

Why this needs you:
- [why research cannot answer it objectively]

Recommendation:
- [best default recommendation]

Tradeoffs:
- Option A: ...
- Option B: ...
```

## Output Contract

When this skill is active, keep interruptions low and make your ownership visible.

If no user question is needed, prefer a short note like:

```text
Decisions:
- Split evals by concern to avoid optimizer coupling. Status: DECIDED.
- Seed the high-priority instruction before running autoresearch. Status: DECIDED_WITH_RISK; risk is limited to prompt iteration churn.
Proceeding without user interruption.
```

If a user question is needed, prefer:

```text
Strategic question:
- Should SLOP be a severity tier or a cross-cutting tag?

Why this needs you:
- Research can show existing patterns, but it cannot choose the review semantics you want this taxonomy to encode.

Recommendation:
- Use SLOP as a tag. Severity should still reflect impact.

Why I'm asking:
- This changes the meaning of the review taxonomy, not just the implementation.
```

## Guardrails

- Do not use this skill as an excuse to make silent product decisions.
- Do not ask tactical questions just because you feel uncertain.
- Do not turn subagents into a ritual; use them when they materially reduce user interruption.
- If the current task already has a stricter "ask before X" boundary, obey that boundary.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** any task where the user wants less interruption
**Next:** done
**Relevant:** `/vs-build-it` | `/vs-orchestrate`
