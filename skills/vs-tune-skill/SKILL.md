---
name: vs-tune-skill
description: "Use when asked to tune or grade a repo's installed skills from past local chats (any project, not vs itself), or when the user types /vs-tune-skill."
---

# Tune Skill

Grade a repository's installed agent skills from real local conversation
history, then propose mergeable `SKILL.md` diffs in scratch. Building block.
Works on any project's skills, not only this vs repo.

This is not `/vs-improve` (codebase advisor) and not `/vs-search-threads`
(finds chats). Compose `/vs-search-threads` only when you need a session
inventory and that is cleaner than running the collector twice.

The flow is local-only: discover skills, score matching transcripts, write
improved copies plus unified diffs under a fresh `mktemp` directory, then
render one human-review page. Inspired by Warp's skill-doctor idea (transcript
grade → proposed diffs). Do not vendor Warp text, scripts, HTML, report
chrome, or a factories CTA.

## Flow Contract

- **Kind:** Building block
- **Inputs:** A target repo (default: cwd), optional one skill name (default:
  grade every installed skill; scope only if the user already named one —
  do not ask and do not open a picker), optional extra skill dirs, optional
  lookback window, optional named Cursor Markdown / Grok Bot JSONL paths
- **Outputs:** Local inventory, a scorecard with three findings, scratch
  `SKILL.md` copies and unified diffs, one HTMDX review page, a chat TLDR
- **Status:** `GRADED` (sessions existed), `NO_SESSIONS` (widen the window),
  `NO_SKILLS` (creating skills is the finding), or `BLOCKED`
- **Consumers:** Skill authors; `/vs-eval` after a contract change; `/vs-htmdx`
  for the review page; `/vs-search-threads` for inventory
- **Skip conditions:** Skip when the ask is a codebase audit (`/vs-improve`)
  or a hunt for a past chat (`/vs-search-threads`) rather than grading
  installed skills against those chats

## Guardrails

- Discover skills under the target repo's `skills/` (vs layout). Add extra
  directories only when the user names them. Do not require Warp-only
  `.agents/skills`.
- Collect recent local sessions whose working directory is the target repo.
  Support at least Claude Code project-history JSONL and/or Codex rollouts.
  Accept a Cursor Markdown export or Grok Bot JSONL only when the user names
  a path. Never upload transcripts, session files, or excerpts.
- If the collector finds zero sessions, say so, suggest widening the window
  or checking the repo path, and stop. If it finds zero skills, continue:
  creating skills is the finding.
- Never write into the real skill tree on a default run. Scratch only. Ask
  whether to apply. Apply only after the user says to.
- Do not edit PathGrade: not wix-private/pathgrade, not `@wix/pathgrade`,
  not `.pathgrade` internals.
- Do not auto-open the HTML page unless the user asks.

Let `SKILL_ROOT` be the directory containing this `SKILL.md`.

```bash
REPORT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vs-tune-skill-XXXXXXXX")"
```

## 1. Discover and collect

```bash
node "$SKILL_ROOT/scripts/collect-sessions.mjs" --repo "$TARGET_REPO" --out "$REPORT_DIR"
```

Useful flags: `--days`, `--max-sessions`, `--skills-dir` (repeatable),
`--cursor-export`, `--grok-jsonl`, `--claude-home`, `--codex-home`.

Default: grade every discovered skill. If the user already named one skill,
score only that one. Do not ask which skill to grade.

You may compose `/vs-search-threads` to list candidate sessions, then pass
only the repo-matching paths into the collector. Print paths and timestamps,
not transcript bodies, until you score.

Read the inventory the collector wrote. Treat a missing inventory as
`NO_SESSIONS` and stop. Do not invent sessions.

## 2. Score each sampled transcript

Score in this process, or in a local child that keeps transcript bytes on
this machine. Two axes, both required:

1. **Waste versus the written contract.** Did the agent redo discovery, skip
   a named gate, or invent steps the skill already specified?
2. **Fire and follow.** Did an installed skill trigger, and was its Flow
   Contract followed?

Call out vs defects when the transcript shows them: slogan-only skills,
missing exclusive contracts, mention-only evals, a missing Flow Contract,
weak trigger descriptions that never fire, and steps invented by trial and
error. An installed skill that never fired in the sample is usually a
description or trigger problem, not proof the skill is unused on purpose.

Record a label, a 0–1 score, and a one-to-three sentence reason that cites
a session and a moment. If a session has no code or skill work, mark
`insufficient_evidence` and drop it from that axis average.

## 3. Aggregate

- `efficiency` — mean waste-versus-contract scores
- `follow_through` — mean fire-and-follow scores
- `skill_coverage` — fraction of sampled sessions where at least one
  installed skill was detected (0 when `skills_found` is 0)
- `overall = 0.5 * efficiency + 0.35 * follow_through + 0.15 * skill_coverage`

Lead with a scorecard and the three most concrete findings. Each suggestion
names a skill (existing or new), the change, and the session moment that
justifies it. Generic best-practice lists fail this skill.

## 4. Draft diffs in scratch

For each justified edit:

1. Read the current skill file (path is in the inventory).
2. Write the full improved `SKILL.md` under `$REPORT_DIR/proposed/<name>/`.
3. Write a unified diff (`diff -u`) next to it.

Change only what the sessions justify: the trigger that never fired, the
missing preflight, the step the agent had to discover. For a proposed-new
skill, write the complete file and treat the diff as an addition.

Do not modify the user's real skill files in this step.

## 5. Human review

Compose `/vs-htmdx` for one picture page. Use `layout: default`. Never use
`layout: vs`. The page shows the scorecard, three findings, and the proposed
diffs. Do not auto-open the HTML unless the user asks.

Chat TLDR is only: the grade, the three findings, and the review-file path.
Do not paste the page body.

## 6. Close

Ask whether to apply the scratch diffs. Default is no.

Direct: emit **Next** only after that question. Composed: return the TLDR
and the scratch path to the caller.

## Output style

Apply the shared output style at
../vs-internal-shared/references/output-style.md to every user-facing
message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** installed skills plus local chats
**Next:** done
**Relevant:** none
