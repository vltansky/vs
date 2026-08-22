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
- **Outputs:** `*.static.eval.ts` and/or `*.eval.ts` plus fixtures that can fail; a `scripts/reject-*.mjs` workspace scorer when the contract is fixture content; status of the pin
- **Status:** PINNED, LIVE, WARN, or BLOCKED
- **Consumers:** Skill authors, `/vs-try-skill` dogfood, `/vs-ship-it` before a skill PR
- **Skip conditions:** Skip when the change is not a skill or eval contract (plain app code with ordinary unit tests)

## Workshop first

Ask 1-3 clarifying questions. Draft one scenario. Write eval code only
after the user accepts.

The live prompt tests skill behavior. It is a problem a real user would
type, not implementation steps.

Bad: "read SKILL.md then run X".
Good: the request a user would type to trigger the skill.

## Workspace scorer, not slogan pins

A writer following this skill emits `scripts/reject-*.mjs` that reads
fixture files and scores their content. Same CLI contract as `/vs-write`
and `/vs-deslop` (examples only; do not edit those skills here):

```bash
node scripts/reject-*.mjs <file-or-pair>
```

Exit 0 clean. Exit 1 reject. Exit 2 cannot check. Treat 2 as not
checked, not a pass.

The static CASE runs that script on fixtures. Do not make a slogan
`toMatch` the contract.

## Static pin vs live CASE

- Static pin (`*.static.eval.ts`): assert wording the skill must keep,
  **or** run the workspace scorer on fixtures. No agent and no tokens.
- Live CASE (`*.eval.ts`): score a transcript with PathGrade
  `createAgent` (from `vs-internal-shared/test/pathgrade-agent`) and
  `evaluate` (from `@wix/pathgrade`). Scope a live file when needed.

Do not write a live CASE for a phrase that SKILL.md can assert. Do not
write a static pin for a first-turn question, a tool call, or a
transcript shape. Do not invent a new PathGrade runner.

### Gold, fail-closed, isolation, APIs

Do not invent APIs. Gold stays true if the skill internals change. Score outcome (lint, tests,
behavior), not filenames or methods the skill might rename. If a check
looks for a file, the user prompt must name it.

Each live CASE needs at least one `check()` or `score()`. Optional
`judge()` at weight 0.2-0.5. `toolUsage` only when the workflow is mandatory.
Score outcome first.

API: `createAgent`, `prompt` / `runConversation`, `evaluate`, `check`,
`score`, `judge`, `toolUsage` from `@wix/pathgrade`. This repo wraps
`createAgent` via `vs-internal-shared/test/pathgrade-agent`.

Isolation is `createAgent({ skillDir, workspace })` copying the skill
and fixture into an isolated workspace and HOME. Score that workspace.
Fail-closed: missing evidence fails; `onScorerError: 'zero'` or
`'fail'`, not `'skip'`. Multi-turn skills use `runConversation`
plus reactions, not a flattened one-shot.

## Exclusive order

1. Name the required behavior.
2. Pair every copied slogan with `not.toMatch` on that slogan.
3. Add the exclusive alternative a slogan-only skill fails (run the
   reject script on a bad fixture).

A fixture can fail good-mention plus bad-behavior. Put the bad tell in
the fixture; put the reject rule in `scripts/reject-*.mjs`. Keep fixture
canaries out of SKILL.md.

Match text across wraps with `\s+`. Do not relax an assertion to make
it pass.

When a skill already pins `toBeLessThanOrEqual(N)` on SKILL.md line
count, stay at or under N. `/vs-write` uses 240. Do not invent a
ceiling a skill does not already pin.

## PathGrade commands - do not edit PathGrade

Prefer pathgrade run over bare vitest. Do not install PathGrade; vs already has @wix/pathgrade. Keep the vs wrappers.

```bash
pathgrade analyze --dir skills/that-skill
pathgrade validate skills/that-skill/test/that.eval.ts
pathgrade run
npm run eval:static
npm run eval
npm run eval -- skills/vs-shape-it/test/shape-it.eval.ts
npm run eval:preview
```

`npm run eval:static` is the edit loop. `npm run eval` spends tokens on live
agents; scope it.
Do not edit PathGrade: not wix-private/pathgrade, not `@wix/pathgrade`, not
node_modules/@wix/pathgrade source, not .pathgrade internals. Change only skill text, fixtures, `scripts/reject-*.mjs`, and
`*.eval.ts` / `*.static.eval.ts` beside the skill.

## Output style

Apply the shared output style at ../vs-internal-shared/references/output-style.md to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** skill change | failing pin
**Next:** done
**Relevant:** none

