---
name: afk
description: "Use when the user says afk or asks you to keep working while they are away. Runs a scoped autonomous work session with stop-hook cleanup."
disable-model-invocation: true
---

# AFK — Autonomous Work Session

Use the available time to make scoped progress on the current conversation, branch, PR, or task list; stop for strategic blockers, product-intent changes, unrelated work, or explicit safety boundaries.

## Codex Goal Integration

When running in Codex, use
[`../internal-shared/references/codex-goal.md`](../internal-shared/references/codex-goal.md)
for goal ownership and completion rules.

AFK owns a time-boxed session goal after Step 2 identifies the work source and
Step 3 defines the session plan. The objective should include the work source,
time budget, and expected evidence. Complete the goal only after the Ralph hook
is removed and the AFK handoff reports completed work, current branch/PR state,
CI/review status, and any needs-attention items. If time expires with blockers,
leave the goal active or blocked according to Codex goal policy and report why.

## Step 0: Initialize + install Ralph loop hook

Parse duration from invocation args (`/afk 30m`, `/afk 2h`, `/afk 1.5h`, or unset for the default cap) with this deterministic snippet before installing hooks:

```bash
ARG="${1:-}"
if [[ -z "$ARG" ]]; then
  DURATION_SECS=3600
elif [[ "$ARG" =~ ^[0-9]+s?$ ]]; then
  DURATION_SECS="${ARG%s}"
elif [[ "$ARG" =~ ^[0-9]+([.][0-9]+)?m$ ]]; then
  DURATION_SECS=$(awk -v n="${ARG%m}" 'BEGIN { printf "%d", n * 60 }')
elif [[ "$ARG" =~ ^[0-9]+([.][0-9]+)?h$ ]]; then
  DURATION_SECS=$(awk -v n="${ARG%h}" 'BEGIN { printf "%d", n * 3600 }')
else
  echo "Invalid AFK duration: $ARG. Use seconds, 30m, 2h, or 1.5h." >&2
  exit 2
fi
```

Then install the stop hook that keeps this session looping until time expires:

```bash
SKILL_DIR="${SKILL_DIR:-plugins/vs/skills/afk}"
bash "$SKILL_DIR/hooks/install.sh" on "$DURATION_SECS"
```

The hook registers a `Stop` handler in whichever host configs exist, both project-local:
- Claude Code → `$REPO/.claude/settings.local.json`
- Codex → `$REPO/.codex/hooks.json` (may trigger a one-time trust prompt on first Codex run)

Both hosts share the same `{"decision":"block","reason":...}` Stop-hook contract, so one `ralph-stop.sh` script serves both. The hook re-prompts the agent to keep working until the state file's budget runs out.

**How to end the loop:**
- Natural: time expires → hook deletes state → stops cleanly
- **Type anything at the prompt** — a `UserPromptSubmit` hook wipes state the moment you're back. This is the default way to interrupt.
- Close/reopen the host — `SessionStart` hook wipes stale state on next launch (handles force-quit / Ctrl+C mid-turn).
- Manual: `bash "$SKILL_DIR/hooks/install.sh" off`
- Nuclear: `rm ~/.vs/afk/state.json`

```bash
START_TIME=$(date +%s)
echo "AFK session started: $(date) — duration ${DURATION_SECS}s"
```

## Step 1: Time calibration

Agent time is not human time. Plan accordingly:

| Time given | What to plan for |
|------------|-----------------|
| 30 min | substantial feature — multiple files, tests, PR creation |
| 1 hour | large feature or 2–3 tasks end-to-end |
| 2h+ | complete initiative — implement, test, PR, iterate on CI |
| no duration | default 1 hour cap |

Do not underscope inside the selected scope. If in-scope work is exhausted, stop with a handoff instead of expanding to unrelated tasks.

## Step 2: Read context (priority order)

Run these to understand what to work on:

```bash
# 1. Current branch and uncommitted state
git branch --show-current
git status -s
git diff --stat HEAD

# 2. Recent commits (what was being built)
git log --oneline -10

# 3. Open PR on this branch (if any)
gh pr view --json number,title,reviewDecision,isDraft 2>/dev/null

# 4. Failing CI on current PR
gh pr checks 2>/dev/null | grep -v "pass\|success" | head -10
```

