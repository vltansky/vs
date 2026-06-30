# vs

You are the bottleneck. But you have the taste and context the agent doesn't.

You have the domain knowledge, the business context, the taste. The agent has the throughput — it can research, implement, review, and test faster than you can. But it doesn't know *what* to build or *why*.

vs is a framework for making that division work. The human makes strategic decisions. The agent executes with discipline. The framework connects the two so neither wastes the other's time.

## How it works

Start with the three core workflows. The first is for you. The second is for the agent. The third is for you again.

```
/shape-it  →  /build-it  →  /ship-it
   you + agent       agent alone       you
```

**`/shape-it`** — you bring whatever you have: a vague idea, a rough plan, a half-formed question. The agent helps you think. It explores options when you're unsure, challenges your plan when you're sure, gathers evidence when you need it. Every interaction is a strategic decision you're making — the agent just makes you faster at making it.

**`/build-it`** — you hand off the design. The agent takes it from direction to working code: stress-tests the plan, implements with TDD, reviews its own work, runs QA. You come back when it's done. Zero hand-holding in between.

**`/ship-it`** — you verify what was built. The agent creates the PR. You decide if it ships.

The human is in the loop where it matters (design, prioritization, verification)
and out of the loop where they'd just slow things down (implementation, review,
testing).

When the next change is not obvious, use the repo itself as the starting point:

```
/improve  ->  plans
 advisor      backlog
```

**`/improve`** audits the repo, ranks high-leverage findings, and writes
self-contained implementation plans. It does not edit source code. It is how you
turn "what should we improve here?" into a durable backlog that `/build-it`,
`/to-issues`, or another agent can execute.

`/improve` is also a lens you can run at other points: before `/shape-it` to
find product direction, before `/build-it` to turn a known concern into a tight
plan, or before `/ship-it` with `branch` scope to capture follow-up work revealed
by the branch.

## Skill layers

vs has beginner-friendly workflows and surgical tools underneath them.

- **Workflows** take a loose goal and drive a full outcome. Use these when you want the system to own the path: `/shape-it`, `/improve`, `/build-it`, `/ship-it`, `/bugfix`, `/fix-pr`, `/afk`, `/baby-sit`.
- **Building blocks** own one bounded job and can be used directly or composed by workflows. Use these when you want precision: `/pushback`, `/github-research`, `/rfc-research`, `/tdd`, `/debug-mode`, `/roast-review`, `/roast-ui`, `/qa`, `/verify`, `/deslop`, `/brief`, `/second-opinion`, `/perf`, `/to-issues`, `/steal`, `/setup-adr`, `/decide-for-me`, `/out-of-context`, `/recap`, `/retro`, `/try-skill`.

The workflows are intentionally built from building blocks. For example, `/build-it` stress-tests with `/pushback`, uses `/decide-for-me` to resolve tactical uncertainty, executes with TDD/debug discipline, reviews with `/roast-review`, runs `/qa` for web apps, verifies with `/verify`, and ends with `/brief`. `/ship-it` turns the reviewed branch into a PR and uses `/brief` as the human-readable orientation layer.

The rule of thumb: start with a workflow when you want momentum, go to a building block when you know the exact phase, mode, or meta job you want to control. Use `/shape-it` when you have an idea to shape; use `/improve` when the repo itself should tell you what is worth doing next.

### Research skills

vs has two explicit research entry points:

| Use | When | Output |
|---|---|---|
| `/github-research` | You need external GitHub evidence: prior art, examples, ecosystem patterns, or a landscape across similar projects | Cited synthesis or landscape matrix |
| `/rfc-research` | You need an RFC, ADR, proposal, or technical decision justified by evidence | Decision document with recommendation, alternatives, risks, and open questions |

The short version:

```text
/github-research = answer with evidence
/rfc-research    = decide with evidence
```

Use `/github-research` for questions like "how do other repos solve this?", "find examples of X", or "compare similar projects." Use `/rfc-research` when the output needs to choose a direction, explain why, and be reviewable as a decision record. `/github-research` can feed `/rfc-research`, but it does not need to.

## Learning path

You do not need to learn every skill at once. Learn the system in layers:

