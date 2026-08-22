---
name: vs-eval
description: "Use when asked to write PathGrade cases, static pins, live evals, exclusive contracts, or fixture-backed skill tests. Use when the user types /vs-eval."
---

# Eval

Write PathGrade cases that fail a skill which copies slogans and omits the
behavior. Building block.

## Flow Contract

- **Kind:** Building block
- **Inputs:** A skill change, a hypothesized contract, and the existing eval style in this repo
- **Outputs:** `*.static.eval.ts` and/or `*.eval.ts` plus fixtures that can fail; status of the pin
- **Status:** PINNED, LIVE, WARN, or BLOCKED
- **Consumers:** Skill authors, `/vs-try-skill` dogfood, `/vs-ship-it` before a skill PR
- **Skip conditions:** Skip when the change is not a skill or eval contract (plain app code with ordinary unit tests)

## Choose static pin or live eval first

- Static pin: files named `*.static.eval.ts` assert SKILL.md wording.
  Run `npm run eval:static`. No agent and no tokens.
  Write this when the contract is wording the skill must keep.
- Live agent CASE: files named `*.eval.ts` that call createAgent score a
  transcript. Run `npm run eval` or `npm run eval` scoped to one file.
  Write this when the contract is what the agent does after reading the skill.

Exclusive split: do not write a live CASE for a phrase that SKILL.md can
assert. Do not write a static pin for a first-turn question, a tool call, or a
transcript shape.

Do not invent a new PathGrade runner. Prefer the `npm run eval*` scripts so
vitest.config.ts timeouts stay consistent.

## Exclusive wording, not mention-only matchers

`toMatch(/self-audit/)` goes green if the skill copies the slogan. That is not
a contract. Do not treat a mention of exclusive, fixture, or self-audit as
enough.

Exclusive order: name the required behavior, pair every copied slogan with
`not.toMatch` on that slogan, then add the exclusive alternative that a
slogan-only skill fails.

A file that matches `test/fixtures/mention-only.static.eval.ts` fails the
catalog: it pins only `self-audit`, `exclusive`, and `fixture` and has no
`not.toMatch`.

A skill that matches `test/fixtures/slogan-only-skill.md` fails the catalog: it
recites exclusive / fixture / self-audit and omits `not.toMatch`, omits an
exclusive alternative, and omits a fixture that can fail a good mention plus
bad behavior.

Copy the matcher pattern from vs-shape-it close (`Chat is only this exclusive
4-item close` plus `not.toMatch` on the old close) and from vs-eli5
(`not.toMatch` compress the last explanation). Do not copy their content.

Match text across wraps with `\s+`. Do not relax an assertion to make it pass.

## Fixture that can fail good mention plus bad behavior

A fixture is not a second slogan. It is a disk sample the skill must reject,
and the skill text must not contain the fixture canaries.

Prose example (`/vs-write`, do not edit that skill here): a fixture holds In
conclusion / Overall. The pin requires ending on the last concrete fact, says
a matching draft fails the audit, and `not.toMatch` those closers in SKILL.md.

Code example (`/vs-deslop`, do not edit that skill here): a fixture holds a
non-throwing try/catch tell. The pin says a matching file fails the catalog,
and `not.toMatch` that canary in SKILL.md.

If the fixture only names self-audit and the skill also names self-audit, the
pin cannot fail. Put the bad tell in the fixture; put the reject rule and the
`not.toMatch` in the CASE.

## Line ceilings

When a skill already pins `toBeLessThanOrEqual(N)` on SKILL.md line count,
stay at or under N. `/vs-write` uses 240. Do not grow a skill to vendor a
reference corpus. Do not invent a ceiling a skill does not already pin.

## PathGrade commands - do not edit PathGrade

```bash
npm run eval:static
npm run eval
npm run eval -- skills/vs-shape-it/test/shape-it.eval.ts
npm run eval:preview
```

`npm run eval:static` is the edit loop. `npm run eval` spends tokens on live
agents; scope it.
Do not edit PathGrade: not wix-private/pathgrade, not `@wix/pathgrade`, not
node_modules/@wix/pathgrade source, not .pathgrade internals. Change only
skill text, fixtures, and `*.eval.ts` / `*.static.eval.ts` beside the skill.

## Output style

Apply the shared output style at ../vs-internal-shared/references/output-style.md to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** skill change | failing pin
**Next:** done
**Relevant:** none
