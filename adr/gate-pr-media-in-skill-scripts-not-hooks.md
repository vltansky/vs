# Gate PR media in skill scripts, not hooks

Date: 2026-09-09

## Context

`vs-ship-it` already asked for matched screenshots and a short recording on
frontend changes, but nothing checked that the PR body carried them. The
failure is silent: the code lands, the body reads well, and the reviewer sees
nothing. Capturing was also token-expensive when done by hand: the agent wrote
Playwright ad hoc, then read the screenshots back into context to caption them.

Prior art splits two ways. Harness hooks (a `PreToolUse` deny on `gh pr create`
when frontend paths changed and the body has no media) are unskippable but
cover only the host that runs them and buy no token savings. Skill-side scripts
that author captions as data and emit a manifest keep pixels out of context
but only run when the skill is followed.

## Decision

Enforce inside the skill, with two shared scripts:

- `record-flow.mjs` takes a `flow.json` with per-step captions, drives real
  pointer events with the existing cursor overlay, draws the caption into
  every still and video frame, writes `captions.vtt`, and prints a manifest
  (paths, captions, bytes, sha256). The skill writes the PR body from the
  manifest and does not read the images.
- `pr-media-gate.mjs` runs on the body file before `gh pr create`. It reads
  git and the body only, and enforces two duties. Unconditionally: the body
  labels both a **Before** and an **After** — a bold run, a heading, or a
  `| Before | After |` table header, never the word inside a prose sentence.
  For frontend paths: hosted media is embedded. Exit 1 when either fails;
  exit 2 when it could not check. A stated `Still unverified:` or
  `No visual change:` line satisfies the media duty but never the comparison,
  so the gate stops omission rather than forcing fabricated proof.

No harness hook is added. Reopen that decision only when an eval shows agents
skipping media on frontend PRs despite the skill gate.

## Consequences

- Positive: annotated stills and video from one command, no vision tokens spent
  on captioning, a deterministic refusal before the PR exists
- Negative: PRs created outside `vs-ship-it` are not gated; the frontend path
  heuristic can misclassify (override with `--frontend <regex>`)
- Follow-up: static evals cover both scripts; a behavioral eval is the trigger
  for any future hook

## Alternatives considered

- `PreToolUse` hook denying `gh pr create`: rejected for now, see above
- Extending `check-visual-evidence.mjs`: rejected, it validates local report
  artifacts by file extension and knows nothing about git or hosted URLs
