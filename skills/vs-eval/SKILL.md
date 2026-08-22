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

### Gold, fail-closed, isolation

These are how this repo already uses PathGrade. Do not invent APIs.

- **Gold:** name the required artifact or behavior, then score it
  (`check` / `score` on the isolated workspace, or the reject script on
  fixture bytes). Mentions in SKILL.md are not gold.
- **Fail-closed:** missing evidence is a fail. `evaluate` with no
  artifact scores 0. Reject-script exit 2 is not a pass.
- **Isolation:** `createAgent({ skillDir, workspace })` copies the skill
  and fixture into an isolated workspace (and HOME) per trial. Score
  that workspace, not the checkout that contains the prompt.

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

```bash
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

