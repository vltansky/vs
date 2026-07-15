# vs

You are the bottleneck. But you have the taste and context the agent doesn't.

You have the domain knowledge, the business context, the taste. The agent has the throughput — it can research, implement, review, and test faster than you can. But it doesn't know *what* to build or *why*.

vs is a framework for making that division work. The human makes strategic decisions. The agent executes with discipline. The framework connects the two so neither wastes the other's time.

## Install

vs ships native plugin manifests for Claude Code (`.claude-plugin/`), Codex
(`.codex-plugin/`), and Cursor (`.cursor-plugin/`). All three read the same
`SKILL.md` files under `skills/`.

### Quick install

One command installs vs into whichever of Claude Code / Codex / Cursor it finds.
Run it without cloning:

```
curl -fsSL https://raw.githubusercontent.com/vltansky/vs/main/install.sh | bash
```

Or with the GitHub CLI (uses your `gh` auth, works for private clones too):

```
gh api repos/vltansky/vs/contents/install.sh -H "Accept: application/vnd.github.raw" | bash
```

Or from a clone (`./install.sh`, or `npm run install-plugin`). The steps below
are the manual equivalents if you prefer to run them yourself.

### Claude Code

Add the repo as a plugin marketplace, then install the plugin:

```
/plugin marketplace add vltansky/vs
/plugin install vs@vs
```

### Codex

Add the repo as a plugin marketplace, then install the plugin:

```
codex plugin marketplace add vltansky/vs
codex plugin add vs@vs
```

### Cursor

Cursor (2.5+) has no plugin-install CLI. Either install from a team marketplace
(Dashboard → Settings → Plugins → import `vltansky/vs`), or load it locally by
linking a clone into Cursor's local plugin dir, then reload Cursor:

```
git clone https://github.com/vltansky/vs ~/.cursor/plugins/local/vs
```

The quick-install script does this link step for you.

### Manual

Every skill under `skills/` is self-contained — you can also copy individual
skill directories straight into your agent's skills folder.

## How it works

Start with the three core workflows. The first is for you. The second is for the agent. The third is for you again.

```
/vs-shape-it  →  /vs-build-it  →  /vs-ship-it
   you + agent       agent alone       you
```

**`/vs-shape-it`** — you bring whatever you have: a vague idea, a rough plan, a half-formed question. The agent helps you think. It explores options when you're unsure, challenges your plan when you're sure, gathers evidence when you need it. The default handoff stays an approved design; for work that genuinely spans sessions, it may propose durable issues and host-native parallel workers without creating them automatically.

**`/vs-build-it`** — you hand off the design. The agent takes it from direction to working code: stress-tests the plan, implements with TDD, reviews its own work, runs QA. You come back when it's done. Zero hand-holding in between.

**`/vs-ship-it`** — you verify what was built. The agent creates the PR, then automatically babysits CI and review until it is merge-ready, merged, or blocked. You decide if it merges.

The human is in the loop where it matters (design, prioritization, verification)
and out of the loop where they'd just slow things down (implementation, review,
testing).

When the next change is not obvious, use the repo itself as the starting point:

```
/vs-improve  ->  plans
 advisor      backlog
```

**`/vs-improve`** audits the repo, ranks high-leverage findings, and writes
self-contained implementation plans. It does not edit source code. It is how you
turn "what should we improve here?" into a durable backlog that `/vs-build-it`,
`/vs-to-issues`, or another agent can execute.

`/vs-improve` is also a lens you can run at other points: before `/vs-shape-it` to
find product direction, before `/vs-build-it` to turn a known concern into a tight
plan, or before `/vs-ship-it` with `branch` scope to capture follow-up work revealed
by the branch.

## Skill layers

vs has beginner-friendly workflows and surgical tools underneath them.

- **Workflows** take a loose goal and drive a full outcome. Use these when you want the system to own the path: `/vs-shape-it`, `/vs-improve`, `/vs-build-it`, `/vs-ship-it`, `/vs-bugfix`, `/vs-fix-pr`, `/vs-afk`, `/vs-baby-sit`.
- **Building blocks** own one bounded job and can be used directly or composed by workflows. Use these when you want precision: `/vs-pushback`, `/vs-prototype`, `/vs-github-research`, `/vs-rfc-research`, `/vs-tdd`, `/vs-debug-mode`, `/vs-roast-review`, `/vs-roast-ui`, `/vs-qa`, `/vs-verify`, `/vs-deslop`, `/vs-write`, `/vs-brief`, `/vs-second-opinion`, `/vs-perf`, `/vs-to-issues`, `/vs-steal`, `/vs-setup-adr`, `/vs-decide-for-me`, `/vs-out-of-context`, `/vs-recap`, `/vs-retro`, `/vs-try-skill`.

