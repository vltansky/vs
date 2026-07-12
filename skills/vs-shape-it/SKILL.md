---
name: vs-shape-it
description: "Use when the user says shape it, brainstorm, explore this idea, grill this, or wants to turn an idea into a buildable design."
---

# Shape It

Turn loose ideas and rough plans into buildable designs. Keep the chat output
short and decision-focused; the human makes the calls.

<HARD-GATE>
Do NOT write code, scaffold projects, or invoke implementation skills. Output is
questions, design, or stress-test only.
</HARD-GATE>

## Pick the mode

Infer mode from the input. Do not ask which mode.

- **Explore**: vague idea, open question, no chosen approach. This is the default.
- **Challenge**: formed plan/spec/RFC, or the user says grill, challenge, or stress-test.

If you guessed wrong, pivot immediately.

## Codex Goal Integration

When running in Codex, use the shared Codex goal guidance from
`vs-internal-shared` for goal-ready output shape.

Shape-it may own a **planning goal** for the shaping session, but it does not
create or complete the later implementation goal. Its output should be fit for
the next workflow's goal:

- one concise implementation objective
- scope and explicit non-goals
- success criteria
- verification plan

Complete a planning goal only after the design/spec or challenge verdict is
reported and the next implementation objective is clear.

## Explore mode

First reply: ask 1-2 blocking questions immediately, before tools or file reads.
Do not propose a solution yet. If the conversation already contains intent,
constraints, and success criteria, state the assumptions and continue instead of
interviewing again.

Question rules:

- Keep question output tiny: under about 120 words for the first reply, and under
  about 90 words for later clarification turns.
- Ask only strategic questions that change purpose, constraints, success criteria,
  or expensive-to-reverse architecture.
- If code, docs, screenshots, or prior artifacts can answer it, inspect them after
  the first reply instead of asking.
- Make safe defaults for tactical details; state them briefly.
- Use one clarification round. After the user's reply, infer the rest and move to
  design unless there is a true contradiction.
- Include your recommendation when asking a choice.
- Make the recommended path option `A` and label it as the default. If the user
  replies `A`, `yes`, `recommended`, or similar, treat it as acceptance and
  continue.
- Number the round as `Question 1 of N`, where `N` is the number of questions in
  this clarification round. For one question, write `Question 1 of 1`.
- Do not output long question inventories, background analysis, or sectioned
  questionnaires. Use this shape:

```text
Question 1 of N: ...
Recommendation: A
Options: A) [recommended default] B) ... C) ...
```

Context intake:

- Check prior artifacts when relevant:
  `~/.vs/$PROJECT_ID/{pushback,specs,context,rfcs}/` (resolve `$PROJECT_ID` per
  [../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md)).
- Explore code and docs lazily, only where it changes the design.

Design output:

- Keep the default chat design under about 450 words.
- Lead with the recommended approach and why.
- Include 1-2 alternatives with tradeoffs; use 3 only for genuinely complex work.
- Cover scope, boundaries, data/control flow, risks, and verification.
- When the design settles a durable, repo-level architecture call (a tradeoff
  that is expensive to reverse and future readers will ask "why did we do it
  this way"), recommend capturing it as an ADR. Follow the repo's ADR
  convention if one exists; otherwise suggest `adr/` at the repo root with a
  slug-only filename, and `/setup-adr` to bootstrap scaffolding. Name the
  decision, the alternatives, and the chosen rationale so `/vs-build-it` can
  write the ADR during implementation.
- Ask for approval once at the end. No section-by-section gates.
- If the design depends on a performance claim, load [../vs-perf/SKILL.md](../vs-perf/SKILL.md)
  when available and define the metric/evaluator before calling it build-ready.

Spec writing:

- Small work: a verbal design is enough.
- Medium/large work: write
  `~/.vs/$PROJECT_ID/specs/YYYY-MM-DD-<topic>-design.md`, then return only a short
  summary and the path in chat.
- Specs must include `Terminology` and `Boundaries` sections.
- For large work, after approval, switch to Challenge mode automatically.

## Challenge mode

Use `/vs-pushback` when the host can invoke it. If not, run a compact stress-test
yourself:

- challenge the premise
- name key assumptions
- check feasibility
- probe edge cases
- give `Verdict: READY | READY_WITH_RISKS | NOT_READY`
- give `Score: <n>/100`
- list the top 3 risks and the recommended next step

If the verdict is `NOT_READY`, help rework the idea in Explore mode. If it is
ready enough, suggest `/vs-build-it`.

## Confusion

When signals conflict, stop and name the conflict:

```text
CONFUSION:
[specific conflict]
Options:
A) [first interpretation + consequence]
B) [second interpretation + consequence]
C) Ask - I should not decide this alone
```

## Verification

Before finishing, check:

- no implementation happened
- mode was inferred or corrected
- Explore produced a design with tradeoffs and one approval gate
- Challenge produced a verdict and score
- unresolved strategic ambiguity is explicit
- next step is `/vs-build-it`, `/vs-pushback`, or rework

## Workflow

**Prev:** idea, rough plan, or question
**Next:** `/vs-build-it` when shaped, `/vs-pushback` when the plan needs adversarial review
