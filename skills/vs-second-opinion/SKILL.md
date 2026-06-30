---
name: vs-second-opinion
description: "Use when a plan, RFC, review, or risky change needs an independent advisor perspective from another model, tool, or reviewer."
metadata:
  verified: true
---

# Second Opinion

Get an independent perspective, then synthesize it without outsourcing the final
judgment. This atom is for disagreement and blind spots, not for ritual.

## Flow Contract

- **Level:** L2 phase tool
- **Inputs:** The concrete question, relevant plan/diff/RFC excerpt, preferred advisor if any, and what decision the opinion should inform
- **Outputs:** Advisor summary, agreements, disagreements, confidence, and final synthesized recommendation
- **Status:** `OPINION_READY`, `PARTIAL`, `SKIPPED_NO_ADVISOR`, or `BLOCKED`
- **Consumers:** `vs:pushback`, `vs:rfc-research`, `vs:roast-review`, high-risk `vs:build-it` reviews
- **Skip conditions:** Skip for routine local facts, cheap direct verification, or when no independent advisor/tool is available and the main agent can answer from evidence

## Advisor Selection

Prefer the most independent useful source available:

1. Existing host/model review command for the current runtime.
2. Local CLI advisor such as `codex`, `claude`, or `gemini` when installed.
3. Focused subagent with restricted context.
4. Manual internal second pass when no external advisor is available.

Do not leak secrets or large private transcripts into external CLIs. Redact
credentials and send only the minimum context needed.

## Procedure

1. State the decision the second opinion should influence.
2. Prepare a narrow prompt with evidence, constraints, and the exact question.
3. Run the advisor path if available.
4. Synthesize:
   - what the advisor agreed with
   - what it challenged
   - whether the challenge changes the plan
   - what you recommend after reconciling both views

## Output

```markdown
## Second Opinion

- Status: OPINION_READY | PARTIAL | SKIPPED_NO_ADVISOR | BLOCKED
- Advisor: <tool/model/subagent/manual>
- Question: <decision being tested>
- Agrees:
  - ...
- Challenges:
  - ...
- Synthesis:
  - <what changes, if anything>
```

## Workflow

**Prev:** `/vs-pushback`, `/vs-rfc-research`, `/vs-roast-review`, risky implementation
**Next:** revise plan, `/vs-verify`, `/vs-build-it`, or `/vs-ship-it`
