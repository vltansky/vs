# vs

vs is a plugin for Claude Code, Codex, and Cursor. It adds reusable workflows for
planning, implementing, reviewing, testing, and shipping changes in a repository.

Its main workflow has three skills:

```text
/vs-shape-it  ->  /vs-build-it  ->  /vs-ship-it
 decide what       build it          verify and publish
```

A skill is a set of instructions you invoke with a slash command. You make the
product decisions; the skills tell the agent how to research, implement, test,
review, and follow through on CI.

## Get started

### 1. Install vs

Run the installer. It installs vs into every supported coding agent it finds:

```bash
curl -fsSL https://raw.githubusercontent.com/vltansky/vs/main/install.sh | bash
```

Restart your agent session after installation.

### 2. Shape the change

Open your project in the agent and describe what you want:

```text
/vs-shape-it Add saved filters to search
```

`/vs-shape-it` explores the repository, asks about decisions that need your
judgment, and turns the idea into an approved design. Stay in the conversation
until the direction is clear.

### 3. Build it

When the design is ready, hand it to the agent:

```text
/vs-build-it Implement the approved design
```

`/vs-build-it` challenges the plan before coding, resolves routine decisions on
its own, implements with tests, reviews the diff, runs relevant QA, and returns
the finished work for you to inspect.

### 4. Ship it

Review the result. When you are satisfied, publish it:

```text
/vs-ship-it
```

`/vs-ship-it` creates the commit and pull request, verifies the published state,
and can keep watching CI and review when you ask it to.

That is the complete beginner workflow. Use these three skills for your first few
changes. The rest of vs is there when you need more control over a specific kind
of work.

## Discover the layers

vs is designed in layers. Start with the top layer and discover the others only
when you need them:

| Layer | Skills | Use them for |
|---|---|---|
| Core workflows | `/vs-shape-it`, `/vs-build-it`, `/vs-ship-it` | Taking a change from idea to pull request |
| Advanced workflows | `/vs-improve`, `/vs-bugfix`, `/vs-fix-pr`, and others | Starting from a different situation or owning a specialized outcome |
| Building blocks | `/vs-tdd`, `/vs-debug-mode`, `/vs-qa`, `/vs-verify`, and others | Controlling one specific phase directly |

The higher-level workflows already use the building blocks under the hood. For
example, `/vs-build-it` can challenge the plan, resolve tactical uncertainty,
use TDD or debugging, review the diff, run QA, verify the result, and produce a
brief by composing the relevant lower-level skills.

You do not need to run that chain yourself. Use the core workflow by default.
When you want only one part—for example, a root-cause investigation or a final
verification—you can invoke `/vs-debug-mode` or `/vs-verify` directly.

### Advanced workflows

| Skill | Use it to |
|---|---|
| `/vs-improve` | Audit a repo and write prioritized implementation plans without editing source |
| `/vs-bugfix` | Reproduce, fix, verify, and review a bug end to end |
| `/vs-fix-pr` | Evaluate and address PR feedback with approval before replies or resolution |
| `/vs-baby-sit` | Keep a PR merge-ready as CI and review state changes |
| `/vs-orchestrate` | Coordinate a multi-milestone project via a living roadmap, one milestone at a time |

`/vs-improve` can also find or specify work before the main flow:

```text
Find direction:       /vs-improve next -> /vs-shape-it -> /vs-build-it
Specify one concern:  /vs-improve plan <thing> -> /vs-build-it
Before shipping:      /vs-improve branch -> /vs-ship-it
```

### Building blocks

| Skill | Use it to |
|---|---|
| `/vs-pushback` | Stress-test an idea, spec, or plan, with risk-gated independent model challenge |
| `/vs-prototype` | Answer one UI or logic question with throwaway code |
| `/vs-github-research` | Find external GitHub examples, patterns, and prior art |
| `/vs-htmdx` | Turn source material into one portable visual HTMDX artifact |
| `/vs-rfc-research` | Turn code and research evidence into an RFC, ADR, or proposal |
| `/vs-tdd` | Run a red-green-refactor loop |
| `/vs-debug-mode` | Find a root cause before proposing a fix |
| `/vs-roast-review` | Review a diff in two passes, with a second opinion for substantial changes |
| `/vs-roast-ui` | Review a UI for hierarchy, accessibility, responsiveness, and generic design |
| `/vs-qa` | Test a web interface in a browser, fix issues, and verify again |
| `/vs-verify` | Prove a change works with concrete evidence |
| `/vs-deslop` | Simplify bloated or repetitive code without changing behavior |
| `/vs-write` | Write or reshape clear prose without losing substance |
| `/vs-brief` | Turn a git diff into a concise review brief |
| `/vs-perf` | Optimize performance against an explicit evaluator |
| `/vs-to-issues` | Turn a plan, spec, or RFC into vertical-slice GitHub issues |
| `/vs-steal` | Find ideas worth porting from another repository |
| `/vs-setup-adr` | Add an ADR convention and scaffolding to a repository |
| `/vs-decide-for-me` | Resolve tactical uncertainty before interrupting you |
| `/vs-next` | Decide whether the current work should continue, delegate, hand off, compact, clear, or stop |
| `/vs-analyze-thread` | Diagnose Codex, Claude Code, or Cursor conversations from transcript evidence |
| `/vs-recap` | Explain the current situation or recent changes from zero prior context, with next actions |
| `/vs-retro` | Extract session learnings and route them to durable destinations |
| `/vs-try-skill` | Blind-test a skill and compare its behavior with expectations |

