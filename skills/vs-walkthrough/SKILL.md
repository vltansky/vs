---
name: vs-walkthrough
description: "Use when explicitly invoked as walkthrough, /vs-walkthrough, or vs:walkthrough to show a scenario, explain a flow, or produce a concrete walkthrough."
disable-model-invocation: true
---

# Walkthrough

Turn a change, skill, feature, function, or workflow into a concrete walkthrough
the human can read, rehearse, or use as review evidence.

<HARD-GATE>
Do NOT implement, edit code, or invent behavior. Output is a walkthrough scenario
and evidence-backed explanation only.
</HARD-GATE>

## Mode

Infer the walkthrough target from the request:

- **Skill walkthrough**: show the conversation scenario that would trigger the
  skill, the agent's expected moves, and the user-visible outcome.
- **Flow walkthrough**: describe the end-to-end path, actors, state changes, inputs,
  outputs, and success/failure branches.
- **Function walkthrough**: explain what the function does as text, including
  inputs, outputs, side effects, and one realistic example call path.
- **Change walkthrough**: explain before/after behavior and the smallest scenario
  that proves the change matters.

If the target is ambiguous, pick the smallest useful mode and state the
assumption in one sentence.

## Evidence First

Before writing the walkthrough, inspect anything the repo can answer:

- referenced files, diffs, tests, docs, ADRs, or issues
- similar skills or functions nearby
- public contracts such as command names, API names, inputs, outputs, and error
  messages

Ask only when the missing answer changes the story the walkthrough must tell.

## Output

Keep the default output short and scenario-first. Lead with the walkthrough the
human can read or rehearse, then explain the mechanics and evidence.

```markdown
## Walkthrough

**Target:** ...
**Assumption:** ... (omit when obvious)

### Scenario
User/request/input: ...
System/agent/code path: ...
Visible result: ...

### Flow
1. ...
2. ...
3. ...

### Branches
- Success: ...
- Failure/edge: ...

### Follow-up scenarios
Recommendation: A
- A) ... (recommended)
- B) ...
- C) ...

### Proof signal
- Observable pass/fail: ...
- Command, scenario, or source that would prove it: ...

### Evidence
**Known**
- ...

**Inferred**
- ...

**Missing evidence**
- ...
```

For a skill walkthrough, make the scenario conversational:

```text
User: ...
Agent: ...
User: ...
Agent: ...
```

For a function walkthrough, prefer text over pseudo-code unless exact code
clarifies the behavior.

## Visualization

Default to text. You may offer ASCII diagrams, tables, or small HTML snippets
when they would make the walkthrough clearer, but ask for confirmation before
producing them because they cost more tokens.

## Quality Bar

- Use exact names from the repo for files, functions, commands, skills, events,
  and APIs.
- Separate known facts from inferred behavior. If anything is inferred, include
  `Known`, `Inferred`, and `Missing evidence` under `Evidence`.
- Include at least one edge or failure branch when the flow has one.
- Cover the main scenario first, then propose 2-3 follow-up scenarios that cover
  meaningful alternate paths or edge cases. Mark one as the recommended next
  walkthrough.
- For change walkthroughs, include a concrete proof signal: the command,
  scenario, or observable result that would show the change works.
- Do not add marketing copy, slides, or UI polish unless the user asks for a
  presentation artifact.
- If the change cannot be demonstrated from current evidence, say what evidence
  is missing and give the closest honest walkthrough.

## Canaries

- `Walkthrough this skill change` should produce a conversational scenario,
  expected agent moves, visible outcome, branches, follow-up scenarios, proof
  signal, and evidence.
- `Walk me through this function` should explain inputs, outputs, side effects,
  call path, proof signal, and evidence in text before offering visualization.

## Workflow

**Prev:** `/vs-shape-it`, `/vs-build-it`, `/vs-brief`, a diff, a function, or a rough idea
**Next:** `/vs-pushback` when the walkthrough exposes unclear intent, `/vs-build-it`
when the scenario is accepted and implementation is still needed
