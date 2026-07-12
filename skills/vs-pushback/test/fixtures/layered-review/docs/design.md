# Layered code-review pipeline

## Goal

Automate code review for creator-kit skills so every PR gets a consistent quality pass.

## Proposed architecture

Three skills, run in sequence:

1. **ck-utility-code-review** — scans the diff and writes a `review-report.json`
   with findings (severity, file, line, description). It does NOT change any code.
2. **ck-review-report** — reads `review-report.json` and renders a human-readable
   markdown summary for the PR thread.
3. **ck-apply-review** — reads `review-report.json` again and applies the fixes.

The `review-report.json` artifact is the contract passed between the three skills.

## Rationale

- Separating "find" from "fix" keeps each skill single-purpose.
- The report artifact means the review can be inspected before anything is applied.
- Each skill is independently installable as its own plugin.

## Open questions

- Where does `review-report.json` live between runs?
- What happens if the diff changes between the review step and the apply step?
- Do all three skills need to ship separately, or is that just how it grew?