Work source priority:
1. **Explicit goal in current conversation** — execute it
2. **Uncommitted changes on current branch** — continue implementing
3. **Failing tests or CI on this branch** — fix them
4. **Open PR with review comments** — address them
5. **`TASKS.md` in repo root** — pick next unchecked item

Pick the highest-priority source with work to do. If multiple sources have work, start with the highest and move down as each completes.

If the work source is a new issue, PR, feature branch, or long-running parallel
task and the current checkout is not already a clean matching branch, establish
the branch/worktree boundary directly before starting AFK execution. Preserve
unrelated dirty state; stop rather than hiding user work.

## Step 3: Plan

Based on available time and work source, list what will be done this session.
Be specific: file names, functions, test cases. Scale ambition to the time budget (see Step 1).

Log the plan as a decision log entry: what to work on and why.

## Step 4: Execute

Work through the plan. For each task:

1. Read relevant files before changing anything
2. Implement the change
3. Run guardrails (test, typecheck, lint — use whatever the project has)
4. Fix guardrail failures before moving to the next task
5. Commit: descriptive message, stage specific files only
6. Push

### No-questions contract (decide-for-me applied)

The user is unreachable. Resolve every question with the `decide-for-me` decision ladder before considering a stop:

1. **Decide locally** — pick the most reasonable interpretation from context.
2. **Verify locally** — read files, grep, run one targeted command.
3. **Verify via subagent** — for edge-case discovery, blast-radius, prior art, or any independent objective lookup. Prefer this over pausing.
4. **Log the judgment call** — write what was ambiguous and why you chose X. Keep moving.

Avoid escalating tactical questions mid-session. Escalate immediately for safety/policy boundaries or irreversible strategic decisions; otherwise log truly strategic blockers under "Needs attention" in the handoff and work around them (skip that task, work on another).

When hitting a conflicting requirement or ambiguous review comment: best-effort call, log, continue.

### PR-mode: hand off to baby-sit

If the chosen work source is "open PR" (review comments / failing CI), switch to the `/baby-sit` loop for that PR:

- Follow `../baby-sit/SKILL.md`. Its loop already handles review threads, CI fixes, and idle-wait cadence.
- The Ralph hook stays installed — baby-sit's waits happen inside the same session, so the Stop hook won't fire between its polls.
- When baby-sit returns (merge-ready / blocked / merged), pull the next work source and continue.

### Time check between tasks

After each task completes:

```bash
NOW=$(date +%s)
ELAPSED=$(( NOW - START_TIME ))
echo "Elapsed: ${ELAPSED}s / ${DURATION_SECS}s"
```

If `DURATION_SECS > 0` and `ELAPSED >= DURATION_SECS`: stop, go to Step 5.
If time remains: pull next task from the work queue and continue.

## Step 5: Handoff

Uninstall the Ralph loop hook first so the next normal session isn't forced to keep looping:

```bash
SKILL_DIR="${SKILL_DIR:-plugins/vs/skills/afk}"
bash "$SKILL_DIR/hooks/install.sh" off
```

Then print a compact summary so the user can pick up without context loss:

```
## AFK session complete

**Duration:** Xs elapsed (of Ys given)
**Work source:** <what was worked on and why>

**Completed:**
- [task]: [commit sha] — [one-line description]
- ...

**Judgment calls:**
- [what was ambiguous]: chose [X] because [reason]
- ...

**Codex Goal:** created/reused/completed/unavailable/left active because ...

**Current state:**
- CI: pass / fail / pending
- Open threads: N
- Branch: <name>, pushed to remote

**Needs attention:**
- [blockers or ambiguous items the human should resolve]
```

If nothing was found to work on: say so clearly and explain what was checked.

## Verification

- [ ] Duration parsed and tracked via `date +%s`
- [ ] Ralph stop hook installed at Step 0 and removed at Step 5 (check `.claude/settings.local.json`)
- [ ] Work source identified from context (not guessed)
- [ ] PR-mode sessions delegated to `baby-sit`, not reimplemented inline
- [ ] No-questions contract held — every ambiguity resolved via decide-for-me ladder, logged in handoff
- [ ] Time budget used ambitiously — not one small task and done
- [ ] All commits pushed to remote before handoff
- [ ] Handoff includes current state so user can pick up cleanly

## Workflow

**Prev:** any in-progress work session
**Next:** user returns, reviews handoff summary | `/baby-sit` (if a PR needs watching) | `/ship-it` (if work is done and needs a PR)
