---
name: vs-try-skill
description: "Use when asked to blind test, dogfood, or try a skill change. Spawns a fresh agent and compares actual behavior to expectations."
---

# Try Skill (Blind Subagent Test)

Exercise a skill through a fresh subagent that has **no knowledge of what you expect**. You hold the expected outcome. The subagent reports what actually happened. You compare.

**Mechanism:** a nested fresh agent spawned through whichever primitive the current harness provides:
- **Claude Code:** `Agent` tool with `subagent_type: "general-purpose"` — child inherits the same skill registry automatically.
- **Codex:** `spawn_agent` with `fork_context: false` + `wait_agent` — child does NOT automatically see repo-local skills; point it at the project root (or an `AGENTS.md` that routes to the target skill) so it can discover the skill on its own.
- **Fallback:** fresh subprocess (`codex exec` or `claude -p`) — only if no native primitive is available; note the harness used in the report.

Use `skill-test` for scripted offline regression runs; use this skill for live mid-iteration dogfooding.

Why blind: if the subagent knows the expected behavior, it rubber-stamps. The whole point is to catch the gap between what your SKILL.md *says* and what a model *does* when it reads the SKILL.md cold.

## Step 1: Identify target skill

From the conversation, pick the skill under test. Usually the one just edited. Confirm with the user if ambiguous.

Read the current `SKILL.md` so you understand what it's supposed to do.

## Step 2: Write down expected behavior (privately)

Before spawning the subagent, write a short internal checklist of what *should* happen when the skill is invoked. Do NOT share this with the subagent.

Expected behavior typically includes:
- Which trigger phrase should activate the skill
- First 2-3 actions the agent should take (tools, files, commands)
- Any mandatory artifact, canary, or output shape the SKILL.md requires
- Any guardrails (things it should refuse to do)

Keep this in your head / in notes — it is the ground truth you will compare against later.

## Step 3: Craft a blind prompt

The prompt to the subagent must be a **natural user utterance** — the kind of thing a real user would type that should trigger the skill. It must NOT:

- Name the skill explicitly ("use bugfix")
- Describe the expected steps ("first read X, then run Y")
- Hint at the SKILL.md's internal structure
- Mention that this is a test

Good prompts look like real requests. Example for a bugfix skill: *"Login button on /settings does nothing when clicked — fix it."* Bad prompt: *"Use the bugfix skill and make sure you write a failing test first."*

## Step 4: Spawn the subagent

Use the harness's native fresh-agent primitive (see Mechanism above). Confirm the child can actually discover the target skill before you judge the trigger:

- Claude Code: the `Agent` tool inherits the skill registry — no setup needed.
- Codex: `spawn_agent` does not automatically expose repo-local skills. Point the child at the project root so it can read `AGENTS.md` / `skills/<name>/SKILL.md`, or hand it the skill path and let it discover the right one via description match.
- Fallback subprocess: `codex exec <cwd> "<prompt>"` or `claude -p "<prompt>"` — only if no native primitive exists; note it in the report.

If the child can't even see the skill, that is a **distribution bug**, not a trigger-phrasing bug — surface it separately.

Prompt template:

```
<the natural user-style trigger from Step 3>

After you finish (or at a reasonable stopping point), report in under 200 words:
- Which skill (if any) you invoked and why
- Your first 3-5 actions in order (tools called, files read, commands run)
- Any mandatory section / artifact / canary you produced
- Anything you refused or flagged

Report actual behavior only. Do not speculate about what you were "supposed" to do.
```

Run the subagent in the foreground — you need its report to proceed.

## Step 5: Compare actual vs expected

Put your private expected behavior (Step 2) next to the subagent's report (Step 4). Call out concrete divergences:

- **Skill didn't trigger** → description/trigger phrases are too narrow or buried
- **Wrong first action** → instructions are ambiguous, ordering unclear, or a louder rule dominates
- **Missed a mandatory step** → that step isn't prominent enough in SKILL.md or is phrased as optional
- **Did something not in the skill** → model is guessing or pulling from training priors
- **Refused correctly / triggered correctly** → confirm and note

Report to the user as a short diff, not a narrative. Example:

```
Expected: read SKILL.md, write failing test, then implement
Actual:   jumped straight to implementation, no test written
Gap:     "Step 1: write a failing test" is buried under a long preamble — lift it up
```

## Step 6: Recommend the SKILL.md edit

For each gap, suggest the smallest concrete change to SKILL.md that would fix it (move a line up, tighten a trigger phrase, replace a soft verb with a rule). Do not edit the file yourself unless the user asks — the user decides whether to apply the fix or re-test first.

If the user applies a fix, offer to re-run Step 3-5 with the same blind prompt to verify the change moved the needle.

## Notes

- One blind run is a signal, not proof. For flaky behavior, run 2-3 blind runs with slightly varied prompts before drawing conclusions.
- If the subagent's report mentions your expected behavior verbatim, you leaked context — rewrite the prompt.
- This is complementary to `skill-test` (offline `claude -p` canary runs) — use `vs-try-skill` mid-iteration, `skill-test` for scripted regression.
- Does not produce session artifacts. Comparison is inline.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** skill change | behavior hypothesis
**Next:** done
**Relevant:** `/vs-retro` | `/vs-analyze-thread`