The workflows are intentionally built from building blocks. For example, `/vs-build-it` stress-tests with `/vs-pushback`, uses `/vs-decide-for-me` to resolve tactical uncertainty, executes with TDD/debug discipline, reviews with `/vs-roast-review`, runs `/vs-qa` for web apps, verifies with `/vs-verify`, and ends with `/vs-brief`. `/vs-ship-it` turns the reviewed branch into a PR and uses `/vs-brief` as the human-readable orientation layer.

The rule of thumb: start with a workflow when you want momentum, go to a building block when you know the exact phase, mode, or meta job you want to control. Use `/vs-shape-it` when you have an idea to shape; use `/vs-improve` when the repo itself should tell you what is worth doing next.

### Research skills

vs has two explicit research entry points:

| Use | When | Output |
|---|---|---|
| `/vs-github-research` | You need external GitHub evidence: prior art, examples, ecosystem patterns, or a landscape across similar projects | Cited synthesis or landscape matrix |
| `/vs-rfc-research` | You need an RFC, ADR, proposal, or technical decision justified by evidence | Decision document with recommendation, alternatives, risks, and open questions |

The short version:

```text
/vs-github-research = answer with evidence
/vs-rfc-research    = decide with evidence
```

Use `/vs-github-research` for questions like "how do other repos solve this?", "find examples of X", or "compare similar projects." Use `/vs-rfc-research` when the output needs to choose a direction, explain why, and be reviewable as a decision record. `/vs-github-research` can feed `/vs-rfc-research`, but it does not need to.

## Learning path

You do not need to learn every skill at once. Learn the system in layers:

1. **Start with the two main entry loops:** use `/vs-shape-it`, `/vs-build-it`, `/vs-ship-it` when you have an idea to turn into a PR; use `/vs-improve` when you want the repo to tell you what work is worth doing next.
2. **Learn the improvement variants:** `/vs-improve quick` for a cheap hotspot pass, `/vs-improve deep` for a broader audit, `/vs-improve branch` before a PR, `/vs-improve next` for direction, `/vs-improve plan <thing>` for one known concern, and `/vs-improve reconcile` to keep the plan backlog alive.
3. **Learn the high-leverage shortcuts:** `/vs-pushback`, `/vs-prototype`, `/vs-github-research`, `/vs-second-opinion`, `/vs-fix-pr`, `/vs-steal`, `/vs-decide-for-me`. These quickly change how useful the agent feels day to day: better plans, cheap answers to design uncertainty, source-backed answers, independent critique, review-feedback handling, reusable ideas from other repos, and fewer tactical interruptions.
4. **Learn the delivery blocks as needed:** `/vs-tdd`, `/vs-debug-mode`, `/vs-roast-review`, `/vs-roast-ui`, `/vs-qa`, `/vs-verify`, `/vs-brief`, `/vs-deslop`, `/vs-write`. These are most useful when you want to steer or inspect one phase of implementation or publication.
5. **Learn the specialized workflows when the situation appears:** `/vs-bugfix`, `/vs-afk`, `/vs-baby-sit`, `/vs-to-issues`, `/vs-rfc-research`, `/vs-perf`, `/vs-setup-adr`, `/vs-out-of-context`, `/vs-recap`, `/vs-retro`, `/vs-try-skill`. These are powerful, but you usually reach for them because a specific job asks for them.

## The problem this solves

Most agent workflows get the division wrong. Either:

- **The agent decides too much.** It silently guesses when the situation is ambiguous. It picks an approach without asking. It builds the wrong thing confidently. You waste time fixing what should have been a conversation.

- **The agent asks too much.** It stops at every routine decision. "Should I use this library?" "Should I name this variable X or Y?" "Should I run tests?" You spend more time approving busywork than you would doing the work yourself.

vs separates strategic decisions (where your judgment matters) from routine decisions (where the agent should just act). The agent never auto-resolves ambiguity that needs your input. It also never asks you to approve something obvious.

## Choosing a flow

The right entry point depends on what you already have:

| Starting point | Flow | Use when |
|---|---|---|
| New idea | `/vs-shape-it` -> `/vs-build-it` -> `/vs-ship-it` | You know the goal but need to shape the design |
| Design uncertainty | `/vs-shape-it` -> `/vs-prototype` -> `/vs-build-it` | A small throwaway implementation can answer a UI or logic question before production work |
| Existing code, formed idea/spec/plan | `/vs-pushback` -> `/vs-build-it` -> `/vs-ship-it` | You have a direction and want it challenged before execution |
| Existing code, unknown next move | `/vs-improve` -> plans -> `/vs-build-it` -> `/vs-ship-it` | You want the repo to surface the highest-leverage work |
| Broken behavior | `/vs-bugfix` -> `/vs-ship-it` | Something fails and root cause is unknown |
| Existing PR | `/vs-fix-pr` -> `/vs-ship-it` or `/vs-baby-sit` | Review comments, CI drift, or keeping a PR merge-ready |

