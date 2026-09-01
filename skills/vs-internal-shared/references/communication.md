# Communication contract — report through a live artifact

Shared by `vs-shape-it`, `vs-build-it`, and `vs-ship-it`. It defines what the
user sees while a phase runs and what they get when it ends.

One rule underneath all of it: **a phase may not claim an outcome it cannot
show.** Everything below is a mechanism for making claims showable.

## The three phases have different jobs

| Phase | User's role | What the user must receive |
|---|---|---|
| shape-it | Very active — makes the strategic calls | Decisions to make, one at a time, each with a recommendation |
| build-it | Passive — the agent is autonomous | Visible progress while it runs, and evidence of what it did |
| ship-it | Takes over | A surface they can try, and a list of what was and was not proven |

Autonomous does not mean silent. Build-it decides without asking; it still
reports while it works.

## Chat budget

Chat is the index. The artifact is the content.

Arrange whatever survives this budget per
[`output-style.md`](./output-style.md): answer first, with every required next
step in one optional `Your action` section.

- At each phase boundary, emit at most a few lines: what finished, the single
  number or verdict that matters, what runs next.
- Detail — tables, screenshots, before/after, decision logs, command output —
  goes into the artifact, not into chat.
- Never paste a wall of markdown that duplicates a file the user can open.
- Final handoffs obey the same chat budget. Required detail that does not fit
  belongs in the artifact; the handoff keeps only the outcome, action, material
  evidence gap, and artifact link.

For explanations and review results, also apply
[`explanation-surfaces.md`](./explanation-surfaces.md): simple answers stay in
chat, while complex answers use a chat TLDR plus one visual HTMDX review surface.

## Visual progress checkpoint

The user-facing process has four phases: **Alignment**, **Shaping**, **Your
input needed**, and **Handoff**. At every user-visible phase change, show one
compact checkpoint that explains the topic, current phase, completed work,
completed subskills and their contributions, and the workflow's output:

```text
─── <TOPIC> ───

Progress: <25|50|75|100>% <█░░░|██░░|███░|████>
<✓|→|○> Alignment: <concrete state>
<✓|→|○> Shaping: <concrete state>
<✓|→|○> Your input needed: <the decision, or "none">
<✓|→|○> Handoff: <concrete state>
Subskills completed: </vs-* → concrete contribution; ...> or <none yet>
Output: <durable deliverable and its state>
```

The percentage is the current phase ordinal, not confidence, elapsed work, or
an estimate: 25% Alignment, 50% Shaping, 75% Your input needed, and 100%
Handoff. The four-character bar mirrors that ordinal exactly.

Use the user's topic as the header. Write concrete states such as `pilot goal
aligned` or `scope ready for approval`; do not repeat the phase label as its
description. List a subskill only after it finishes, in completion order, and
pair it with the concrete result carried into the parent workflow. Do not list
active or planned subskills, tools, agents, references, or the parent workflow
itself. Use `none yet` until the first subskill finishes.

`Output` names what the current workflow is producing, plus `drafting`,
`ready`, or `blocked` and a path when one exists. For shape-it, use `Goal
Contract + Execution Strategy`; do not reduce the output to `plan` or `spec`.

Session internals stay hidden: compact, clear, continue, subagent, stop, and
the session-action named handoff. Those belong to
[`phase-boundaries.md`](./phase-boundaries.md). The user step named Handoff is
the last of the four user steps, not that session action.

`vs-shape-it` ships this first. `vs-build-it` and `vs-ship-it` inherit this
section by pointer. Do not copy the whole contract into those skills.

## Progress emissions

Emit one checkpoint at each phase boundary while a long autonomous run is in
flight, so the user can see movement without asking. When the user-visible
phase changes, use the visual progress checkpoint above.

```text
[3/7] The first working slice is committed; 4 of 6 steps are done and tests still pass.
```

Emit when a phase starts and when it ends. Do not emit per file edit, per tool
call, or per test run.

## The artifact

Non-trivial runs write one portable HTMDX file and give the user its path.
Follow [`rich-artifacts.md`](./rich-artifacts.md) for the single-file source
contract, the pinned runtime, and the sensitive-data fallback; follow
`/vs-show-me` ([`../../vs-show-me/SKILL.md`](../../vs-show-me/SKILL.md)) for authoring.

A run is non-trivial when it changed observable behavior, captured
before-and-after evidence, ran QA, or made a durable decision. A one-line
documentation fix does not need an artifact.

Store it under `~/.vs/$PROJECT_ID/<phase>/YYYY-MM-DD-<slug>.html`, resolving
`$PROJECT_ID` per [`../SKILL.md`](../SKILL.md).

## Opening an artifact

When a phase is required to show the user a report rather than link it, open it
with the host's platform-appropriate command:

```bash
case "$(uname -s)" in
  Darwin) open "$REPORT_PATH" ;;
  Linux)  xdg-open "$REPORT_PATH" >/dev/null 2>&1 & ;;
  MINGW*|MSYS*|CYGWIN*) start "" "$REPORT_PATH" ;;
esac
```

If no opener is available, print the absolute path and say it could not be
opened. Do not claim the report was shown.

## Install freshness

Skill text only takes effect once the installed copy matches the source. Any
change to skill content bumps `version` in `.claude-plugin/plugin.json` and
`package.json` together, so the plugin cache directory changes.

A version bump alone does not update anyone's install. When a workflow run
changes skill content, its handoff states the exact re-install command and
treats "the user has the new behavior" as an unproven claim until the installed
copy is verified.
