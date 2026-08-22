---
name: vs-explain-diff
description: "Use when the user asks to explain, teach, or deeply understand a code change, PR, branch, or commit range — 'explain this PR', 'teach me this change', 'help me understand this diff', 'walk me through this branch', 'onboard me to this code change', 'why does this change work'. Produces one HTMDX explainer with background, intuition, a code walkthrough, and reader self-check questions."
---

# Explain Diff

Teach a reader why a change works, not just what it touched.

The deliverable is an explainer someone reads once and then understands the
subsystem: deep background, the core intuition on toy data, a grouped code
walkthrough, and questions that let the reader confirm they got it.

## Boundary

This skill is expensive by design — it explores surrounding code and writes
long-form. Route elsewhere when the reader needs less:

| Reader needs | Use |
|---|---|
| Understanding of why the change is designed this way | this skill |
| Orientation: what changed, where to look | `/vs-brief` |
| Current situation and next decision | `/vs-recap` |
| Judgment on whether the change is good | `/vs-roast-code` |

Do not run this on a typo, version bump, or config tweak. Say the change does
not need an explainer and offer `/vs-brief` instead.

## Step 1: Resolve the change

Ask for the target only when the request is ambiguous. Otherwise resolve in this
order: an explicit ref the user named, an open PR, then the current branch.

```bash
UPSTREAM_REF=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
BASE=$(git merge-base HEAD "$UPSTREAM_REF" 2>/dev/null)
[ -z "$BASE" ] && BASE=$(git rev-list --max-parents=0 HEAD | tail -1)
git diff --stat "$BASE"...HEAD
```

For a PR, prefer `gh pr diff <n>` plus `gh pr view <n> --json title,body,comments`
— the description and review discussion often carry the intent the diff cannot.

Stop with `BLOCKED_NO_DIFF` when there is no meaningful diff.

## Step 2: Read for teaching

A summary can be written from the diff alone. An explanation cannot.

1. Read the changed files whole, not just the hunks.
2. Read the callers and callees the change sits between, and the tests that
   pin its behavior.
3. Read the commit messages, PR body, and any linked issue for stated intent.
4. Name the single core idea in one sentence. If you cannot, keep reading.
5. Separate what the reader must already know from what this change introduces.

Mark inference as inference. When the reason for a design choice is not in the
code, commits, or discussion, say it is your reading rather than asserting
intent the author never stated.

## Step 3: Pick two or three diagram families

Choose a small set of diagram shapes and reuse them across the whole document,
so the reader learns to read one visual language instead of five. Useful
families:

- a simplified view of what the user sees, for behavior changes;
- a data-flow or component diagram, always carrying example values;
- a before-and-after pair in the same shape, so the delta is the only difference.

Reuse beats novelty. A third variant of a diagram the reader already understands
is worth more than a new abstraction.

## Step 4: Write the four sections

**Background** — two layers. First the deep version for a reader new to this
area, explicitly marked skippable. Then the narrow version covering only the
code this change touches.

**Intuition** — the essence, not the details. Trace one concrete example with
small invented values through the old path and the new one. This is where
diagrams do most of the work.

**Code** — a walkthrough grouped by idea, not by file. Order the groups so each
builds on the last. Quote the code that carries the change and skip the
mechanical rest.

**Self-check** — five questions, per Step 5.

Write in the register of a good systems-book chapter: concrete, ordered,
transitions that carry the reader forward, no hype and no filler summary
paragraphs. Prefer a worked example over an adjective.

## Step 5: Write self-check questions

Five questions the reader can only answer by having understood the change.

- Medium difficulty: substantive, not gotchas, not trivia about names or line
  counts.
- Each question's answer must be derivable from the explainer plus the diff.
- Give the answer and a short why, so a wrong guess teaches something.
- Write the answers as reveals, not inline text, so the reader can try first.

Render each as one `AccordionItem`: the question in `AccordionTrigger`, the
answer and reasoning in `AccordionContent`. The HTMDX runtime has no scored
quiz component, so this is reveal-on-click, not grading — do not promise a
score.

If you cannot write five questions that pass the derivable test, the explainer
is still too shallow. Return to Step 2.

## Step 6: Render

Delegate rendering to [../vs-htmdx/SKILL.md](../vs-htmdx/SKILL.md), which owns
the pinned runtime, the artifact shell, and the render check. Pass it the
finished content and this destination:

```text
~/.vs/$PROJECT_ID/explanations/YYYY-MM-DD-<change-slug>.html
```

Resolve `$PROJECT_ID` with
[../vs-internal-shared/SKILL.md](../vs-internal-shared/SKILL.md). Derive the
slug from the PR title or branch name. When the path already exists, add a
numeric suffix rather than overwriting.

Use `layout: vs` and ordinary `###` sections for the four-section spine —
it is read in order, so it is not a `Tabs` case. Do not produce a Markdown twin.

## Handoff

Return:

- `Explains:` the change, by ref
- `Core idea:` the one-sentence essence
- `Saved:` a clickable absolute path to the `.html`
- `Verified:` structural checks and, separately, rendered browser proof
- `Status: READY_FOR_REVIEW`

Do not echo the document body into chat.

## Flow Contract

- **Kind:** Building block
- **Inputs:** a PR number, branch, commit range, or working diff, plus the
  surrounding code the change depends on
- **Outputs:** one portable `.html` explainer with background, intuition, code
  walkthrough, and five self-check questions
- **Status:** `READY_FOR_REVIEW | BLOCKED_NO_DIFF | SKIPPED_TRIVIAL`
- **Consumers:** direct human invocation, onboarding a reviewer or teammate to
  an unfamiliar change
- **Skip conditions:** trivial diff, or the reader wants orientation or a
  quality judgment rather than understanding

## Output style

Apply the [shared output style](../vs-internal-shared/references/output-style.md)
to every user-facing message.

## Workflow

Direct: emit **Next** only. Composed: return to caller.

**Prev:** a merged, open, or in-progress change the reader needs to understand
**Next:** done
**Relevant:** `/vs-htmdx` | `/vs-roast-code`