`/vs-improve` can also be inserted into other flows:

```text
Find direction:       /vs-improve next -> /vs-shape-it -> /vs-build-it
Specify one concern:  /vs-improve plan <thing> -> /vs-build-it
Before shipping:      /vs-improve branch -> /vs-ship-it
```

The difference is the question being asked:

- `/vs-shape-it`: What should this idea become?
- `/vs-prototype`: What does this uncertain design feel like when made interactive?
- `/vs-pushback`: Does this idea, spec, or plan survive adversarial review?
- `/vs-improve`: What improvements does this repo or branch reveal?
- `/vs-roast-review`: Is this diff good enough?
- `/vs-deslop`: Can this working code be cleaner without changing behavior?

## Skill map

The three core delivery skills are the main path from known idea to PR. `/vs-improve`
is both a repo-first planning workflow and a cross-cutting improvement lens.
Under the hood, the workflows compose the rest:

| Skill | Kind | What it does | Who drives |
|---------|-------|-------------|-----------|
| `/vs-shape-it` | Workflow | Explore ideas and challenge plans into buildable designs | you |
| `/vs-improve` | Workflow | Audit a repo and write executable improvement plans | you |
| `/vs-build-it` | Workflow | Plan-to-code with TDD, review, QA, and handoff | agent |
| `/vs-ship-it` | Workflow | Create PR with change brief, then babysit CI and review | agent after your verification |
| `/vs-bugfix` | Workflow | End-to-end bug fix pipeline | agent |
| `/vs-fix-pr` | Workflow | Address reviewer comments with approval gates | you |
| `/vs-afk` | Workflow | Scoped autonomous work session while you are away | agent |
| `/vs-baby-sit` | Workflow | Watch a PR, fix CI/review drift, and keep it merge-ready | agent |
| `/vs-pushback` | Building block | Adversarial stress-test on an idea, spec, or plan | you |
| `/vs-prototype` | Building block | Build throwaway UI or logic code to answer one design question | you |
| `/vs-github-research` | Building block | Answer external-prior-art questions with GitHub examples, patterns, or landscape comparisons | you |
| `/vs-rfc-research` | Building block | Turn evidence into an RFC, ADR, proposal, or technical decision | you |
| `/vs-tdd` | Building block | Red-green-refactor loop | agent |
| `/vs-debug-mode` | Building block | Root-cause investigation | agent |
| `/vs-roast-review` | Building block | Two-pass code review + optional Codex cross-model review | agent |
| `/vs-roast-ui` | Building block | Sharp frontend/design review for hierarchy, accessibility, responsiveness, and AI-slop tells | agent |
| `/vs-qa` | Building block | Browser-based QA with atomic fixes | agent |
| `/vs-verify` | Building block | Prove a change works with concrete evidence | agent |
| `/vs-deslop` | Building block | Clean AI-ish code while preserving behavior | agent |
| `/vs-write` | Building block | Write, rewrite, or shape clear, direct prose without losing substance | you |
| `/vs-brief` | Building block | Orientation brief from a git diff: what changed, where to look | you |
| `/vs-second-opinion` | Building block | Get an independent advisor perspective and synthesize it | agent |
| `/vs-perf` | Building block | Run evaluator-backed performance optimization | agent |
| `/vs-to-issues` | Building block | Turn a plan/spec/RFC into vertical-slice GitHub issues | you |
| `/vs-steal` | Building block | Scan a named repo for ideas worth porting | you |
| `/vs-setup-adr` | Building block | Bootstrap ADR support in a repo | agent |
| `/vs-decide-for-me` | Building block | Resolve tactical uncertainty before interrupting the user | agent |
| `/vs-out-of-context` | Building block | Explain the current situation from zero prior context | you |
| `/vs-recap` | Building block | Tiny catch-up on recent changes and next actions | you |
| `/vs-retro` | Building block | Extract session learnings and route them to the right destination | you |
| `/vs-try-skill` | Building block | Blind-test a skill change and compare behavior to expectations | agent |

Notice the pattern: skills where the human drives are about *decisions* (what to build, whether the idea/spec/plan holds up, what the code does). Skills where the agent drives are about *execution* (implementing, testing, reviewing, debugging).

## Typical flows

```
New feature:       /vs-shape-it -> /vs-build-it -> /vs-ship-it
Uncertain design:  /vs-shape-it -> /vs-prototype -> /vs-build-it
Known direction:   /vs-pushback -> /vs-build-it -> /vs-ship-it
Repo improvement:  /vs-improve -> plans -> /vs-build-it -> /vs-ship-it
Bug fix:           /vs-bugfix -> /vs-ship-it
PR feedback:       /vs-fix-pr
PR watch:          /vs-baby-sit
```