## Why this workflow exists

Most agent workflows fail in one of two ways:

- The agent decides too much. It guesses through meaningful ambiguity and
  confidently builds the wrong thing.
- The agent asks too much. It stops for routine choices, turning you into an
  approval queue.

vs separates strategic decisions from routine execution. Its skills use explicit
handoffs, bounded loops, verification gates, and circuit breakers. They stop when
your judgment is required and keep moving when the next step is mechanical.

At phase boundaries, VS also separates the semantic next workflow from context
treatment. The agent chooses whether to continue, delegate bounded work, create
a durable handoff, compact, clear, or stop. `/vs-next` exposes that reasoning
directly when you ask what should happen next; workflows use the same contract
internally, so remembering the command is optional.

## Installation options

vs ships native plugin manifests for Claude Code, Codex, and Cursor. All three
load the same `SKILL.md` files under `skills/`.

### GitHub CLI

This uses your existing `gh` authentication and also works for private clones:

```bash
gh api repos/vltansky/vs/contents/install.sh -H "Accept: application/vnd.github.raw" | bash
```

From a clone, run `./install.sh` or `npm run install-plugin`.

### Claude Code

```text
/plugin marketplace add vltansky/vs
/plugin install vs@vs
```

### Codex

```bash
codex plugin marketplace add vltansky/vs
codex plugin add vs@vs
```

### Cursor

Cursor 2.5+ has no plugin-install CLI. Import `vltansky/vs` through your team
marketplace, or clone the plugin locally and reload Cursor:

```bash
git clone https://github.com/vltansky/vs ~/.cursor/plugins/local/vs
```

You can also copy any self-contained directory under `skills/` into your agent's
skills folder.

## Included tooling

vs includes [octocode MCP](https://github.com/bgauryy/octocode-mcp) for
evidence-backed code research. It supports `/vs-github-research`,
`/vs-rfc-research`, `/vs-steal`, and prior-art passes in `/vs-shape-it` and
`/vs-pushback`.

Optional tools add capabilities without being required for the rest of vs:

- [dev-browser](https://github.com/anthropics/dev-browser) for browser QA
- [`gh`](https://cli.github.com/) for PR creation and review threads
- [Codex CLI](https://github.com/openai/codex) for cross-model review

## Developing skills

```text
skills/            skill definitions and supporting files
skills/vs-*/test/  PathGrade behavior evals and fixtures
adr/               architecture decision records
vitest.config.ts   PathGrade plugin configuration
```

Skill behavior is tested with
[`@wix/pathgrade`](https://github.com/wix-incubator/pathgrade), which runs a real
coding agent against each skill and scores the result. Evals live beside their
skills in `skills/vs-*/test/*.eval.ts`.

On macOS, PathGrade can reuse local Claude Code or Codex subscription credentials
from Keychain. Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` only when you want to
use a key or proxy instead.

```bash
npm install
npm run typecheck
npm run eval:static
npm run eval
npx vitest run skills/vs-shape-it/test
PATHGRADE_AGENT=codex npm run eval
npm run eval:preview
```

Use `npm run eval:static` as the default edit loop. Each behavior eval starts a
live agent, so the full `npm run eval` suite takes minutes and may require agent
credentials.

## Acknowledgements

vs builds on ideas from
[superpowers](https://github.com/obra/superpowers),
[Matt Pocock's skills](https://github.com/mattpocock/skills),
[oh-my-claudecode](https://github.com/yeachan-heo/oh-my-claudecode),
[gstack](https://github.com/garrytan/gstack),
[shadcn/improve](https://github.com/shadcn/improve),
[OpenClaw's agent skills](https://github.com/openclaw/agent-skills), and
[Impeccable](https://github.com/pbakaus/impeccable).

The pipeline framing owes a lot to gstack. vs applies these ideas to repository
work with explicit skill layers, flow contracts, built-in review and testing,
and durable handoffs between humans and coding agents.

See [Third-party notices](THIRD_PARTY_NOTICES.md) for source and license details.

## License

MIT
