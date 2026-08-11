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
- The final handoff shell of each workflow is exempt; it is the contract, not
  progress narration.

## Progress emissions

Emit one line at each phase boundary while a long autonomous run is in flight,
so the user can see movement without asking:

```text
[3/7] The first working slice is committed; 4 of 6 steps are done and tests still pass.
```

Emit when a phase starts and when it ends. Do not emit per file edit, per tool
call, or per test run.

## The artifact

Non-trivial runs write one portable HTMDX file and give the user its path.
Follow [`rich-artifacts.md`](./rich-artifacts.md) for the single-file source
contract, the pinned runtime, and the sensitive-data fallback; follow
[`../../vs-htmdx/SKILL.md`](../../vs-htmdx/SKILL.md) for authoring.

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