## Why the skills are opinionated

The skills are written to fail closed. They'd rather stop and ask than silently guess wrong:

- Confusion templates instead of silent assumptions
- Verification checklists that block "seems done"
- `[EASY TO MISS]` annotations at the points agents typically drift
- A rubber-stamp gate in review — "no findings" has to be defended
- Bounded debugging loops that escalate instead of wandering
- Circuit breakers that stop autonomous execution when the plan is broken

These matter more than clever prompting. They reduce the cases where the agent wastes your time by building the wrong thing.

## Included MCP

vs ships an `.mcp.json` with [octocode MCP](https://github.com/bgauryy/octocode-mcp), used by `/vs-github-research`, `/vs-rfc-research`, `/vs-steal`, and prior-art passes in `/vs-shape-it` and `/vs-pushback`.

## Optional dependencies

The stack degrades gracefully when these extras are missing:

- [dev-browser](https://github.com/anthropics/dev-browser) — browser QA flows
- `gh` CLI — PR creation and review threads
- [Codex CLI](https://github.com/openai/codex) — cross-model review (second opinion from a different LLM)

## Repo layout

```
skills/        skill definitions (SKILL.md plus supporting files)
  vs-*/test/   pathgrade behavior evals (*.eval.ts) + fixtures
adr/           architecture decision records
vitest.config.ts   pathgrade plugin config
```

## Evals

Skill behavior is tested with [`@wix/pathgrade`](https://github.com/wix-incubator/pathgrade),
which drives a real coding agent against each skill and scores the outcome.
Evals live next to each skill in `skills/vs-*/test/*.eval.ts`.

On macOS, pathgrade reuses your local Claude Code (or Codex) subscription auth
from the Keychain — no API key required. Set `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY` only if you want to bill a key or target a proxy.

```bash
npm install                                    # one-time: pathgrade + vitest

npm run eval                                   # run every eval (uses local auth)
npx vitest run skills/vs-shape-it/test          # one skill
PATHGRADE_AGENT=codex npm run eval              # drive Codex instead of Claude
npm run eval:preview                            # browser report
```

Each eval spawns a live agent, so a full run takes minutes. Static, no-agent
evals (e.g. `architecture-depth.static.eval.ts`) run instantly.

## Acknowledgements

vs is heavily inspired by the agent-skill ecosystem around [superpowers](https://github.com/obra/superpowers), [Matt Pocock's skills](https://github.com/mattpocock/skills), [oh-my-claudecode](https://github.com/yeachan-heo/oh-my-claudecode), [gstack](https://github.com/garrytan/gstack), and [shadcn/improve](https://github.com/shadcn/improve). These projects demonstrated that small, composable skills can make agent workflows more reliable, portable, and humane.

Some direct lineage:

| VS skill | Credits |
|---|---|
| `/vs-improve` | Adapted from [shadcn/improve](https://github.com/shadcn/improve). |
| `/vs-shape-it` | Inspired by Matt Pocock's Grill Me skill from [mattpocock/skills](https://github.com/mattpocock/skills), the interview-skill pattern shared by [trq212](https://x.com/trq212/status/2005315275026260309), and brainstorming workflows in [obra/superpowers](https://github.com/obra/superpowers). |
| `/vs-prototype` | Adapted from Matt Pocock's [prototype skill](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype), with UI concept-divergence ideas from Wix Creator Kit's [`ck-ux-concepts`](https://github.com/wix-private/creator-kit/tree/master/skills/ck-ux-concepts). |
| `/vs-roast-review` | Inspired by OpenClaw's [autoreview skill](https://github.com/openclaw/agent-skills/blob/main/skills/autoreview/SKILL.md), Cursor's [thermo-nuclear-code-quality-review](https://github.com/cursor/plugins/tree/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review), and Claude Code's [code-simplifier](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit/agents/code-simplifier.md). |
| `/vs-roast-ui` | Copies and adapts Paul Bakaus' Apache-2.0 licensed [impeccable](https://github.com/pbakaus/impeccable) skill, including its references and bundled scripts. Its `verdict` command is adapted from Yeachan Heo's MIT-licensed [oh-my-claudecode visual-verdict skill](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/skills/visual-verdict/SKILL.md). |

The pipeline framing owes a lot to gstack. vs takes these ideas in a repo-maintainer direction: opinionated skill layers, stricter flow contracts, built-in review/testing loops, and local workflow handoffs for coding agents.

Third-party license details are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

[octocode MCP](https://github.com/bgauryy/octocode-mcp) is also included and credited for evidence-backed code research.

## License

MIT
