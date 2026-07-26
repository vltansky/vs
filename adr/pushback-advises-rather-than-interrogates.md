# Pushback advises rather than interrogates

Date: 2026-07-26

Refines `merge-independent-opinions-into-pushback.md` and
`replace-grill-me-with-pushback-and-domain-model.md`; both remain in force.

## Context

`vs-pushback` made the question its unit of work. Its flow was pre-scan, open
with Round 1, grill in rounds, report — so every dimension became a question,
and every question carried the same ballot: `A) Accept recommendation
B) Defend current plan C) Modify D) Skip`.

Real sessions show what that produces. In a face-grouping review the skill asked
the user *"Where should face indexing run?"* and *"How should fragment merging
work, given 31 candidate pairs at centroid >= 0.55?"* — engineering mechanics it
could have settled from the code and the data. The user's reported experience
was that pushback "asks weird questions" and "treats the user like he knows
everything."

The same skill's best run did the opposite: asked to test three grouping
theories, it computed against all 1265 production embeddings, found that
clustering was already correct for real attendees and that singletons were
unusable tiny faces rather than fragments, and reshaped the plan before any code
was written. That run advised. The difference was not effort — it was whether
the skill resolved facts itself or handed them back.

Survey of public prior art (mattpocock/skills `grilling`,
anthropics/claude-plugins-official `code-review`, obra/superpowers reviewers,
EveryInc/compound-engineering-plugin, simota/agent-skills `riff`,
bradygaster/squad, MADEVAL/Pre-Mortem-Skill) found that no strong reviewer runs
multiple-choice interrogation rounds. They investigate, score their own
confidence, filter, and hand the user a decision surface.

Three specific gaps stood out. There was no confidence dimension, so every
finding became a question regardless of how sure the reviewer was. There was no
false-positive catalog, so nothing told the model what to leave out. And a
strong defense earned `+2` on the score, which is the author grading their own
plan.

An audit of 24 saved reports and 13 sessions quantified the damage:

- **Roughly one strategic question for every four mechanics questions.** The
  skill's own rule already assigned mechanics to the model; the flow overrode it.
- **The ballot was never used.** Across 16+ option blocks, `B`/`C`/`D` were
  selected zero times. Every reply was `A`, a bare accept, or a free-text
  override — including three consecutive turns of literally `A`, `A`, `A` one
  minute apart. The user's own verdict was "i dont like the questions", after
  which he abandoned a grill mid-Round-2.
- **The protocol degraded into theater.** One Codex session emitted
  `Round 1 of 2 — Q1-Q3` in a 325-character message that contained no questions,
  declared two dimensions "well-defended" off a single unprompted user sentence,
  answered its own Round 2 with no intervening user turn, and saved a report
  listing five `User Decisions` at 82/100.
- **Scores encoded participation, not plan quality.** Every run where the user
  was present scored 66-91 (in practice 72-84); every sub-60 was a
  non-interactive eval or delegated review. Nothing landed between 59 and 65.
  Bare `[High -> resolved]` downgrades inside a single session propped up four
  of the high scores.

## Decision

The unit of work in `vs-pushback` is a **finding**, not a question.

- **Facts are the reviewer's, decisions are the user's.** A question that a
  `grep`, a benchmark, or a search would have answered is a defect in the
  review. Mechanics — sequencing, wording, defaults, thresholds — are the
  reviewer's to choose and state.
- **Anchored confidence gates output.** Findings are scored on behavioral
  anchors `0/25/50/75/100`. `0-25` is dropped silently, `50` surfaces as
  non-blocking FYI, `75-100` is actionable and is all that moves the score.
  Premise and strategy findings cap at `50-75` by nature and are not filtered
  out for lacking proof they could never have.
- **A false-positive catalog says what not to raise**, including objections
  invented to fill a dimension. At least one finding on a substantial plan must
  be a mundane failure mode rather than an exotic one.
- **Steelman before attacking.** The flow is Investigate, Steelman, Take a
  position, Ask only what is left, Report.
- **The author's rationale is a claim, not evidence.** A defense that supplies a
  fact is evidence and re-opens the finding; a defense that supplies only
  reasoning changes nothing. The `+2` strong-defense bonus is removed.
- **Questions must earn their place.** Zero to three per review, zero being a
  normal outcome. `Defend current plan` and `Skip` are banned as options;
  options are competing designs, scopes, or tradeoffs.
- **A plan is allowed to pass.** When nothing clears the filter above FYI, the
  report says so. Every report ends with a Gap Check naming a failure category
  the review probably did not explore well.
- **The record must be real.** Never print a round header without the questions
  it announces, never answer your own round, and never record a `User Decision`
  the user did not make. Retiring a finding requires naming the fact that
  retired it — `[High -> resolved: <fact>]`, never a bare `resolved`.
- **Score the plan, not the conversation.** An engaged user is not evidence. A
  plan with a real unresolved blocker belongs below 60 however responsive its
  author was.

Unresolvable uncertainty is returned as a decisive fact plus the cheapest
experiment that would settle it, not as a question.

`vs-shape-it` now always ends its independent beat by running pushback in
composed (non-interactive) mode over the finished design, and always considers
an external research flow. See
`shape-it-always-stress-tests-and-researches.md`.

## Consequences

- Reviews cost more investigation up front and fewer user round-trips.
- Question count stops being a proxy for rigor; `pushback.eval.ts` now grades
  advisor posture and bans the ballot instead of rewarding `asks-in-rounds`.
- Score distribution should widen: FYI findings no longer drag the number, and
  confident defenses no longer inflate it.
- A confidently-argued weak plan scores lower than it used to. This is intended.
- Risk: the confidence filter can suppress a real concern the reviewer failed to
  verify. Mitigated by the `50` FYI tier and the Gap Check, which force partial
  knowledge to surface rather than vanish.
- Risk: a reviewer that asks nothing can miss user intent it never had. Mitigated
  by keeping intent, priorities, and risk appetite explicitly on the user's side
  of the line.

## Alternatives considered

- **Cap the number of questions.** Rejected. mattpocock/skills rejected the same
  cap after "Codex just asked me 200 questions", on the grounds that redundant
  questions are a prompt-quality problem and "the fix for the latter belongs in
  the skill prompt, not in a counter." Raising the bar for what earns a question
  addresses the cause.
- **Continuous 0.0-1.0 confidence scores.** Rejected.
  EveryInc/compound-engineering-plugin measured personas clustering at
  0.65-0.72 without genuinely differentiating them — false precision. Discrete
  behavioral anchors are calibratable.
- **Filter findings at >= 80 like Anthropic's code review.** Rejected for plan
  review, following EveryInc's reasoning that premise claims have a natural
  confidence ceiling and an 80 gate silences exactly the dimension pushback
  exists to cover.
- **Drop questions entirely and emit a report.** Rejected. Intent and risk
  appetite are genuinely in the user's head, and pushback is invoked
  interactively by a human who is present.
- **Keep the ballot but improve the wording.** Rejected. The `Defend` option
  structurally invites the self-grading that the evidence rule forbids, and
  `Skip` on a finding the reviewer believes is real is incoherent.
