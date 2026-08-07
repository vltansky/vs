# Working in this repo

This repo is a plugin of skills. A change to a skill is a change to agent
behavior, so the evals in `skills/vs-*/test/` are the only way to tell whether
an edit did what you meant.

## Branch from and push to `main`

`main` is the only long-lived branch. There is no `master`, and a repository rule
blocks creating one — a run that pushes there fails outright rather than parking
the work somewhere nobody looks. Branch work off `main` as `vladta/<topic>` and
open a PR, or commit to `main` directly for small changes.

If you find yourself on a detached HEAD, check where the branch you are about to
push actually points before pushing.

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

Prefer `npm run eval*` over calling `vitest` ad hoc so timeouts and worker caps
from `vitest.config.ts` stay consistent. On macOS, PathGrade reuses Claude Code
Keychain OAuth without copying `~/.claude.json` or enabling Claude.ai MCP
connectors, so personal MCP servers no longer leak into trial sandboxes.

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
