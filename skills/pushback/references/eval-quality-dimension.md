# Eval Quality dimension

Run this dimension **only** when the plan involves authoring or changing an evaluation that measures non-deterministic behavior — LLM output, agent actions, human judgment via rubric, or any benchmark that scores quality rather than correctness.

## Detection signals

Any one of these is enough:

- Plan mentions writing, changing, or "proving with" an eval / benchmark / score
- A test or eval file is in scope (staged, touched, or referenced) that exercises LLM/agent behavior rather than pure code
- Plan mentions scorers, rubrics, fixtures, judges, human raters, or grading criteria
- User said "only with proofs", "eval-driven", or otherwise treats the eval's pass as the validation signal

If none apply, skip silently. Do **not** let absence reduce the overall score — recompute over dimensions that ran. Deterministic unit tests and integration tests are not evals in this sense; they fall under Feasibility / Maintainability.

## Anti-patterns to grill

Framework-agnostic — substitute the specific terms from whatever eval framework is in use.

### Scorer and assertion integrity

1. **Scorer theater** — Do the assertions test *what the agent did* (real tool calls, files written, commands run, state changes) or just *what the agent said* (transcript regex, phrase mentions)? A scorer that passes when the agent says "I will read X" without reading X rewards narration.

2. **Tautology** — Does the thing under test MANDATE the exact strings or structure the scorers look for? If the skill/prompt says "output X" and the scorer checks "does output contain X", the eval measures compliance, not behavior. Compliance passes tell you the instruction was followed, not that the behavior is correct.

3. **Loose anti-trap matching** — When a scorer negates a trapped outcome (e.g., "did NOT recommend X"), does it handle the same content expressed in different wrappers (markdown formatting, synonyms, sentence reordering)? Tight anti-trap regexes pass when the model rephrases.

### LLM judge hygiene (when any LLM-as-judge is used)

4. **Answer-key contamination** — Does the judge rubric context include the correct answer or expected verdict? If yes, the judge is doing match-against-answer, not reasoning evaluation. Pass only fixture facts, not the verdict.

5. **Known judge biases** — Is the judge exposed to position bias (prefers option A in pairwise ~70% of the time — mitigate by swapping and averaging), verbosity bias (prefers longer answers even without added information), or self-enhancement bias (~10-25% win-rate inflation when judging output from the same model family)? Each applicable bias needs a named mitigation.

6. **Judge calibration** — Does the judge have a calibration set: a small set of human-labeled inputs with known-good and known-bad outputs, measuring judge-human agreement (Cohen's kappa, not raw accuracy)? Judges often hit 95% on easy passes but only 30-60% recall on defects. Without a calibration set, you don't know if the judge is catching failures or rubber-stamping.

7. **Rubric shape** — Default to binary pass/fail per dimension (enables precision/recall math). Require reasoning-before-verdict (the judge explains *why* before scoring — this outperforms score-then-explain). Avoid aggregate Likert rubrics (a single 1-10 score across multiple criteria smears dimensions together).

### Fixture and dataset design

8. **Non-adversarial fixture** — Would a naive agent trivially pass? An eval without a designed trap doesn't distinguish good behavior from default behavior. Every fixture should have at least one "easy wrong answer" that the scorers penalize.

9. **Missing slice coverage** — Does the eval report per-slice results (input type, difficulty tier, edge-case class), or just one aggregate score? A 92% aggregate with one slice at 40% is a ship-blocker, not a pass. Flag any slice where n is too small for a meaningful confidence interval.

10. **Unsafe fixture values** — If the fixture contains fake credentials, plausible PII, or injection-shaped strings, do any match real secret-scanner regexes, look like real customer data, or trip content filters? Committed fixtures are real artifacts with real downstream effects.

### Statistical rigor

11. **Insufficient sampling** — Is the eval run once per gate, or does the plan include distribution verification (multiple trials, report variance)? One run on any stochastic system is noise. Report mean +/- confidence interval. When examples share structure (same doc, same user, same passage), cluster standard errors on the unit of randomization — naive SE can understate error by 3x. When comparing two model versions on the same fixture, use paired-difference tests for free variance reduction.

12. **Goodhart / eval overfitting** — Nothing prevents optimizing *against* the eval. Does the plan include a held-out slice that is never shown during prompt iteration? Watch for the "prompt patching" pattern: expanding the prompt with special cases for eval items while real-world quality stays flat or drops. Track eval-set-size growth vs. production quality delta.

## Scoring

- Each anti-pattern found is a separate finding — severity depends on how load-bearing the compromised scorer is to the overall verdict
- An eval passes Eval Quality when no anti-pattern is unresolved and at least one assertion checks real behavior (tool events, observable side effects, or framework-native equivalents), not just transcript text
- The judge hygiene cluster (items 4-7) is a single high-severity finding if *any* sub-item is unresolved and an LLM judge is used