1. **Start with the two main entry loops:** use `/shape-it`, `/build-it`, `/ship-it` when you have an idea to turn into a PR; use `/improve` when you want the repo to tell you what work is worth doing next.
2. **Learn the improvement variants:** `/improve quick` for a cheap hotspot pass, `/improve deep` for a broader audit, `/improve branch` before a PR, `/improve next` for direction, `/improve plan <thing>` for one known concern, and `/improve reconcile` to keep the plan backlog alive.
3. **Learn the high-leverage shortcuts:** `/pushback`, `/github-research`, `/second-opinion`, `/fix-pr`, `/steal`, `/decide-for-me`. These quickly change how useful the agent feels day to day: better plans, source-backed answers, independent critique, review-feedback handling, reusable ideas from other repos, and fewer tactical interruptions.
4. **Learn the delivery blocks as needed:** `/tdd`, `/debug-mode`, `/roast-review`, `/roast-ui`, `/qa`, `/verify`, `/brief`, `/deslop`. These are most useful when you want to steer or inspect one phase of implementation.
5. **Learn the specialized workflows when the situation appears:** `/bugfix`, `/afk`, `/baby-sit`, `/to-issues`, `/rfc-research`, `/perf`, `/setup-adr`, `/out-of-context`, `/recap`, `/retro`, `/try-skill`. These are powerful, but you usually reach for them because a specific job asks for them.

## The problem this solves

Most agent workflows get the division wrong. Either:

- **The agent decides too much.** It silently guesses when the situation is ambiguous. It picks an approach without asking. It builds the wrong thing confidently. You waste time fixing what should have been a conversation.

- **The agent asks too much.** It stops at every routine decision. "Should I use this library?" "Should I name this variable X or Y?" "Should I run tests?" You spend more time approving busywork than you would doing the work yourself.

vs separates strategic decisions (where your judgment matters) from routine decisions (where the agent should just act). The agent never auto-resolves ambiguity that needs your input. It also never asks you to approve something obvious.

## Choosing a flow

The right entry point depends on what you already have:

| Starting point | Flow | Use when |
|---|---|---|
| New idea | `/shape-it` -> `/build-it` -> `/ship-it` | You know the goal but need to shape the design |
| Existing code, formed idea/spec/plan | `/pushback` -> `/build-it` -> `/ship-it` | You have a direction and want it challenged before execution |
| Existing code, unknown next move | `/improve` -> plans -> `/build-it` -> `/ship-it` | You want the repo to surface the highest-leverage work |
| Broken behavior | `/bugfix` -> `/ship-it` | Something fails and root cause is unknown |
| Existing PR | `/fix-pr` -> `/ship-it` or `/baby-sit` | Review comments, CI drift, or keeping a PR merge-ready |

`/improve` can also be inserted into other flows:

```text
Find direction:       /improve next -> /shape-it -> /build-it
Specify one concern:  /improve plan <thing> -> /build-it
Before shipping:      /improve branch -> /ship-it
```

The difference is the question being asked:

- `/shape-it`: What should this idea become?
- `/pushback`: Does this idea, spec, or plan survive adversarial review?
- `/improve`: What improvements does this repo or branch reveal?
- `/roast-review`: Is this diff good enough?
- `/deslop`: Can this working code be cleaner without changing behavior?

## Skill map

The three core delivery skills are the main path from known idea to PR. `/improve`
is both a repo-first planning workflow and a cross-cutting improvement lens.
Under the hood, the workflows compose the rest:

| Skill | Kind | What it does | Who drives |
|---------|-------|-------------|-----------|
| `/shape-it` | Workflow | Explore ideas and challenge plans into buildable designs | you |
| `/improve` | Workflow | Audit a repo and write executable improvement plans | you |
| `/build-it` | Workflow | Plan-to-code with TDD, review, QA, and handoff | agent |
| `/ship-it` | Workflow | Create PR with change brief and AI session context | you verify |
| `/bugfix` | Workflow | End-to-end bug fix pipeline | agent |
| `/fix-pr` | Workflow | Address reviewer comments with approval gates | you |
| `/afk` | Workflow | Scoped autonomous work session while you are away | agent |
| `/baby-sit` | Workflow | Watch a PR, fix CI/review drift, and keep it merge-ready | agent |
| `/pushback` | Building block | Adversarial stress-test on an idea, spec, or plan | you |
| `/github-research` | Building block | Answer external-prior-art questions with GitHub examples, patterns, or landscape comparisons | you |
| `/rfc-research` | Building block | Turn evidence into an RFC, ADR, proposal, or technical decision | you |
| `/tdd` | Building block | Red-green-refactor loop | agent |
| `/debug-mode` | Building block | Root-cause investigation | agent |
| `/roast-review` | Building block | Two-pass code review + optional Codex cross-model review | agent |
| `/roast-ui` | Building block | Sharp frontend/design review for hierarchy, accessibility, responsiveness, and AI-slop tells | agent |
| `/qa` | Building block | Browser-based QA with atomic fixes | agent |
| `/verify` | Building block | Prove a change works with concrete evidence | agent |
| `/deslop` | Building block | Clean AI-ish code while preserving behavior | agent |
| `/brief` | Building block | Orientation brief from a git diff: what changed, where to look | you |
| `/second-opinion` | Building block | Get an independent advisor perspective and synthesize it | agent |
| `/perf` | Building block | Run evaluator-backed performance optimization | agent |
| `/to-issues` | Building block | Turn a plan/spec/RFC into vertical-slice GitHub issues | you |
| `/steal` | Building block | Scan a named repo for ideas worth porting | you |
| `/setup-adr` | Building block | Bootstrap ADR support in a repo | agent |
| `/decide-for-me` | Building block | Resolve tactical uncertainty before interrupting the user | agent |
| `/out-of-context` | Building block | Explain the current situation from zero prior context | you |
| `/recap` | Building block | Tiny catch-up on recent changes and next actions | you |
| `/retro` | Building block | Extract session learnings and route them to the right destination | you |
| `/try-skill` | Building block | Blind-test a skill change and compare behavior to expectations | agent |

