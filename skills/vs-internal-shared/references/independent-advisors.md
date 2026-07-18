# Independent advisor fanout

Use this internal contract when a review benefits from a genuinely independent
model perspective. `vs-pushback` owns the public user intent; other review
skills may reuse this mechanism without exposing another user-facing skill.

## Flow contract

- **Inputs:** Decision under review, minimal evidence, risk signals, available
  advisor runtimes, and remaining child budget.
- **Outputs:** `ADVISORS_READY`, `PARTIAL`, or `SKIPPED`, plus bounded objections,
  material dissent, and skipped-advisor reasons.
- **Consumers:** `vs-pushback`, `vs-rfc-research`, `vs-roast-review`, and other
  risk-gated reviews.

## Risk gate

- **Routine:** Use no advisor when deterministic evidence settles the question.
- **Substantial:** Use one advisor for a public API or meaningful architecture,
  auth, security, persistence, migration, concurrency, or payment decision.
- **High-risk or disputed:** Use two advisors in parallel when the decision has
  high blast radius, the evidence supports competing conclusions, or the user
  explicitly asks for multiple models.

Two advisors require the shared deep child budget. If that budget is not
available, use one advisor and return `PARTIAL`; never exceed the budget.

## Independence and selection

Prefer a different model family over another instance of the parent model:

1. Existing host review command backed by another model.
2. An installed, non-interactive CLI such as `codex`, `claude`, or `gemini`.
3. One blind, fresh-context subagent as a fallback.

Check availability without triggering login or permission prompts. Multiple
same-model subagents are not a substitute for model diversity.

## Latency contract

- Dispatch during the caller's pre-scan and continue the parent review.
- Never delay Round 1 or another first user-visible response.
- Give the whole advisor batch one 45-second deadline from first dispatch.
- Collect completed results immediately before the verdict.
- Discard late results; do not retry them. Skip and disclose unavailable,
  unauthenticated, unsafe, or timed-out advisors.

## Prompt contract

Send only the decision, constraints, and minimal redacted context. Never send
credentials, secrets, broad private transcripts, or unrelated repository data.
Ask each advisor independently for:

1. The top three falsifiable objections.
2. Evidence supporting each objection or the evidence needed to test it.
3. Confidence from 0 to 100.
4. The smallest change that would resolve the strongest objection.

Do not show one advisor another advisor's answer.

## Synthesis

The parent verifies advisor claims against available evidence, records material
dissent, and owns the recommendation. Do not majority-vote. Unsupported or
duplicate objections are discarded rather than amplified by repetition.
