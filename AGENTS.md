# Working in this repo

This repo is a plugin of skills. A change to a skill is a change to agent
behavior, so the evals in `skills/vs-*/test/` are the only way to tell whether
an edit did what you meant.

## Use the evals as the feedback loop

`npm run eval:static` runs every `*.static.eval.ts` in about five seconds. These
assert the contract of a skill against its own `SKILL.md` and references — no
agent, no tokens, no network. Run them after every edit to a skill, the same way
you would run a unit test suite.

`npm run eval` additionally runs the behavior evals, each of which drives a live
coding agent through a fixture and scores the transcript. The full suite takes
around 25 minutes and spends real tokens, so it belongs before you ship a
behavior change, not in the edit loop. Scope it while iterating:

```bash
npm run eval:static
npm run eval -- skills/vs-shape-it/test/shape-it.eval.ts
npm run eval -- skills/vs-shape-it/test/shape-it.eval.ts -t "vague idea"
```

Behavior evals score a live agent, so a single failure can be variance. Re-run a
failing eval before treating it as a regression, and read the score rather than
just the pass or fail.

## Run evals through the npm scripts

Do not call `vitest` directly. The `npm run eval*` scripts go through
`scripts/eval-home.mjs`, which points `HOME` at a sanitized copy of your home
directory. PathGrade's macOS Keychain auth path copies `~/.claude.json` into
every trial sandbox; without the wrapper each eval agent inherits your personal
MCP servers and stalls on interactive logins the evals never need.

## When a static eval fails

Decide which side is stale before editing. These evals assert prose in
`SKILL.md`, so a failure means either the skill lost a guardrail it should have
kept, or the guardrail changed on purpose and the assertion was left behind.
Check the history of the phrase (`git log -S "<phrase>"`) and fix the side that
is actually wrong. Do not relax an assertion to make it pass.

Match text across line wraps with `\s+` rather than a literal space — SKILL.md
prose gets re-wrapped, and an assertion pinned to one wrapping breaks on edits
that did not change meaning.

## Before finishing

```bash
npm run typecheck
npm run eval:static
```

Plus the behavior evals for whatever you touched. Keep the version in
`package.json`, `package-lock.json`, `.claude-plugin/plugin.json`,
`.codex-plugin/plugin.json`, and `.cursor-plugin/plugin.json` in sync — installed
plugins detect updates by version, and `tests/install.eval.ts` enforces it.