Notice the pattern: skills where the human drives are about *decisions* (what to build, whether the idea/spec/plan holds up, what the code does). Skills where the agent drives are about *execution* (implementing, testing, reviewing, debugging).

## Typical flows

```
New feature:       /shape-it -> /build-it -> /ship-it
Known direction:   /pushback -> /build-it -> /ship-it
Repo improvement:  /improve -> plans -> /build-it -> /ship-it
Bug fix:           /bugfix -> /ship-it
PR feedback:       /fix-pr
PR watch:          /baby-sit
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

## Install

vs ships native plugin manifests for both Claude Code (`.claude-plugin/`) and
Codex (`.codex-plugin/`).

### Claude Code

Add the repo as a plugin marketplace, then install the plugin:

```
/plugin marketplace add vltansky/vs
/plugin install vs@vs
```

### Codex

Add the repo as a Codex plugin source and install `vs` from the plugin menu, or
point Codex at the `.codex-plugin/plugin.json` manifest in your clone.

### Manual

Every skill under `skills/` is self-contained — you can also copy individual
skill directories straight into your agent's skills folder.

## Included MCP

vs ships an `.mcp.json` with [octocode MCP](https://github.com/bgauryy/octocode-mcp), used by `/github-research`, `/rfc-research`, `/steal`, and prior-art passes in `/shape-it` and `/pushback`.

## Optional dependencies

The stack degrades gracefully when these extras are missing:

- [dev-browser](https://github.com/anthropics/dev-browser) — browser QA flows
- `gh` CLI — PR creation and review threads
- [Codex CLI](https://github.com/openai/codex) — cross-model review (second opinion from a different LLM)

## Repo layout

```
skills/        skill definitions (SKILL.md plus supporting files)
adr/           architecture decision records
```

## Acknowledgements

vs is heavily inspired by the agent-skill ecosystem around [superpowers](https://github.com/obra/superpowers), [Matt Pocock's skills](https://github.com/mattpocock/skills), [oh-my-claudecode](https://github.com/yeachan-heo/oh-my-claudecode), [gstack](https://github.com/garrytan/gstack), and [shadcn/improve](https://github.com/shadcn/improve). These projects demonstrated that small, composable skills can make agent workflows more reliable, portable, and humane.

Some direct lineage:

| VS skill | Credits |
|---|---|
| `/improve` | Adapted from [shadcn/improve](https://github.com/shadcn/improve). |
| `/shape-it` | Inspired by Matt Pocock's Grill Me skill from [mattpocock/skills](https://github.com/mattpocock/skills), the interview-skill pattern shared by [trq212](https://x.com/trq212/status/2005315275026260309), and brainstorming workflows in [obra/superpowers](https://github.com/obra/superpowers). |
| `/roast-review` | Inspired by OpenClaw's [autoreview skill](https://github.com/openclaw/agent-skills/blob/main/skills/autoreview/SKILL.md), Cursor's [thermo-nuclear-code-quality-review](https://github.com/cursor/plugins/tree/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review), and Claude Code's [code-simplifier](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit/agents/code-simplifier.md). |
| `/roast-ui` | Copies and adapts Paul Bakaus' Apache-2.0 licensed [impeccable](https://github.com/pbakaus/impeccable) skill, including its references and bundled scripts. Its `verdict` command is adapted from Yeachan Heo's MIT-licensed [oh-my-claudecode visual-verdict skill](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/skills/visual-verdict/SKILL.md). |

The pipeline framing owes a lot to gstack. vs takes these ideas in a repo-maintainer direction: opinionated skill layers, stricter flow contracts, built-in review/testing loops, and local workflow handoffs for coding agents.

Third-party license details are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

[octocode MCP](https://github.com/bgauryy/octocode-mcp) is also included and credited for evidence-backed code research.

## License

MIT
